import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { test, skip } from "node:test";
import assert from "node:assert/strict";
import { parseXxlXml } from "../src/parser";
import { buildFlowTree, mapEnum, ROUTE_MAP, resolveJobBeanName, sanitizeFileName } from "../src/mapping";
import { buildImportPlans } from "../src/writer";

const FIXTURE_DIR = process.env.XXL_XML_FIXTURES ?? "/Users/chenzhongjun/Desktop/obsidian材料";
const FIX_A = join(FIXTURE_DIR, "通用保险执行器(xxl-job-executor-batch-job-demo) (1).xml");
const FIX_B = join(FIXTURE_DIR, "通用保险执行器(xxl-job-executor-batch-job-demo).xml");

// ---------- 合成样例：MAIN → 2 VIRTUAL → 各 2 COMPONENT（验证 n 元树） ----------

const synthetic = `<linked-list>
  <job><xxlJobInfo>
    <id>1</id><jobGroup>100</jobGroup><jobCron>0 0 2 * * ?</jobCron>
    <jobDesc>主链路</jobDesc><author>u1</author>
    <executorRouteStrategy>FIRST</executorRouteStrategy><executorBlockStrategy>SERIAL_EXECUTION</executorBlockStrategy>
    <jobLevelType>MAIN_TRIGGER_JOB</jobLevelType><executeBizDateType>TODAY</executeBizDateType>
    <misfireStrategy>DO_NOTHING</misfireStrategy><triggerStatus>0</triggerStatus>
  </xxlJobInfo>
  <yrTriggerInfo><triggerId>1</triggerId><taskFlowInfo>{&quot;nodes&quot;:[{&quot;triggerId&quot;:10,&quot;label&quot;:&quot;任务A&quot;,&quot;type&quot;:&quot;node&quot;,&quot;id&quot;:&quot;n1&quot;},{&quot;triggerId&quot;:11,&quot;label&quot;:&quot;任务B&quot;,&quot;type&quot;:&quot;node&quot;,&quot;id&quot;:&quot;n2&quot;}],&quot;edges&quot;:[{&quot;source&quot;:&quot;n1&quot;,&quot;target&quot;:&quot;n2&quot;}]}</taskFlowInfo></yrTriggerInfo>
  </job>
  <job><xxlJobInfo>
    <id>10</id><jobGroup>100</jobGroup><jobDesc>任务A</jobDesc><author>u2</author>
    <executorRouteStrategy>FIRST</executorRouteStrategy><executorBlockStrategy>SERIAL_EXECUTION</executorBlockStrategy>
    <executorParam>{&quot;pageSize&quot;:500,&quot;organCode&quot;:&quot;R1&quot;}</executorParam>
    <jobLevelType>VIRTUAL_JOB</jobLevelType><executeBizDateType>TODAY</executeBizDateType>
    <misfireStrategy>DO_NOTHING</misfireStrategy><triggerStatus>0</triggerStatus>
  </xxlJobInfo>
  <yrTriggerInfo><triggerId>10</triggerId><taskFlowInfo>{&quot;nodes&quot;:[{&quot;triggerId&quot;:100,&quot;label&quot;:&quot;组件A1&quot;,&quot;type&quot;:&quot;node&quot;,&quot;id&quot;:&quot;c1&quot;},{&quot;triggerId&quot;:101,&quot;label&quot;:&quot;组件A2&quot;,&quot;type&quot;:&quot;node&quot;,&quot;id&quot;:&quot;c2&quot;}],&quot;edges&quot;:[]}</taskFlowInfo></yrTriggerInfo>
  </job>
  <job><xxlJobInfo>
    <id>11</id><jobGroup>100</jobGroup><jobDesc>任务B</jobDesc><author>u2</author>
    <executorRouteStrategy>FIRST</executorRouteStrategy><executorBlockStrategy>SERIAL_EXECUTION</executorBlockStrategy>
    <jobLevelType>VIRTUAL_JOB</jobLevelType><executeBizDateType>TODAY</executeBizDateType>
    <misfireStrategy>DO_NOTHING</misfireStrategy><triggerStatus>0</triggerStatus>
  </xxlJobInfo>
  <yrTriggerInfo><triggerId>11</triggerId><taskFlowInfo>{&quot;nodes&quot;:[{&quot;triggerId&quot;:102,&quot;label&quot;:&quot;组件B1&quot;,&quot;type&quot;:&quot;node&quot;,&quot;id&quot;:&quot;c3&quot;}],&quot;edges&quot;:[]}</taskFlowInfo></yrTriggerInfo>
  </job>
  <job><xxlJobInfo>
    <id>100</id><jobGroup>100</jobGroup><jobDesc>组件A1</jobDesc><author>u3</author>
    <executorRouteStrategy>CONSISTENT_HASH</executorRouteStrategy><executorBlockStrategy>DISCARD_LATER</executorBlockStrategy>
    <jobLevelType>COMPONENT_JOB</jobLevelType><misfireStrategy>DO_NOTHING</misfireStrategy><triggerStatus>0</triggerStatus>
    <executorParam>{&quot;pageSize&quot;:500}</executorParam>
    <jobInfo>{&quot;nodes&quot;:[{&quot;id&quot;:&quot;s&quot;,&quot;label&quot;:&quot;开始&quot;,&quot;dataType&quot;:&quot;startNode&quot;},{&quot;id&quot;:&quot;r&quot;,&quot;label&quot;:&quot;组件A1&quot;,&quot;dataType&quot;:&quot;rect&quot;,&quot;processClass&quot;:&quot;beanA1Job&quot;},{&quot;id&quot;:&quot;e&quot;,&quot;label&quot;:&quot;结束&quot;,&quot;dataType&quot;:&quot;endNode&quot;}],&quot;edges&quot;:[{&quot;source&quot;:&quot;s&quot;,&quot;target&quot;:&quot;r&quot;},{&quot;source&quot;:&quot;r&quot;,&quot;target&quot;:&quot;e&quot;}]}</jobInfo>
  </xxlJobInfo>
  <yrJobInfo><id>y100</id><name>组件A1</name></yrJobInfo>
  </job>
  <job><xxlJobInfo>
    <id>101</id><jobGroup>100</jobGroup><jobDesc>组件A2</jobDesc>
    <executorRouteStrategy>FIRST</executorRouteStrategy><executorBlockStrategy>SERIAL_EXECUTION</executorBlockStrategy>
    <jobLevelType>COMPONENT_JOB</jobLevelType><misfireStrategy>DO_NOTHING</misfireStrategy><triggerStatus>0</triggerStatus>
  </xxlJobInfo>
  <yrJobInfo><id>y101</id><name>组件A2</name></yrJobInfo>
  </job>
  <job><xxlJobInfo>
    <id>102</id><jobGroup>100</jobGroup><jobDesc>组件B1</jobDesc>
    <executorRouteStrategy>FIRST</executorRouteStrategy><executorBlockStrategy>SERIAL_EXECUTION</executorBlockStrategy>
    <jobLevelType>COMPONENT_JOB</jobLevelType><misfireStrategy>DO_NOTHING</misfireStrategy><triggerStatus>0</triggerStatus>
  </xxlJobInfo>
  <yrJobInfo><id>y102</id><name>组件B1</name></yrJobInfo>
  </job>
</linked-list>`;

test("枚举映射表", () => {
	assert.equal(mapEnum(ROUTE_MAP, "FIRST"), "第一个");
	assert.equal(mapEnum(ROUTE_MAP, "SHARDING_BROADCAST"), "分片广播");
	assert.equal(mapEnum(ROUTE_MAP, "UNKNOWN_X"), "UNKNOWN_X"); // 未识别原样
});

test("文件名净化", () => {
	assert.equal(sanitizeFileName('a/b\\c:d*e?f"g<h>i|j'), "a-b-c-d-e-f-g-h-i-j");
});

test("合成样例：解析与层级", () => {
	const r = parseXxlXml(synthetic, "synthetic.xml");
	assert.equal(r.jobs.length, 6);
	const levels = Object.groupBy(r.jobs, (j) => j.level);
	assert.equal(levels.MAIN?.length, 1);
	assert.equal(levels.VIRTUAL?.length, 2);
	assert.equal(levels.COMPONENT?.length, 3);
	const main = r.jobs.find((j) => j.id === "1")!;
	assert.equal(main.cron, "0 0 2 * * ?");
	assert.deepEqual(main.childrenIds, ["10", "11"]);
	const comp = r.jobs.find((j) => j.id === "100")!;
	assert.equal(comp.processClass, "beanA1Job");
});

test("合成样例：n 元树与父子关系", () => {
	const tree = buildFlowTree([parseXxlXml(synthetic)]);
	assert.equal(tree.roots.length, 1);
	assert.equal(tree.roots[0].jobDesc, "主链路");
	assert.equal(tree.parentOf.get("10"), "1");
	assert.equal(tree.parentOf.get("11"), "1");
	assert.equal(tree.parentOf.get("100"), "10");
	assert.equal(tree.parentOf.get("102"), "11");
});

test("合成样例：三遍法生成 6 份文档", () => {
	const tree = buildFlowTree([parseXxlXml(synthetic)]);
	const { plans, warnings } = buildImportPlans(tree, () => "测试执行器");
	assert.equal(plans.length, 6);
	assert.ok(warnings.length === 0, `unexpected warnings: ${warnings.join("; ")}`);
	const kinds = Object.groupBy(plans, (p) => p.kind);
	assert.equal(kinds["任务流"]?.length, 1);
	assert.equal(kinds["批任务"]?.length, 2);
	assert.equal(kinds["任务组件"]?.length, 3);

	const flow = plans.find((p) => p.kind === "任务流")!;
	assert.ok(flow.path.includes("/任务流/主链路.md"), flow.path);
	assert.match(flow.content, /fileClass: 任务流/);
	assert.match(flow.content, /调度状态: 停止/);
	assert.match(flow.content, /Cron表达式: "0 0 2 \* \* \?"/);
	// mermaid 双链指向任务目录
	assert.match(flow.content, /\[\[8\.xxljob\/测试执行器\/任务\/任务A\|任务A\]\]/);
	assert.match(flow.content, /1 --> 2/); // n1→n2 边
	assert.match(flow.content, /2 --> 3/);

	const taskA = plans.find((p) => p.title === "任务A")!;
	assert.match(taskA.content, /fileClass: 批任务/);
	assert.match(taskA.content, /对应任务流名称: "主链路"/);
	assert.match(taskA.content, /\[\[8\.xxljob\/测试执行器\/任务组件\/组件A1\|组件A1\]\]/);
	assert.match(taskA.content, /任务参数: "\{\\"pageSize\\":500/); // 参数反转义保留

	const compA1 = plans.find((p) => p.title === "组件A1")!;
	assert.match(compA1.content, /fileClass: 任务组件/);
	assert.match(compA1.content, /对应批任务名称: "任务A"/);
	assert.match(compA1.content, /路由策略: 一致性hash/);
	assert.match(compA1.content, /阻塞处理策略: 丢弃后续调度/);
	assert.match(compA1.content, /jobBeanName: "beanA1Job"/);
	assert.match(compA1.content, /分片参数: "待确认"/);
	assert.match(compA1.content, /排序规则：待确认/);
	assert.match(compA1.content, /# 来源信息/);

	// 组件 A1 的 mermaid 使用画布 processClass
	assert.match(compA1.content, /B\[beanA1Job\]/);
});

test("合成样例：雪花 ID 精度保持（字符串处理）", () => {
	const long = "1267443418091716608";
	// 注意：JSON 在 XML 里是 &quot; 转义形式，替换需匹配转义后的写法
	const xml = synthetic
		.replace(/<triggerId>10<\/triggerId>/g, `<triggerId>${long}</triggerId>`)
		.replace("<id>10</id>", `<id>${long}</id>`)
		.replace(/&quot;triggerId&quot;:10,/g, `&quot;triggerId&quot;:${long},`);
	const r = parseXxlXml(xml);
	const main = r.jobs.find((j) => j.id === "1")!;
	assert.ok(main.childrenIds.includes(long), `childrenIds=${main.childrenIds}`);
	const parsed = r.jobs.find((j) => j.id === long);
	assert.ok(parsed, "长 ID 任务存在");
	assert.equal(parsed!.level, "VIRTUAL");
});

// ---------- 真实样例（fixture 在仓库外，缺失则跳过） ----------

const hasA = existsSync(FIX_A);
const hasB = existsSync(FIX_B);

test("真实样例A：担保函链路（无 MAIN，顶层 VIRTUAL → 2 组件）", { skip: !hasA && "fixture 不存在" }, () => {
	const r = parseXxlXml(readFileSync(FIX_A, "utf-8"), FIX_A);
	assert.equal(r.jobs.length, 3);
	assert.equal(r.jobGroups[0], "1120");
	const tree = buildFlowTree([r]);
	assert.equal(tree.roots.length, 1);
	assert.equal(tree.roots[0].level, "VIRTUAL");
	const gen = r.jobs.find((j) => j.jobDesc === "担保函生成任务组件")!;
	assert.equal(gen.processClass, "letterOfGuaranteeGenerateJob");
	const { plans } = buildImportPlans(tree, () => "通用保险执行器");
	assert.equal(plans.length, 3);
	const up = plans.find((p) => p.title === "担保函上传任务组件")!;
	assert.match(up.content, /jobBeanName: "letterOfGuaranteeUploadJob"/);
	// 顶层 VIRTUAL 的对应任务流名称为待确认
	const task = plans.find((p) => p.kind === "批任务")!;
	assert.match(task.content, /对应任务流名称: "待确认"/);
});

test("真实样例B：账务文件链路（MAIN → 3 任务 → 3 组件）", { skip: !hasB && "fixture 不存在" }, () => {
	const r = parseXxlXml(readFileSync(FIX_B, "utf-8"), FIX_B);
	assert.equal(r.jobs.length, 7);
	const main = r.jobs.find((j) => j.level === "MAIN")!;
	assert.equal(main.cron, "0 15/20 4-20 * * ?");
	assert.equal(main.childrenIds.length, 3);
	assert.equal(main.alarmMobile, "17887285283");
	const tree = buildFlowTree([r]);
	assert.equal(tree.roots.length, 1);
	const { plans, warnings } = buildImportPlans(tree, () => "通用保险执行器");
	assert.equal(plans.length, 7);
	// MAIN 的 mermaid 引用三个任务
	const flow = plans.find((p) => p.kind === "任务流")!;
	assert.match(flow.content, /任务\/【蚂蚁星河-广州盛大】账务文件-数据加工/);
	assert.match(flow.content, /任务\/【蚂蚁星河-广州盛大】账务文件-文件上传/);
	// 批任务回链任务流
	const task = plans.find((p) => p.title === "【蚂蚁星河-广州盛大】账务文件-数据加工")!;
	assert.match(task.content, /对应任务流名称: "【蚂蚁星河-广州盛大】账务文件-加工生成及上传"/);
	// jobBeanName 是任务组件级字段：在数据加工组件文档上断言
	const dataComp = plans.find((p) => p.title === "【账务文件配置】数据加工")!;
	assert.match(dataComp.content, /对应批任务名称: "【蚂蚁星河-广州盛大】账务文件-数据加工"/);
	assert.match(dataComp.content, /jobBeanName: "assetfileProcessJob"/);
	// 组件回链批任务
	const comps = plans.filter((p) => p.kind === "任务组件");
	assert.ok(comps.every((c) => /对应批任务名称: "【蚂蚁星河/.test(c.content)), comps.map((c) => c.title).join(","));
	// 未识别枚举警告为 0（样例枚举均在映射表内）
	assert.equal(warnings.filter((w) => w.includes("未识别")).length, 0, warnings.join("; "));
});

test("真实样例：A+B 合并导入（跨文件去重）", { skip: !hasA || !hasB && "fixture 不存在" }, () => {
	const ra = parseXxlXml(readFileSync(FIX_A, "utf-8"), FIX_A);
	const rb = parseXxlXml(readFileSync(FIX_B, "utf-8"), FIX_B);
	const tree = buildFlowTree([ra, rb]);
	assert.equal(tree.jobs.length, 10); // 3 + 7
	const { plans } = buildImportPlans(tree, () => "通用保险执行器");
	assert.equal(plans.length, 10);
	// 两条独立链路，roots 应为 2（B 的 MAIN + A 的顶层 VIRTUAL）
	assert.equal(tree.roots.length, 2);
});

test("resolveJobBeanName 回退 executorParam.executeBeanName", () => {
	const r = parseXxlXml(synthetic);
	const taskA = r.jobs.find((j) => j.id === "10")!;
	assert.equal(resolveJobBeanName(taskA), undefined); // 任务层无 processClass
});
