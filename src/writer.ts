import {
	BIZDATE_MAP,
	MISFIRE_MAP,
	ROUTE_MAP,
	BLOCK_MAP,
	extractShardingParam,
	levelToDirName,
	levelToDocKind,
	mapEnum,
	parentTaskFlowName,
	parentTaskName,
	resolveJobBeanName,
	sanitizeFileName,
	type FlowTree,
} from "./mapping";
import { splitFrontmatter } from "./frontmatter";
import { asText } from "./util";
import type { FilePlan, ParsedJob, SourceInfo } from "./types";

// ---------- YAML frontmatter ----------

/**
 * 生成 YAML 标量：能用裸标量就用裸标量（与 vault 里手写文档、模板风格一致），
 * 含特殊字符（引号、花括号、方括号、冒号、逗号、井号等）时才切双引号。
 */
function yamlScalar(value: string): string {
	if (value === "") return '""';
	if (value !== value.trim()) return JSON.stringify(value);
	// 这些字符出现在 plain scalar 里会引起 YAML 歧义
	if (/["'`{}[\],]/.test(value)) return JSON.stringify(value);
	if (/(^|\s):|:\s/.test(value)) return JSON.stringify(value); // 冒号（键值分隔）
	if (/\s#/.test(value)) return JSON.stringify(value); // 行内注释
	// 首字符是 YAML 指示符（别名、锚点、块标量、序列项等）
	if (/^[-?*&!|>%@]/.test(value)) return JSON.stringify(value);
	return value;
}

function frontmatter(lines: string[]): string {
	return `---\n${lines.join("\n")}\n---`;
}

/** 无模板时的 frontmatter：按给定键顺序输出 */
function fmBlock(values: Record<string, string | undefined>): string {
	return frontmatter(Object.entries(values).map(([k, v]) => `${k}: ${yamlScalar(v ?? "")}`));
}

// ---------- mermaid 生成 ----------

function sanitizeMermaidLabel(label: string): string {
	return label.replace(/["|[\]{}()<>]/g, " ").trim() || "-";
}

/** 文档存放目录：严格按层级（任务流/任务/任务组件） */
function dirForJob(job: ParsedJob): string {
	return levelToDirName(levelToDocKind(job.level));
}

/**
 * 生成父级文档（任务流/批任务）的依赖 mermaid：
 * 节点 1 为父任务自身，节点 2..n+1 为下辖子任务的 [[双链]]；edges 表达先后顺序。
 */
function buildParentMermaid(
	tree: FlowTree,
	job: ParsedJob,
	childKindDir: string,
	childTitleOf: (childId: string) => string,
	childLinkBaseOf: (childId: string) => string,
): string {
	const lines = ["```mermaid", "graph TD"];
	lines.push(`  1["${sanitizeMermaidLabel(job.jobDesc)}"]`);
	const childIds = job.childrenIds.filter((cid) => tree.byId.has(cid));
	const idxOf = new Map<string, number>();
	childIds.forEach((cid, i) => {
		const n = i + 2;
		idxOf.set(cid, n);
		const title = childTitleOf(cid);
		const link = `[[${childLinkBaseOf(cid)}/${childKindDir}/${sanitizeFileName(title)}|${sanitizeMermaidLabel(title)}]]`;
		lines.push(`  ${n}[" ${link}"]`);
	});
	// 边：优先用画布 edges 表达子任务间的先后顺序
	const pairEdges: Array<[number, number]> = [];
	if (job.taskFlow && job.taskFlow.edges.length > 0) {
		const canvasIdToChildIdx = new Map<string, number>();
		job.taskFlow.nodes.forEach((n) => {
			const idx = idxOf.get(n.triggerId);
			if (idx !== undefined) canvasIdToChildIdx.set(n.nodeId, idx);
		});
		for (const e of job.taskFlow.edges) {
			const s = canvasIdToChildIdx.get(e.source);
			const t = canvasIdToChildIdx.get(e.target);
			if (s !== undefined && t !== undefined) pairEdges.push([s, t]);
		}
	}
	const childIdxList = [...idxOf.values()];
	if (pairEdges.length === 0) {
		// 无显式边：按节点声明顺序串行（画布 index 即执行顺序）
		let prev = 1;
		for (const idx of childIdxList) {
			pairEdges.push([prev, idx]);
			prev = idx;
		}
	} else {
		// 有显式边：父节点连到所有无入边的子节点（入口/并行分支）
		const withIn = new Set(pairEdges.map(([, t]) => t));
		for (const idx of childIdxList) {
			if (!withIn.has(idx)) pairEdges.push([1, idx]);
		}
	}
	for (const [s, t] of pairEdges) lines.push(`  ${s} --> ${t}`);
	lines.push("```");
	return lines.join("\n");
}

/** 任务组件内部流程 mermaid（jobInfo 画布：开始→业务节点→结束） */
function buildComponentMermaid(job: ParsedJob): string {
	const lines = ["```mermaid", "graph TD"];
	const canvas = job.canvas;
	if (!canvas || canvas.nodes.length === 0) {
		const bean = resolveJobBeanName(job) ?? "待确认";
		lines.push(`  A[开始] --> B[${sanitizeMermaidLabel(bean)}]`, "  B --> C[结束]", "```");
		return lines.join("\n");
	}
	const idMap = new Map<string, string>();
	canvas.nodes.forEach((n, i) => {
		idMap.set(n.id, String.fromCharCode(65 + i)); // A, B, C...
		const label = n.processClass ?? sanitizeMermaidLabel(n.label);
		lines.push(`  ${idMap.get(n.id)}[${label}]`);
	});
	const seen = new Set<string>();
	for (const e of canvas.edges) {
		const s = idMap.get(e.source);
		const t = idMap.get(e.target);
		if (s && t) {
			const key = `${s}->${t}`;
			if (!seen.has(key)) {
				seen.add(key);
				lines.push(`  ${s} --> ${t}`);
			}
		}
	}
	lines.push("```");
	return lines.join("\n");
}

/** 把正文里第一个 mermaid 代码块整体替换（模板里带的是示例图） */
function replaceFirstMermaid(body: string, replacement: string): string {
	const m = body.match(/```mermaid[\s\S]*?```/);
	if (!m || m.index === undefined) return `${body.replace(/\s*$/, "")}\n\n${replacement}\n`;
	return body.slice(0, m.index) + replacement + body.slice(m.index + m[0].length);
}

// ---------- 模板驱动渲染 ----------

export interface TemplateSources {
	/** 任务流模板原文 */
	taskFlow?: string;
	/** 批任务模板原文 */
	task?: string;
	/** 任务组件模板原文 */
	component?: string;
}

export interface BuildOptions {
	docsFolder?: string;
	templates?: TemplateSources;
}

/** 正文占位填充规则：命中关键词且有值时替换，否则保留模板里的 {{填写提示}} */
interface BodyFill {
	re: RegExp;
	value?: string;
}

function fillPlaceholders(body: string, fills: BodyFill[]): string {
	return body.replace(/\{\{([\s\S]*?)\}\}/g, (full, inner: string) => {
		for (const f of fills) {
			if (f.value !== undefined && f.value !== "" && f.re.test(inner)) return f.value;
		}
		return full;
	});
}

/** 按模板原有键顺序重写 frontmatter：能确定的写真实值，其余保留模板里的填写提示 */
function applyFrontmatter(tplFm: string, values: Record<string, string | undefined>): string {
	const used = new Set<string>();
	const lines = tplFm.split("\n").map((line) => {
		const m = line.match(/^(\s*)([^:\s-][^:]*):\s*(.*)$/);
		if (!m) return line; // 空行、注释、列表项原样保留
		const key = m[2].trim();
		const value = values[key];
		if (value === undefined || value === "") return line;
		used.add(key);
		return `${m[1]}${key}: ${yamlScalar(value)}`;
	});
	for (const [key, value] of Object.entries(values)) {
		if (value === undefined || value === "" || used.has(key)) continue;
		lines.push(`${key}: ${yamlScalar(value)}`);
	}
	return lines.join("\n");
}

/** 套模板生成整篇文档；模板缺失或没有 frontmatter 时回退到内置结构 */
function renderDoc(
	raw: string | undefined,
	values: Record<string, string | undefined>,
	fills: BodyFill[],
	mermaid: string | undefined,
	fallback: () => string,
): string {
	const split = raw ? splitFrontmatter(raw) : undefined;
	if (!split) return fallback();
	const fm = applyFrontmatter(split.fm, values);
	let body = split.body;
	if (mermaid !== undefined) body = replaceFirstMermaid(body, mermaid);
	body = fillPlaceholders(body, fills);
	return `---\n${fm}\n---\n${body.startsWith("\n") ? body : `\n${body}`}`;
}

// ---------- 可推断的正文片段 ----------

function bizScope(job: ParsedJob): string | undefined {
	if (!job.paramJson) return undefined; // 无法推断 → 保留模板提示由人工填写
	const items: string[] = [];
	for (const [k, v] of Object.entries(job.paramJson)) {
		if (/^(ORG_CODE|organCode|TENANT_ID|JOB_TRADE_CODE|bizMode|businessDim|businessType)$/.test(k)) {
			items.push(`- ${k}: \`${asText(v)}\``);
		}
	}
	if (items.length === 0) return undefined;
	items.push("- 其余业务范围：待确认");
	return items.join("\n");
}

function pageSizeNote(job: ParsedJob): string | undefined {
	const ps = job.paramJson?.["pageSize"];
	if (ps === undefined) return undefined; // 无分页参数 → 保留模板提示
	return `涉及分页，pageSize=${asText(ps)}。排序规则：待确认。`;
}

// ---------- 来源信息（不再写进正文，改由 plan 返回供状态文件记录） ----------

function sourceInfo(job: ParsedJob): SourceInfo {
	return {
		jobId: job.id,
		sourceFile: job.sourceFile,
		author: job.author,
		addTime: job.addTime,
		updateTime: job.updateTime,
		alarmMobile: job.alarmMobile,
	};
}

const GUIDE_NOTE = "> 本页维护当前契约。本次差异、风险、测试结果与评审结论统一放在设计文档。按适用场景填写，未核实写待确认；不适用写依据。";

// ---------- 三类文档正文（回退用：未配置模板时的内置结构） ----------

function fallbackTaskFlowBody(tree: FlowTree, job: ParsedJob, docsFolder: string, executorFor: (job: ParsedJob) => string): string {
	const cronDesc = job.cron ? `调度 Cron \`${job.cron}\`` : "无调度（被上层编排触发）";
	const bizDate = mapEnum(BIZDATE_MAP, job.executeBizDateType);
	return [
		GUIDE_NOTE,
		"",
		"# 任务说明",
		"> 说明该任务流做什么、何时触发、失败如何处理。",
		"> 使用流程图或者时序图说明。任务流的流程图中可以直接引用对应的任务。",
		"",
		`本任务流来自 xxl-job 导入：${job.jobDesc}；${cronDesc}${bizDate ? `；业务执行日期 ${bizDate}` : ""}。下辖 ${job.childrenIds.filter((c) => tree.byId.has(c)).length} 个任务。失败处理：待确认。`,
		"",
		buildParentMermaid(tree, job, "任务", (cid) => tree.byId.get(cid)?.jobDesc ?? cid, (cid) => `${docsFolder}/${executorFor(tree.byId.get(cid)!)}`),
		"",
	].join("\n");
}

function fallbackTaskBody(tree: FlowTree, job: ParsedJob, docsFolder: string, executorFor: (job: ParsedJob) => string): string {
	const parentFlow = parentTaskFlowName(tree, job);
	const childCount = job.childrenIds.filter((c) => tree.byId.has(c)).length;
	return [
		GUIDE_NOTE,
		"",
		"# 任务说明",
		"> 说明该任务做什么、何时触发、失败如何处理。",
		"> 使用流程图或者时序图说明。",
		"",
		`本任务来自 xxl-job 导入：${job.jobDesc}；属【${parentFlow ?? "待确认"}】任务流的编排节点，下辖 ${childCount} 个任务组件。任务参数见 frontmatter。失败处理：待确认。`,
		"",
		buildParentMermaid(tree, job, "任务组件", (cid) => tree.byId.get(cid)?.jobDesc ?? cid, (cid) => `${docsFolder}/${executorFor(tree.byId.get(cid)!)}`),
		"",
	].join("\n");
}

function fallbackComponentBody(job: ParsedJob): string {
	const bean = resolveJobBeanName(job);
	return [
		GUIDE_NOTE,
		"",
		"# 任务说明",
		"> 说明该任务做什么、何时触发、失败如何处理。",
		"> 使用流程图或者时序图说明",
		"",
		`本任务组件来自 xxl-job 导入：${job.jobDesc}${bean ? `；jobBeanName: ${bean}` : "；jobBeanName: 待确认"}。`,
		"",
		buildComponentMermaid(job),
		"",
		"# 涉及的业务范围",
		"> 需要写明该批量涉及处理的业务范围。不接受“标准化所有产品”这类含糊描述。需要穷举罗列。",
		bizScope(job) ?? "待确认",
		"",
		"# 批任务防止重复调度机制",
		"> 注意：光靠丢弃后续调度作为防重调度不可靠。若调度在不同的执行器上，会出现未按照预期丢弃后续调度的场景。需要在批任务业务逻辑中保有防止重复调度的机制。",
		"待确认",
		"",
		"# 是否涉及调用外部接口",
		"> 需要罗列所涉及的全部外部接口。调用外部接口关键字段说明需要在client接口文档中说明。",
		"待确认",
		"",
		"# 调用外部接口的防重机制",
		"> 发送外部接口前更新交易记录状态（记录是否发送外部），并通过乐观锁避免重复调用",
		"待确认",
		"",
		"# 是否涉及交易状态判断",
		"> 阐述该批量任务中是否涉及业务交易状态判断，及判断逻辑。阐述是否满足准则要求准则：“==明确成功才是成功，明确失败才是失败，其他处理中。”",
		"待确认",
		"",
		"# 涉及到分页必须有排序",
		"> 是否涉及分页？若涉及分页必须有可靠的排序规则，否则可能出现不同页之间数据重复或遗漏。若分页未进行排序可能出现第 1 页和第 2 页其中部分数据重复的情况。",
		pageSizeNote(job) ?? "待确认",
		"",
	].join("\n");
}

// ---------- frontmatter 取值（键名与 _fileclasses 一致） ----------

function taskFlowFm(job: ParsedJob, executor: string): Record<string, string | undefined> {
	return {
		fileClass: "任务流",
		执行器: executor,
		任务流名称: job.jobDesc,
		业务执行日期: mapEnum(BIZDATE_MAP, job.executeBizDateType) ?? "今天",
		Cron表达式: job.cron,
		负责人: job.author ?? "待确认",
		调度过期策略: mapEnum(MISFIRE_MAP, job.misfireStrategy) ?? "忽略",
		调度状态: "停止",
	};
}

function taskFm(tree: FlowTree, job: ParsedJob, executor: string): Record<string, string | undefined> {
	return {
		fileClass: "批任务",
		执行器: executor,
		对应任务流名称: parentTaskFlowName(tree, job) ?? "待确认",
		任务名称: job.jobDesc,
		负责人: job.author ?? "待确认",
		任务参数: job.executorParam,
		调度过期策略: mapEnum(MISFIRE_MAP, job.misfireStrategy) ?? "忽略",
	};
}

function componentFm(tree: FlowTree, job: ParsedJob, executor: string): { values: Record<string, string | undefined>; warnings: string[] } {
	const sharding = extractShardingParam(job.paramJson);
	const warnings: string[] = [];
	const route = mapEnum(ROUTE_MAP, job.routeStrategy);
	if (job.routeStrategy && route === job.routeStrategy) warnings.push(`未识别的路由策略枚举：${job.routeStrategy}（原样写入）`);
	const block = mapEnum(BLOCK_MAP, job.blockStrategy);
	if (job.blockStrategy && block === job.blockStrategy) warnings.push(`未识别的阻塞处理策略枚举：${job.blockStrategy}（原样写入）`);
	return {
		values: {
			fileClass: "任务组件",
			执行器: executor,
			对应批任务名称: parentTaskName(tree, job) ?? "待确认",
			任务组件名称: job.jobDesc,
			阻塞处理策略: block ?? "单机串行",
			jobBeanName: resolveJobBeanName(job) ?? "待确认",
			路由策略: route ?? "第一个",
			分片参数: sharding ?? "待确认",
			调度过期策略: mapEnum(MISFIRE_MAP, job.misfireStrategy) ?? "忽略",
		},
		warnings,
	};
}

// ---------- 三遍法编排 ----------

export interface ImportPlanResult {
	plans: FilePlan[];
	warnings: string[];
}

function normalizeOptions(opts: BuildOptions | string | undefined): Required<BuildOptions> {
	if (typeof opts === "string") return { docsFolder: opts, templates: {} };
	return { docsFolder: opts?.docsFolder ?? "8.xxljob", templates: opts?.templates ?? {} };
}

/**
 * 自底向上三遍法：先任务组件（叶子）→ 批任务（引用组件路径）→ 任务流（引用任务路径）。
 * 同 id 任务跨文件去重后，每个任务生成一份文档。
 * 文档内容严格套用 _template 的三份 xxljob 模板；模板缺失时回退内置结构。
 */
export function buildImportPlans(
	tree: FlowTree,
	executorFor: (job: ParsedJob) => string,
	opts: BuildOptions | string = {},
): ImportPlanResult {
	const { docsFolder, templates } = normalizeOptions(opts);
	const warnings = [...tree.warnings];
	const titleOf = new Map<string, string>(); // id → 文档名（去 .md）

	for (const job of tree.jobs) {
		titleOf.set(job.id, sanitizeFileName(job.jobDesc || job.yrJobName || job.id));
	}

	const components = tree.jobs.filter((j) => j.level === "COMPONENT");
	const tasks = tree.jobs.filter((j) => j.level === "VIRTUAL");
	const flows = tree.jobs.filter((j) => j.level === "MAIN");

	const plans: FilePlan[] = [];
	const childLinkBaseOf = (cid: string) => `${docsFolder}/${executorFor(tree.byId.get(cid)!)}`;

	// Pass 1: 任务组件
	for (const job of components) {
		const executor = executorFor(job);
		const title = titleOf.get(job.id)!;
		const { values, warnings: ws } = componentFm(tree, job, executor);
		for (const w of ws) warnings.push(`任务组件「${job.jobDesc}」${w}`);
		const summary = `本任务组件来自 xxl-job 导入：${job.jobDesc}${values.jobBeanName ? `；jobBeanName: ${values.jobBeanName}` : "；jobBeanName: 待确认"}。`;
		const content = renderDoc(
			templates.component,
			values,
			[
				{ re: /任务简述|任务组件简述/, value: summary },
				{ re: /业务范围/, value: bizScope(job) },
				{ re: /分页/, value: pageSizeNote(job) },
			],
			buildComponentMermaid(job),
			() => `${fmBlock(values)}\n\n${fallbackComponentBody(job)}`,
		);
		plans.push({
			path: `${docsFolder}/${executor}/${dirForJob(job)}/${title}.md`,
			content,
			kind: "任务组件",
			title,
			jobId: job.id,
			source: sourceInfo(job),
		});
	}

	// Pass 2: 批任务（任务层）
	for (const job of tasks) {
		const executor = executorFor(job);
		const title = titleOf.get(job.id)!;
		const values = taskFm(tree, job, executor);
		const parentFlow = parentTaskFlowName(tree, job);
		const childCount = job.childrenIds.filter((c) => tree.byId.has(c)).length;
		const summary = `本任务来自 xxl-job 导入：${job.jobDesc}；属【${parentFlow ?? "待确认"}】任务流的编排节点，下辖 ${childCount} 个任务组件。任务参数见 frontmatter。失败处理：待确认。`;
		const content = renderDoc(
			templates.task,
			values,
			[{ re: /任务简述|批任务简述/, value: summary }],
			buildParentMermaid(tree, job, "任务组件", (cid) => tree.byId.get(cid)?.jobDesc ?? cid, childLinkBaseOf),
			() => `${fmBlock(values)}\n\n${fallbackTaskBody(tree, job, docsFolder, executorFor)}`,
		);
		plans.push({
			path: `${docsFolder}/${executor}/${dirForJob(job)}/${title}.md`,
			content,
			kind: "批任务",
			title,
			jobId: job.id,
			source: sourceInfo(job),
		});
	}

	// Pass 3: 任务流
	for (const job of flows) {
		const executor = executorFor(job);
		const title = titleOf.get(job.id)!;
		const values = taskFlowFm(job, executor);
		const cronDesc = job.cron ? `调度 Cron \`${job.cron}\`` : "无调度（被上层编排触发）";
		const bizDate = mapEnum(BIZDATE_MAP, job.executeBizDateType);
		const summary = `本任务流来自 xxl-job 导入：${job.jobDesc}；${cronDesc}${bizDate ? `；业务执行日期 ${bizDate}` : ""}。下辖 ${job.childrenIds.filter((c) => tree.byId.has(c)).length} 个任务。失败处理：待确认。`;
		const content = renderDoc(
			templates.taskFlow,
			values,
			[{ re: /任务流简述|任务简述/, value: summary }],
			buildParentMermaid(tree, job, "任务", (cid) => tree.byId.get(cid)?.jobDesc ?? cid, childLinkBaseOf),
			() => `${fmBlock(values)}\n\n${fallbackTaskFlowBody(tree, job, docsFolder, executorFor)}`,
		);
		plans.push({
			path: `${docsFolder}/${executor}/${dirForJob(job)}/${title}.md`,
			content,
			kind: "任务流",
			title,
			jobId: job.id,
			source: sourceInfo(job),
		});
	}

	// 顶层入口（无 MAIN 的链路，如文件A 顶层 VIRTUAL）已在 plans 中，无需特殊处理；
	// 但入口 VIRTUAL 的「对应任务流名称」为 待确认，提醒用户。
	for (const job of tasks) {
		if (!tree.parentOf.has(job.id)) {
			warnings.push(`批任务「${job.jobDesc}」没有所属任务流（链路入口），frontmatter 对应任务流名称已标 待确认`);
		}
	}

	return { plans, warnings };
}
