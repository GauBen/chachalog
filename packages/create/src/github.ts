export const commentPr = {
	name: "Comment PR",
	on: { pull_request_target: { branches: ["main"] } },
	permissions: {
		contents: "write",
		"pull-requests": "write",
	},
	jobs: {
		"comment-pr": {
			"runs-on": "ubuntu-latest",
			steps: [
				{ uses: "actions/checkout@v4" },
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
	on: { push: { branches: ["main"] } },
	permissions: {
		contents: "write",
		"pull-requests": "write",
	},
	jobs: {
		...(prepare && {
			"prepare-next-release": {
				"runs-on": "ubuntu-latest",
				steps: [
					{ uses: "actions/checkout@v4" },
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
								{ uses: "actions/setup-node@v4" },
								{
									name: "Build and publish",
									run: "corepack enable && yarn\nyarn workspaces foreach -Avv --topological-dev run build\nyarn config set npmAuthToken '${{ secrets.NPM_TOKEN }}'\nyarn workspaces foreach -Avv --no-private npm publish --access public --tolerate-republish\n",
								},
							]
						: publish === "pnpm"
							? [
									{ uses: "actions/setup-node@v4" },
									{
										name: "Build and publish",
										run: "corepack enable && pnpm install\npnpm -r build\npnpm config set '//registry.npmjs.org/:_authToken' '${{ secrets.NPM_TOKEN }}'\npnpm -r publish --access public\n",
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
