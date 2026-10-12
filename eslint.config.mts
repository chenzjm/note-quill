import eslint from "@eslint/js";
import obsidianmd from "eslint-plugin-obsidianmd";
import tseslint from "typescript-eslint";

export default tseslint.config(
	{ ignores: ["main.js", "node_modules/"] },
	eslint.configs.recommended,
	...tseslint.configs.recommended,
	obsidianmd.configs.recommended,
	{
		rules: {
			"no-unused-vars": "off",
			"@typescript-eslint/no-unused-vars": [
				"error",
				{ argsIgnorePattern: "^_" },
			],
		},
	},
);
