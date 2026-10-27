---
# Allowed version bumps: patch, minor, major
chachalog: patch
# "@chachalog/create": minor
# "@chachalog/types": minor
---

Default `releaseBranch` to `release-<branch>` instead of `release/<branch>` for non-main branches, as the latter cannot be pushed while a `release` branch exists.
