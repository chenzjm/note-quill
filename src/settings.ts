import { App, PluginSettingTab, Setting } from "obsidian";
import type FlowAtlasPlugin from "./main";

export interface FlowAtlasSettings {
	greetingName: string;
}

export const DEFAULT_SETTINGS: FlowAtlasSettings = {
	greetingName: "world",
};

export class FlowAtlasSettingTab extends PluginSettingTab {
	plugin: FlowAtlasPlugin;

	constructor(app: App, plugin: FlowAtlasPlugin) {
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
