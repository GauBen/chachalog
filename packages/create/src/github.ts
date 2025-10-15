export const commentPr = {
	name: "Comment PR",
	on: {
		pull_request_target: { branches: ["main"] },
		workflow_dispatch: null,
	},
	permissions: {
		contents: "write",
		"pull-requests": "write",
	},
	jobs: {
		"comment-pr": {
			"runs-on": "ubuntu-latest",
			steps: [
				{ uses: "actions/checkout@v5" },
				{
					run: "npx chachalog@0.4 comment-pr",
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
	permissions: {
		contents: "write",
		"pull-requests": "write",
	},
	jobs: {
		...(prepare && {
			"prepare-next-release": {
				"runs-on": "ubuntu-latest",
				steps: [
					{ uses: "actions/checkout@v5" },
					{
						run: "npx chachalog@0.4 prepare-next-release",
						env: { GITHUB_TOKEN: "${{ secrets.GITHUB_TOKEN }}" },
					},
				],
			},
		}),
		...(publish && {
			"publish-release": {
				"runs-on": "ubuntu-latest",
				steps: [
					{ uses: "actions/checkout@v4" },
					...(publish === "yarn"
						? [
								{ uses: "actions/setup-node@v6" },
								{
									name: "Build and publish",
									run: `corepack enable && yarn install
yarn workspaces foreach -Avv --topological-dev run build
yarn workspaces foreach -Avv --no-private npm publish --access public --tolerate-republish
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
						run: "npx chachalog@0.4 publish-release",
						env: { GITHUB_TOKEN: "${{ secrets.GITHUB_TOKEN }}" },
					},
				],
			},
		}),
	},
});
