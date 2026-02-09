import { defineConfig } from "rolldown";
import pkg from "./package.json" with { type: "json" };

const createEntry = (file) => [
  file.replace("./dist/", "").replaceAll(/\.js$/g, ""),
  file.replace("./dist/", "./src/").replace(/\.js$/, ".ts"),
];

export default defineConfig([
  {
    input: Object.fromEntries(
      Object.values(pkg.exports)
        .filter((exports) => typeof exports === "object")
        .map((exports) => createEntry(exports.import))
        .concat([createEntry(pkg.bin)]),
    ),
    output: {
      dir: "dist",
      minify: true,
    },
    platform: "node",
    // Hack for pnpm: @reflink/reflink is a binary, mark it as external so rolldown skips it
    external: ["@reflink/reflink"],
  },
]);
