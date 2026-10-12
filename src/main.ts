import { Notice, Plugin } from "obsidian";
import { DEFAULT_SETTINGS, NoteQuillSettingTab, type NoteQuillSettings } from "./settings";

export default class NoteQuillPlugin extends Plugin {
	settings: NoteQuillSettings;

	async onload() {
		await this.loadSettings();

		// Command (no default hotkey: it may conflict with the user's bindings)
		this.addCommand({
			id: "hello",
			name: "Say hello",
			callback: () => {
				new Notice(`Hello, ${this.settings.greetingName}!`);
			},
		});

		// Ribbon icon
		this.addRibbonIcon("feather", "Note Quill: say hello", () => {
			new Notice(`Hello, ${this.settings.greetingName}!`);
		});

		// Status bar item: shows the active file name
		const statusBarItem = this.addStatusBarItem();
		this.registerEvent(
			this.app.workspace.on("file-open", (file) => {
				statusBarItem.setText(file ? file.basename : "");
			}),
		);

		// Settings tab
		this.addSettingTab(new NoteQuillSettingTab(this.app, this));
	}

	onunload() {
		// Only clean up resources NOT managed by register*.
		// Do NOT detach leaves here (it breaks the user's workspace layout).
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
