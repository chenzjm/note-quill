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
import type { FilePlan, ParsedJob } from "./types";

// ---------- YAML frontmatter ----------

/** 字符串值用 JSON.stringify 生成（JSON 转义与 YAML 双引号风格兼容），枚举原样 */
function yv(value?: string): string {
	if (value === undefined || value === "") return '""';
	return JSON.stringify(value);
}

function frontmatter(lines: string[]): string {
	return `---\n${lines.join("\n")}\n---`;
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

// ---------- 参数表 ----------

function buildParamTable(job: ParsedJob): string {
	if (!job.executorParam) return "无任务参数。";
	if (!job.paramJson) return `任务参数（JSON 解析失败，原样保留）：\n\n\`${job.executorParam}\``;
	const rows = ["| 参数 | 值 |", "|---|---|"];
	for (const [k, v] of Object.entries(job.paramJson)) {
		rows.push(`| ${k} | \`${typeof v === "string" ? v : JSON.stringify(v)}\` |`);
	}
	return rows.join("\n");
}

function bizScope(job: ParsedJob): string {
	if (!job.paramJson) return "待确认";
	const items: string[] = [];
	for (const [k, v] of Object.entries(job.paramJson)) {
		if (/^(ORG_CODE|organCode|TENANT_ID|JOB_TRADE_CODE|bizMode|businessDim|businessType)$/.test(k)) {
			items.push(`- ${k}: \`${String(v)}\``);
		}
	}
	items.push("- 其余业务范围：待确认");
	return items.join("\n");
}

function pageSizeNote(job: ParsedJob): string {
	const ps = job.paramJson?.["pageSize"];
	if (ps === undefined) return "待确认";
	const text = typeof ps === "string" ? ps : JSON.stringify(ps);
	return `涉及分页，pageSize=${text}。排序规则：待确认。`;
}

// ---------- 来源信息 ----------

function sourceInfo(job: ParsedJob): string {
	const items: string[] = [];
	if (job.author) items.push(`- 负责人（author）：${job.author}`);
	if (job.addTime) items.push(`- 创建时间：${job.addTime}`);
	if (job.updateTime) items.push(`- 更新时间：${job.updateTime}`);
	items.push(`- 原 id：${job.id}`);
	if (job.alarmMobile) items.push(`- 告警手机号：${job.alarmMobile}`);
	return items.join("\n");
}

const GUIDE_NOTE = "> 本页维护当前契约。本次差异、风险、测试结果与评审结论统一放在设计文档。按适用场景填写，未核实写待确认；不适用写依据。";

// ---------- 三类文档正文 ----------

function taskFlowBody(
	tree: FlowTree,
	job: ParsedJob,
	docsFolder: string,
	executorFor: (job: ParsedJob) => string,
): string {
	const cronDesc = job.cron ? `调度 Cron \`${job.cron}\`` : "无调度（被上层编排触发）";
	const bizDate = mapEnum(BIZDATE_MAP, job.executeBizDateType);
	const lines = [
		GUIDE_NOTE,
		"",
		"# 任务说明",
		"> 说明该任务流做什么、何时触发、失败如何处理。",
		"> 使用流程图或者时序图说明。任务流的流程图中可以直接引用对应的任务。",
		"",
		`本任务流来自 xxl-job 导入：${job.jobDesc}；${cronDesc}${bizDate ? `；业务执行日期 ${bizDate}` : ""}。下辖 ${job.childrenIds.filter((c) => tree.byId.has(c)).length} 个任务。失败处理：待确认。`,
		"",
		buildParentMermaid(
			tree,
			job,
			"任务",
			(cid) => tree.byId.get(cid)?.jobDesc ?? cid,
			(cid) => `${docsFolder}/${executorFor(tree.byId.get(cid)!)}`,
		),
		"",
		"# 来源信息",
		sourceInfo(job),
	];
	return lines.join("\n");
}

function taskBody(
	tree: FlowTree,
	job: ParsedJob,
	docsFolder: string,
	executorFor: (job: ParsedJob) => string,
): string {
	const parentFlow = parentTaskFlowName(tree, job);
	const childCount = job.childrenIds.filter((c) => tree.byId.has(c)).length;
	const lines = [
		GUIDE_NOTE,
		"",
		"# 任务说明",
		"> 说明该任务做什么、何时触发、失败如何处理。",
		"> 使用流程图或者时序图说明。",
		"",
		`本任务来自 xxl-job 导入：${job.jobDesc}；属【${parentFlow ?? "待确认"}】任务流的编排节点，下辖 ${childCount} 个任务组件。失败处理：待确认。`,
		"",
		buildParentMermaid(
			tree,
			job,
			"任务组件",
			(cid) => tree.byId.get(cid)?.jobDesc ?? cid,
			(cid) => `${docsFolder}/${executorFor(tree.byId.get(cid)!)}`,
		),
		"",
		"# 任务参数",
		"> 该任务下发给执行器的参数（executorParam）。",
		buildParamTable(job),
		"",
		"# 来源信息",
		sourceInfo(job),
	];
	return lines.join("\n");
}

function componentBody(job: ParsedJob): string {
	const bean = resolveJobBeanName(job);
	const lines = [
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
		bizScope(job),
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
		pageSizeNote(job),
		"",
		"# 来源信息",
		sourceInfo(job),
	];
	return lines.join("\n");
}

// ---------- frontmatter（严格按 _fileclasses 字段与顺序） ----------

function taskFlowFm(tree: FlowTree, job: ParsedJob, executor: string): string[] {
	return [
		"fileClass: 任务流",
		`执行器: ${yv(executor)}`,
		`任务流名称: ${yv(job.jobDesc)}`,
		`业务执行日期: ${mapEnum(BIZDATE_MAP, job.executeBizDateType) ?? "今天"}`,
		`Cron表达式: ${yv(job.cron)}`,
		`负责人: ${yv(job.author ?? "待确认")}`,
		`调度过期策略: ${mapEnum(MISFIRE_MAP, job.misfireStrategy) ?? "忽略"}`,
		"调度状态: 停止",
	];
}

function taskFm(tree: FlowTree, job: ParsedJob, executor: string): string[] {
	return [
		"fileClass: 批任务",
		`执行器: ${yv(executor)}`,
		`对应任务流名称: ${yv(parentTaskFlowName(tree, job) ?? "待确认")}`,
		`任务名称: ${yv(job.jobDesc)}`,
		`负责人: ${yv(job.author ?? "待确认")}`,
		`任务参数: ${yv(job.executorParam)}`,
		`调度过期策略: ${mapEnum(MISFIRE_MAP, job.misfireStrategy) ?? "忽略"}`,
	];
}

function componentFm(tree: FlowTree, job: ParsedJob, executor: string): { lines: string[]; warnings: string[] } {
	const sharding = extractShardingParam(job.paramJson);
	const warnings: string[] = [];
	const route = mapEnum(ROUTE_MAP, job.routeStrategy);
	if (job.routeStrategy && route === job.routeStrategy) warnings.push(`未识别的路由策略枚举：${job.routeStrategy}（原样写入）`);
	const block = mapEnum(BLOCK_MAP, job.blockStrategy);
	if (job.blockStrategy && block === job.blockStrategy) warnings.push(`未识别的阻塞处理策略枚举：${job.blockStrategy}（原样写入）`);
	return {
		lines: [
			"fileClass: 任务组件",
			`执行器: ${yv(executor)}`,
			`对应批任务名称: ${yv(parentTaskName(tree, job) ?? "待确认")}`,
			`任务组件名称: ${yv(job.jobDesc)}`,
			`路由策略: ${route ?? "第一个"}`,
			`阻塞处理策略: ${block ?? "单机串行"}`,
			`分片参数: ${yv(sharding ?? "待确认")}`,
			`jobBeanName: ${yv(resolveJobBeanName(job) ?? "待确认")}`,
			`调度过期策略: ${mapEnum(MISFIRE_MAP, job.misfireStrategy) ?? "忽略"}`,
		],
		warnings,
	};
}

// ---------- 三遍法编排 ----------

export interface ImportPlanResult {
	plans: FilePlan[];
	warnings: string[];
}

/**
 * 自底向上三遍法：先任务组件（叶子）→ 批任务（引用组件路径）→ 任务流（引用任务路径）。
 * 同 id 任务跨文件去重后，每个任务生成一份文档。
 */
export function buildImportPlans(tree: FlowTree, executorFor: (job: ParsedJob) => string, docsFolder = "8.xxljob"): ImportPlanResult {
	const warnings = [...tree.warnings];
	const titleOf = new Map<string, string>(); // id → 文档名（去 .md）

	// 标题：批任务/任务流用 jobDesc；任务组件 jobDesc 为准（与 yrJobName 不一致时 name 记入正文备注已由 body 处理）
	for (const job of tree.jobs) {
		titleOf.set(job.id, sanitizeFileName(job.jobDesc || job.yrJobName || job.id));
	}

	const components = tree.jobs.filter((j) => j.level === "COMPONENT");
	const tasks = tree.jobs.filter((j) => j.level === "VIRTUAL");
	const flows = tree.jobs.filter((j) => j.level === "MAIN");

	const plans: FilePlan[] = [];

	// Pass 1: 任务组件
	for (const job of components) {
		const executor = executorFor(job);
		const title = titleOf.get(job.id)!;
		const fm = componentFm(tree, job, executor);
		for (const w of fm.warnings) warnings.push(`任务组件「${job.jobDesc}」${w}`);
		plans.push({
			path: `${docsFolder}/${executor}/${dirForJob(job)}/${title}.md`,
			content: `${frontmatter(fm.lines)}\n\n${componentBody(job)}\n`,
			kind: "任务组件",
			title,
			jobId: job.id,
		});
	}

	// Pass 2: 批任务（任务层）
	for (const job of tasks) {
		const executor = executorFor(job);
		const title = titleOf.get(job.id)!;
		const fm = taskFm(tree, job, executor);
		plans.push({
			path: `${docsFolder}/${executor}/${dirForJob(job)}/${title}.md`,
			content: `${frontmatter(fm)}\n\n${taskBody(tree, job, docsFolder, executorFor)}\n`,
			kind: "批任务",
			title,
			jobId: job.id,
		});
	}

	// Pass 3: 任务流
	for (const job of flows) {
		const executor = executorFor(job);
		const title = titleOf.get(job.id)!;
		const fm = taskFlowFm(tree, job, executor);
		plans.push({
			path: `${docsFolder}/${executor}/${dirForJob(job)}/${title}.md`,
			content: `${frontmatter(fm)}\n\n${taskFlowBody(tree, job, docsFolder, executorFor)}\n`,
			kind: "任务流",
			title,
			jobId: job.id,
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
