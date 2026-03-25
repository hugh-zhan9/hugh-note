---
title: "翻译转载： Harness design for long-running application development"
draft: false
date: 2026-03-25T15:06:48+08:00
description: "Anthropic 工程团队分享如何通过多智能体框架设计（生成器-评估器架构）突破长时间自主编码的性能瓶颈，包括前端设计和全栈应用开发的实践经验。"
tags: [AI工程, 多智能体, 框架设计]
---

Source: https://www.anthropic.com/engineering/harness-design-long-running-apps
Published Mar 24, 2026
Written by Prithvi Rajasekaran, a member of our Labs team.

Harness design is key to performance at the frontier of agentic coding. Here's how we pushed Claude further in frontend design and long-running autonomous software engineering.
在智能体编码的前沿领域，框架设计是提升性能的关键。以下是我们如何帮助 Claude 在前端设计和长期自主软件工程方面取得更大进步。

Over the past several months I’ve been working on two interconnected problems: getting Claude to produce high-quality frontend designs, and getting it to build complete applications without human intervention. This work originated with earlier efforts on our [frontend design skill](https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md) and [long-running coding agent harness](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents), where my colleagues and I were able to improve Claude’s performance well above baseline through prompt engineering and harness design—but both eventually hit ceilings.
过去几个月，我一直在研究两个相互关联的问题：一是让 Claude 生成高质量的前端设计，二是让它无需人工干预即可构建完整的应用程序。这项工作源于我们之前在前端设计技能（https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md）和长运行编码代理框架（https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents）方面的努力。我和我的同事通过快速的工程和框架设计，成功地将 Claude 的性能提升到了远超基准水平的程度——但最终都遇到了瓶颈。

To break through, I sought out novel AI engineering approaches that held across two quite different domains, one defined by subjective taste, the other by verifiable correctness and usability. Taking inspiration from [Generative Adversarial Networks](https://en.wikipedia.org/wiki/Generative_adversarial_network) (GANs), I designed a multi-agent structure with a **generator** and **evaluator** agent. Building an evaluator that graded outputs reliably—and with taste—meant first developing a set of criteria that could turn subjective judgments like “is this design good?” into concrete, gradable terms.
为了取得突破，我寻求能够跨越两个截然不同的领域的新型人工智能工程方法：一个领域以主观喜好为标准，另一个领域则以可验证的正确性和可用性为标准。我从生成对抗网络（GAN）中汲取灵感，设计了一个包含生成器和评估器的多智能体结构。构建一个能够可靠且有品位地对输出进行评分的评估器，意味着首先要制定一套标准，将“这个设计好不好？”之类的主观判断转化为具体的、可评分的指标。

I then applied these techniques to long-running autonomous coding, carrying over two lessons from our earlier harness work: decomposing the build into tractable chunks, and using structured artifacts to hand off context between sessions. The final result was a three-agent architecture—planner, generator, and evaluator—that produced rich full-stack applications over multi-hour autonomous coding sessions.
随后，我将这些技术应用于长时间自主编码，并借鉴了我们之前框架搭建工作中的两个经验：将构建过程分解成易于处理的小块，以及使用结构化工件在不同会话之间传递上下文。最终成果是一个由三个智能体组成的架构——规划器、生成器和评估器——能够在长达数小时的自主编码会话中生成功能丰富的全栈应用程序。

## Why naive implementations fall short / 为什么简单的实现方式会失败

We've previously shown that harness design has a substantial impact on the effectiveness of long running agentic coding. In an earlier[experiment](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents), we used an initializer agent to decompose a product spec into a task list, and a coding agent that implemented the tasks one feature at a time before handing off artifacts to carry context across sessions. The broader developer community has converged on similar insights, with approaches like the "[Ralph Wiggum](https://ghuntley.com/ralph/)" method using hooks or scripts to keep agents in continuous iteration cycles.
我们之前已经证明，框架设计对长时间运行的智能体编码的效率有着显著的影响。在早期的[实验](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)中，我们使用了一个初始化智能体将产品规格分解成任务列表，并使用一个编码智能体逐个实现这些任务的功能，最后将生成的工件传递给其他智能体，以便在不同会话之间传递上下文信息。更广泛的开发者社区也逐渐形成了类似的认识，例如[Ralph Wiggum](https://ghuntley.com/ralph/)的方法就利用钩子或脚本来保持智能体持续迭代。

But some problems remained persistent. For more complex tasks, the agent still tends to go off the rails over time. While decomposing this issue, we observed two common failure modes with agents executing these sorts of tasks.
但有些问题依然存在。对于更复杂的任务，智能体仍然容易随着时间的推移而偏离轨道。在分析这个问题时，我们观察到智能体在执行此类任务时存在两种常见的故障模式。

First is that models tend to lose coherence on lengthy tasks as the context window fills (see our post on [context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)). Some models also exhibit "context anxiety," in which they begin wrapping up work prematurely as they approach what they believe is their context limit. Context resets—clearing the context window entirely and starting a fresh agent, combined with a structured handoff that carries the previous agent's state and the next steps—addresses both these issues.
首先，随着上下文窗口逐渐填满，模型在执行长时间任务时往往会失去连贯性（参见我们关于[上下文工程](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)的文章）。一些模型还会表现出“上下文焦虑”，即当它们接近自身认为的上下文极限时，就会过早地结束工作。上下文重置——完全清除上下文窗口并启动一个新的智能体，同时配合结构化的交接机制（该机制会传递前一个智能体的状态和后续步骤）——可以解决这两个问题。

This differs from compaction, where earlier parts of the conversation are summarized in place so the same agent can keep going on a shortened history. While compaction preserves continuity, it doesn't give the agent a clean slate, which means context anxiety can still persist. A reset provides a clean slate, at the cost of the handoff artifact having enough state for the next agent to pick up the work cleanly. In our earlier testing, we found Claude Sonnet 4.5 exhibited context anxiety strongly enough that compaction alone wasn't sufficient to enable strong long task performance, so context resets became essential to the harness design. This solves the core issue, but adds orchestration complexity, token overhead, and latency to each harness run.
这与压缩不同，压缩会将对话的早期部分进行原地概括，以便同一代理能够继续处理缩短后的历史记录。虽然压缩保持了连续性，但它并不能让代理从头开始，这意味着上下文焦虑仍然存在。重置可以提供一个全新的状态，但代价是交接工件会保留足够的状态，以便下一个代理能够顺利地接手工作。在我们之前的测试中，我们发现 Claude Sonnet 4.5 的上下文焦虑非常严重，仅靠压缩不足以实现出色的长时间任务性能，因此上下文重置成为框架设计中必不可少的环节。这解决了核心问题，但增加了编排的复杂性、令牌开销和每次框架运行的延迟。

A second issue, which we haven’t previously addressed, is self-evaluation. When asked to evaluate work they've produced, agents tend to respond by confidently praising the work—even when, to a human observer, the quality is obviously mediocre. This problem is particularly pronounced for subjective tasks like design, where there is no binary check equivalent to a verifiable software test. Whether a layout feels polished or generic is a judgment call, and agents reliably skew positive when grading their own work.
第二个问题，也是我们之前没有讨论过的，是自我评价。当被要求评价自己完成的工作时，员工往往会自信地称赞自己的作品——即使在人类观察者看来，作品的质量明显平庸。这个问题在设计这类主观性较强的任务中尤为突出，因为这类任务没有像软件测试那样的二元评判标准。一个布局是精致还是平庸完全取决于主观判断，而员工在评价自己的作品时往往会倾向于给出更高的评价。

However, even on tasks that do have verifiable outcomes, agents still sometimes exhibit poor judgment that impedes their performance while completing the task. Separating the agent doing the work from the agent judging it proves to be a strong lever to address this issue. The separation doesn't immediately eliminate that leniency on its own; the evaluator is still an LLM that is inclined to be generous towards LLM-generated outputs. But tuning a standalone evaluator to be skeptical turns out to be far more tractable than making a generator critical of its own work, and once that external feedback exists, the generator has something concrete to iterate against.
然而，即使在那些结果可验证的任务中，智能体有时仍然会表现出判断失误，从而影响其完成任务的表现。将执行任务的智能体与评估任务的智能体分开，被证明是解决这一问题的有效方法。这种分离本身并不能立即消除这种宽容；评估者仍然是一个逻辑逻辑模型（LLM），它倾向于对 LLM 生成的输出给予较高的评价。但是，调整一个独立的评估者使其保持怀疑态度，远比让生成器对其自身的工作进行批判性思考要容易得多。一旦有了这种外部反馈，生成器就有了可以迭代的具体依据。

## Frontend design: making subjective quality gradable / 前端设计：使主观质量可分级

I started by experimenting on frontend design, where the self-evaluation issue was most visible. Absent any intervention, Claude normally gravitates toward safe, predictable layouts that are technically functional but visually unremarkable.
我首先从前端设计入手进行实验，因为自我评价的问题在这里最为明显。如果没有人干预，Claude 通常会倾向于安全、可预测的布局，这些布局技术上功能齐全，但视觉上平淡无奇。

Two insights shaped the harness I built for frontend design. First, while aesthetics can’t be fully reduced to a score—and individual tastes will always vary—they can be improved with grading criteria that encode design principles and preferences. "Is this design beautiful?" is hard to answer consistently, but "does this follow our principles for good design?" gives Claude something concrete to grade against. Second, by separating frontend generation from frontend grading, we can create a feedback loop that drives the generator toward stronger outputs.
我为前端设计构建的框架基于两个关键洞察。首先，虽然美学无法完全用分数来衡量——而且个人品味也总是各不相同——但我们可以通过编码设计原则和偏好的评分标准来提升设计水平。“这个设计美观吗？”很难给出一致的答案，但“它是否符合我们对优秀设计的原则？”则为 Claude 提供了一个具体的评分标准。其次，通过将前端生成与前端评分分离，我们可以创建一个反馈循环，从而驱动生成器输出更优质的内容。

With this in mind, I wrote four grading criteria that I gave to both the generator and evaluator agents in their prompts:
基于此，我编写了四项评分标准，并在提示中将其提供给了生成器和评估器：

*   **Design quality:** Does the design feel like a coherent whole rather than a collection of parts? Strong work here means the colors, typography, layout, imagery, and other details combine to create a distinct mood and identity.
*   **Originality:** Is there evidence of custom decisions, or is this template layouts, library defaults, and AI-generated patterns? A human designer should recognize deliberate creative choices. Unmodified stock components—or telltale signs of AI generation like purple gradients over white cards—fail here.
*   **Craft:** Technical execution: typography hierarchy, spacing consistency, color harmony, contrast ratios. This is a competence check rather than a creativity check. Most reasonable implementations do fine here by default; failing means broken fundamentals.
*   **Functionality:** Usability independent of aesthetics. Can users understand what the interface does, find primary actions, and complete tasks without guessing?
* **设计质量：** 设计是否感觉像一个连贯的整体，而不是各个部分的简单堆砌？优秀的设计意味着色彩、字体、布局、图像和其他细节能够完美融合，营造出独特的氛围和风格。
* **原创性：** 是否有明显的定制化设计痕迹，还是使用了模板布局、库默认设置或人工智能生成的图案？专业的设计师应该能够识别出精心设计的创意。未经修改的现成组件，或者像白色卡片上叠加紫色渐变这样的人工智能生成痕迹，都无法通过这项测试。
* **工艺：** 技术执行：字体层级、间距一致性、色彩和谐、对比度。这更多的是一项能力测试，而非创意测试。大多数合理的实现方式都能做到这一点；如果失败，则意味着基本功出现了问题。
* **功能性：** 可用性，与美观无关。用户能否理解界面的功能，找到主要操作，并无需猜测即可完成任务？

I emphasized design quality and originality over craft and functionality. Claude already scored well on craft and functionality by default, as the required technical competence tended to come naturally to the model. But on design and originality, Claude often produced outputs that were bland at best. The criteria explicitly penalized highly generic “AI slop” patterns, and by weighting design and originality more heavily it pushed the model toward more aesthetic risk-taking.
我更注重设计质量和原创性，而非工艺和功能性。Claude 在工艺和功能性方面本身就表现出色，因为所需的技术能力对这个模型来说往往是与生俱来的。但在设计和原创性方面，Claude 的作品充其量只能算平庸。评分标准明确惩罚了过于通用的“人工智能粗糙”模式，并通过提高设计和原创性的权重，促使模型在美学上进行更多冒险尝试。

I calibrated the evaluator using few-shot examples with detailed score breakdowns. This ensured the evaluator’s judgment aligned with my preferences, and reduced score drift across iterations.
我使用少量样本并附有详细的分数细分来校准评估器。这确保了评估器的判断与我的偏好一致，并减少了迭代过程中分数的偏差。

I built the loop on the [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview), which kept the orchestration straightforward. A generator agent first created an HTML/CSS/JS frontend based on a user prompt. I gave the evaluator the Playwright MCP, which let it interact with the live page directly before scoring each criterion and writing a detailed critique. In practice, the evaluator would navigate the page on its own, screenshotting and carefully studying the implementation before producing its assessment. That feedback flowed back to the generator as input for the next iteration. I ran 5 to 15 iterations per generation, with each iteration typically pushing the generator in a more distinctive direction as it responded to the evaluator's critique. Because the evaluator was actively navigating the page rather than scoring a static screenshot, each cycle took real wall-clock time. Full runs stretched up to four hours. I also instructed the generator to make a strategic decision after each evaluation: refine the current direction if scores were trending well, or pivot to an entirely different aesthetic if the approach wasn't working.
我基于 Claude Agent SDK 构建了循环，这使得流程编排非常简洁。首先，生成器代理会根据用户提示创建一个 HTML/CSS/JS 前端。我为评估者提供了 Playwright MCP，使其能够直接与实时页面交互，然后对每个标准进行评分并撰写详细的评论。实际上，评估者会自行浏览页面，截屏并仔细研究实现，然后再进行评估。这些反馈会作为输入返回给生成器，用于下一次迭代。每个生成周期运行 5 到 15 次迭代，每次迭代通常会根据评估者的评论，引导生成器朝着更明确的方向发展。由于评估者是主动浏览页面而不是对静态截图进行评分，因此每个循环都需要实际运行时间。完整的运行时间最长可达四个小时。我还指示生成器在每次评估后做出战略决策：如果分数趋势良好，则改进当前方向；如果该方法行不通，则转向完全不同的美学。

Across runs, the evaluator's assessments improved over iterations before plateauing, with headroom still remaining. Some generations refined incrementally. Others took sharp aesthetic turns between iterations.
在多次迭代中，评估者的评价逐渐提高，最终趋于稳定，但仍有提升空间。有些版本是逐步改进的，而另一些版本则在迭代之间出现了显著的审美转变。

The wording of the criteria steered the generator in ways I didn't fully anticipate. Including phrases like "the best designs are museum quality" pushed designs toward a particular visual convergence, suggesting that the prompting associated with the criteria directly shaped the character of the output.
这些评判标准的措辞以我未曾完全预料的方式引导了生成器。例如，诸如“最佳设计应达到博物馆级别”之类的表述，促使设计作品朝着特定的视觉方向发展，这表明与这些标准相关的提示直接塑造了输出结果的特征。

While scores generally improved over iterations, the pattern was not always cleanly linear. Later implementations tended to be better as a whole, but I regularly saw cases where I preferred a middle iteration over the last one. Implementation complexity also tended to increase across rounds, with the generator reaching for more ambitious solutions in response to the evaluator’s feedback. Even on the first iteration, outputs were noticeably better than a baseline with no prompting at all, suggesting the criteria and associated language themselves steered the model away from generic defaults before any evaluator feedback led to further refinement.
虽然分数通常会随着迭代次数的增加而提高，但这种提升并非总是呈现清晰的线性趋势。后期的实现整体上往往更好，但我经常会遇到这样的情况：我更喜欢中间的迭代版本而不是最后一次迭代。实现的复杂度也往往会随着迭代次数的增加而增加，生成器会根据评估者的反馈寻求更具挑战性的解决方案。即使在第一次迭代中，输出结果也明显优于完全没有提示的基准版本，这表明在评估者的反馈促使模型进一步改进之前，评分标准及其相关语言本身就已经引导模型摆脱了通用的默认设置。

In one notable example, I prompted the model to create a website for a Dutch art museum. By the ninth iteration, it had produced a clean, dark-themed landing page for a fictional museum. The page was visually polished but largely in line with my expectations. Then, on the tenth cycle, it scrapped the approach entirely and reimagined the site as a spatial experience: a 3D room with a checkered floor rendered in CSS perspective, artwork hung on the walls in free-form positions, and doorway-based navigation between gallery rooms instead of scroll or click. It was the kind of creative leap that I hadn't seen before from a single-pass generation.
举个例子，我让模型为一家荷兰艺术博物馆设计网站。到了第九次迭代，它生成了一个简洁的深色主题首页，页面内容是虚构的博物馆。页面视觉效果不错，但基本符合我的预期。然而，到了第十次迭代，它彻底放弃了之前的设计思路，将网站重新构想成一个空间体验：一个 3D 房间，房间内铺设着用 CSS 透视渲染的方格地板，艺术品以自由形式悬挂在墙上，展厅之间的导航不再是滚动或点击，而是通过门来切换。这种创造性的飞跃，是我之前从未在单次迭代的模型中见过的。

## Scaling to full-stack coding / 扩展到全栈编码

With these findings in hand, I applied this GAN-inspired pattern to full-stack development. The generator-evaluator loop maps naturally onto the software development lifecycle, where code review and QA serve the same structural role as the design evaluator.
基于这些发现，我将这种受生成对抗网络（GAN）启发的模式应用于全栈开发。生成器-评估器循环自然地映射到软件开发生命周期中，其中代码审查和质量保证（QA）与设计评估器发挥着相同的结构性作用。

### The architecture / 架构

In our earlier [long-running harness](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents), we had solved for coherent multi-session coding with an initializer agent, a coding agent that worked one feature at a time, and context resets between sessions. Context resets were a key unlock: the harness used Sonnet 4.5, which exhibited the “context anxiety” tendency mentioned earlier. Creating a harness that worked well across context resets was key to keeping the model on task. Opus 4.5 largely removed that behavior on its own, so I was able to drop context resets from this harness entirely. The agents were run as one continuous session across the whole build, with the [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview)'s automatic compaction handling context growth along the way.
在我们之前的[长期运行的代理](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)中，我们通过初始化代理、一次处理一个功能的编码代理以及会话间的上下文重置来解决了连贯的多会话编码问题。上下文重置是关键所在：该代理使用了 Sonnet 4.5，而 Sonnet 4.5 存在之前提到的“上下文焦虑”问题。创建一个能够在上下文重置后良好运行的代理是确保模型持续执行任务的关键。Opus 4.5 在很大程度上消除了这种行为，因此我能够完全从该代理中移除上下文重置。代理在整个构建过程中作为一个连续的会话运行，[Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview)的自动压缩功能则负责处理过程中不断增长的上下文。

For this work I built on the foundation from the original harness with a three-agent system, with each agent addressing a specific gap I'd observed in prior runs. The system contained the following agent personas:
这项工作是在原有框架的基础上，构建了一个三智能体系统，每个智能体都针对我在之前的运行中观察到的特定缺陷进行改进。该系统包含以下智能体角色：

**Planner:** Our previous long-running harness required the user to provide a detailed spec upfront. I wanted to automate that step, so I created a planner agent that took a simple 1-4 sentence prompt and expanded it into a full product spec. I prompted it to be ambitious about scope and to stay focused on product context and high level technical design rather than detailed technical implementation. This emphasis was due to the concern that if the planner tried to specify granular technical details upfront and got something wrong, the errors in the spec would cascade into the downstream implementation. It seemed smarter to constrain the agents on the deliverables to be produced and let them figure out the path as they worked. I also asked the planner to find opportunities to weave AI features into the product specs. (See example in the Appendix at the bottom.)
**规划器：**我们之前长期使用的工具需要用户预先提供详细的规格说明。为了实现这一步骤的自动化，我创建了一个规划器代理，它能够接收一个 1-4 句话的简单提示，并将其扩展为完整的产品规格说明。我要求它在范围方面设定一个远大的目标，并专注于产品背景和高层技术设计，而不是具体的实现细节。之所以这样强调，是因为我们担心，如果规划器试图预先指定细粒度的技术细节，一旦出错，规格说明中的错误就会波及到后续的实现。因此，将代理的工作范围限定在需要交付的成果上，并让它们在工作中逐步摸索，似乎更为明智。我还要求规划器寻找机会，将 AI 功能融入到产品规格说明中。（参见文末附录中的示例。）

**Generator:** The one-feature-at-a-time approach from the earlier harness worked well for scope management. I applied a similar model here, instructing the generator to work in sprints, picking up one feature at a time from the spec. Each sprint implemented the app with a React, Vite, FastAPI, and SQLite (later PostgreSQL) stack, and the generator was instructed to self-evaluate its work at the end of each sprint before handing off to QA. It also had git for version control.
**生成器：** 之前框架中采用的一次只开发一个功能的方法在范围管理方面效果很好。我在这里也采用了类似的模型，指示生成器以迭代的方式工作，每次从规范中选取一个功能。每个迭代都使用 React、Vite、FastAPI 和 SQLite（后来是 PostgreSQL）技术栈来实现应用程序，并指示生成器在每个迭代结束时进行自我评估，然后再移交给 QA。它还使用了 Git 进行版本控制。

**Evaluator:** Applications from earlier harnesses often looked impressive but still had real bugs when you actually tried to use them. To catch these, the evaluator used the Playwright MCP to click through the running application the way a user would, testing UI features, API endpoints, and database states. It then graded each sprint against both the bugs it had found and a set of criteria modeled on the frontend experiment, adapted here to cover product depth, functionality, visual design, and code quality. Each criterion had a hard threshold, and if any one fell below it, the sprint failed and the generator got detailed feedback on what went wrong.
**评估员：**早期框架中的应用程序通常看起来很棒，但实际使用时仍然存在一些实际的缺陷。为了发现这些问题，评估员使用 Playwright MCP 以用户的方式点击运行中的应用程序，测试 UI 功能、API 端点和数据库状态。然后，评估员根据发现的缺陷以及一套基于前端实验构建的标准对每个迭代进行评分。这套标准经过调整，涵盖产品深度、功能、视觉设计和代码质量。每个标准都有一个硬性阈值，如果任何一项低于该阈值，则该迭代失败，生成器将收到关于出错原因的详细反馈。

Before each sprint, the generator and evaluator negotiated a sprint contract: agreeing on what "done" looked like for that chunk of work before any code was written. This existed because the product spec was intentionally high-level, and I wanted a step to bridge the gap between user stories and testable implementation. The generator proposed what it would build and how success would be verified, and the evaluator reviewed that proposal to make sure the generator was building the right thing. The two iterated until they agreed.
每次迭代开始前，开发者和评估者都会协商一份迭代契约：在编写任何代码之前，就该部分工作的“完成”标准达成一致。之所以这样做，是因为产品规格说明有意写得比较概括，而我希望通过这一步骤来弥合用户故事和可测试实现之间的差距。开发者提出要构建的内容以及如何验证成功，评估者则审查该提案，以确保开发者构建的内容是正确的。双方反复沟通，直到达成一致。

Communication was handled via files: one agent would write a file, another agent would read it and respond either within that file or with a new file that the previous agent would read in turn. The generator then built against the agreed-upon contract before handing the work off to QA. This kept the work faithful to the spec without over-specifying implementation too early.
通信通过文件进行：一个代理写入一个文件，另一个代理读取该文件并做出响应，响应内容可以是写入该文件本身，也可以是写入一个新文件，供之前的代理读取。生成器随后根据约定的协议进行构建，最后将工作成果交付给质量保证团队。这样既保证了工作成果忠实于规范，又避免了过早地过度定义实现细节。

### Running the harness

For the first version of this harness, I used Claude Opus 4.5, running user prompts against both the full harness and a single-agent system for comparison. I used Opus 4.5 since this was our best coding model when I began these experiments.
在这个测试框架的第一个版本中，我使用了 Claude Opus 4.5，并针对完整的测试框架和单代理系统运行用户提示以进行比较。之所以选择 Opus 4.5，是因为在开始这些实验时，这是我们当时最好的编码模型。

I wrote the following prompt to generate a retro video game maker:
我编写了以下提示，以生成一个复古视频游戏制作工具：

> _Create a 2D retro game maker with features including a level editor, sprite editor, entity behaviors, and a playable test mode._
> _创建一个包含关卡编辑器、精灵编辑器、实体行为和可玩测试模式等功能的 2D 复古游戏制作工具。_

The table below shows the harness type, length it ran for, and the total cost.
下表显示了 harness类型、运行长度和总成本。

| **Harness** | **Duration** | **Cost** |
| --- | --- | --- |
| Solo | 20 min | $9 |
| Full harness | 6 hr | $200 |

The harness was over 20x more expensive, but the difference in output quality was immediately apparent.
虽然线束的价格贵了 20 多倍，但输出质量的差异立竿见影。

I was expecting an interface where I could construct a level and its component parts (sprites, entities, tile layout) then hit play to actually play the level. I started by opening the solo run’s output, and the initial application seemed in line with those expectations.
我原本以为会看到一个可以构建关卡及其组成部分（精灵、实体、图块布局）的界面，然后点击播放按钮即可实际游玩该关卡。我首先打开了单人游戏的输出文件，初始界面看起来与我的预期相符。

As I clicked through, however, issues started to emerge. The layout wasted space, with fixed-height panels leaving most of the viewport empty. The workflow was rigid. Trying to populate a level prompted me to create sprites and entities first, but nothing in the UI guided me toward that sequence. More to the point, the actual game was broken. My entities appeared on screen but nothing responded to input. Digging into the code revealed that the wiring between entity definitions and the game runtime was broken, with no surface indication of where.
然而，随着我不断点击操作，问题开始显现。布局浪费空间，固定高度的面板导致视口大部分区域空空如也。工作流程也十分僵化。尝试填充关卡时，系统提示我先创建精灵和实体，但用户界面没有任何提示引导我完成这些步骤。更重要的是，游戏本身存在问题。我的实体出现在屏幕上，但对任何输入都没有反应。深入研究代码后发现，实体定义和游戏运行时之间的连接出现了故障，但表面上却找不到任何线索。

After evaluating the solo run, I turned my attention to the harness run. This run started from the same one-sentence prompt, but the planner step expanded that prompt into a 16-feature spec spread across ten sprints. It went well beyond what the solo run attempted. In addition to the core editors and play mode, the spec called for a sprite animation system, behavior templates, sound effects and music, an AI-assisted sprite generator and level designer, and game export with shareable links. I gave the planner access to our [frontend design skill](https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md), which it read and used to create a visual design language for the app as part of the spec. For each sprint, the generator and evaluator negotiated a contract defining the specific implementation details for the sprint, and the testable behaviors that would be tested to verify completion.
在评估完单人测试后，我将注意力转向了团队测试。这次测试同样始于一句提示，但规划步骤将该提示扩展为一个包含 16 个功能的规范，并分十个迭代周期完成。这远远超出了单人测试的尝试范围。除了核心编辑器和游戏模式之外，规范还要求包含精灵动画系统、行为模板、音效和音乐、AI 辅助的精灵生成器和关卡设计器，以及带有可分享链接的游戏导出功能。我授予了规划器访问我们前端设计技能的权限（https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md），规划器读取并使用它来创建应用程序的视觉设计语言，作为规范的一部分。在每个迭代周期，生成器和评估器都会协商一份合同，定义该迭代周期的具体实现细节，以及用于验证完成情况的可测试行为。

The app immediately showed more polish and smoothness than the solo run. The canvas used the full viewport, the panels were sized sensibly, and the interface had a consistent visual identity that tracked the design direction from the spec. Some of the clunkiness I'd seen in the solo run did remain—the workflow still didn't make it clear that you should build sprites and entities before trying to populate a level, and I had to figure that out by poking around. This read as a gap in the base model’s product intuition rather than something the harness was designed to address, though it did suggest a place where targeted iteration inside the harness could help to further improve output quality.
与单人运行版本相比，该应用程序立即展现出更高的完善度和流畅度。画布充分利用了视口，面板尺寸合理，界面视觉风格一致，与规范中的设计方向相符。我在单人运行版本中发现的一些笨拙之处仍然存在——工作流程仍然没有明确提示用户在尝试填充关卡之前应该先创建精灵和实体，我不得不摸索一番才能弄明白。这与其说是该框架旨在解决的问题，不如说是基础模型产品直觉上的缺陷，尽管这也表明框架内部的针对性迭代可以进一步提升输出质量。

Working through the editors, the new run's advantages over solo became more apparent. The sprite editor was richer and more fully featured, with cleaner tool palettes, a better color picker, and more usable zoom controls.
使用编辑器时，新模式相比单人模式的优势更加明显。精灵编辑器功能更丰富、更完善，工具面板更简洁，颜色选择器更好用，缩放控制也更便捷。

Because I'd asked the planner to weave AI features into its specs, the app also came with a built-in Claude integration that let me generate different parts of the game through prompting. This significantly sped up the workflow.
因为我要求规划器在其规格中融入人工智能功能，所以该应用程序还内置了 Claude 集成，让我可以通过提示生成游戏的不同部分。这大大加快了工作流程。

The biggest difference was in play mode. I was actually able to move my entity and play the game. The physics had some rough edges—my character jumped onto a platform but ended up overlapping with it, which felt intuitively wrong—but the core thing worked, which the solo run did not manage. After moving around a bit, I did hit some limitations with the AI’s game level construction. There was a large wall that I wasn’t able to jump past, so I was stuck. This suggested there were some common sense improvements and edge cases that the harness could handle to further refine the app.
最大的区别在于游戏模式。我终于可以控制角色移动并进行游戏了。物理引擎还有一些瑕疵——我的角色跳上平台后却和平台重叠了，这感觉很不自然——但核心功能是正常的，而单人游戏模式却没能做到这一点。稍微探索了一番之后，我发现 AI 在关卡设计上存在一些局限性。有一堵高墙我无法跳过，所以被困住了。这表明，该应用还有一些常识性的改进空间，并且可以通过一些特殊情况的处理来进一步完善。

Reading through the logs, it was clear that the evaluator kept the implementation in line with the spec. Each sprint, it walked through the sprint contract's test criteria and exercised the running application through Playwright, filing bugs against anything that diverged from expected behavior. The contracts were granular—Sprint 3 alone had 27 criteria covering the level editor—and the evaluator's findings were specific enough to act on without extra investigation. The table below shows several examples of issues our evaluator identified:
阅读日志后可以明显看出，评估人员严格按照规范执行了开发工作。每个迭代周期，评估人员都会逐一检查迭代合同中的测试标准，并通过 Playwright 对运行中的应用程序进行测试，并对任何偏离预期行为的情况提交错误报告。合同非常细致——仅第三个迭代周期就包含了 27 条涵盖关卡编辑器的标准——评估人员的发现也足够具体，无需额​​外调查即可采取行动。下表列出了评估人员发现的一些问题示例：

| **Contract criterion** | **Evaluator finding** |
| --- | --- |
| Rectangle fill tool allows click-drag to fill a rectangular area with selected tile | **FAIL** — Tool only places tiles at drag start/end points instead of filling the region. `fillRectangle` function exists but isn't triggered properly on mouseUp. |
| User can select and delete placed entity spawn points | **FAIL** — Delete key handler at `LevelEditor.tsx:892` requires both `selection` and `selectedEntityId`to be set, but clicking an entity only sets `selectedEntityId`. Condition should be `selection || (selectedEntityId && activeLayer === 'entity')`. |
| User can reorder animation frames via API | **FAIL** — `PUT /frames/reorder` route defined after `/{frame_id}` routes. FastAPI matches 'r`eorder`' as a frame_id integer and returns 422: "unable to parse string as an integer." |

| **合同标准** | **评估者发现** | | --- | --- | | 矩形填充工具允许通过点击拖动来用选定的图块填充矩形区域 | **失败** — 该工具仅将图块放置在拖动的起点/终点，而不是填充区域。`fillRectangle` 函数存在，但在鼠标抬起时未正确触发。 | | 用户可以选择并删除已放置的实体生成点 | **失败** — `LevelEditor.tsx:892` 处的删除键处理程序需要同时设置 `selection` 和 `selectedEntityId`，但点击实体只会设置 `selectedEntityId`。条件应为 `selection || (selectedEntityId && activeLayer === 'entity')`。 | | 用户可以通过 API 重新排列动画帧 | **失败** — `PUT /frames/reorder` 路由定义在 `/{frame_id}` 路由之后。 FastAPI 将 'r`eorder`' 匹配为 frame_id 整数，并返回 422：“无法将字符串解析为整数。” |

Getting the evaluator to perform at this level took work. Out of the box, Claude is a poor QA agent. In early runs, I watched it identify legitimate issues, then talk itself into deciding they weren't a big deal and approve the work anyway. It also tended to test superficially, rather than probing edge cases, so more subtle bugs often slipped through. The tuning loop was to read the evaluator's logs, find examples where its judgment diverged from mine, and update the QAs prompt to solve for those issues. It took several rounds of this development loop before the evaluator was grading in a way that I found reasonable. Even then, the harness output showed the limits of the model’s QAing capabilities: small layout issues, interactions that felt unintuitive in places, and undiscovered bugs in more deeply nested features that the evaluator hadn't exercised thoroughly. There was clearly more verification headroom to capture with further tuning. But compared to the solo run, where the central feature of the application simply didn't work, the lift was obvious.
要让评估器达到这个水平需要付出很多努力。Claude 本身并不是一个合格的质量保证代理。在早期运行中，我发现它虽然识别出了合理的问题，但却会自我安慰，认为这些问题无关紧要，最终还是批准了工作。它也倾向于进行表面测试，而不是深入探究各种极端情况，因此一些更隐蔽的 bug 常常被忽略。调整流程是读取评估器的日志，找出它判断与我不同的例子，并更新质量保证提示以解决这些问题。经过几轮这样的开发循环，评估器的评分方式才最终达到我认可的合理水平。即便如此，测试结果仍然显示出该模型质量保证能力的局限性：一些小的布局问题、某些地方交互体验不够直观，以及评估器尚未彻底测试的更深层嵌套功能中存在的未发现 bug。显然，通过进一步的调整，还有更大的验证空间。但与应用程序核心功能根本无法正常工作的单独运行相比，提升是显而易见的。

### Iterating on the harness / 对线束进行迭代

The first set of harness results was encouraging, but it was also bulky, slow, and expensive. The logical next step was to find ways to simplify the harness without degrading its performance. This was partly common sense and partly a function of a more general principle: every component in a harness encodes an assumption about what the model can't do on its own, and those assumptions are worth stress testing, both because they may be incorrect, and because they can quickly go stale as models improve. Our blog post [Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) frames the underlying idea as "find the simplest solution possible, and only increase complexity when needed," and it's a pattern that shows up consistently for anyone maintaining an agent harness.
第一组测试结果令人鼓舞，但该测试框架体积庞大、运行缓慢且成本高昂。接下来的合理步骤，就是寻找在不降低性能的前提下简化测试框架的方法。这既源于常识，也基于一个更普遍的原则：测试框架中的每个组件都暗含着对模型自身能力不足的假设，而这些假设值得进行压力测试——一方面是因为它们可能不正确，另一方面是因为随着模型的改进，这些假设很快就会过时。我们的博客文章[《构建高效代理》]（https://www.anthropic.com/research/building-effective-agents）将这一核心理念概括为“寻找尽可能简单的解决方案，仅在必要时增加复杂度”，这也是任何维护代理框架的人都会反复遇到的模式。

In my first attempt to simplify, I cut the harness back radically and tried a few creative new ideas, but I wasn't able to replicate the performance of the original. It also became difficult to tell which pieces of the harness design were actually load-bearing, and in what ways. Based on that experience, I moved to a more methodical approach, removing one component at a time and reviewing what impact it had on the final result.
在最初尝试简化设计时，我大幅精简了 harness 结构，并尝试了几个富有创意的新点子，但未能重现原版的性能。此外，也难以分辨安全带设计中的哪些部件实际上承担了载荷，以及它们是如何发挥作用的。基于这次经验，我转而采取了更系统的方法，一次只去除一个组件，并评估它对最终结果的影响。

As I was going through these iteration cycles, we also released Opus 4.6, which provided further motivation to reduce harness complexity. There was good reason to expect 4.6 would need less scaffolding than 4.5 did. From our [launch blog:](https://www.anthropic.com/news/claude-opus-4-6) "[Opus 4.6] plans more carefully, sustains agentic tasks for longer, can operate more reliably in larger codebases, and has better code review and debugging skills to catch its own mistakes." It also improved substantially on long-context retrieval. These were all capabilities the harness had been built to supplement.
在经历这些迭代周期时，我们还发布了 Opus 4.6，这进一步推动了我们降低测试框架复杂度的努力。有充分理由相信，4.6 所需的辅助框架将比 4.5 更少。正如我们在 [发布博客](https://www.anthropic.com/news/claude-opus-4-6) 中所述 “[Opus 4.6] 规划更周密，能更长时间地维持代理任务，在更大规模的代码库中运行更可靠，并且具备更强的代码审查和调试能力，能够发现自身的错误。”它在长上下文检索方面也得到了显著提升。这些正是测试框架当初构建时旨在补充的功能。

### Removing the sprint construct / 移除冲刺结构

I started by removing the sprint construct entirely. The sprint structure had helped to decompose work into chunks for the model to work coherently. Given the improvements in Opus 4.6, there was good reason to believe that the model could natively handle the job without this sort of decomposition.
我首先彻底移除了迭代周期结构。迭代周期结构有助于将工作分解成若干小块，从而使模型能够协调一致地运行。鉴于 Opus 4.6 的改进，我们有理由相信，即使没有这种分解方式，模型也能原生处理这项工作。

I kept both the planner and evaluator, as each continued to add obvious value. Without the planner, the generator under-scoped: given the raw prompt, it would start building without first speccing its work, and end up creating a less feature-rich application than the planner did.
我保留了规划器和评估器，因为它们都持续发挥着显而易见的价值。如果没有规划器，生成器的功能就会不足：给定原始提示，它会在没有事先明确功能需求的情况下就开始构建，最终生成的应用程序功能不如规划器生成的丰富。

With the sprint construct removed, I moved the evaluator to a single pass at the end of the run rather than grading per sprint. Since the model was much more capable, it changed how load-bearing the evaluator was for certain runs, with its usefulness depending on where the task sat relative to what the model could do reliably on its own. On 4.5, that boundary was close: our builds were at the edge of what the generator could do well solo, and the evaluator caught meaningful issues across the build. On 4.6, the model's raw capability increased, so the boundary moved outward. Tasks that used to need the evaluator's check to be implemented coherently were now often within what the generator handled well on its own, and for tasks within that boundary, the evaluator became unnecessary overhead. But for the parts of the build that were still at the edge of the generator’s capabilities, the evaluator continued to give real lift.
随着冲刺机制的移除，我将评估器调整为在运行结束时进行单次评估，而非按冲刺阶段分别评分。由于模型的能力大幅提升，这改变了评估器在某些运行中的承重程度，其作用取决于任务相对于模型自身可靠能力所处的位置。在 4.5 版本中，这一界限非常接近：我们的构建处于生成器能够独立处理的极限边缘，评估器在整个构建过程中捕获了有意义的问题。在 4.6 版本中，模型的原始能力有所提升，因此该界限向外推移。过去需要评估器检查才能实现一致性的任务，现在往往已处于生成器能够独立处理的范围内；对于处于该界限内的任务，评估器变成了不必要的开销。但对于构建中仍处于生成器能力边缘的部分，评估器继续发挥着实质性的作用。

The practical implication is that the evaluator is not a fixed yes-or-no decision. It is worth the cost when the task sits beyond what the current model does reliably solo.
实际意义在于，评估结果并非简单的“是”或“否”。当任务超出当前模型单独可靠完成的能力范围时，这种评估方式是值得的。

Alongside the structural simplification, I also added prompting to improve how the harness built AI features into each app, specifically getting the generator to build a proper agent that could drive the app's own functionality through tools. That took real iteration, since the relevant knowledge is recent enough that Claude's training data covers it thinly. But with enough tuning, the generator was building agents correctly.
除了结构简化之外，我还添加了提示功能，以改进框架将 AI 功能集成到每个应用程序中的方式，特别是让生成器构建一个合适的代理，该代理能够通过工具驱动应用程序自身的功能。这需要反复迭代，因为相关知识比较新，Claude 的训练数据覆盖面不够广。但经过充分的调整，生成器最终能够正确地构建代理。

### Results from the updated harness / 更新后的测试结果

To put the updated harness to the test, I used the following prompt to generate a Digital Audio Workstation (DAW), a music production program for composing, recording, and mixing songs:
为了测试更新后的设备，我使用以下提示符生成了一个数字音频工作站 (DAW)，这是一个用于作曲、录音和混音的音乐制作程序：

> _Build a fully featured DAW in the browser using the Web Audio API._
使用 Web Audio API 在浏览器中构建功能齐全的数字音频工作站 (DAW)。

The run was still lengthy and expensive, at about 4 hours and $124 in token costs.
这次跑步活动仍然耗时很长，而且费用昂贵，大约需要 4 个小时，代币费用为 124 美元。

Most of the time went to the builder, which ran coherently for over two hours without the sprint decomposition that Opus 4.5 had needed.
大部分时间都给了构建者，构建者连续运行了两个多小时，而没有像 Opus 4.5 那样进行冲刺分解。

|**Agent & Phase**|**Duration**|**Cost**|
|----|-----|-----|
|Planner |4.7 min|$0.46|
|Build (Round 1)|2 hr 7 min|$71.08|
|QA (Round 1)|8.8 min|$3.24|
|Build (Round 2)|1 hr 2 min|$36.89|
|QA (Round 2)|6.8 min|$3.09|
|Build (Round 3)|10.9 min|$5.88|
|QA (Round 3) | 9.6 min|$4.06|
|**Total V2 Harness**|**3 hr 50 min**|**$124.70**|

|**代理及阶段**|**持续时间**|**成本**|
|-----|----|----|
| 规划器| 4.7 分钟 |0.46 美元| 
|构建（第一轮）|2 小时 7 分钟| 71.08 美元|
|质量保证（第一轮）|8.8 分钟 |3.24 美元| 
|构建（第二轮）|1 小时 2 分钟| 36.89 美元| 
|质量保证（第二轮）|6.8 分钟 |3.09 美元| 
|构建（第三轮）|10.9 分钟| 5.88 美元| 
|质量保证（第三轮）|9.6 分钟 |4.06 美元| 
|**V2 框架总耗时**|**3 小时 50 分钟**|**124.70 美元**|

As with the previous harness, the planner expanded the one-line prompt into a full spec. From the logs, I could see the generator model did a good job planning the app and the agent design, wiring the agent up, and testing it before handing off to QA.
与之前的方案一样，规划器将一行提示信息扩展成了完整的规范。从日志中可以看出，生成器模型很好地完成了应用程序和代理的设计规划、代理的配置以及在交付给质量保证团队之前进行的测试。

That being said, the QA agent still caught real gaps. In its first-round feedback, it noted:
尽管如此，质检人员还是发现了一些实际问题。在第一轮反馈中，它指出：

> This is a strong app with excellent design fidelity, solid AI agent, and good backend. The main failure point is Feature Completeness — while the app looks impressive and the AI integration works well, several core DAW features are display-only without interactive depth: clips can't be dragged/moved on the timeline, there are no instrument UI panels (synth knobs, drum pads), and no visual effect editors (EQ curves, compressor meters). These aren't edge cases — they're the core interactions that make a DAW usable, and the spec explicitly calls for them.
这款应用功能强大，设计精良，AI 代理稳定可靠，后端也相当出色。其主要不足之处在于功能完整性——尽管应用界面美观，AI 集成也运行良好，但一些核心的 DAW 功能仅供显示，缺乏交互深度：片段无法在时间线上拖拽/移动，没有乐器 UI 面板（合成器旋钮、鼓垫），也没有可视化效果编辑器（均衡器曲线、压缩器电平表）。这些并非个别情况——它们是 DAW 可用的核心交互功能，规范中也明确要求具备这些功能。

In its second round feedback, it again caught several functionality gaps:
在第二轮反馈中，它再次发现了一些功能上的不足：

> Remaining gaps:
> 
> - Audio recording is still stub-only (button toggles but no mic capture)
> 
> - Clip resize by edge drag and clip split not implemented
> 
> - Effect visualizations are numeric sliders, not graphical (no EQ curve)

> 剩余缺陷： 
>  - 音频录制功能仍然很简陋（按钮可以切换，但没有麦克风录制） 
>  - 边缘拖动调整片段大小和片段分割功能尚未实现 
> - 效果可视化为数值滑块，而非图形（没有均衡器曲线）

The generator was still liable to miss details or stub features when left to its own devices, and the QA still added value in catching those last mile issues for the generator to fix.
即使让生成器自行运行，它仍然可能遗漏细节或缺少功能，而质量保证人员仍然能够发现这些最后阶段的问题，以便生成器进行修复。

Based on the prompt, I was expecting a program where I could create melodies, harmonies, and drum patterns, arrange them into a song, and get help from an integrated agent along the way. The video below shows the result.
根据提示，我原本以为会是一个可以让我创作旋律、和声和鼓点，并将它们编排成一首歌，同时还能获得内置智能助手帮助的程序。下面的视频展示了最终成果。

The app is far from a professional music production program, and the agent's song composition skills could clearly use a lot of work. Additionally, Claude can’t actually hear, which made the QA feedback loop less effective with respect to musical taste.
这款应用远非专业的音乐制作软件，经纪人的作曲能力显然还有待提高。此外，Claude 实际上听不见，这使得质量保证反馈机制在音乐品味方面效果不佳。

But the final app had all the core pieces of a functional music production program: a working arrangement view, mixer, and transport running in the browser. Beyond that, I was able to put together a short song snippet entirely through prompting: the agent set the tempo and key, laid down a melody, built a drum track, adjusted mixer levels, and added reverb. The core primitives for song composition were present, and the agent could drive them autonomously, using tools to create a simple production from end to end. You might say it’s not pitch-perfect yet—but it’s getting there.
但最终的应用程序具备了功能齐全的音乐制作程序的所有核心组件：一个可正常工作的编曲视图、混音器和传输控制界面，全部运行在浏览器中。除此之外，我还能完全通过提示完成一小段歌曲：智能体设置了速度和调性，谱写了旋律，创建了鼓点，调整了混音器音量，并添加了混响。歌曲创作的核心要素一应俱全，智能体可以自主运行这些功能，使用各种工具完成从头到尾的简单制作。你可能会说它还不够完美——但它正在朝着这个方向发展。

## What comes next / 接下来会发生什么？

As models continue to improve, we can roughly expect them to be capable of working for longer, and on more complex tasks. In some cases, that will mean the scaffold surrounding the model matters less over time, and developers can wait for the next model and see certain problems solve themselves. On the other hand, the better the models get, the more space there is to develop harnesses that can achieve complex tasks beyond what the model can do at baseline.
随着模型不断改进，我们可以大致预期它们能够运行更长时间，并处理更复杂的任务。在某些情况下，这意味着随着时间的推移，模​​型周围的框架的重要性会降低，开发人员可以等待下一代模型，并看到某些问题自行解决。另一方面，模型越好，就越有空间开发能够完成模型基线功能之外的复杂任务的框架。

With this in mind, there are a few lessons from this work worth carrying forward. It is always good practice to experiment with the model you're building against, read its traces on realistic problems, and tune its performance to achieve your desired outcomes. When working on more complex tasks, there is sometimes headroom from decomposing the task and applying specialized agents to each aspect of the problem. And when a new model lands, it is generally good practice to re-examine a harness, stripping away pieces that are no longer load-bearing to performance and adding new pieces to achieve greater capability that may not have been possible before.
鉴于此，这项工作中有一些值得借鉴的经验。始终对正在构建的模型进行实验，分析其在实际问题上的表现，并调整其性能以达到预期结果，这始终是一个好习惯。在处理更复杂的任务时，有时可以通过分解任务并针对问题的各个方面应用专门的代理来提升性能。此外，当新模型上线后，通常最好重新审视其架构，移除不再对性能产生影响的部分，并添加新的部分以实现以前可能无法实现的更强大的功能。

From this work, my conviction is that the space of interesting harness combinations doesn't shrink as models improve. Instead, it moves, and the interesting work for AI engineers is to keep finding the next novel combination.
这项研究让我确信，随着模型的改进，有趣的硬件组合空间并不会缩小。相反，它会不断扩展，而人工智能工程师的真正乐趣在于不断寻找下一个新颖的组合。

## Acknowledgements / 致谢

Special thanks to Mike Krieger, Michael Agaby, Justin Young, Jeremy Hadfield, David Hershey, Julius Tarng, Xiaoyi Zhang, Barry Zhang, Orowa Sidker, Michael Tingley, Ibrahim Madha, Martina Long, and Canyon Robbins for their contributions to this work.
特别感谢 Mike Krieger、Michael Agaby、Justin Young、Jeremy Hadfield、David Hershey、Julius Tarng、Xiaoyi Zhang、Barry Zhang、Orowa Sidker、Michael Tingley、Ibrahim Madha、Martina Long 和 Canyon Robbins 对这项工作的贡献。

Thanks also to Jake Eaton, Alyssa Leonard, and Stef Sequeira for their help shaping the post.
还要感谢 Jake Eaton、Alyssa Leonard 和 Stef Sequeira 对本文的撰写提供的帮助。

## Appendix / 附录

Example plan generated by planner agent.
由规划代理生成的示例计划。

```
RetroForge - 2D Retro Game Maker
RetroForge - 2D 复古游戏制作器

Overview
RetroForge is a web-based creative studio for designing and building 2D retro-style video games. It combines the nostalgic charm of classic 8-bit and 16-bit game aesthetics with modern, intuitive editing tools—enabling anyone from hobbyist creators to indie developers to bring their game ideas to life without writing traditional code.
概述：RetroForge 是一个基于 Web 的创意工作室，用于设计和构建 2D 复古风格的视频游戏。它将经典 8 位和 16 位游戏的怀旧魅力与现代、直观的编辑工具相结合，使从业余创作者到独立开发者的任何人都能将他们的游戏创意变为现实，而无需编写传统代码。

The platform provides four integrated creative modules: a tile-based Level Editor for designing game worlds, a pixel-art Sprite Editor for crafting visual assets, a visual Entity Behavior system for defining game logic, and an instant Playable Test Mode for real-time gameplay testing. By weaving AI assistance throughout (powered by Claude), RetroForge accelerates the creative process—helping users generate sprites, design levels, and configure behaviors through natural language interaction.
该平台提供四个集成式创意模块：基于图块的关卡编辑器，用于设计游戏世界；像素艺术精灵编辑器，用于制作视觉素材；可视化实体行为系统，用于定义游戏逻辑；以及即时可玩测试模式，用于实时游戏测试。RetroForge 贯穿始终地融入了人工智能辅助功能（由 Claude 提供技术支持），加速了创作过程——帮助用户通过自然语言交互生成精灵、设计关卡并配置行为。

RetroForge targets creators who love retro gaming aesthetics but want modern conveniences. Whether recreating the platformers, RPGs, or action games of their childhood, or inventing entirely new experiences within retro constraints, users can prototype rapidly, iterate visually, and share their creations with others.
RetroForge 面向那些热爱复古游戏美学但又渴望现代便捷体验的创作者。无论是重现童年时代的平台游戏、角色扮演游戏还是动作游戏，亦或是受限于复古元素创造全新的游戏体验，用户都可以快速制作原型、进行视觉迭代，并与他人分享自己的作品。

Features
1. Project Dashboard & Management
The Project Dashboard is the home base for all creative work in RetroForge. Users need a clear, organized way to manage their game projects—creating new ones, returning to works-in-progress, and understanding what each project contains at a glance.
功能 1. 项目仪表盘和管理 项目仪表盘是 RetroForge 中所有创作工作的中心。用户需要一种清晰、有序的方式来管理他们的游戏项目——创建新项目、返回正在进行的项目，并一目了然地了解每个项目包含的内容。

User Stories: As a user, I want to:
用户故事：作为用户，我希望：

- Create a new game project with a name and description, so that I can begin designing my game
- See all my existing projects displayed as visual cards showing the project name, last modified date, and a thumbnail preview, so that I can quickly find and continue my work
- Open any project to enter the full game editor workspace, so that I can work on my game
- Delete projects I no longer need, with a confirmation dialog to prevent accidents, so that I can keep my workspace organized
- Duplicate an existing project as a starting point for a new game, so that I can reuse my previous work
- 创建一个新的游戏项目，并添加名称和描述，以便开始游戏设计。- 查看所有现有项目，以卡片形式呈现，显示项目名称、最后修改日期和缩略图预览，方便快速查找并继续工作。- 打开任意项目即可进入完整的游戏编辑器工作区，开始游戏开发。- 删除不再需要的项目，并弹出确认对话框以防止误操作，保持工作区整洁有序。- 复制现有项目作为新游戏的起点，以便重复利用之前的工作成果。

Project Data Model: Each project contains:
项目数据模型：每个项目包含：

Project metadata (name, description, created/modified timestamps)
Canvas settings (resolution: e.g., 256x224, 320x240, or 160x144)
Tile size configuration (8x8, 16x16, or 32x32 pixels)
Color palette selection 
All associated sprites, tilesets, levels, and entity definitions
项目元数据（名称、描述、创建/修改时间戳）画布设置（分辨率：例如 256x224、320x240 或 160x144）图块大小配置（8x8、16x16 或 32x32 像素）调色板选择所有关联的精灵、图块集、关卡和实体定义
```
