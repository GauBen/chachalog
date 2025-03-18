import { UsageError } from "clipanion";
import type { CommandWithConfig } from "../bin.ts";
import { processEntries } from "../changelog/process.ts";

export default async function commentPr({ config, dir }: CommandWithConfig) {
	try {
		const changelogEntries = await config.platform.getChangelogEntries(dir);
		const bumps = await processEntries(changelogEntries, config.validator);

		const filename = `${dir}/${Buffer.from(crypto.getRandomValues(new Uint8Array(6))).toString("base64url")}.md`;
		const frontmatter =
			"---\n# Describe desired version bumps as package: major|minor|patch\n\n---";

		const body = `## 🦜 Chachalog

${bumps.size ? "" : "No changelog entries detected"}
${[...bumps].map(([key, value]) => `- ${key}: ${value.bump}`).join("\n")}

[Create a new entry](${await config.platform.createChangelogEntryLink(filename, frontmatter)})`;

		await config.platform.upsertChangelogComment(body);
	} catch (error) {
		await config.platform.upsertChangelogComment(`## 🦜 Chachalog

Something went: ${(error as Error).message}

Check the logs for more details.`);
		throw new UsageError((error as Error).message);
	}
}
