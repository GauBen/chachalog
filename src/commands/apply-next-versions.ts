import fs from "node:fs/promises";
import path from "node:path";
import semver from "semver";
import { globSync } from "tinyglobby";
import { processEntries } from "../changelog/process.ts";
import type { CommandWithLocalConfig } from "../config.ts";

export default async function prepareNextRelease({ config, dir }: CommandWithLocalConfig) {
  const files = new Map<string, string>();
  for (const name of globSync("*.md", { cwd: dir })) {
    const file = path.join(dir, name);
    const content = await fs.readFile(file, "utf-8");
    files.set(file, content);
  }
  const changelogEntries = await processEntries(
    files,
    config.packages.map((pkg) => pkg.name),
    config.validator,
  );

  if (changelogEntries.size === 0) return;

  for (const pkg of config.packages) {
    const changelogEntry = changelogEntries.get(pkg.name);
    if (!changelogEntry) continue;

    const version = semver.inc(
      pkg.version,
      changelogEntry.bump,
      config.prereleaseIdentifier,
      config.prereleaseIdentifierBase,
    );
    if (!version) throw new Error("bump failed");
    await config.setVersion(pkg, version);
  }
}
