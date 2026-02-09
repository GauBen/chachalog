import type { TopLevelContent } from "mdast";
import { remark } from "remark";
import { ReleaseTypes } from "../index.ts";
import type { MdChildren } from "./process.ts";

export function writeChangelog(
  {
    releaseEntries,
    namedEntries,
    intro,
  }: {
    releaseEntries: Map<ReleaseTypes, MdChildren[]>;
    namedEntries: Map<string, MdChildren[]>;
    intro: MdChildren;
  },
  bumpTitles: Record<ReleaseTypes, string>,
) {
  const children: MdChildren = [...intro];

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
        children: node,
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
          children: node,
        })),
      });
    }
  }

  return children;
}

export function insertChangelog(original: string, version: string, children: TopLevelContent[]) {
  const changelog = remark().parse(original);

  const insertIndex = changelog.children.findIndex(
    (node) => node.type === "heading" && node.depth === 2,
  );
  changelog.children.splice(
    insertIndex < 0 ? changelog.children.length : insertIndex,
    0,
    { type: "heading", depth: 2, children: [{ type: "text", value: version }] },
    ...children,
  );

  return remark().stringify(changelog);
}
