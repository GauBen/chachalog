import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import * as core from "@actions/core";
import { context, getOctokit } from "@actions/github";
import type { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";
import { RequestError } from "@octokit/request-error";
import type { PullRequestEvent } from "@octokit/webhooks-types";
import type { Platform, Releases } from "./index.ts";

const git = (...args: string[]) =>
  execFileSync("git", args, { stdio: ["ignore", "pipe", "inherit"], encoding: "utf-8" });

const marker = "<!--🦜-->";

export const ReleaseMessage = {
  /** `chore: release pkg @ v1.2.3` or `chore: release X packages` */
  SMART: (releases) => {
    if (releases.length === 0) return "chore: release";

    if (releases.length === 1)
      return `chore: release ${releases[0].name} @ v${releases[0].to} (${releases[0].bump})`;

    return (
      `chore: release ${releases.length} packages\n` +
      releases.map(({ name, from, to, bump }) => `- ${name} ${from} → ${to} (${bump})`).join("\n")
    );
  },
} satisfies Record<string, (releases: Releases) => string>;

export default async function github({
  username = "github-actions[bot]",
  email = "41898282+github-actions[bot]@users.noreply.github.com",
  base: baseFn = (branch) => branch,
  releaseBranch: releaseBranchFn = (branch) =>
    branch === "main" || branch === "master" ? "release" : `release/${branch}`,
  releaseMessage: releaseMessageFn = ReleaseMessage.SMART,
}: {
  /** Account used to author comments. @default "github-actions[bot]" */
  username?: string;
  /**
   * Email of the account used to author comments.
   *
   * @default "41898282+github-actions[bot]@users.noreply.github.com"
   */
  email?: string;
  /** Base branch. @default (branch) => branch */
  base?: string | ((branch: string) => string);
  /**
   * Branch to use to create release PRs.
   *
   * @default (branch) => branch === "main" || branch === "master" ? "release" : `release/${branch}`
   */
  releaseBranch?: string | ((branch: string) => string);
  /** Commit message to use when creating a release. @default "chore: release" */
  releaseMessage?: string | ((releases: Releases) => string);
} = {}): Promise<Platform> {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error(
      "GITHUB_TOKEN is not set.\nDid you forget to add `env: { GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}' }` to your workflow?",
    );
  }

  const octokit = getOctokit(token);

  return {
    username,
    email,
    async createChangelogEntryLink(filename: string, content: string) {
      const { pull_request: pr } = context.payload as PullRequestEvent;

      const url = new URL(`new/${pr.head.ref}`, `${(pr.head.repo ?? pr.base.repo).html_url}/`);
      url.searchParams.set("filename", filename);
      url.searchParams.set("value", content);

      return url.toString();
    },
    async upsertChangelogComment(body: string) {
      const { pull_request: pr } = context.payload as PullRequestEvent;

      const comments = await octokit.rest.issues.listComments({
        ...context.repo,
        issue_number: pr.number,
      });
      const comment = comments.data.find(
        (comment) => comment.user?.login === username && comment.body?.includes(marker),
      );

      if (comment) {
        await octokit.rest.issues.updateComment({
          ...context.repo,
          comment_id: comment.id,
          body: `${body}\n${marker}`,
        });
      } else {
        await octokit.rest.issues.createComment({
          ...context.repo,
          issue_number: pr.number,
          body: `${body}\n${marker}`,
        });
      }
    },
    async deleteChangelogComment() {
      const { pull_request: pr } = context.payload as PullRequestEvent;

      const comments = await octokit.rest.issues.listComments({
        ...context.repo,
        issue_number: pr.number,
      });
      const comment = comments.data.find(
        (comment) => comment.user?.login === username && comment.body?.includes(marker),
      );

      if (comment) {
        await octokit.rest.issues.deleteComment({
          ...context.repo,
          comment_id: comment.id,
        });
      }
    },
    async getChangelogEntries(dir: string, packagePaths: Array<[string, string]>) {
      const { pull_request: pr } = context.payload as PullRequestEvent;

      if (!pr.head.repo) throw new Error("Pull request does not have a head repository.");

      const title = `${pr.title} (#${pr.number})`;

      const changedPackages = new Set<string>();
      const unchangedPackages = new Map(packagePaths);
      const changelogEntries: RestEndpointMethodTypes["pulls"]["listFiles"]["response"]["data"] =
        [];
      const per_page = 100;

      for (let page = 1; page * per_page < 3000; page++) {
        const files = await octokit.rest.pulls.listFiles({
          ...context.repo,
          pull_number: pr.number,
          per_page,
          page,
        });

        for (const file of files.data) {
          if (file.filename.startsWith(dir)) {
            // Only consider additions to changelog entries
            if (
              ["added", "modified", "renamed", "copied", "changed"].includes(file.status) &&
              file.filename.endsWith(".md")
            )
              changelogEntries.push(file);

            // Ignore all other changes in the chachalog directory
            continue;
          }

          for (const [path, name] of unchangedPackages) {
            if (file.filename.startsWith(path)) {
              changedPackages.add(name);
              unchangedPackages.delete(path);
            }
          }
        }

        if (files.data.length < per_page) break;
      }

      const entries = new Map<string, string>();

      core.setOutput("changelogEntries", changelogEntries.length);

      for (const { filename } of changelogEntries) {
        const { data: contents } = await octokit.rest.repos.getContent({
          // Load files from the head repo, not the base repo
          owner: pr.head.repo.owner.login,
          repo: pr.head.repo.name,
          path: filename,
          ref: pr.head.ref,
          mediaType: { format: "raw" },
        });
        if (typeof contents !== "string")
          throw new Error(`Expected ${filename} to be a file, but got ${typeof contents}`);
        entries.set(filename, contents);
      }

      return { title, entries, changedPackages };
    },
    async upsertReleasePr(body, releases = []) {
      git("add", ".");
      const changes = git(
        "diff-index",
        "--cached",
        "--name-status",
        "--no-renames", // Guarantees two fields per change instead of three
        "-z", // NUL-separated output
        "HEAD",
      ).split("\0");

      // `GITHUB_REF_NAME` is not yet available in `context`
      const refName = context.ref.replace(/^refs\/heads\//, "");
      const base = typeof baseFn === "string" ? baseFn : baseFn(refName);
      const releaseBranch =
        typeof releaseBranchFn === "string" ? releaseBranchFn : releaseBranchFn(refName);

      const additions: Array<{ path: string; contents: string }> = [];
      const deletions: Array<{ path: string }> = [];
      for (let i = 0; i + 1 < changes.length; i += 2) {
        const [status, path] = [changes[i], changes[i + 1]];
        if (status === "D") {
          deletions.push({ path });
        } else {
          additions.push({
            path,
            contents: await fs.readFile(path, "base64"),
          });
        }
      }

      if (additions.length === 0 && deletions.length === 0) {
        core.warning("No changes to release, skipping release pull request.");
        return;
      }

      // Create a signed commit on a temporary branch to prevent the release PR
      // from being closed by GitHub after resetting the release branch
      const tmpBranch = `refs/heads/chachalog-tmp-${releaseBranch}`;
      git("push", "--force", "origin", `${context.sha}:${tmpBranch}`);

      const releaseMessage =
        typeof releaseMessageFn === "string" ? releaseMessageFn : releaseMessageFn(releases);

      const [headline, ...rest] = releaseMessage.split("\n");
      try {
        const { createCommitOnBranch } = await octokit.graphql<{
          createCommitOnBranch: { commit: { oid: string } };
        }>(
          `
            mutation ($input: CreateCommitOnBranchInput!) {
              createCommitOnBranch(input: $input) {
                commit {
                  oid
                }
              }
            }
          `,
          {
            input: {
              branch: {
                repositoryNameWithOwner: `${context.repo.owner}/${context.repo.repo}`,
                branchName: tmpBranch,
              },
              expectedHeadOid: context.sha,
              message: { headline, body: rest.join("\n") || undefined },
              fileChanges: { additions, deletions },
            },
          },
        );
        const signedCommit = createCommitOnBranch.commit.oid;

        // Fetch the commit and push it to the real release branch
        git("fetch", "origin", tmpBranch);
        git("push", "--force", "origin", `${signedCommit}:refs/heads/${releaseBranch}`);
      } finally {
        try {
          git("push", "--delete", "origin", tmpBranch);
        } catch (error) {
          core.warning(`Could not delete ${tmpBranch}: ${error}`);
        }
      }

      // Update the release PR body
      const { data: pulls } = await octokit.rest.pulls.list({
        ...context.repo,
        base,
        head: `${context.repo.owner}:${releaseBranch}`,
        state: "open",
      });

      if (pulls.length > 0) {
        await octokit.rest.pulls.update({
          ...context.repo,
          pull_number: pulls[0].number,
          title: headline,
          body,
        });
      } else {
        await octokit.rest.pulls.create({
          ...context.repo,
          base,
          head: releaseBranch,
          title: headline,
          body,
        });
      }
    },
    async createRelease(tag, title, body) {
      try {
        await octokit.rest.repos.createRelease({
          ...context.repo,
          tag_name: tag,
          name: title,
          body,
        });
        return true;
      } catch (error) {
        if (!(error instanceof RequestError) || error.status !== 422) throw error;
        return false; // Release already exists
      }
    },
    async reportReleasesCreated(packages: string[]) {
      core.setOutput("releases", packages.length);
      core.setOutput("releasedPackages", JSON.stringify(packages));
      for (const pkg of packages) core.setOutput(`released_${pkg}`, true);
    },
  };
}
