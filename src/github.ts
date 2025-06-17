import * as core from "@actions/core";
import { context, getOctokit } from "@actions/github";
import type { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";
import { RequestError } from "@octokit/request-error";
import type { PullRequestEvent } from "@octokit/webhooks-types";
import type { Platform } from "./index.ts";

export default async function github({
	username = "github-actions[bot]",
	email = "41898282+github-actions[bot]@users.noreply.github.com",
	base = "main",
}: {
	username?: string;
	email?: string;
	/** Base branch. Defaults to `main`. */
	base?: string;
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

			const marker = "<!--🦜-->";
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
		async upsertReleasePr(branch: string, title: string, body: string) {
			const { data: pulls } = await octokit.rest.pulls.list({
				...context.repo,
				base,
				head: `${context.repo.owner}:${branch}`,
				state: "open",
			});

			if (pulls.length > 0) {
				await octokit.rest.pulls.update({
					...context.repo,
					pull_number: pulls[0].number,
					title,
					body,
				});
			} else {
				await octokit.rest.pulls.create({
					...context.repo,
					base,
					head: branch,
					title,
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
			} catch (error) {
				if (!(error instanceof RequestError) || error.status !== 422) throw error;
				// Release already exists
			}
		},
	};
}
