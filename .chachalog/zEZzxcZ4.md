---
# Allowed version bumps: patch, minor, major
chachalog: patch
# "@chachalog/create": minor
# "@chachalog/types": minor
---

New `Platform` API: `reportReleasesCreated`. (#61)

It is implemented for the native `github()` platform, `npx chachalog publish-release` will populate the following output vars:

- `releases (number)`: number of releases created by Chachalog
- `releasedPackages (string)`: list of packages released, as a JSON array (e.g., `["pkg-a","pkg-b"]`)
- `released_<pkg> (boolean)`: one variable per package released (true when released, unset otherwise)
