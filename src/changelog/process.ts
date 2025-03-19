import { UsageError } from "clipanion";
import type { BlockContent, DefinitionContent, Root, TopLevelContent } from "mdast";
import { remark } from "remark";
import remarkFrontmatter from "remark-frontmatter";
import { matter } from "vfile-matter";
import { ReleaseTypes } from "../index.ts";

declare module "vfile" {
	interface DataMap {
		matter: NonNullable<unknown>;
		tree: Root & { children: TopLevelContent[] };
	}
}

export type MdChildren = Array<BlockContent | DefinitionContent>;

/**
 * Processes a single changelog entry (as a markdown string) to extract version bumps and release
 * notes.
 */
export async function processEntry(content: string) {
	// Parse the markdown content to retrieve the frontmatter and the AST
	const { data } = await remark()
		.use(remarkFrontmatter)
		.use(() => (tree, file) => {
			matter(file);
			file.data.tree = tree as Root & { children: TopLevelContent[] };
		})
		.process(content);

	const bumps = data.matter!;

	/** Default entry where lines go if not under a title. Called "Other Changes" by default. */
	const defaultEntry: MdChildren = [];
	/** All non-default entries under a title. */
	const namedEntries: Map<string, MdChildren> = new Map();
	/** Current title, undefined if not under a title. */
	let entry: string | undefined;

	for (const node of data.tree!.children) {
		// Ignore HTML comments and YAML frontmatter
		if (
			(node.type === "html" && node.value.startsWith("<!--") && node.value.endsWith("-->")) ||
			node.type === "yaml"
		) {
			continue;
		}

		// Heading <= 3 (#, ## and ###) start a new entry
		if (node.type === "heading" && node.depth <= 3) {
			// Stringify the children of the title node to get the title
			entry = remark().stringify({ type: "root", children: node.children }).trim();
			continue;
		}

		// If not under a title, add to default entry
		if (!entry) {
			defaultEntry.push(node);
			continue;
		}

		// If under a title, add to named entry
		if (!namedEntries.has(entry)) namedEntries.set(entry, []);
		namedEntries.get(entry)?.push(node);
	}

	return { bumps, defaultEntry, namedEntries };
}

/** Processes multiple changelog entries. */
export async function processEntries(
	files: Map<string, string>,
	validator: (bumps: unknown) => Record<string, ReleaseTypes>,
) {
	const changelog = new Map<
		string,
		{
			bump: ReleaseTypes;
			releaseEntries: Map<ReleaseTypes, MdChildren>;
			namedEntries: Map<string, MdChildren>;
		}
	>();

	for (const [file, content] of files) {
		try {
			const current = await processEntry(content);
			for (const [pkg, bump] of Object.entries(validator(current.bumps))) {
				const previous = changelog.get(pkg);

				// Deep merge previous and current named entries
				const namedEntries: Map<string, MdChildren> = previous?.namedEntries ?? new Map();
				for (const [title, content] of current.namedEntries)
					namedEntries.set(title, [...(namedEntries.get(title) ?? []), ...content]);

				const releaseEntries: Map<ReleaseTypes, MdChildren> = previous?.releaseEntries ?? new Map();
				if (current.defaultEntry.length > 0)
					releaseEntries.set(bump, [...(releaseEntries.get(bump) ?? []), ...current.defaultEntry]);

				changelog.set(pkg, {
					bump: previous?.bump
						? ReleaseTypes[
								// ReleaseTypes starts at "major" and ends at "prerelease"
								Math.min(ReleaseTypes.indexOf(previous.bump), ReleaseTypes.indexOf(bump))
							]
						: bump,
					releaseEntries,
					namedEntries,
				});
			}
		} catch (error) {
			throw new UsageError(`Error processing ${file}: ${(error as Error).message}`);
		}
	}

	return changelog;
}
