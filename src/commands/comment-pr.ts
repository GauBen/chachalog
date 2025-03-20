import { UsageError } from "clipanion";
import type { RootContent } from "mdast";
import { remark } from "remark";
import type { CommandWithConfig } from "../bin.ts";
import { processEntries } from "../changelog/process.ts";
import { writeChangelog } from "../changelog/write.ts";

export default async function commentPr({ config, dir }: CommandWithConfig) {
	try {
		const changelogEntries = await config.platform.getChangelogEntries(dir);
		const bumps = await processEntries(changelogEntries, config.validator);

		const filename = `${dir}/${Buffer.from(crypto.getRandomValues(new Uint8Array(6))).toString("base64url")}.md`;
		const frontmatter =
			"---\n# Describe desired version bumps as package: major|minor|patch\n\n---";

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
