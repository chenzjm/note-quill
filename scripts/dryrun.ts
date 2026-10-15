// 端到端干跑：用真实 XML 跑完整链路（解析 → 映射 → 生成），把文档写到本地暂存目录（不进 vault）。
// 不加 --write 时只打印计划；加 --write 才落盘。重复执行同一目录可验证冲突策略。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseXxlXml } from "../src/parser";
import { buildFlowTree } from "../src/mapping";
import { buildImportPlans } from "../src/writer";
import { guessExecutorFromFileName, sanitizeExecutorDir } from "../src/executors";
import { mergeFrontmatter } from "../src/frontmatter";
import type { ParsedJob } from "../src/types";

const args = process.argv.slice(2);
const write = args.includes("--write");
const policyArg = args.find((a) => a.startsWith("--policy="))?.split("=")[1] ?? "skip";
const outArg = args.find((a) => a.startsWith("--out="))?.split("=")[1] ?? ".dryrun";
const files = args.filter((a) => !a.startsWith("--"));

if (files.length === 0) {
	console.error("用法：node scripts/dryrun.mjs <xml 路径...> [--write] [--policy=skip|update|rename] [--out=.dryrun]");
	process.exit(1);
}

const outRoot = resolve(outArg);
const docsFolder = "8.xxljob";

const parsed = files.map((f) => ({
	file: f,
	name: f.split("/").pop() ?? f,
	result: parseXxlXml(readFileSync(f, "utf-8"), f),
}));

for (const p of parsed) {
	console.log(`文件 ${p.name}：任务 ${p.result.jobs.length} 个，jobGroup ${p.result.jobGroups.join("/") || "(无)"}`);
	for (const w of p.result.warnings) console.log(`  警告：${w}`);
}

const tree = buildFlowTree(parsed.map((p) => p.result));
const executorByFile = new Map(parsed.map((p) => [p.name, guessExecutorFromFileName(p.name)]));
const executorFor = (job: ParsedJob): string =>
	sanitizeExecutorDir(executorByFile.get(job.sourceFile.split("/").pop() ?? job.sourceFile) ?? "未命名执行器");

const { plans, warnings } = buildImportPlans(tree, executorFor, docsFolder);
console.log(`\n计划生成 ${plans.length} 份文档，警告 ${warnings.length} 条`);
for (const w of warnings) console.log(`  警告：${w}`);

let created = 0;
let updated = 0;
let renamed = 0;
let skipped = 0;

for (const plan of plans) {
	const target = join(outRoot, plan.path);
	if (write) {
		mkdirSync(dirname(target), { recursive: true });
		if (!existsSync(target)) {
			writeFileSync(target, plan.content, "utf-8");
			created += 1;
		} else if (policyArg === "skip") {
			skipped += 1;
		} else if (policyArg === "update") {
			writeFileSync(target, mergeFrontmatter(readFileSync(target, "utf-8"), plan.content), "utf-8");
			updated += 1;
		} else {
			let i = 2;
			let alt = target;
			while (existsSync(alt)) {
				alt = target.replace(/\.md$/, ` (${i}).md`);
				i += 1;
			}
			writeFileSync(alt, plan.content, "utf-8");
			renamed += 1;
		}
	} else {
		console.log(`  [${plan.kind}] ${plan.path}`);
	}
}

console.log(`\n结果：新建 ${created} · 更新 ${updated} · 副本 ${renamed} · 跳过 ${skipped}`);
if (write) console.log(`落盘目录：${outRoot}`);
