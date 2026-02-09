/// @ts-check
/// <reference types="@chachalog/types" />
import { defineConfig } from "chachalog";
import github from "chachalog/github";
import yarn from "chachalog/yarn";

export default defineConfig(() => ({
  allowedBumps: ["patch", "minor", "major"],
  platform: github(),
  managers: yarn(),
}));
