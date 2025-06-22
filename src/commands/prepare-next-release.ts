import fs from "node:fs/promises";
import path from "node:path";
import type { TopLevelContent } from "mdast";
import { remark } from "remark";
import semver from "semver";
import { globSync } from "tinyglobby";
import pkg from "../../package.json" with { type: "json" };
import { processEntries } from "../changelog/process.ts";
import { insertChangelog, writeChangelog } from "../changelog/write.ts";
import type { CommandWithConfig } from "../config.ts";

export default async function prepareNextRelease({
	config,
	dir,
	latestVersion,
}: CommandWithConfig) {
	const files = new Map<string, string>();
	for (const name of globSync("*.md", { cwd: dir })) {
		const file = path.join(dir, name);
		const content = await fs.readFile(file, "utf-8");
		files.set(file, content);
		await fs.rm(file);
	}
	const changelogEntries = await processEntries(
		files,
		config.packages.map((pkg) => pkg.name),
		config.validator,
	);

	if (changelogEntries.size === 0) return;

	const body: TopLevelContent[] = [
		{
			type: "heading",
			depth: 2,
			children: [
				{ type: "link", url: pkg.homepage, children: [{ type: "text", value: "🦜" }] },
				{ type: "text", value: " Chachalog" },
			],
		},
		{
			type: "paragraph",
			children: [{ type: "text", value: "This PR will bump the following packages:" }],
		},
	];
	for (const pkg of config.packages) {
		const changelogEntry = changelogEntries.get(pkg.name);
		if (!changelogEntry) continue;

		const version = semver.inc(
			pkg.version,
			changelogEntry.bump,
			config.prereleaseIdentifier,
			config.prereleaseIdentifierBase,
		);
		if (!version) throw new Error("bump failed");
		await config.setVersion(pkg, version);

		const changelogFile = await config.getChangelogFile(pkg);
		const original = await fs.readFile(changelogFile, "utf-8").catch((error) => {
			if (error.code === "ENOENT") return config.getNewChangelog(pkg);
			throw error;
		});

		const children = writeChangelog(changelogEntry, config.bumpTitles);

		const updated = insertChangelog(original, version, children);
		await fs.writeFile(changelogFile, updated);

		body.push(
			{ type: "html", value: `<details><summary><code>${pkg.name}</code> ${version}</summary>` },
			{ type: "blockquote", children },
			{ type: "html", value: "</details>" },
		);
	}

	const nextVersion = await latestVersion;
	if (nextVersion) {
		body.push({
			type: "paragraph",
			children: [
				{
					type: "text",
					value: `Chachalog ${nextVersion} is available, you are running chachalog ${pkg.version}`,
				},
			],
		});
	}

	await config.platform.upsertReleasePr(remark().stringify({ type: "root", children: body }));
}
