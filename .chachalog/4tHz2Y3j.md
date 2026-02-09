---
chachalog: minor
"@chachalog/create": patch
---

**Breaking change**: dropped support for Node.js versions below 24. (#56)

GitHub has a new image more suited for repository tasks, [`ubuntu-slim`](https://github.com/actions/runner-images/blob/main/images/ubuntu-slim/ubuntu-slim-Readme.md), and it's the new target of Chachalog.

You can upgrade your CI files manually or run `npm init @chachalog@latest` to create fresh ones.
