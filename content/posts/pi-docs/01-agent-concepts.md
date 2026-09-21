---
title: "pi agent - 概念入门：agent、harness、tool calling"
draft: false
date: 2026-09-21T15:05:17+08:00
description: "基于Pi agent 学习 ai agent 相关知识"
tags: [agent, pi, AI]
---

# 第 1 天 · 概念入门：agent、harness、tool calling

> 阅读前提：会 TypeScript / Node.js，知道"调用一次 LLM API 拿到一段文本"是怎么回事。不需要任何 agent 背景。
> 本篇目标：读完以后，你能用自己的话说清楚 agent 循环是什么，并且能在本仓库里指出这个循环的代码在哪一行。
> 预计用时：2–3 小时（只读，不动手；动手在第 2 天）。

***

## 1. 从"一次调用"到"一个 agent"

先看最普通的 LLM 用法：

```
你的程序 ──(一段文字)──▶ LLM ──(一段文字)──▶ 你的程序
```

这是**一次性问答**。模型只能靠训练时的知识和你塞进去的文字回答问题。它读不了你磁盘上的文件，跑不了 `npm test`，也改不了代码。

Agent 解决的就是这件事。做法只有一个关键动作：**给模型一份"可调用函数"的清单，让它在回答里说"我要调用哪个函数、参数是什么"，由你的程序真的去执行，再把执行结果塞回对话里，然后再问一次模型。**

```
你的程序 ──(文字 + 工具清单)──▶ LLM
                                 │
                                 ├─ 情况 A：回一段文字      → 结束
                                 └─ 情况 B：回"调用 read(path=README.md)"
                                        │
                                你的程序真的去读文件
                                        │
                                 把文件内容作为"工具结果"追加进对话
                                        │
                                        └──▶ 再问一次 LLM（回到上面）
```

**这个"再问一次"的重复过程，就是 agent 循环（agent loop）。** 一个 agent = LLM + 工具 + 这个循环 + 循环过程中积累的状态。

本仓库里这个循环的真身是一个 `while (true)`，在
[`packages/agent/src/agent-loop.ts`](../packages/agent/src/agent-loop.ts) 的 `runLoop()` 函数里。第 4 天我们会逐行读它。现在只要先记住：

- 循环的**输入**是一个消息数组（对话历史）；
- 每一圈叫一个 **turn**：一次 LLM 调用 + 这次调用要求的所有工具执行；
- 循环的**退出条件**是"模型这一轮没有再要求调用任何工具，并且没有排队等待的新消息"。

### 一个真实的三轮对话长什么样

假设你对 pi 说 `README 里说怎么跑测试？`，实际发生的事（简化）：

| turn | 发给 LLM 的东西                                  | LLM 回什么                              | agent做什么                       |
| ---- | ------------------------------------------- | ------------------------------------ | ------------------------------ |
| 1    | system 提示词 + 工具声明 + `user: README 里说怎么跑测试？` | `toolCall: read(path="README.md")`   | 读文件，把内容包成 `toolResult` 追加到消息数组 |
| 2    | 上面所有内容 + `toolResult: <README 全文>`          | `toolCall: grep(pattern="test")`（可能） | 执行 grep，追加结果                   |
| 3    | 上面所有内容 + 第二个 `toolResult`                   | `text: "跑 ./test.sh 即可…"`（没有工具调用）    | 循环结束，把文字展示给你                   |

注意三件事，它们是后面所有内容的基础：

1. **每一轮都把完整历史重新发一遍。** LLM 本身是无状态的，"记忆"完全是你这边维护的消息数组。
2. **工具结果是以消息的形式回到对话里的**，不是某种带外通道。
3. **谁决定停止？模型。** 它不再发工具调用，循环就退出了。所以 agent 的行为质量，很大程度上由提示词和工具描述决定。

***

## 2. 什么是 agent harness

"Agent 循环"本身只有几十行代码。但要把它变成一个你敢每天用的东西，还缺一大堆配套：

| 缺的东西     | 为什么必须有                                           | Pi 里对应的部分                                                       |
| -------- | ------------------------------------------------ | --------------------------------------------------------------- |
| 统一对接各家模型 | Anthropic / OpenAI / Google 的请求格式、思考块、工具调用格式都不一样 | `packages/ai`                                                   |
| 工具实现     | 读文件、写文件、跑命令、搜索                                   | `packages/coding-agent/src/core/tools/`                         |
| 状态与持久化   | 关掉终端第二天还能接着聊；能回到三步之前重来                           | `packages/coding-agent/src/core/session-manager.ts`（JSONL 会话树）  |
| 上下文管理    | 对话太长会超出模型的上下文窗口                                  | 压缩（compaction），`packages/coding-agent/src/core/compaction/`     |
| 中断与引导    | 模型跑偏了，你想中途插一句                                    | steering / follow-up 队列，`packages/agent/src/agent.ts`           |
| 出错恢复     | 网络抖动、429、上下文溢出                                   | 自动重试 + 溢出后压缩重试，`agent-session.ts`                               |
| 界面       | 终端里流式显示、展开/折叠工具输出                                | `packages/tui` + `packages/coding-agent/src/modes/interactive/` |
| 扩展机制     | 让别人在不改你代码的前提下加能力                                 | extensions / skills / providers                                 |

**把这些东西打包在一起的那层，就叫 agent harness（agent 运行外壳）。** 仓库根 [`README.md`](../README.md) 的第一句话就是这么定位自己的：

> This is the home of the Pi agent harness project including our self extensible coding agent.

所以"Pi"其实是两样东西：一个**通用 harness**（可以拿去搭任何 agent），和一个**用这个 harness 搭出来的编码 agent**（就是你在终端里敲 `pi` 启动的那个）。第 9、10 天我们会用前者搭自己的东西。

***

## 3. 本仓库的三层结构

打开 [`packages/`](../packages/) 你会看到 11 个包。先只记住主干的三层，其余的等用到再说。

```
┌───────────────────────────────────────────────────────────┐
│  packages/coding-agent   @earendil-works/pi-coding-agent   │
│  「编码 agent 产品」                                         │
│  CLI、TUI、会话文件、压缩、内置工具、扩展系统、SDK             │
│  入口: src/core/sdk.ts  (createAgentSession)               │
└───────────────────────────┬───────────────────────────────┘
                            │ 依赖
┌───────────────────────────▼───────────────────────────────┐
│  packages/agent          @earendil-works/pi-agent-core     │
│  「agent 运行时」                                           │
│  agent 循环、工具执行、事件流、状态、steering 队列            │
│  入口: src/agent.ts (Agent 类) + src/agent-loop.ts (循环)   │
└───────────────────────────┬───────────────────────────────┘
                            │ 依赖
┌───────────────────────────▼───────────────────────────────┐
│  packages/ai             @earendil-works/pi-ai             │
│  「统一多供应商 LLM API」                                    │
│  消息类型、Provider/Models 集合、认证、流式事件、成本统计      │
│  入口: src/index.ts, src/models.ts, src/types.ts           │
└───────────────────────────────────────────────────────────┘
```

配角（知道存在即可，前 8 天几乎用不到）：

| 包                                         | 作用                            |
| ----------------------------------------- | ----------------------------- |
| `packages/tui`                            | 终端 UI 组件库，差分渲染。写自定义 UI 扩展时才会碰 |
| `packages/telemetry`                      | 与厂商无关的遥测契约                    |
| `packages/chord`                          | 服务组合运行时（RPC、复制状态、插件），实验性      |
| `packages/protocol` / `client` / `server` | 实验性的远程 harness，默认不打包进 npm 产物  |
| `packages/session-backends/sqlite-node`   | SQLite 会话后端，独立包以免核心包拖入原生依赖    |
| `packages/evals`                          | 评测                            |

### 分层的一个判断依据

这三层的边界不是随便划的，可以用一句话区分：

- **pi-ai 不知道什么是 agent。** 它只知道"把消息数组发给某个模型，流式拿回一个 assistant 消息"。它不会替你执行工具。
- **pi-agent-core 不知道什么是编程。** 它知道 agent 循环、工具怎么执行、事件怎么发，但它不认识 `read` / `bash`，也不知道会话要存成 JSONL。
- **pi-coding-agent 才知道"这是个写代码的 agent"。** 内置工具、系统提示词、会话文件格式、TUI 都在这一层。

这个边界很重要：第 10 天你要搭一个**非编码**的 agent 时，正确的做法是直接用中间层 `pi-agent-core`，而不是去魔改 `pi-coding-agent`。

***

## 4. Tool calling 到底是怎么工作的

这是 agent 里最容易想当然、也最容易踩坑的一环。拆成四步看。

### 第 1 步：声明工具

工具是一个带 JSON Schema 的函数描述。Pi 用 [TypeBox](https://github.com/sinclairzx81/typebox) 写 schema，因为它既是 TypeScript 类型又能序列化成 JSON。

看 pi-ai 里最原始的定义，[`packages/ai/src/types.ts`](../packages/ai/src/types.ts)：

```typescript
export interface Tool<TParameters extends TSchema = TSchema> {
	name: string;
	description: string;
	parameters: TParameters;
	constrainedSampling?: false | ConstrainedSamplingConfig;
}
```

只有"是什么"，**没有"怎么执行"**——因为 pi-ai 不执行工具。

到了 agent 层，[`packages/agent/src/types.ts`](../packages/agent/src/types.ts) 才加上执行能力：

```typescript
export interface AgentTool<TParameters extends TSchema = TSchema, TDetails = any> extends Tool<TParameters> {
	label: string;                     // 给 UI 显示用
	prepareArguments?: (args: unknown) => Static<TParameters>;
	execute: (
		toolCallId: string,
		params: Static<TParameters>,
		signal?: AbortSignal,
		onUpdate?: AgentToolUpdateCallback<TDetails>,
	) => Promise<AgentToolResult<TDetails>>;
	replay?: "never" | "safe";
	executionMode?: ToolExecutionMode;  // "sequential" | "parallel"
}
```

一个真实例子，内置的 `read` 工具，[`packages/coding-agent/src/core/tools/read.ts`](../packages/coding-agent/src/core/tools/read.ts)：

```typescript
const readSchema = Type.Object({
	path: Type.String({ description: "Path to the file to read (relative or absolute)" }),
	offset: Type.Optional(Type.Number({ description: "Line number to start reading from (1-indexed)" })),
	limit: Type.Optional(Type.Number({ description: "Maximum number of lines to read" })),
});
```

注意每个字段都有 `description`。这些描述会原样进入发给模型的请求，**模型是靠读这些描述来决定怎么填参数的**。描述写得含糊，模型就会乱填。

### 第 2 步：模型输出工具调用

模型不会真的"执行"任何东西。它输出的是一段结构化内容，pi-ai 把它归一化成 `ToolCall` 内容块（[`packages/ai/src/types.ts`](../packages/ai/src/types.ts)）：

```typescript
export interface ToolCall {
	type: "toolCall";
	id: string;                        // 后面 toolResult 要靠它配对
	name: string;
	arguments: Record<string, any>;
	thoughtSignature?: string;         // Google 专用
	namespace?: string;                // OpenAI Responses 专用
}
```

一条 assistant 消息的 `content` 是 `(TextContent | ThinkingContent | ToolCall)[]`——也就是说，**模型可以在一条消息里同时说一段话、思考一段、并且发起多个工具调用**。这解释了为什么 Pi 要支持并行工具执行。

### 第 3 步：验证并执行

参数是模型生成的 JSON，**不可信**。Pi 在执行前一定先按 schema 校验。`agent-loop.ts` 里的 `prepareToolCall()`：

```typescript
const preparedToolCall = prepareToolCallArguments(tool, toolCall);
const validatedArgs = validateToolArguments(tool, preparedToolCall);
```

`validateToolArguments` 来自 pi-ai（[`packages/ai/src/utils/validation.ts`](../packages/ai/src/utils/validation.ts)），校验失败会抛错，而抛出的错会被循环捕获、变成一个 `isError: true` 的工具结果回给模型，让模型自己重试。这是很关键的设计：**工具出错不会让整个 agent 崩掉，而是变成模型能看见、能修正的反馈。**

### 第 4 步：结果回到对话

执行结果被包成 `ToolResultMessage`：

```typescript
export interface ToolResultMessage<TDetails = any> {
	role: "toolResult";
	toolCallId: string;      // 对应上面 ToolCall.id
	toolName: string;
	content: (TextContent | ImageContent)[];   // 这部分发给模型
	details?: TDetails;                        // 这部分不发给模型，给 UI 和状态用
	usage?: Usage;
	isError: boolean;
	timestamp: number;
}
```

**请特别注意 `content` 和 `details` 的分工**，这是 Pi 的一个重要设计，后面写自定义工具会反复用到：

- `content`：模型能看到的。要克制，因为它占上下文窗口。
- `details`：模型看不到的结构化数据。UI 用它渲染漂亮的界面（比如 `edit` 工具的彩色 diff），扩展用它做状态持久化。

### 常见误解澄清

| 误解              | 事实                                   |
| --------------- | ------------------------------------ |
| "模型会自己去执行函数"    | 不会。模型只输出调用意图，执行 100% 由你的代码负责         |
| "工具调用是一问一答"     | 一条 assistant 消息可以同时发多个工具调用，Pi 默认并发执行 |
| "参数一定符合 schema" | 不一定。必须校验。流式过程中的参数更是残缺的 JSON          |
| "工具出错要抛给用户"     | 不。抛错会被转成 `isError` 的工具结果喂回模型，让它自己纠正  |

***

## 5. 状态管理：消息数组就是状态

Agent 的"状态"听起来玄，其实主要就是一个数组。看 [`packages/agent/src/types.ts`](../packages/agent/src/types.ts) 的 `AgentState`：

```typescript
export interface AgentState {
	readonly systemPrompt: string;     // 只读！由 transcript 里的 system 消息回放出来
	model: Model<any>;
	thinkingLevel: ThinkingLevel;
	set tools(tools: AgentTool<any>[]);
	get tools(): AgentTool<any>[];
	set messages(messages: AgentMessage[]);
	get messages(): AgentMessage[];
	readonly isStreaming: boolean;
	readonly streamingMessage?: AgentMessage;
	readonly pendingToolCalls: ReadonlySet<string>;
	readonly errorMessage?: string;
}
```

### AgentMessage vs Message：两套消息类型

这是初学时最容易绕晕的地方，但逻辑很简单。

**LLM 只认四种角色**：`system`、`user`、`assistant`、`toolResult`。这四种在 pi-ai 里合称 `Message`。

**但一个真实应用还想在对话里放别的东西**：用户敲的 `!git status` 及其输出、扩展注入的提示、一次压缩产生的摘要……这些在 UI 上要显示，有的要进上下文，有的不要。

Pi 的做法是让应用层通过 TypeScript 的 declaration merging 往联合类型里加自定义角色。看 [`packages/coding-agent/src/core/messages.ts`](../packages/coding-agent/src/core/messages.ts)：

```typescript
declare module "@earendil-works/pi-agent-core" {
	interface CustomAgentMessages {
		bashExecution: BashExecutionMessage;
		custom: CustomMessage;
		branchSummary: BranchSummaryMessage;
		compactionSummary: CompactionSummaryMessage;
	}
}
```

这段代码有两个 TypeScript 特性，都值得展开讲一下，因为后面（第 10 天）你要自己写一遍。

#### `declare module` 干了什么

`CustomAgentMessages` 这个接口**声明在 agent 包里**，而且是空的。看 [`packages/agent/src/types.ts`](../packages/agent/src/types.ts)：

```typescript
export interface CustomAgentMessages {
	// Empty by default - apps extend via declaration merging
}
```

`declare module "@earendil-works/pi-agent-core" { interface CustomAgentMessages { ... } }` 的作用，是从**外部**把这个已经声明过的接口重新打开，往里加字段。TypeScript 把同名接口的多处声明合并成一个，这叫 **declaration merging（声明合并）**。

所以 coding-agent 那段代码跑完，`CustomAgentMessages` 在类型系统眼里变成了：

```typescript
interface CustomAgentMessages {
	bashExecution: BashExecutionMessage;
	custom: CustomMessage;
	branchSummary: BranchSummaryMessage;
	compactionSummary: CompactionSummaryMessage;
}
```

关键在于**合并是累加的、开放的**：agent 包写下这个空接口时，完全不知道以后会有谁往里加什么。coding-agent 加了 4 个；你自己的应用可以再加几个，两边互不影响。

#### `CustomAgentMessages[keyof CustomAgentMessages]` 怎么读

`AgentMessage` 的定义只有一行（同一个文件）：

```typescript
export type AgentMessage = Message | CustomAgentMessages[keyof CustomAgentMessages];
```

`|` 左边的 `Message` 就是那 4 种标准消息。右边那串分两步读：

**第 1 步，`keyof X`** —— 取出 X 所有**键名**组成的联合类型：

```typescript
keyof CustomAgentMessages
// = "bashExecution" | "custom" | "branchSummary" | "compactionSummary"
```

**第 2 步，`X[键名联合]`** —— 用这些键去索引，取出它们对应的**值类型**的联合：

```typescript
CustomAgentMessages["bashExecution" | "custom" | "branchSummary" | "compactionSummary"]
// = BashExecutionMessage | CustomMessage | BranchSummaryMessage | CompactionSummaryMessage
```

合起来，在 coding-agent 里 `AgentMessage` 最终展开成 8 种：

```typescript
type AgentMessage =
	| SystemMessage | UserMessage | AssistantMessage | ToolResultMessage   // Message，4 种标准
	| BashExecutionMessage | CustomMessage | BranchSummaryMessage | CompactionSummaryMessage;  // 注册进来的 4 种
```

#### 没人注册时会怎样

这个写法有个顺带的好处：接口是空的时候，`keyof {}` 是 `never`，用 `never` 去索引得到的还是 `never`，而 `T | never` 就等于 `T`。所以：

```typescript
type AgentMessage = Message | never;   // = Message
```

**谁都不注册，`AgentMessage` 就退化成那 4 种标准消息。** 只用 `pi-agent-core` 而不需要自定义消息的应用，什么都不用做。

#### 为什么要绕这一圈

直接在 agent 包里写死 8 种不行 —— agent 包是通用运行时，它不该知道"bash 执行记录"或"压缩摘要"这种编码 agent 才有的概念（第 3 节讲的分层）。但它又必须让这些类型能安全地混进同一个消息数组里。

declaration merging 正好满足这两条：**类型定义权在应用手里，类型检查权在 agent 包手里**。

**问题来了**：多出来的这 4 种，供应商不认识。把 `{ role: "bashExecution", ... }` 原样发给 Anthropic 会被直接拒绝。

**所以每次请求前，必须有个函数逐条决定这 8 种里的每一条该变成什么。** 这就是 `convertToLlm`。每条消息只有两种下场：

- **翻译**成一条标准消息 —— `bashExecution` 变成一条 `user` 消息，正文是命令和它的输出
- **丢弃**（返回 `undefined` 或 `[]`）—— 比如 `!!` 前缀执行的命令，标了 `excludeFromContext: true`，只留在界面和会话文件里，不进上下文

翻译器就写在声明那 4 种类型的同一个文件里（`messages.ts`）。这不是巧合：**谁加了自定义消息类型，谁就负责翻译它们。**

```typescript
export function convertToLlm(messages: AgentMessage[]): Message[] {
	return messages
		.map((m): Message | undefined => {
			switch (m.role) {
				case "bashExecution":
					if (m.excludeFromContext) return undefined;   // !! 前缀：不进上下文
					return { role: "user", content: [{ type: "text", text: bashExecutionToText(m) }], timestamp: m.timestamp };
				case "compactionSummary":
					return { role: "user", content: [{ type: "text", text: COMPACTION_SUMMARY_PREFIX + m.summary + COMPACTION_SUMMARY_SUFFIX }], timestamp: m.timestamp };
				// …
				case "system": case "user": case "assistant": case "toolResult":
					return m;                                       // 原样透传
			}
		})
		.filter((m) => m !== undefined);
}
```

一个具体的示例 —— 你在 pi 里敲 `!git status`：

````
1. pi 往 transcript 追加一条自定义消息：
   { role: "bashExecution", command: "git status", output: "M packages/...", exitCode: 0, ... }

2. 这条对象进了 agent.state.messages，TUI 用它渲染出带边框的命令块

3. 下一次请求前，convertToLlm 把它翻译成：
   { role: "user", content: [{ type: "text", text: "Ran `git status`\n```\nM packages/...\n```" }] }

4. 供应商收到的是第 3 步那个对象。它从不知道 bashExecution 存在
````

敲 `!!git status`（双感叹号）的话，第 3 步会返回 `undefined`，这条消息就停在第 2 步。

### 一个容易踩的坑：不写 `convertToLlm` 会怎样

假设你按前面的办法注册了一个自定义消息类型，想让模型看到它：

```typescript
declare module "@earendil-works/pi-agent-core" {
	interface CustomAgentMessages {
		notification: { role: "notification"; text: string; timestamp: number };
	}
}

// 往对话里放一条，指望模型读到"构建失败了"
agent.state.messages.push({ role: "notification", text: "CI 构建失败：3 个测试未通过", timestamp: Date.now() });
```

然后你**没有**提供 `convertToLlm`。会发生什么？

- TypeScript 不报错
- 运行时不报错
- 这条消息在会话记录里、在界面上都在
- **但模型永远看不到它**

原因是 `Agent` 类给 `convertToLlm` 准备了一个默认实现，你不传就用它。这个默认实现很短（[`packages/agent/src/agent.ts`](../packages/agent/src/agent.ts)）：

```typescript
function defaultConvertToLlm(messages: AgentMessage[]): Message[] {
	return messages.filter(
		(message) =>
			message.role === "system" ||
			message.role === "user" ||
			message.role === "assistant" ||
			message.role === "toolResult",
	);
}
```

**它只保留 4 种标准角色，其他的全部 `filter` 掉，不吭一声。**

这个默认行为本身是合理的：大量自定义消息本来就**不该**进上下文（界面上的通知、状态卡片、调试信息）。默认丢弃正好是安全的选择。但它对"我加了个类型，指望模型读到"这种情况就是个陷阱。

所以记住这条规则：

> **只要你注册的自定义消息类型需要进入 LLM 上下文，就必须自己写 `convertToLlm`。**
> 默认实现只适用于纯界面用途、不该发给模型的类型。

coding-agent 就是按这条规则做的：它注册了 4 种类型（`bashExecution` 等），所以它也在同一个文件里写了自己的 `convertToLlm`。第 10 天你会为自己的 agent 做同样的事。

（补充一个细节，第 4 天会用到：Pi 的 agent 运行时有两个入口，上面说的是常用的 `Agent` 类，它的 `convertToLlm` 可选。另一个更底层的入口把它定义成**必填**，不传直接编译不过。）

数据流因此是两段的（`packages/agent/README.md` 里有同样的图）：

```
AgentMessage[] ──transformContext()──▶ AgentMessage[] ──convertToLlm()──▶ Message[] ──▶ LLM
                  (可选：裁剪 / 注入)        (翻译：自定义类型必须自己写)
```

`transformContext` 是给"上下文太长了要裁剪"这类事情用的钩子；`convertToLlm` 是纯粹的类型翻译。两个钩子的契约都写在 [`packages/agent/src/types.ts`](../packages/agent/src/types.ts) 的注释里，共同点是：**都不允许抛异常**，出错要返回安全的降级值，否则会打断底层循环的事件序列。

### 系统提示词是"回放"出来的

`AgentState.systemPrompt` 是 `readonly`，这在别的框架里很少见。原因是 Pi 把**系统提示词和工具声明都存在 transcript 的 system 消息里**，而不是存成一个可变字段。

`SystemMessage`（[`packages/ai/src/types.ts`](../packages/ai/src/types.ts)）：

```typescript
export interface SystemMessage {
	role: "system";
	content: string | TextContent[];             // 首条=基础提示词；后续=追加的指令
	sections?: Record<string, string | null>;    // 具名段落；后续消息按名字替换，null 表示删除
	toolsAdded?: Tool[];                         // 从这一点开始可用的工具
	toolsRemoved?: ToolReference[];              // 从这一点开始不可用的工具
	timestamp: number;
}
```

**按顺序回放所有 system 消息，就得到"现在"的提示词和工具集。** 想中途改提示词，不是去改一个变量，而是往对话里再追加一条 system 消息。

这么设计是为了 **prompt cache**。各家供应商都按"前缀是否完全一致"来命中缓存。如果每次改提示词都重写第一条消息，整个缓存前缀就失效了，每一轮都要按全价重新计算。用追加 + 具名段落打补丁的方式，支持 mid-conversation system 消息的模型可以保住缓存前缀。

***

## 6. 仓库地图：以后去哪儿找什么

<br />

### 理解 agent 机制

| 想看什么                   | 去哪里                                                |
| ---------------------- | -------------------------------------------------- |
| agent 循环本体             | `packages/agent/src/agent-loop.ts` → `runLoop()`   |
| Agent 类（状态 + 事件 + 队列）  | `packages/agent/src/agent.ts`                      |
| 所有核心类型与钩子契约            | `packages/agent/src/types.ts`                      |
| 消息 / 工具 / 模型类型         | `packages/ai/src/types.ts`                         |
| Models 集合与 Provider 契约 | `packages/ai/src/models.ts`                        |
| 事件流实现                  | `packages/ai/src/utils/event-stream.ts`            |
| 官方英文说明                 | `packages/agent/README.md`、`packages/ai/README.md` |

### 理解 coding agent

| 想看什么                  | 去哪里                                                               |
| --------------------- | ----------------------------------------------------------------- |
| 会话是怎么组装起来的            | `packages/coding-agent/src/core/sdk.ts` → `createAgentSession()`  |
| 会话运行期（3600+ 行，重头戏）    | `packages/coding-agent/src/core/agent-session.ts`                 |
| 系统提示词构建               | `packages/coding-agent/src/core/system-prompt.ts`                 |
| 自定义消息类型与 convertToLlm | `packages/coding-agent/src/core/messages.ts`                      |
| 内置工具                  | `packages/coding-agent/src/core/tools/`                           |
| 会话树 / JSONL           | `packages/coding-agent/src/core/session-manager.ts`               |
| 压缩                    | `packages/coding-agent/src/core/compaction/`                      |
| 扩展类型定义（1820 行，是权威）    | `packages/coding-agent/src/core/extensions/types.ts`              |
| 扩展加载 / 事件分发           | `packages/coding-agent/src/core/extensions/loader.ts`、`runner.ts` |

### 官方文档

| 文档                                              | 内容                             |
| ----------------------------------------------- | ------------------------------ |
| `packages/coding-agent/docs/index.md`           | 文档总目录                          |
| `packages/coding-agent/docs/quickstart.md`      | 安装、认证、第一次会话                    |
| `packages/coding-agent/docs/extensions.md`      | 扩展 API 全集（3018 行）              |
| `packages/coding-agent/docs/skills.md`          | Skills                         |
| `packages/coding-agent/docs/custom-provider.md` | 自定义模型供应商                       |
| `packages/coding-agent/docs/sdk.md`             | SDK，嵌入到自己的 Node 程序             |
| `packages/coding-agent/docs/session-format.md`  | JSONL 会话格式与 SessionManager API |
| `packages/coding-agent/docs/compaction.md`      | 压缩与分支摘要内部机制                    |
| `packages/coding-agent/docs/rpc.md`             | 跨进程 JSONL 协议                   |
| `packages/coding-agent/docs/tui.md`             | TUI 组件                         |

### 可跟做的示例

| 目录                                           | 内容                                                      |
| -------------------------------------------- | ------------------------------------------------------- |
| `packages/coding-agent/examples/sdk/`        | 13 个 SDK 示例，从 `01-minimal.ts` 到 `13-session-runtime.ts` |
| `packages/coding-agent/examples/extensions/` | 70+ 个扩展示例，`README.md` 里有分类索引                            |

***

## 7. 一个还没讲的东西：AgentHarness

你在 `packages/agent/src/harness/` 下会看到一大堆文件，还有一篇 1400 行的规格 [`packages/agent/docs/harness.md`](../packages/agent/docs/harness.md)。

这是 Pi 正在建设的**持久化运行时**：把会话和"操作状态"都落到存储里，进程被杀掉以后能从中断处恢复，而且不会重复已经产生副作用的动作（比如不会把文件删两次）。

**但它目前还不是 `pi` 命令实际走的路径。** 在 `packages/coding-agent/src/` 里搜 `AgentHarness`，只出现在 `src/experimental/` 下。生产路径仍然是 `Agent` + `agent-loop.ts`。harness.md 的 §0.9 自己也标注了哪些部分只有规格没有实现。

所以本套文档的第 3–5 天讲的是**现在真正在跑的那条路**。等你吃透了，再回头看 harness.md 会轻松很多。

***

## 8. 术语表

| 术语                        | 一句话解释                                                                |
| ------------------------- | -------------------------------------------------------------------- |
| **agent**                 | LLM + 工具 + 反复调用的循环                                                   |
| **agent harness**         | 把 agent 循环包装成可用产品的那一层（模型对接、工具、状态、UI、扩展…）                             |
| **turn（轮）**               | 一次 LLM 调用 + 这次调用请求的所有工具执行                                            |
| **run（运行）**               | 一次 `prompt()` 引发的全过程，包含多个 turn，以 `agent_end` 结束                      |
| **tool calling**          | 模型输出结构化的函数调用意图，由宿主程序执行                                               |
| **transcript**            | 对话记录，即消息数组                                                           |
| **context window（上下文窗口）** | 模型单次请求能接受的 token 上限                                                  |
| **compaction（压缩）**        | 上下文快满时，把旧消息总结成摘要以腾出空间                                                |
| **steering（引导）**          | 模型干活时你插一句话，在当前 turn 的工具跑完后送达                                         |
| **follow-up（追加）**         | 排队等模型彻底停下来后再送达的消息                                                    |
| **thinking level**        | 推理强度档位：`off`/`minimal`/`low`/`medium`/`high`/`xhigh`/`max`           |
| **provider**              | 一个模型供应商的运行单元：自己的模型目录 + 认证 + 流式行为                                     |
| **API implementation**    | 线上协议实现，如 `anthropic-messages`、`openai-completions`。多个 provider 可共用一个 |
| **extension（扩展）**         | 一个 TypeScript 模块，挂到 Pi 的事件和注册点上增强能力                                  |
| **skill（技能）**             | 一个带 frontmatter 的 Markdown 目录，按需加载的工作流说明                             |
| **session（会话）**           | 一次对话的持久化记录，JSONL 文件，树结构                                              |
| **JSONL**                 | 每行一个 JSON 对象的文本格式                                                    |
| **TUI**                   | Terminal UI，终端界面                                                     |

***

## 9. 自测

不查资料，试着回答：

1. 为什么每次 LLM 调用都要把完整历史重发一遍？
2. `AgentMessage` 和 `Message` 的区别是什么？谁负责在两者之间转换？
3. 工具的 `content` 和 `details` 分别给谁看？
4. 工具执行抛出异常时，agent 会崩溃吗？会发生什么？
5. 为什么 `AgentState.systemPrompt` 是只读的？想改提示词该怎么做？
6. 一条 assistant 消息里可以有几个工具调用？
7. 如果要做一个"邮件助手" agent，你应该基于 `pi-coding-agent` 还是 `pi-agent-core`？为什么？

答案分别在本篇第 1、5、4、4、5、4、3 节。
