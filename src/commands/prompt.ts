import fs from "node:fs/promises";
import path from "node:path";
import * as p from "@clack/prompts";
import * as yaml from "yaml";
import type { CommandWithLocalConfig } from "../bin.ts";
import { ReleaseTypes } from "../index.ts";

/** Interactively create a new changelog entry */
export default async function prompt({ config, dir }: CommandWithLocalConfig) {
	const filename = path.join(
		dir,
		`${Buffer.from(crypto.getRandomValues(new Uint8Array(6))).toString("base64url")}.md`,
	);
	const bumps: Record<string, ReleaseTypes> = {};

	p.intro("🦜 Pick version bumps");

	for (const pkg of config.packages) {
		const bump = await p.select({
			message: `Bump for ${pkg.name}`,
			options: [
				{ value: null, label: "Skip", hint: "I don't want to bump" },
				...ReleaseTypes.map((value) => ({ value })),
			],
		});

		if (p.isCancel(bump)) {
			p.cancel("Bump cancelled, come back soon!");
			return 0;
		}

		if (bump === null) continue;

		bumps[pkg.name] = bump;
	}

	const entry = await p.text({ message: "Changelog entry", placeholder: "Markdown supported" });

	if (p.isCancel(entry)) {
		p.cancel("You were so close!");
		return 0;
	}

	await fs.writeFile(filename, `---\n${yaml.stringify(bumps)}---\n\n${entry}\n`);

	p.outro(`Entry created at ${filename}`);
}
