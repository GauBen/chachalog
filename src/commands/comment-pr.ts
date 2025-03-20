import path from "node:path";
import { UsageError } from "clipanion";
import type { RootContent } from "mdast";
import { remark } from "remark";
import type { CommandWithConfig } from "../bin.ts";
import { processEntries } from "../changelog/process.ts";
import { writeChangelog } from "../changelog/write.ts";
import * as yaml from "yaml";
import { ReleaseTypes } from "../index.ts";

export default async function commentPr({ config, dir }: CommandWithConfig) {
	try {
		const packagePaths = config.packages
			.map<[string, string]>((p) => [path.relative(process.cwd(), p.path), p.name])
			.sort((a, z) => z[0].length - a[0].length);

		const { title, entries, changedPackages } = await config.platform.getChangelogEntries(
			dir,
			packagePaths,
		);

		const conventionnalCommit = title.match(/^(\w+).*?(!)?:/);
		let suggestedBump = config.allowedBumps[0];
		if (conventionnalCommit?.[1]) {
			suggestedBump =
				ReleaseTypes.find((bump) => config.allowedBumps.includes(bump)) ?? suggestedBump;
		} else if (conventionnalCommit?.[0] === "feat") {
			suggestedBump =
				(["minor", "preminor"] as const).find((bump) =>
					(config.allowedBumps as string[]).includes(bump),
				) ?? suggestedBump;
		} else if (conventionnalCommit?.[0] === "fix") {
			suggestedBump =
				(["patch", "prepatch"] as const).find((bump) =>
					(config.allowedBumps as string[]).includes(bump),
				) ?? suggestedBump;
		}

		const filename = `${dir}/${Buffer.from(crypto.getRandomValues(new Uint8Array(6))).toString("base64url")}.md`;
		const frontmatter =
			changedPackages.length > 0
				? `---\n# Describe desired version bumps\n${yaml.stringify(
						Object.fromEntries(changedPackages.map((name) => [name, suggestedBump])),
					)}\n---`
				: "---\n# Describe desired version bumps\n\n---";

		const bumps = await processEntries(entries, config.validator);

		const body = remark().stringify({
			type: "root",
			children: [
				{ type: "heading", depth: 2, children: [{ type: "text", value: "🦜 Chachalog" }] },
				...((bumps.size > 0
					? [...bumps].flatMap<RootContent>(([key, value]) => [
							{
								type: "html",
								value: `<details><summary><code>${key}</code> ${value.bump}</summary>`,
							},
							{ type: "blockquote", children: writeChangelog(value) },
							{ type: "html", value: "</details>" },
						])
					: [
							{
								type: "paragraph",
								children: [{ type: "text", value: "No changelog entries detected" }],
							},
						]) satisfies RootContent[]),
				{
					type: "paragraph",
					children: [
						{
							type: "link",
							url: await config.platform.createChangelogEntryLink(filename, frontmatter),
							children: [{ type: "text", value: "Create a new entry" }],
						},
					],
				},
			],
		});

		await config.platform.upsertChangelogComment(body);
	} catch (error) {
		await config.platform.upsertChangelogComment(`## 🦜 Chachalog

Something went: ${(error as Error).message}

Check the logs for more details.`);
		throw new UsageError((error as Error).message);
	}
}
