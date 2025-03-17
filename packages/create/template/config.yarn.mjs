/// @ts-check
/// <reference types="@chachalog/types" />
import { defineConfig } from "chachalog";
import github from "chachalog/github";
import yarn from "chachalog/yarn";

export default defineConfig(() => ({
	platform: github(),
	managers: yarn(),
}));
