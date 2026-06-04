#!/usr/bin/env node
import * as p from "@clack/prompts";
import process from "node:process";
import create from "./index.ts";

p.intro("🦜 Welcome to Chachalog!");

process.exit(await create());
