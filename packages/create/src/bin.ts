import * as p from "@clack/prompts";
import process from "node:process";
import fs from "node:fs/promises";
import * as yaml from "yaml";
import { commentPr, release } from "./github.ts";

p.intro("🦜 Welcome to Chachalog!");

const { manager, features } = await p.group(
	{
		manager: () =>
			p.select({
				message: "What package manager do you want to use?",
				options: [
					{
						value: "yarn",
						label: "Yarn",
						hint: "Should also work with npm",
					},
					{
						value: "pnpm",
						label: "pnpm",
					},
					{
						value: "nothing",
						label: "Nothing",
						hint: "I'll manage packages myself",
					},
				] as const,
			}),
		features: () =>
			p.multiselect({
				message: "What features do you want to use?",
				options: [
					{
						value: "comment-pr",
						label: "Comment pull requests to ask for changelog entries",
					},
					{
						value: "prepare-next-release",
						label: "Create a pull request with the next release",
					},
					{
						value: "publish-release",
						label: "Publish the release to GitHub",
					},
				],
			}),
	},
	{
		onCancel() {
			p.cancel("Setup cancelled, come back soon!");
			process.exit(0);
		},
	},
);

const ok = await p.confirm({ message: "Does this look good to you?" });
if (p.isCancel(ok) || !ok) {
	p.cancel("Setup cancelled, come back soon!");
	process.exit(0);
}

await fs.mkdir(".chachalog", { recursive: true });
await fs.copyFile(
	new URL(`../template/config.${manager}.mjs`, import.meta.url),
	".chachalog/config.mjs",
);
if (manager === "nothing") await fs.writeFile(".chachalog/.version", "0.0.1");

await fs.mkdir(".github/workflows", { recursive: true });

if (features.includes("comment-pr"))
	await fs.writeFile(
		".github/workflows/comment-pr.yml",
		yaml.stringify(commentPr, { lineWidth: 100 }),
	);

if (features.includes("prepare-next-release") || features.includes("publish-release")) {
	await fs.writeFile(
		".github/workflows/release.yml",
		yaml.stringify(
			release(
				features.includes("prepare-next-release"),
				features.includes("publish-release") && manager,
			),
			{ lineWidth: 100 },
		),
	);
}

p.outro("Have a nice day!");
