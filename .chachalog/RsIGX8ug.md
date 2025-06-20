---
# Allowed version bumps: patch, minor, major
chachalog: minor
# "@chachalog/create": major
# "@chachalog/types": major
---

`releaseBranch` and `releaseMessage` options moved from root level to `github()`. (#38)

```diff
 export default defineConfig(() => ({
   allowedBumps: ["patch", "minor", "major"],
-  releaseMessage: "chore: release",
   platform: github({
+    releaseMessage: "chore: release"
   }),
   managers: yarn()
 }));
```
