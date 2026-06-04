import * as p from "@clack/prompts";
import fs from "node:fs/promises";
import path, { basename } from "node:path";
import process from "node:process";
import { styleText } from "node:util";
import * as yaml from "yaml";
import { findConfigFile, loadConfig, resolveLocalConfig } from "../config.ts";
import type { ReleaseTypes } from "../index.ts";
import create from "@chachalog/create";

/** Interactively create a new changelog entry */
export default async function prompt(dir: string) {
  const filename = path.join(
    dir,
    `${Buffer.from(crypto.getRandomValues(new Uint8Array(6))).toString("base64url")}.md`,
  );
  const bumps: Record<string, ReleaseTypes> = {};

  const cwd = basename(process.cwd());

  // A default config if chachalog prompt is run in a directory without a config file
  let config = await resolveLocalConfig({
    allowedBumps: ["patch", "minor", "major"],
    managers: { packages: { name: cwd, version: "0.0.0", path: process.cwd() } },
    platform: null as never,
  });

  p.intro("🦜 Pick version bumps");

  if ((await findConfigFile(dir).catch(() => null)) === null) {
    p.log.warning(
      `No config file found in the specified directory (${styleText("greenBright", `chachalog --dir ${dir}`)})`,
    );
    const choice = await p.select({
      message: "What do you want to do?",
      options: [
        {
          value: "go",
          label: `Use the current directory (${styleText("greenBright", cwd)}) as a package`,
        },
        { value: "create", label: `Initialize chachalog in the current directory` },
        { value: "exit", label: "Exit" },
      ],
    });

    if (p.isCancel(choice)) {
      p.cancel("Have a nice day!");
      return 0;
    }

    if (choice === "exit") {
      p.outro("See you soon!");
      return 0;
    }

    if (choice === "create") {
      return create();
    }

    // If choice === "go", we just continue with the default config from above
  } else {
    config = await loadConfig(dir)
      .then((fn) => fn())
      .then(resolveLocalConfig);
  }

  for (const pkg of config.packages) {
    const bump = await p.select({
      message: `Bump for ${pkg.name}`,
      options: [
        { value: null, label: "Skip", hint: "I don't want to bump" },
        ...config.allowedBumps.map((value) => ({ value, hint: config.bumpTitles[value] })),
      ],
    });

    if (p.isCancel(bump)) {
      p.cancel("Bump cancelled, come back soon!");
      return 0;
    }

    if (bump === null) continue;

    bumps[pkg.name] = bump;
  }

  if (Object.keys(bumps).length === 0) {
    p.outro("Nothing to bump, exiting...");
    return 0;
  }

  const entry = await p.multiline({
    message: "Changelog entry (multiline, double enter to submit)",
    placeholder: "Markdown supported",
    defaultValue: "",
  });

  if (p.isCancel(entry)) {
    p.cancel("You were so close!");
    return 0;
  }

  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filename, `---\n${yaml.stringify(bumps)}---\n\n${entry}\n`);

  p.outro(`Entry created at ${filename}`);
}
