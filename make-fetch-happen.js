// Replace `make-fetch-happen` with the built-in `fetch` implementation
fs.writeFileSync(
  path.join(execEnv.buildDir, "package.json"),
  JSON.stringify({ name: "make-fetch-happen", version: "1.0.0" }),
);
fs.writeFileSync(path.join(execEnv.buildDir, "index.js"), "module.exports = fetch");
