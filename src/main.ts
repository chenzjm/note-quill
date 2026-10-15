import { Plugin } from "obsidian";
import { DEFAULT_SETTINGS, FlowAtlasSettingTab, type FlowAtlasSettings } from "./settings";
import { XxlImportModal } from "./ui/importModal";
import { readTemplates } from "./templates";

export default class FlowAtlasPlugin extends Plugin {
	settings: FlowAtlasSettings = DEFAULT_SETTINGS;

	async onload() {
		await this.loadSettings();

		const openWizard = async (): Promise<void> => {
			const { templates } = await readTemplates(this.app, {
				flowTemplate: this.settings.flowTemplate,
				taskTemplate: this.settings.taskTemplate,
				componentTemplate: this.settings.componentTemplate,
			});
			new XxlImportModal(this.app, {
				docsFolder: this.settings.docsFolder,
				policy: () => this.settings.conflictPolicy,
				getExecutors: () => this.settings.executors,
				onExecutorsChanged: async (next) => {
					this.settings.executors = next;
					await this.saveSettings();
				},
				templates,
			}).open();
		};

		// Command (no default hotkey: it may conflict with the user's bindings)
		this.addCommand({
			id: "import-xml",
			name: "导入 xxl-job 任务 XML",
			callback: () => void openWizard(),
		});

		// Ribbon icon
		this.addRibbonIcon("upload-cloud", "导入 xxl-job 任务 XML", () => void openWizard());

		// Settings tab
		this.addSettingTab(new FlowAtlasSettingTab(this.app, this));
	}

	async loadSettings() {
		const stored = (await this.loadData()) as Partial<FlowAtlasSettings>;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, stored);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
