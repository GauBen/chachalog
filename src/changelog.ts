import fs from "node:fs/promises";
import glob from "fast-glob";
import type { BlockContent, DefinitionContent, Root, TopLevelContent } from "mdast";
import { remark } from "remark";
import remarkFrontmatter from "remark-frontmatter";
import { matter } from "vfile-matter";

declare module "vfile" {
	interface DataMap {
		matter: Record<string, string>;
		tree: Root & { children: TopLevelContent[] };
	}
}

const order = ["patch", "minor", "major"] as const;

export async function getChangelog(dir: string) {
	const files = [];
	for (const entry of glob.sync("*.md", {
		cwd: dir,
		absolute: true,
	})) {
		const content = await fs.readFile(entry, "utf-8");
		files.push(content);
		await fs.rm(entry);
	}
	return processChangelog(files);
}

type MdMap = Map<string, Array<BlockContent | DefinitionContent>>;
export async function processChangelog(files: string[]) {
	const changelog = new Map<
		string,
		{
			bump: (typeof order)[number];
			entries: MdMap;
			defaultEntry: Array<BlockContent | DefinitionContent>;
		}
	>();

	for (const content of files) {
		let entry: string | undefined;
		const defaultEntry: Array<BlockContent | DefinitionContent> = [];
		const entries: MdMap = new Map();
		const file = await remark()
			.use(remarkFrontmatter)
			.use(() => (tree, file) => {
				matter(file);
				file.data.tree = tree as Root & { children: TopLevelContent[] };
			})
			.process(content);

		for (const node of file.data.tree?.children ?? []) {
			if (
				(node.type === "html" && node.value.startsWith("<!--") && node.value.endsWith("-->")) ||
				node.type === "yaml"
			) {
				continue;
			}

			if (node.type === "heading" && node.depth === 1) {
				const root: Root = { type: "root", children: node.children };
				entry = remark().stringify(root).trim();
				continue;
			}

			if (!entry) {
				defaultEntry.push(node);
				continue;
			}

			if (!entries.has(entry)) entries.set(entry, []);
			entries.get(entry)?.push(node);
		}

		for (const [key, value] of Object.entries(file.data.matter ?? {})) {
			const previous = changelog.get(key) ?? {
				bump: "patch",
				entries: new Map() as MdMap,
				defaultEntry: [],
			};
			for (const [key, value] of entries) {
				previous.entries.set(key, [...(previous.entries.get(key) ?? []), ...value]);
			}
			changelog.set(key, {
				bump: order[
					Math.max(order.indexOf(previous.bump), order.indexOf(value as (typeof order)[number]))
				],
				defaultEntry: [...previous.defaultEntry, ...defaultEntry],
				entries: previous.entries,
			});
		}
	}

	return changelog;
}
