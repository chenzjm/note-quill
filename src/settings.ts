import { App, PluginSettingTab, Setting } from "obsidian";
import type NoteQuillPlugin from "./main";

export interface NoteQuillSettings {
	greetingName: string;
}

export const DEFAULT_SETTINGS: NoteQuillSettings = {
	greetingName: "world",
};

export class NoteQuillSettingTab extends PluginSettingTab {
	plugin: NoteQuillPlugin;

	constructor(app: App, plugin: NoteQuillPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		// Use el.empty() instead of innerHTML
		containerEl.empty();

		new Setting(containerEl)
			.setName("Greeting name")
			.setDesc("Name used in the hello notice.")
			.addText((text) =>
				text
					.setPlaceholder("Enter your name")
					.setValue(this.plugin.settings.greetingName)
					.onChange(async (value) => {
						this.plugin.settings.greetingName = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
