---
title: "pi agent - 实现一个 agent 循环"
draft: false
date: 2026-09-23T10:21:26+08:00
description: "基于Pi agent 学习 ai agent 相关知识"
tags: [agent, pi, AI, loop]
---

# 第 2 天 · 动手：把 agent 循环亲手写一遍

> 前置：[第 1 天 · 概念入门](https://hugh-zhan9.github.io/posts/pi-docs/01-agent-concepts/)。
> 本篇目标：把 pi 跑起来；然后用 `pi-ai` 亲手写一个 40 行的 tool-calling 循环；再用 `pi-agent-core` 的 `Agent` 类替换它，用对比看清框架替你做了什么。
> 预计用时：3–4 小时（大部分时间在敲和调）。

***

## 0. **从本仓库源码跑**

```bash
cd /path/to/pi
npm install --ignore-scripts
npm run build          # 会联网刷新模型目录数据
# 或 npm run build:offline    用已有的模型数据，不联网

./pi-test.sh           # 从任意目录都能跑，保留调用者的 cwd
```

看一眼 [`pi-test.sh`](../pi-test.sh) 最后一行就知道它在干嘛：

```bash
"$SCRIPT_DIR/node_modules/.bin/tsx" --tsconfig "$SCRIPT_DIR/tsconfig.json" \
  "$SCRIPT_DIR/packages/coding-agent/src/experimental/cli.ts" ${ARGS[@]+"${ARGS[@]}"}
```

用 `tsx` 直接跑 TypeScript 源码，不用先编译。**改了源码立刻生效**，这对后面几天读代码时做实验非常方便。

顺带一提，`./pi-test.sh --no-env` 会先清掉所有 API key 环境变量再启动，用来测试"没有凭证时"的行为。

### 认证

在 pi 里跑 `/login` 选订阅制供应商（Claude Pro/Max、ChatGPT Plus/Pro、GitHub Copilot），或者直接用上面的环境变量。凭证存在 `~/.pi/agent/auth.json`。

***

## 1. 常见的用法

| 操作                  | 看什么                                                               |
| ------------------- | ----------------------------------------------------------------- |
| 输入 `!git status`    | `!` 开头的命令在本地执行，输出**会**进入模型上下文                                     |
| 输入 `!!ls -la`       | `!!` 执行但输出**不**进上下文（对应 `BashExecutionMessage.excludeFromContext`） |
| 模型正在跑工具时敲一句话按 Enter | 这是 **steering**，会在当前 turn 的工具跑完后送达                                |
| 同样场景按 Alt+Enter     | 这是 **follow-up**，等模型彻底停下来才送达                                      |
| `/session`          | 看当前会话文件路径、token 数、花费                                              |
| `/tree`             | 看会话树。每条消息都有 id/parentId，可以跳回任意一点重来                                |
| `/model`            | 切模型。Ctrl+S 保存为默认                                                  |
| Shift+Tab           | 循环切换思考强度                                                          |

`/tree` 特别值得多玩一会儿。它直观展示了"会话是一棵树而不是一条线"——第 5 天会讲这棵树是怎么存的。

完整命令表在 [`packages/coding-agent/docs/usage.md`](../packages/coding-agent/docs/usage.md)。

***

## 2. 实验 1：用 pi-ai 调一次模型

现在离开成品，回到最底层。建一个练习目录（**放在 pi 仓库之外**，避免和仓库的 lint/类型检查打架）：

```bash
mkdir ~/pi-lab && cd ~/pi-lab
npm init -y
npm pkg set type=module
npm install @earendil-works/pi-ai
npm install -D tsx typescript
```

新建 `lab1.ts`：

```typescript
import type { Context } from "@earendil-works/pi-ai";
import { builtinModels } from "@earendil-works/pi-ai/providers/all";

// builtinModels() 返回一个注册了全部内置 provider 的 Models 集合
const models = builtinModels();

const model = models.getModel("anthropic", "claude-sonnet-4-5");
if (!model) throw new Error("模型不存在，换一个 provider/id");

const context: Context = {
  systemPrompt: "你是一个简洁的助手，用中文回答。",
  messages: [{ role: "user", content: "用一句话解释什么是 tool calling", timestamp: Date.now() }],
};

// 流式：拿到一个事件流
const stream = models.streamSimple(model, context);

for await (const event of stream) {
  if (event.type === "text_delta") process.stdout.write(event.delta);
}

// 流结束后取最终消息
const final = await stream.result();
console.log("\n---");
console.log("stopReason:", final.stopReason);
console.log("tokens:", final.usage.input, "in /", final.usage.output, "out");
console.log("cost: $", final.usage.cost.total.toFixed(6));
```

跑它：

```bash
npx tsx lab1.ts
```

### 上述代码中的 5 个关键点

**1）`Models` 是一个集合，不是一个函数。**
`builtinModels()` 把所有内置 provider 注册进去。如果你在意打包体积，可以只注册需要的：

```typescript
import { createModels } from "@earendil-works/pi-ai";
import { anthropicProvider } from "@earendil-works/pi-ai/providers/anthropic";

const models = createModels();
models.setProvider(anthropicProvider());
```

**2）认证是自动的，而且有优先级。**
你没写任何 `apiKey`，`models.streamSimple()` 会通过 provider 解析认证：存储的凭证优先，然后是环境变量。想显式覆盖就传 `{ apiKey: "..." }`，想在不发请求的情况下检查，用 `await models.getAuth(model)`。

**3）`Context` 里的 `systemPrompt` 和 `tools` 是简写。**
它们会被 `normalizeContext()` 折叠成一条首部 system 消息。再往下（provider 实现那层）只有 `TranscriptContext`，只有 `messages`。这正是第 1 天说的"提示词存在 transcript 里"。

**4）流式失败不会抛异常。**
一旦流被返回，请求失败会以 `error` 事件出现，最终消息的 `stopReason` 是 `"error"` 或 `"aborted"`，细节在 `errorMessage`。这个约定贯穿整个 Pi：**底层不靠异常传递模型调用失败**，因为异常会打断事件序列。

**5）`streamSimple` vs `stream`。**
`streamSimple` 用跨供应商统一的选项（比如 `reasoning: "medium"`）；`stream` 接受该 API 独有的完整选项（比如 Anthropic 的 `thinkingEnabled` + `thinkingBudgetTokens`）。agent 层用的是前者。

想拿完整响应而不流式，用 `await models.completeSimple(model, context)`。

### 加一段"思考"

普通模型收到问题，直接开始写答案。**推理模型（reasoning model）** 会先在内部"想一会儿” —— 产出一段**不是最终答案**的推理内容 —— 然后才写答案。

pi-ai 把这段推理内容作为 **单独的内容块 **暴露出来，和正文分开。所以一条 assistant 消息的 `content` 可能长这样：

```
[
  { type: "thinking", thinking: "用户问的是 X。我需要先确认 Y，因为…" },   ← 推理过程
  { type: "text",     text: "答案是 Z。" }                                  ← 最终答案
]
```

流式的时候，这两种块**各有自己的一套事件**：

| 内容块 | 开始               | 增量               | 结束             |
| :-- | :--------------- | :--------------- | :------------- |
| 正文  | `text_start`     | `text_delta`     | `text_end`     |
| 思考  | `thinking_start` | `thinking_delta` | `thinking_end` |

lab1 里你只处理了 `text_delta`，所以思考内容被你丢掉了（模型可能根本没思考，因为你没开）。完整事件表第 3 天看。

#### 打开它

给 `streamSimple` 传 `reasoning`：

```
const stream = models.streamSimple(model, context, { reasoning: "medium" });

for await (const event of stream) {
  if (event.type === "thinking_delta") {
    // \x1b[90m 和 \x1b[0m 是 ANSI 转义码：前者把后续文字变成灰色，后者恢复默认色。
    // 纯粹是为了在终端里一眼区分"思考"和"答案"，删掉也能正常跑。
    process.stdout.write("\x1b[90m" + event.delta + "\x1b[0m");
  }
  if (event.type === "text_delta") {
    process.stdout.write(event.delta);
  }
}
```

不想折腾颜色，用标记更清楚：

```
for await (const event of stream) {
  if (event.type === "thinking_start") console.log("\n[思考中…]");
  if (event.type === "thinking_delta") process.stdout.write(event.delta);
  if (event.type === "thinking_end")   console.log("\n[思考结束]\n");
  if (event.type === "text_delta")     process.stdout.write(event.delta);
}
```

流结束后，思考内容也在最终消息里：

```
const final = await stream.result();
for (const block of final.content) {
  if (block.type === "thinking") console.log("思考:", block.thinking);
  if (block.type === "text")     console.log("回答:", block.text);
}
```

#### 档位控制什么，代价是什么

六档，从少到多：

```
minimal  <  low  <  medium  <  high  <  xhigh  <  max
```

档位越高，模型想得越久、越细。代价很直接：**更慢，而且更贵**——思考产生的 token 算在 `usage.output` 里，按输出价格计费。

`Usage` 里有个 `reasoning` 字段，源码注释专门提醒了一句（[`packages/ai/src/types.ts`](../packages/ai/src/types.ts)）：

> Reasoning/thinking tokens, when the provider reports them. **This is a subset of `output`: `output` already includes these tokens.**
>
> （供应商上报思考 token 数时会填这个字段。**它是 `output` 的子集，`output` 已经包含了这些 token。**）

所以算成本时**不要把它和 `output` 相加**。

#### "不思考” 怎么表示

这是个容易踩的点。pi-ai 的 `reasoning` 参数类型里**根本没有 `"off"`**：

```
// packages/ai/src/types.ts
export type ThinkingLevel = "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
```

**不想思考，就不传这个参数。**

（agent 层另有一个包含 `"off"` 的 `ThinkingLevel`，因为它要表示"用户当前选的档位"这个状态。在 `agent-loop.ts` 里看到这个转换：`thinkingLevel === "off"` → `reasoning: undefined`。）

#### 怎么知道一个模型支不支持

```
import { getSupportedThinkingLevels, clampThinkingLevel } from "@earendil-works/pi-ai";

console.log(model.reasoning);                    // boolean：它是不是推理模型
console.log(getSupportedThinkingLevels(model));  // 它实际支持哪些档位
```

要点：

- **非推理模型**：`model.reasoning === false`，`getSupportedThinkingLevels()` 返回 `["off"]`。
- **给非推理模型传 `reasoning` 不会报错，会被静默忽略。** 所以代码里不用到处做条件判断，但也别指望有报错提醒你。
- `minimal` 到 `high` 这四档，推理模型基本都有。
- **`xhigh` 和 `max` 是 opt-in 的**：只有在模型元数据里显式声明了对应映射的模型才有（比如 GPT-5.6 两个都有）。想用先查。
- 不确定某个档位合不合法，用 `clampThinkingLevel(model, level)` 收敛到最近的受支持档位——`createAgentSession()` 内部就是这么做的（第 5 天）。

***

## 3. 实验 2：手写 tool-calling 循环

这是本篇最重要的一段。**先自己写一遍，你才知道框架省了你什么。**

新建 `lab2.ts`：

```typescript
import { Type, validateToolCall } from "@earendil-works/pi-ai";
import type { Context, Message, Tool } from "@earendil-works/pi-ai";
import { builtinModels } from "@earendil-works/pi-ai/providers/all";
import { readFile } from "node:fs/promises";

const models = builtinModels();
const model = models.getModel("anthropic", "claude-sonnet-4-5")!;

// ---- 1. 声明工具 ----------------------------------------------------------
const tools: Tool[] = [
  {
    name: "read_file",
    description: "读取一个文本文件的内容",
    parameters: Type.Object({
      path: Type.String({ description: "相对或绝对文件路径" }),
    }),
  },
  {
    name: "now",
    description: "获取当前时间",
    parameters: Type.Object({}),
  },
];

// ---- 2. 实现工具 ----------------------------------------------------------
async function runTool(name: string, args: any): Promise<string> {
  switch (name) {
    case "read_file":
      return await readFile(args.path, "utf-8");
    case "now":
      return new Date().toISOString();
    default:
      throw new Error(`未知工具: ${name}`);
  }
}

// ---- 3. 循环 --------------------------------------------------------------
const context: Context = {
  systemPrompt: "你是一个助手。需要文件内容时使用 read_file 工具。用中文回答。",
  messages: [{ role: "user", content: "package.json 里声明了哪些 devDependencies？", timestamp: Date.now() }],
  tools,
};

let turn = 0;
while (true) {
  turn++;
  console.log(`\n===== turn ${turn} =====`);

  const stream = models.streamSimple(model, context);
  for await (const event of stream) {
    if (event.type === "text_delta") process.stdout.write(event.delta);
  }
  const assistant = await stream.result();
  context.messages.push(assistant);

  if (assistant.stopReason === "error" || assistant.stopReason === "aborted") {
    console.error("\n请求失败:", assistant.errorMessage);
    break;
  }

  const toolCalls = assistant.content.filter((b) => b.type === "toolCall");
  if (toolCalls.length === 0) break;          // ← 唯一的正常退出条件

  for (const call of toolCalls) {
    console.log(`\n[tool] ${call.name}(${JSON.stringify(call.arguments)})`);
    let content: Message["content"];
    let isError = false;
    try {
      const args = validateToolCall(tools, call);   // 一定要校验！
      content = [{ type: "text", text: await runTool(call.name, args) }];
    } catch (err) {
      content = [{ type: "text", text: err instanceof Error ? err.message : String(err) }];
      isError = true;                                // 错误也回给模型，让它自己纠正
    }
    context.messages.push({
      role: "toolResult",
      toolCallId: call.id,     // 必须与 call.id 一致，否则供应商会拒绝
      toolName: call.name,
      content: content as any,
      isError,
      timestamp: Date.now(),
    });
  }
}

console.log("\n\n总消息数:", context.messages.length);
```

跑：

```bash
npx tsx lab2.ts
```

你应该看到至少两个 turn：第一个 turn 模型调 `read_file`，第二个 turn 才给答案。

### 停下来，数一数这里有多少坑

上面的代码是一个**能跑吗，但很脆弱**的循环。它至少有以下这些事是没处理的：

| 没处理的                          | 后果                                        |
| ----------------------------- | ----------------------------------------- |
| 没有超时和 abort                   | Ctrl+C 只能杀进程，正在跑的工具不会被通知                  |
| 工具串行执行                        | 三个独立的读文件请求要排队                             |
| 没有轮数上限                        | 模型可能无限循环调用工具                              |
| 消息数组无限增长                      | 迟早超出上下文窗口，请求直接被拒                          |
| 没有持久化                         | 进程一退全没了                                   |
| 没有中途插话能力                      | 只能等它跑完                                    |
| 没有事件供 UI 消费                   | 想做界面得从头改                                  |
| 工具输出没有截断                      | 一个 `cat` 大文件就能撑爆上下文                       |
| `stopReason === "length"` 没处理 | 输出被截断时，工具调用的参数可能是**残缺但能解析**的 JSON，照样执行会出事 |

***

&#x20;`stopReason === "length`” 这条值得单独讲，因为它**不会报错，只会静默错误执行**。

#### `"length"` 是什么意思

`stopReason` 是模型告诉你"我这一轮为什么停下来"（lab1 里你打印过它）。`"length"` 的含义是：**不是说完了，是撞到输出 token 上限被硬切断的。**问题在于，被切断的不只是文字。如果模型当时正在写一个工具调用的参数 JSON，**那段 JSON 也是半截的**。

#### 反直觉的地方：半截 JSON 不会报错

直觉上"JSON 不完整 → `JSON.parse` 抛错 → 我就知道出问题了"。实际不是这样。

pi-ai 用一个抢救解析器（`parseStreamingJson`，底层是 `partial-json` 包）把流式过程中的半截 JSON 补全成合法对象——这是为了做 "正在写入 src/foo.ts…” 这类实时 UI 预览。

**而最终定稿走的是同一个函数**（[`packages/ai/src/api/anthropic-messages.ts`](../packages/ai/src/api/anthropic-messages.ts) 的 `content_block_stop` 分支）：

```typescript
} else if (block.type === "toolCall") {
    block.arguments = parseStreamingJson(block.partialJson);
```

所以一个被截断的工具调用，最后拿到的是一个**结构合法的参数对象**。

#### 举一个具体的例子

模型要调 `write(path, content)` 写一个 200 行的配置文件，写到第 90 行时撞到了 token 上限。

供应商实际发过来的 JSON 是半截的：

```
{"path": "src/config.ts", "content": "export const A = 1;\nexport const B
```

抢救解析器补全成：

```javascript
{ path: "src/config.ts", content: "export const A = 1;\nexport const B" }
```

现在看 `write` 的 schema：`path: string`、`content: string`。**两个字段都在，类型都对，校验通过。**

你在 lab2 里写的循环会这样走：

```typescript
const args = validateToolCall(tools, call);   // ✅ 通过
content = await runTool(call.name, args);     // ✅ 执行 → src/config.ts 被写成半截
```

**文件被截断了一半，没有任何报错。** 模型也不知道，因为它收到的工具结果是"写入成功"。

#### Pi 的做法

[`packages/agent/src/agent-loop.ts`](../packages/agent/src/agent-loop.ts) 在执行之前拦了一道：

```typescript
const executedToolBatch =
    message.stopReason === "length"
        ? await failToolCallsFromTruncatedMessage(toolCalls, emit)   // 一个都不执行
        : await executeToolCalls(currentContext, message, config, signal, emit);
```

源码注释写明了理由：

> Streamed tool-call arguments are finalized with a best-effort JSON salvage parser, so a truncated message can yield tool calls whose arguments **parse and validate but are silently incomplete**. None of them are safe to execute; report each as an error so the model can re-issue them.
>
> （流式传输的工具调用参数会通过尽力恢复的 JSON 解析器进行最终处理，因此截断的消息可能导致工具调用的参数**能够解析并验证，但内容不完整且静默忽略**。这些调用均不可安全执行；应将每个此类情况报告为错误，以便模型重新发出。）

注意是**整批都不执行**，不是只跳过最后那个——因为你无法知道切断点落在哪个调用上。每个调用被换成一条错误结果，文字就是给模型看的：

> Tool call "write" was not executed: the response hit the output token limit, so its arguments may be truncated. Re-issue the tool call with complete arguments.
>
> （工具调用 “write” 未执行：响应已达到输出令牌限制，因此其参数可能被截断。请重新发出包含完整参数的工具调用。）

模型读到这句，就会重发完整的调用。

（注意这道拦截**只在有工具调用时才起作用**。如果 `length` 出现在一条没有工具调用的消息上，上面那段代码根本不会进入 `if (toolCalls.length > 0)` 分支，循环就正常结束了 —— 模型的话被截断了，但没有危险的副作用。持久化运行时把这种情况明确命名为"真正的输出上限 length"并当作正常完成，见[附录 A 第 10.2 节](A1-agent-harness.md)。）

<br />

**这些问题的存在，就是 `pi-agent-core` 要解决的。**

***

## 4. 实验 3：换成 Agent 类

现在把同样的事交给框架。

```bash
npm install @earendil-works/pi-agent-core
```

`lab3.ts`：

```typescript
import { Agent } from "@earendil-works/pi-agent-core";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type } from "@earendil-works/pi-ai";
import { builtinModels } from "@earendil-works/pi-ai/providers/all";
import { readFile } from "node:fs/promises";

const models = builtinModels();
const model = models.getModel("anthropic", "claude-sonnet-4-5")!;

// 工具：比 pi-ai 的 Tool 多了 label 和 execute
const readFileTool: AgentTool = {
  name: "read_file",
  label: "Read File",
  description: "读取一个文本文件的内容",
  parameters: Type.Object({
    path: Type.String({ description: "相对或绝对文件路径" }),
  }),
  execute: async (_toolCallId, params, _signal, onUpdate) => {
    onUpdate?.({ content: [{ type: "text", text: `读取 ${params.path}…` }], details: {} });
    const content = await readFile(params.path as string, "utf-8");
    return {
      content: [{ type: "text", text: content }],   // 给模型看
      details: { path: params.path, size: content.length },  // 给 UI / 状态用
    };
  },
};

const agent = new Agent({
  initialState: {
    systemPrompt: "你是一个助手。需要文件内容时使用 read_file 工具。用中文回答。",
    model,
    tools: [readFileTool],
  },
  streamFn: models.streamSimple.bind(models),   // 必填：怎么调模型
});

agent.subscribe((event) => {
  switch (event.type) {
    case "turn_start":
      console.log("\n--- turn ---");
      break;
    case "message_update":
      if (event.assistantMessageEvent.type === "text_delta") {
        process.stdout.write(event.assistantMessageEvent.delta);
      }
      break;
    case "tool_execution_start":
      console.log(`\n[tool] ${event.toolName}`, event.args);
      break;
    case "tool_execution_end":
      console.log(`[tool] ${event.toolName} ${event.isError ? "失败" : "完成"}`);
      break;
    case "agent_end":
      console.log(`\n\n本次运行新增 ${event.messages.length} 条消息`);
      break;
  }
});

await agent.prompt("package.json 里声明了哪些 devDependencies？");
```

### 对比：

|  lab2 写的                       | lab3 里由谁负责                                                             |
| ------------------------------ | ---------------------------------------------------------------------- |
| `while (true)`                 | `agentLoop()` 的双层循环                                                    |
| `context.messages.push(...)`   | `Agent` 内部状态机（`processEvents`）                                         |
| `validateToolCall` + try/catch | `prepareToolCall()` / `executePreparedToolCall()`                      |
| 手动判断是否还有工具调用                   | `hasMoreToolCalls`                                                     |
| `console.log` 打点               | 完整的事件流（`subscribe`）                                                    |
| ——                             | 并行工具执行、abort、steering/follow-up 队列、`stopReason === "length"` 防护、工具变更声明 |

而且注意几处**签名细节**，它们透露了设计意图：

- `streamFn` 是必填的构造参数。`Agent` 自己**不导入任何 provider**，它只要求你给一个"能把 transcript 变成流"的函数。这就是 agent 层不依赖具体模型厂商的原因。
- `execute()` 的第三个参数是 `AbortSignal`，第四个是 `onUpdate` 回调。工具**有责任**响应中断、并且可以边跑边汇报进度。
- 返回值里 `content` 和 `details` 分开。上一篇文章讲过这个分工。
- 工具失败要 **throw**，不要返回一段"出错了"的文本。`packages/agent/README.md` 写得很明确：throw 出来的错误会被捕获并以 `isError: true` 报告给模型；返回值无论写什么都不会设置错误标志。

### 加一个权限门

`Agent` 有一堆钩子。试试最有用的那个：

```typescript
const agent = new Agent({
  // …同上…
  beforeToolCall: async ({ toolCall, args }) => {
    if (toolCall.name === "read_file" && String((args as any).path).includes(".env")) {
      return { block: true, reason: "不允许读取 .env 文件" };
    }
  },
});
```

被拦下的调用会变成一个错误工具结果，`reason` 就是模型看到的文字。模型通常会换个做法。这就是 pi 的 `permission-gate.ts` 扩展的原理。

***

## 5. 实验 4：不花钱的 faux provider

pi-ai 自带一个脚本化的假 provider，用来写测试和做演示。它非常适合用来观察事件顺序——因为响应是你自己写死的，你能确切知道会发生什么。

`lab4.ts`：

```typescript
import {
  createModels,
  fauxAssistantMessage,
  fauxProvider,
  fauxText,
  fauxThinking,
  fauxToolCall,
} from "@earendil-works/pi-ai";
import { Agent } from "@earendil-works/pi-agent-core";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type } from "@earendil-works/pi-ai";

const faux = fauxProvider({ tokensPerSecond: 80 });   // 按真实速度吐字，方便观察
const models = createModels();
models.setProvider(faux.provider);
const model = faux.getModel();

const echoTool: AgentTool = {
  name: "echo",
  label: "Echo",
  description: "原样返回输入",
  parameters: Type.Object({ text: Type.String() }),
  execute: async (_id, params) => ({
    content: [{ type: "text", text: `echo: ${params.text}` }],
    details: {},
  }),
};

// 脚本：第一次回工具调用，第二次回文字
faux.setResponses([
  fauxAssistantMessage(
    [fauxThinking("我应该先调用 echo。"), fauxToolCall("echo", { text: "hello" })],
    { stopReason: "toolUse" },
  ),
  fauxAssistantMessage([fauxText("工具返回了 hello，任务完成。")]),
]);

const agent = new Agent({
  initialState: { systemPrompt: "测试用", model, tools: [echoTool] },
  streamFn: models.streamSimple.bind(models),
});

// 打印每一个事件的类型，看完整顺序
agent.subscribe((event) => {
  console.log(event.type);
});

await agent.prompt("随便说点什么");
```

输出会是这样一串（和 `packages/agent/README.md` 里画的一致）：

```
agent_start
turn_start
message_start      ← 你的 user 消息
message_end
message_start      ← assistant 开始流式
message_update     ← 很多条
…
message_end
tool_execution_start
tool_execution_end
message_start      ← toolResult 消息
message_end
turn_end
turn_start         ← 第二轮
message_start
message_update…
message_end
turn_end
agent_end
```

后面无论是写扩展、做 UI 还是调试，都可以使用这个 faux provider 进行测试。

faux provider 的其他用法（`faux.appendResponses()`、多模型、`faux.state.callCount`）在 [`packages/ai/README.md`](../packages/ai/README.md) 的 "Faux Provider for Tests" 一节。pi 自己的测试套件 `packages/coding-agent/test/suite/` 就是靠它跑的——按 [`AGENTS.md`](../AGENTS.md) 的规定，那些测试不许碰真 API。

***

## 6. 回看：一次 `prompt()` 到底发生了什么

把今天的东西串起来。当你在 lab3 里调用 `await agent.prompt("...")`：

```
Agent.prompt()
 └─ runPromptMessages()            agent.ts
     └─ runWithLifecycle()          建 AbortController，置 isStreaming
         └─ runAgentLoop()          agent-loop.ts
             ├─ declareToolChanges()   对比 transcript 声明的工具 vs 当前可执行工具，
             │                         有差异就插一条 system 消息告诉模型
             ├─ emit agent_start / turn_start / message_start+end(user)
             └─ runLoop()              ← 双层 while
                 └─ 每一圈：
                     ├─ streamAssistantResponse()
                     │    ├─ transformContext?()        AgentMessage[] → AgentMessage[]
                     │    ├─ convertToLlm()             AgentMessage[] → Message[]
                     │    ├─ normalizeContext()         折叠 systemPrompt/tools
                     │    ├─ getApiKey?()               每次请求重新解析（OAuth 会过期）
                     │    └─ streamFn(...)              ← 唯一真正发 HTTP 的地方
                     ├─ 若 stopReason 是 error/aborted → 结束
                     ├─ executeToolCalls()               并行或串行
                     │    ├─ prepareToolCall()           找工具 + 校验参数 + beforeToolCall
                     │    ├─ executePreparedToolCall()   tool.execute()
                     │    └─ finalizeExecutedToolCall()  afterToolCall
                     ├─ emit turn_end
                     ├─ shouldStopAfterTurn?()          想提前停就在这里
                     └─ getSteeringMessages()           取排队的插话
                 └─ 没有工具调用也没有 steering 了 → 看 getFollowUpMessages()
                     └─ 还是没有 → break → emit agent_end
```

每一个名字都能在 [`packages/agent/src/agent-loop.ts`](../packages/agent/src/agent-loop.ts) 里找到。

***

## 7. 今日检查清单

- [ ] pi 能在终端跑起来，我试过 `/tree`、`!command`、steering
- [ ] lab1 跑通，我知道 `stopReason`、`usage.cost` 从哪来
- [ ] lab2 跑通，我能说出手写循环缺了哪 5 件事
- [ ] lab3 跑通，我知道 `streamFn` 为什么是必填的
- [ ] lab4 跑通，我能默写出 `prompt()` 的事件顺序
- [ ] 我知道 `content` 和 `details` 的区别
- [ ] 我知道工具失败为什么要 throw 而不是返回错误文本
