import type { CommandWithConfig } from "../bin.ts";
import { processChangelog } from "../changelog.ts";

export default async function commentPr({ config, dir }: CommandWithConfig) {
	const changelogEntries = await config.platform.getChangelogEntries(dir);
	const bumps = await processChangelog(changelogEntries);

	console.log("files:", changelogEntries);

	const filename = `${dir}/${Buffer.from(crypto.getRandomValues(new Uint8Array(6))).toString("base64url")}.md`;
	const frontmatter = "---\n# Describe desired version bumps as package: major|minor|patch\n\n---";

	const body = `## 🦜 Chachalog

${bumps.size ? "" : "No changelog entries detected"}
${[...bumps].map(([key, value]) => `- ${key}: ${value.bump}`).join("\n")}

[Create a new entry](${await config.platform.createChangelogEntryLink(filename, frontmatter)})`;

	await config.platform.upsertChangelogComment(body);
}
