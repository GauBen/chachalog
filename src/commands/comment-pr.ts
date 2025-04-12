import path from "node:path";
import { UsageError } from "clipanion";
import type { RootContent } from "mdast";
import { remark } from "remark";
import * as yaml from "yaml";
import type { CommandWithConfig } from "../bin.ts";
import { processEntries } from "../changelog/process.ts";
import { writeChangelog } from "../changelog/write.ts";
import { ReleaseTypes } from "../index.ts";
import pkg from "../../package.json" with { type: "json" };

const sentenceCase = (s: string) => s && s[0].toUpperCase() + s.slice(1);

export default async function commentPr({ config, dir }: CommandWithConfig) {
	try {
		const packagePaths = config.packages
			.map<[string, string]>((p) => [path.relative(process.cwd(), p.path), p.name])
			.sort((a, z) => z[0].length - a[0].length);

		const { title, entries, changedPackages } = await config.platform.getChangelogEntries(
			dir,
			packagePaths,
		);

		const conventionnalCommit = title.match(/^(\w+).*?(!)?:([\s\S]*)/);
		const suggestedBump =
			ReleaseTypes.slice(
				conventionnalCommit?.[2]
					? 0
					: conventionnalCommit?.[1] === "feat"
						? 2
						: conventionnalCommit?.[1] === "fix"
							? 4
							: 0,
			).find((bump) => config.allowedBumps.includes(bump)) ?? config.allowedBumps[0];

		const filename = `${dir}/${Buffer.from(crypto.getRandomValues(new Uint8Array(6))).toString("base64url")}.md`;
		const content = `---\n# Describe desired version bumps\n${
			changedPackages.length > 0
				? yaml.stringify(Object.fromEntries(changedPackages.map((name) => [name, suggestedBump])))
				: "\n"
		}---\n\n${sentenceCase((conventionnalCommit?.[3] ?? title).trim())}`;

		const bumps = await processEntries(entries, config.validator);
		const url = await config.platform.createChangelogEntryLink(filename, content);

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
							{ type: "blockquote", children: writeChangelog(value, config.bumpTitles) },
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
							url,
							children: [{ type: "text", value: "Create a new entry online" }],
						},
						{
							type: "text",
							value: " or run ",
						},
						{
							type: "inlineCode",
							value: `npx chachalog@${pkg.version} prompt`,
						},
						{
							type: "text",
							value: " to create a new entry locally.",
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
