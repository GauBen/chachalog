import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import type { TopLevelContent } from "mdast";
import { remark } from "remark";
import semver from "semver";
import { globSync } from "tinyglobby";
import type { CommandWithConfig } from "../bin.ts";
import { processEntries } from "../changelog/process.ts";

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

	for (const pkg of config.packages) {
		const changelogEntry = changelogEntries.get(pkg.name);
		if (!changelogEntry) continue;
		const version = semver.inc(pkg.version, changelogEntry.bump);
		if (!version) throw new Error("bump failed");
		await config.setVersion(pkg, version);

		const children: TopLevelContent[] = [
			{
				type: "heading",
				depth: 2,
				children: [{ type: "text", value: version }],
			},
		];

		for (const [title, nodes] of changelogEntry.namedEntries) {
			const {
				children: [paragraph],
			} = remark().parse(title);
			if (paragraph?.type !== "paragraph") throw new Error("title parsing failed");
			children.push({ ...paragraph, type: "heading", depth: 3 });
			children.push({
				type: "list",
				children: nodes.map((node) => ({
					type: "listItem",
					children: [node],
				})),
			});
		}

		if (changelogEntry.defaultEntry.length > 0) {
			if (changelogEntry.namedEntries.size > 0) {
				children.push({
					type: "heading",
					depth: 3,
					children: [{ type: "text", value: "Other changes" }],
				});
			}

			children.push({
				type: "list",
				children: changelogEntry.defaultEntry.map((node) => ({
					type: "listItem",
					children: [node],
				})),
			});
		}

		const changelog = remark().parse(
			await fs.readFile(path.join(pkg.path, "CHANGELOG.md"), "utf-8").catch((error) => {
				if (error.code === "ENOENT") return `# ${pkg.name} Changelog\n`;
				throw error;
			}),
		);

		const insertIndex = changelog.children.findIndex(
			(node) => node.type === "heading" && node.depth === 2,
		);
		changelog.children.splice(
			insertIndex < 0 ? changelog.children.length : insertIndex,
			0,
			...children,
		);

		await fs.writeFile(path.join(pkg.path, "CHANGELOG.md"), remark().stringify(changelog));
	}

	if (skipCommit) return;

	const git = (...args: string[]) =>
		execFileSync("git", args, { stdio: "inherit", encoding: "utf-8" });

	git("config", "user.name", config.platform.username);
	git("config", "user.email", config.platform.email);
	git("switch", "-c", "release");
	git("add", ".");
	git("commit", "-m", "chore: release");
	git("push", "--force", "origin", "release");

	await config.platform.upsertReleasePr(
		"chore: release",
		"Merge this PR to release the next version",
	);
}
