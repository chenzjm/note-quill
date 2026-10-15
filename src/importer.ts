import { App, TFile } from "obsidian";
import type { FilePlan } from "./types";
import { mergeFrontmatter } from "./frontmatter";
import type { ConflictPolicy } from "./settings";

export interface ImportOutcome {
	created: string[];
	updated: string[];
	renamed: string[];
	skipped: string[];
	failed: Array<{ path: string; reason: string }>;
}

function emptyOutcome(): ImportOutcome {
	return { created: [], updated: [], renamed: [], skipped: [], failed: [] };
}

function dirOf(path: string): string {
	const idx = path.lastIndexOf("/");
	return idx === -1 ? "" : path.slice(0, idx);
}

/** 把生成计划写入 vault；按冲突策略处理已存在文档 */
export async function applyPlans(
	app: App,
	plans: FilePlan[],
	policy: ConflictPolicy,
): Promise<ImportOutcome> {
	const outcome = emptyOutcome();

	// 预建目录
	const dirs = new Set<string>();
	for (const p of plans) dirs.add(dirOf(p.path));
	for (const d of dirs) {
		if (!d) continue;
		if (!(await app.vault.adapter.exists(d))) {
			await app.vault.adapter.mkdir(d);
		}
	}

	for (const p of plans) {
		try {
			const existing = app.vault.getAbstractFileByPath(p.path);
			if (!existing) {
				await app.vault.create(p.path, p.content);
				outcome.created.push(p.path);
				continue;
			}
			if (!(existing instanceof TFile)) {
				outcome.failed.push({ path: p.path, reason: "同名路径已存在且不是文件" });
				continue;
			}
			if (policy === "skip") {
				outcome.skipped.push(p.path);
				continue;
			}
			if (policy === "update") {
				const old = await app.vault.cachedRead(existing);
				await app.vault.modify(existing, mergeFrontmatter(old, p.content));
				outcome.updated.push(p.path);
				continue;
			}
			// rename：追加序号直到不冲突
			let i = 2;
			let target = p.path;
			while (app.vault.getAbstractFileByPath(target)) {
				target = p.path.replace(/\.md$/, ` (${i}).md`);
				i += 1;
			}
			await app.vault.create(target, p.content);
			outcome.renamed.push(target);
		} catch (e) {
			outcome.failed.push({ path: p.path, reason: e instanceof Error ? e.message : String(e) });
		}
	}

	return outcome;
}
