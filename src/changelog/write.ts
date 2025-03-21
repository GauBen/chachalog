import type { BlockContent, DefinitionContent, TopLevelContent } from "mdast";
import { remark } from "remark";
import { ReleaseTypes } from "../index.ts";
import type { MdChildren } from "./process.ts";

export function writeChangelog(
	{
		releaseEntries,
		namedEntries,
	}: {
		releaseEntries: Map<ReleaseTypes, Array<BlockContent | DefinitionContent>>;
		namedEntries: Map<string, Array<BlockContent | DefinitionContent>>;
	},
	bumpTitles: Record<ReleaseTypes, string>,
) {
	const children: Array<BlockContent | DefinitionContent> = [];

	for (const [title, nodes] of namedEntries) {
		const {
			children: [paragraph],
		} = remark().parse(title);
		if (paragraph?.type !== "paragraph") throw new Error("Title parsing failed");
		children.push({ ...paragraph, type: "heading", depth: 3 });
		children.push({
			type: "list",
			children: nodes.map((node) => ({
				type: "listItem",
				children: [node],
			})),
		});
	}

	if (releaseEntries.size > 0) {
		const printTitle = namedEntries.size + releaseEntries.size > 1;

		for (const release of ReleaseTypes) {
			const entries = releaseEntries.get(release);
			if (!entries) continue;

			if (printTitle) {
				children.push({
					type: "heading",
					depth: 3,
					children: [{ type: "text", value: bumpTitles[release] }],
				});
			}

			children.push({
				type: "list",
				children: entries.map((node) => ({
					type: "listItem",
					children: [node],
				})),
			});
		}
	}

	return children;
}

export function insertChangelog(
	original: string,
	version: string,
	changelogEntry: {
		releaseEntries: Map<ReleaseTypes, MdChildren>;
		namedEntries: Map<string, MdChildren>;
	},
	bumpTitles: Record<ReleaseTypes, string>,
) {
	const changelog = remark().parse(original);

	const children: TopLevelContent[] = [
		{ type: "heading", depth: 2, children: [{ type: "text", value: version }] },
		...writeChangelog(changelogEntry, bumpTitles),
	];

	const insertIndex = changelog.children.findIndex(
		(node) => node.type === "heading" && node.depth === 2,
	);
	changelog.children.splice(
		insertIndex < 0 ? changelog.children.length : insertIndex,
		0,
		...children,
	);

	return remark().stringify(changelog);
}
