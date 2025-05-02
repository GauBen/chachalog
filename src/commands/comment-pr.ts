import path from "node:path";
import { UsageError } from "clipanion";
import type { RootContent } from "mdast";
import { remark } from "remark";
import * as yaml from "yaml";
import pkg from "../../package.json" with { type: "json" };
import type { CommandWithConfig } from "../bin.ts";
import { processEntries } from "../changelog/process.ts";
import { writeChangelog } from "../changelog/write.ts";
import { ReleaseTypes } from "../index.ts";

export const sentenceCase = (s: string) => s && s[0].toUpperCase() + s.slice(1);
export const suggestBump = (title: string, allowedBumps: readonly ReleaseTypes[]) => {
	const [, type, breaking, message] = title.match(/^(\w+).*?(!)?:([\s\S]*)/) ?? [];
	return {
		bump:
			ReleaseTypes.slice(breaking ? 0 : type === "feat" ? 2 : 4).find((bump) =>
				allowedBumps.includes(bump),
			) ?? allowedBumps[0],
		message: sentenceCase((message ?? title).trim()),
	};
};

export const suggestEntry = (
	{ bump, message }: { bump: string; message: string },
	packages: Array<{ name: string; changed: boolean }>,
	allowedBumps: readonly ReleaseTypes[],
) => {
	return `---\n# Allowed version bumps: ${allowedBumps.join(", ")}\n${packages
		.map(({ name, changed }) => {
			const line = yaml.stringify({ [name]: bump });
			if (changed) return line;
			return `# ${line}`;
		})
		.join("")}---\n\n${message}`;
};

export default async function commentPr({ config, dir }: CommandWithConfig) {
	try {
		const packagePaths = config.packages
			.map<[string, string]>((p) => [path.relative(process.cwd(), p.path), p.name])
			.sort((a, z) => z[0].length - a[0].length);

		const { title, entries, changedPackages } = await config.platform.getChangelogEntries(
			dir,
			packagePaths,
		);
		const packages = config.packages.map(({ name }) => ({
			name,
			changed: changedPackages.has(name),
		}));

		const filename = `${dir}/${Buffer.from(crypto.getRandomValues(new Uint8Array(6))).toString("base64url")}.md`;
		const suggestion = suggestBump(title, config.allowedBumps);
		const content = suggestEntry(suggestion, packages, config.allowedBumps);

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
								children: [
									{ type: "text", value: "No changelog entries detected. " },
									{
										type: "link",
										url: "https://github.com/GauBen/chachalog#readme",
										children: [{ type: "text", value: "Learn more about Chachalog." }],
									},
								],
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
