import fs from "node:fs/promises";
import path from "node:path";
import type { CommandWithConfig } from "../bin.ts";
import { remark } from "remark";

export default async function publishRelease({ config }: CommandWithConfig) {
	for (const pkg of config.packages) {
		try {
			await fs.access(path.join(pkg.path, "CHANGELOG.md"));
		} catch {
			continue;
		}

		const changelog = remark().parse(
			await fs.readFile(path.join(pkg.path, "CHANGELOG.md"), "utf-8"),
		);
		const release = changelog.children.findIndex(
			(node) => node.type === "heading" && node.depth === 2,
		);

		if (release === -1) continue;

		const heading = changelog.children[release];
		if (heading.type !== "heading" || heading.children[0].type !== "text")
			throw new Error("title parsing failed");

		const version = heading.children[0].value;

		const length = changelog.children
			.slice(release)
			.findIndex((node) => node.type === "heading" && node.depth === 2);
		const body = remark().stringify({
			type: "root",
			children: changelog.children.slice(release + 1, length > 0 ? release + length : undefined),
		});

		const title = `${pkg.name} @ v${version}`;
		const tag = `${pkg.prefix}/${pkg.name}@${version}`;
		await config.platform.createRelease(tag, title, body);
	}
}
