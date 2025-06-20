/// @ts-check
/// <reference types="@chachalog/types" />
import fs from "node:fs";
import { defineConfig } from "chachalog";
import github from "chachalog/github";

export default defineConfig(() => ({
	allowedBumps: ["patch", "minor", "major"],
	platform: github(),
	managers: {
		packages: {
			name: "root",
			path: process.cwd(),
			version: fs.readFileSync(".chachalog/.version", "utf-8").trim(),
		},
		setVersion(_pkg, version) {
			fs.writeFileSync(".chachalog/.version", version);
			return true;
		},
	},
}));
