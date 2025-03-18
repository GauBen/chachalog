import fs from "node:fs";
import { context, getOctokit } from "@actions/github";
import type { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";
import { RequestError } from "@octokit/request-error";
import type { Platform } from "./index.ts";

export default async function github({
	username = "github-actions[bot]",
	email = "41898282+github-actions[bot]@users.noreply.github.com",
}: { username?: string; email?: string } = {}): Promise<Platform> {
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
		async createChangelogEntryLink(filename: string, frontmatter: string) {
			const { data: pr } = await octokit.rest.pulls.get({
				owner: context.repo.owner,
				repo: context.repo.repo,
				pull_number: context.issue.number,
			});

			const url = new URL(`new/${pr.head.ref}`, `${(pr.head.repo ?? pr.base.repo).html_url}/`);
			url.searchParams.set("filename", filename);
			url.searchParams.set("value", `${frontmatter}\n\n${pr.title} (#${pr.number})`);

			return url.toString();
		},
		async upsertChangelogComment(body: string) {
			const marker = "<!--🦜-->";
			const comments = await octokit.rest.issues.listComments({
				owner: context.repo.owner,
				repo: context.repo.repo,
				issue_number: context.issue.number,
			});
			const comment = comments.data.find(
				(comment) => comment.user?.login === username && comment.body?.includes(marker),
			);

			if (comment) {
				await octokit.rest.issues.updateComment({
					owner: context.repo.owner,
					repo: context.repo.repo,
					comment_id: comment.id,
					body: `${body}\n${marker}`,
				});
			} else {
				await octokit.rest.issues.createComment({
					owner: context.repo.owner,
					repo: context.repo.repo,
					issue_number: context.issue.number,
					body: `${body}\n${marker}`,
				});
			}
		},
		async getChangelogEntries(dir: string) {
			const changelogEntries: RestEndpointMethodTypes["pulls"]["listFiles"]["response"]["data"] =
				[];
			const per_page = 100;

			for (let page = 1; page * per_page < 3000; page++) {
				const files = await octokit.rest.pulls.listFiles({
					owner: context.repo.owner,
					repo: context.repo.repo,
					pull_number: context.issue.number,
					per_page,
					page,
				});

				for (const file of files.data) {
					// Only consider additions to changelog entries
					if (!["added", "modified", "renamed", "copied", "changed"].includes(file.status))
						continue;
					if (!file.filename.startsWith(dir) || !file.filename.endsWith(".md")) continue;
					changelogEntries.push(file);
				}

				if (files.data.length < per_page) break;
			}

			const files = new Map<string, string>();

			for (const { filename } of changelogEntries) {
				const contents = fs.readFileSync(filename, "utf-8");
				files.set(filename, contents);
			}

			return files;
		},
		async upsertReleasePr(title: string, body: string) {
			const { data: pulls } = await octokit.rest.pulls.list({
				owner: context.repo.owner,
				repo: context.repo.repo,
				base: "main",
				head: "release",
				state: "open",
			});

			if (pulls.length > 0) {
				await octokit.rest.pulls.update({
					owner: context.repo.owner,
					repo: context.repo.repo,
					pull_number: pulls[0].number,
					title,
					body,
				});
			} else {
				await octokit.rest.pulls.create({
					owner: context.repo.owner,
					repo: context.repo.repo,
					base: "main",
					head: "release",
					title,
					body,
				});
			}
		},
		async createRelease(tag, title, body) {
			try {
				await octokit.rest.repos.createRelease({
					owner: context.repo.owner,
					repo: context.repo.repo,
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
