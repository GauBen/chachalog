/// @ts-check
/// <reference types="@chachalog/types" />
import { defineConfig } from "chachalog";
import github from "chachalog/github";
import pnpm from "chachalog/pnpm";

export default defineConfig(() => ({
	allowedBumps: ["patch", "minor", "major"],
	platform: github(),
	managers: pnpm(),
}));
