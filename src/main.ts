import { Notice, Plugin } from "obsidian";
import { DEFAULT_SETTINGS, FlowAtlasSettingTab, type FlowAtlasSettings } from "./settings";

export default class FlowAtlasPlugin extends Plugin {
	settings: FlowAtlasSettings = DEFAULT_SETTINGS;

	async onload() {
		await this.loadSettings();

		// Command (no default hotkey: it may conflict with the user's bindings)
		this.addCommand({
			id: "import-xml",
			name: "Import xxl-job tasks",
			callback: () => {
				new Notice("Import wizard coming soon.");
			},
		});

		// Ribbon icon
		this.addRibbonIcon("upload-cloud", "Import xxl-job tasks", () => {
			new Notice("Import wizard coming soon.");
		});

		// Status bar item: shows the active file name
		const statusBarItem = this.addStatusBarItem();
		this.registerEvent(
			this.app.workspace.on("file-open", (file) => {
				statusBarItem.setText(file ? file.basename : "");
			}),
		);

		// Settings tab
		this.addSettingTab(new FlowAtlasSettingTab(this.app, this));
	}

	onunload() {
		// Only clean up resources NOT managed by register*.
		// Do NOT detach leaves here (it breaks the user's workspace layout).
	}

	async loadSettings() {
		const stored = (await this.loadData()) as Partial<FlowAtlasSettings>;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, stored);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
