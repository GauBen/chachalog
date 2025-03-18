/// @ts-check
/// <reference types="@chachalog/types" />
import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "chachalog";
import github from "chachalog/github";

export default defineConfig(() => ({
	platform: github(),
	managers: {
		packages: {
			name: "root",
			path: path.resolve(".."),
			version: fs.readFileSync(".chachalog/.version", "utf-8").trim(),
		},
		setVersion(pkg, version) {
			fs.writeFileSync(".chachalog/.version", version);
			return true;
		},
	},
}));
