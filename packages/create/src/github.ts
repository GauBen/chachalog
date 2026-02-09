import pkg from "../../../package.json" with { type: "json" };

export const commentPr = {
  name: "Comment PR",
  on: {
    pull_request_target: { branches: ["main"] },
  },
  jobs: {
    "comment-pr": {
      "runs-on": "ubuntu-slim",
      permissions: {
        "pull-requests": "write",
      },
      steps: [
        { uses: "actions/checkout@v6" },
        {
          run: `npx chachalog@^${pkg.version} comment-pr`,
          env: { GITHUB_TOKEN: "${{ secrets.GITHUB_TOKEN }}" },
        },
      ],
    },
  },
};

export const release = (prepare: boolean, publish: "yarn" | "pnpm" | "nothing" | false) => ({
  name: "Release",
  on: {
    push: { branches: ["main"] },
    workflow_dispatch: null,
  },
  jobs: {
    ...(prepare && {
      "prepare-next-release": {
        "runs-on": "ubuntu-slim",
        permissions: {
          contents: "write",
          "pull-requests": "write",
        },
        steps: [
          { uses: "actions/checkout@v6" },
          {
            run: `npx chachalog@^${pkg.version} prepare-next-release`,
            env: { GITHUB_TOKEN: "${{ secrets.GITHUB_TOKEN }}" },
          },
        ],
      },
    }),
    ...(publish && {
      "publish-release": {
        "runs-on": "ubuntu-slim",
        permissions: {
          contents: "write",
          "id-token": "write",
        },
        steps: [
          { uses: "actions/checkout@v6" },
          ...(publish === "yarn"
            ? [
                { uses: "actions/setup-node@v6" },
                {
                  name: "Build and publish",
                  run: `corepack enable && yarn install
yarn workspaces foreach -vv --all --topological-dev run build
yarn workspaces foreach -vv --all --topological --no-private npm publish --access public --tolerate-republish --provenance
`,
                },
              ]
            : publish === "pnpm"
              ? [
                  { uses: "actions/setup-node@v6" },
                  {
                    name: "Build and publish",
                    run: `corepack enable && pnpm install
pnpm -r build
pnpm -r publish --access public
`,
                  },
                ]
              : []),
          {
            run: `npx chachalog@^${pkg.version} publish-release`,
            env: { GITHUB_TOKEN: "${{ secrets.GITHUB_TOKEN }}" },
          },
        ],
      },
    }),
  },
});
