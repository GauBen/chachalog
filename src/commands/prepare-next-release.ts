import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import semver from "semver";
import { globSync } from "tinyglobby";
import type { CommandWithConfig } from "../bin.ts";
import { processEntries } from "../changelog/process.ts";
import { insertChangelog, writeChangelog } from "../changelog/write.ts";
import type { TopLevelContent } from "mdast";
import { remark } from "remark";

export default async function prepareNextRelease({ config, dir, skipCommit }: CommandWithConfig) {
	const files = new Map<string, string>();
	for (const name of globSync("*.md", { cwd: dir })) {
		const file = path.join(dir, name);
		const content = await fs.readFile(file, "utf-8");
		files.set(file, content);
		await fs.rm(file);
	}
	const changelogEntries = await processEntries(files, config.validator);

	if (changelogEntries.size === 0) return;

	const body: TopLevelContent[] = [
		{ type: "heading", depth: 2, children: [{ type: "text", value: "🦜 Chachalog" }] },
		{
			type: "paragraph",
			children: [{ type: "text", value: "This PR will bump the following packages:" }],
		},
	];
	for (const pkg of config.packages) {
		const changelogEntry = changelogEntries.get(pkg.name);
		if (!changelogEntry) continue;

		const version = semver.inc(pkg.version, changelogEntry.bump);
		if (!version) throw new Error("bump failed");
		await config.setVersion(pkg, version);

		const changelogFile = await config.getChangelogFile(pkg);
		const original = await fs.readFile(changelogFile, "utf-8").catch((error) => {
			if (error.code === "ENOENT") return config.getNewChangelog(pkg);
			throw error;
		});

		const updated = insertChangelog(original, version, changelogEntry, config.bumpTitles);
		await fs.writeFile(changelogFile, updated);

		body.push(
			{ type: "html", value: `<details><summary><code>${pkg.name}</code> ${version}</summary>` },
			{ type: "blockquote", children: writeChangelog(changelogEntry, config.bumpTitles) },
			{ type: "html", value: "</details>" },
		);
	}

	if (skipCommit) return;

	const git = (...args: string[]) =>
		execFileSync("git", args, { stdio: "inherit", encoding: "utf-8" });

	git("config", "user.name", config.platform.username);
	git("config", "user.email", config.platform.email);
	git("switch", "-c", "release");
	git("add", ".");
	git("commit", "-m", config.releaseMessage);
	git("push", "--force", "origin", "release");

	await config.platform.upsertReleasePr(
		config.releaseBranch,
		config.releaseMessage,
		remark().stringify({ type: "root", children: body }),
	);
}
