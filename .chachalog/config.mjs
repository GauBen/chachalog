/// @ts-check
/// <reference types="@chachalog/types" />
import fs from "node:fs/promises";
import { defineConfig } from "chachalog";
import github from "chachalog/github";
import yarn from "chachalog/yarn";

export default defineConfig(() => ({
  allowedBumps: ["patch", "minor", "major"],
  platform: github(),
  managers: [
    yarn(),
    {
      /** Keep `@chachalog/types` up-to-date */
      async setVersion(pkg, version) {
        if (pkg.name !== "chachalog") return;
        const current = await fs.readFile("packages/types/package.json", "utf-8");
        const updated = current.replace(
          /"version": "[^"]*"/,
          `"version": ${JSON.stringify(version)}`,
        );
        await fs.writeFile("packages/types/package.json", updated);
      },
    },
  ],
}));
