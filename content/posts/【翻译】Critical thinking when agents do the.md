---
title: "【翻译】使用 agents 工作时需要的批判性思维"
draft: false
date: 2026-11-13T16:25:45+08:00
description: "翻译 [Critical thinking when agents do the work](https://x.com/addyosmani/article/2117512471930167377)"
tags: [agent, 翻译, AI]
---

# 使用 agents 工作时需要的批判性思维

> 原文链接：<https://x.com/addyosmani/article/2117512471930167377>
>
> 作者：[Addy Osmani](https://x.com/addyosmani)

Back in the day, critical thinking was taught as approaching new info with humble curiosity and a healthy dose of skepticism - take in different views, form your own opinion. Still true, but increasingly, nothing in my day-to-day forces critical thinking on me now that so much of my work runs through agents. For the engineers and product people who have fully bought into agentic workflows (running multiple sessions in parallel and expecting the models to improve), I'm here to say: I'm a big fan of these tools. I'm not writing this to advocate for less agentic workflows.

> 过去，批判性思维被教导为以谦逊的好奇心和健康的怀疑精神处理新信息——接纳不同观点，形成自己的见解。这依然正确，但 如今，由于我日常工作的大部分内容都通过代理完成，几乎没有什么能迫使我进行批判性思维对于那些完全拥抱代理工作流程的工程师和产品人员（同时运行多个会话并期望模型变得更好），我想说：我非常喜欢这些工具。我写这篇文章并非主张减少代理工作流程。

My goal is to help you maintain critical thinking in a world where it's easy to offload anything to an agent.

> 我的目标是帮助你在一个可以轻松将任何事情外包给代理的世界中保持批判性思维。

In the past, most of our cognitive and aesthetic processing happened in the space between question and answer. That space is now measured in seconds. The more you use agentic workflows, the more difficult it becomes (though not in the way I think people expected): as the models improve, the percentage of obvious errors is lower. Many (most?) outputs will be well-written and mostly correct, but they won't demand a second look.

> 过去，我们大部分的认知和审美处理都发生在问题与答案之间的空间里。如今，这个空间被压缩到几秒钟。你越多使用 agent 工作流，批判性思维就变得越困难（尽管不是人们预期的那种方式）：随着模型的改进，明显错误的比例降低了。许多（甚至大多数？）输出都会写得很好且基本正确，但它们不会引发你的第二次审视。

Even if you are running many agents at a time, you still only have one pair of eyes on the outputs.

> 即使你同时运行多个 agent，最终也只能用一双眼睛查看输出。

You have to build critical thinking into your day, because by default nothing will do it for you.

> 你必须将批判性思维融入日常工作中，因为默认情况下，没有任何东西会为你完成这件事。

Part of the reason it's hard to self-correct for this is that agentic workflows are pleasant. Getting fast, pleasant, often-correct answers is refreshing in a busy day, but that's also why it's easy to relax your vigilance.

> 其中一个原因是代理工作流程很舒适。在繁忙的一天中，获得快速、愉悦且通常正确的答案令人耳目一新，但这也是为什么你容易放松警惕。

## Offloading, deferral and surrender /。外包、推迟与放弃

When discussing this with people, I describe it as a spectrum:

> 在与人讨论这件事时，我把它描述为一个光谱：

At the top: cognitive offloading, the act of delegating tasks to the AI, but maintaining ownership of the result. I do this all day. You should, too. In the middle: deferral, where the output of the tool becomes your new input; the result has ceased to be a hypothesis. At the bottom: [cognitive surrender](https://addyosmani.com/blog/cognitive-surrender/) - the AI's output quietly becomes your own, you feel no need to check it.

Cognitive surrender is a term coined by [Steven Shaw and Gideon Nave](https://ssrn.com/abstract_id=6097646) at Wharton. It fits neatly what I've been seeing: as trust (or laziness) increases, people drift down the spectrum. The transition is rarely observed, because the steps are each gradual and seem reasonable. You read the last answer well, so you skim the next one. You just scan the skeleton of the one after that. Then you get asked about a line and can't explain it, even with your agent's help.
That's cognitive surrender. It's how cognitive debt accumulates. It's usually discovered when you try to apply a mental model of the system and it doesn't exist. [Margaret-Anne Storey](https://margaretstorey.com/blog/2026/02/09/cognitive-debt/) has written about how this shows up in teams as an eroding understanding of a shared system theory. I've written about the code equivalent, [comprehension debt](https://addyosmani.com/blog/comprehension-debt/) (a term coined by Jeremy Twei). In the moment, it's completely invisible. The codebase looks pristine and the tests pass. It doesn't become obvious until you have to make a change to the system and realize that nobody understands it anymore. The same applies when you've read the table of contents of a strategy doc or spec and signed off on it.

To be clear, I'm not advocating for the impossible. It's impossible to maintain the full mental model of a large modern codebase. [The Claude Code team has said publicly](https://claude.dev/blog/solving-code-review-at-anthropic/) that they rebuild understanding on demand: when they need to understand a part, they ask Claude to explain that slice, rather than holding the full model in their heads. As I've [written about before](https://addyosmani.com/blog/intent-debt/), this sort of debt is more recoverable than most engineers expect. You don't need to maintain the full model as long as you can rebuild it locally as needed. You just need to know what you don't have.

\**Where the stakes are low, feel free to delegate entirely. When you can't explain the answer to a question, even by way of your agent, you've ceded ownership.**

This isn't always a problem, either. Just recently, I was recording a course and had to select one out of three similarly-rated hotels to use as a recording location. I didn't have time to manually review all the reviews, so I delegated the decision to an AI. It worked, and I'd do the same thing again. However, I wouldn't do that when deciding how to invest our money, how to advise our kids on their careers, or at work: what we should build, what changes affect what users, whether it's safe to ship. Take the handoff where being wrong is cheap, keep the reasoning where others will have to deal with the consequences.

## The questions I ask myself /  扪心自问的问题

When I didn't know what I thought, I'd usually go back to a basic list of questions like these: How do I know that I'm working on the right problem? How do I know that I'm solving it the right way? Is there evidence that supports my conclusion? How do I know that I'm finished? Most times, this is just [who, what, where, why, when and how](https://addyo.substack.com/p/critical-thinking-during-the-age). When written out, it looks absurdly child-like, but it forces you to think in terms of categories that you'd otherwise ignore. These days, it's too easy to simply skip all of this and ask your agent what it thinks you should do. These are the new versions of these questions that I ask myself now.

> 当我不知道自己到底在想什么时，我通常会回到这样一份基础问题清单：我怎么知道自己在处理正确的问题？我怎么知道自己在用正确的方式解决它？有没有证据支持我的结论？我怎么知道已经完成了？大多数时候，这其实就是[谁、什么、哪里、为什么、何时和如何](https://addyo.substack.com/p/critical-thinking-during-the-age)。写下来时，它看起来荒谬得像个孩子的问题，但它会迫使你从那些你原本会忽略的类别去思考。如今，人们太容易直接跳过这一切，去问你的代理人，它认为你该怎么做。这些就是我现在问自己的这些问题的新版本。

**Did I formulate a hypothesis before asking?** Before I run an agent on any non-trivial task, I write down, even just in my head, what I think the answer might be. It's OK if it's a bad guess. You're always welcome to change your mind in light of new information. Once you've read a well-written response, though, it's hard to imagine any other possibility. If you have no guidance whatsoever, ask for what Thariq Shihipar calls a [blind spot pass](https://claude.com/blog/a-field-guide-to-claude-fable-finding-your-unknowns): give the model what you know and have it find your unknown unknowns.

> **我在提问前是否先提出了假设？** 在对任何非平凡任务运行智能体之前，我都会写下，哪怕只是在心里，我认为可能的答案。错了也没关系。你随时都可以根据新信息改变想法。不过，一旦你读到一个写得很好的回答，就很难再想象出其他可能性。如果你完全没有任何指引，可以要求模型进行 Thariq Shihipar 所说的“[盲点扫描](https://claude.com/blog/a-field-guide-to-claude-fable-finding-your-unknowns)”（blind spot pass）：把你知道的信息提供给模型，让它找出你未知的未知。

**Am I asking it to help me think or to offload thinking from me?** Both are OK, as long as you know which one you're doing.

**What would have to be true for this to be wrong?** Then go find out. A model's self-assessment of confidence is much less valuable than an actual test you can perform, so give it one.

> 什么情况下这个结论会是错的？ 然后去验证。模型对自身置信度的自我评估远不如你能执行的实际测试有价值，所以给它一个测试。

**Have I heard the counter argument from a different angle?** When I've taken a hard stance on something that's somewhat open-ended, I'll ask more than one model to argue the opposite side, then review the output and form my own opinion. This takes longer, but I end up knowing much more about the subject.

> 我是否从不同角度听过反方观点？ 当我对某个有一定开放性的问题持强硬立场时，我会让多个模型从相反角度进行论证，然后审查输出并形成自己的观点。这会花费更长时间，但最终我对该主题的了解会更深入。

**Would I bet on this in front of the person who has to maintain it?** This applies to code and to anything else that you're delivering. I believe that this is the bar for answerability.

> 如果让必须维护它的人站出来，我会为这个答案下注吗？ 这适用于代码，也适用于你交付的任何其他内容。我相信这是可问责性的标准。

**What am I no longer practicing?** Maybe it's some of the routine debugging. I'm OK with letting some of that go, but I want it to be intentional.

> 我现在不再练习什么了？ 也许是一些常规调试。我可以接受放弃其中一些，但希望这是有意而为之。

## Verification as a habit / 将验证养成习惯

I've been writing a lot about verification lately because I believe that [the bottleneck has shifted from coding to being sure you're right](https://addyo.substack.com/p/agentic-verification). When you give an agent the means to verify what it's doing, whether that be by way of end-to-end tests, property tests, or by way of actual app interactions, it can make a change, run the verification test, read the output, and attempt again all before you've looked at anything. This is what Boris Cherny calls ["give Claude a way to verify its work"](https://x.com/bcherny/status/2007179861115511237) and I believe that this is one of the most critical components of achieving great results. Rather than reading every line, you'll be building these loops and reviewing the evidence.

> 最近我写了很多关于验证的内容，因为我相信[瓶颈已经从编码转移到了确保自己正确](https://addyo.substack.com/p/agentic-verification)。当你赋予智能体验证自身行为的手段时——无论是通过端到端测试、属性测试，还是通过实际的应用交互——它就能在修改、运行验证测试、读取输出并再次尝试之后，在你查看任何东西之前完成这一切。这就是 Boris Cherny 所说的“[给 Claude 一种验证其工作的方式](https://x.com/bcherny/status/2007179861115511237)”，而我认为这是取得出色成果的最关键要素之一。你不必逐行阅读，而是会构建这些循环，并审查证据。

You can also surrender verification. "Is there evidence that supports my conclusion?" becomes "Did the check turn green?" Agents make it so cheap to create tests that you'll see a lot of green, and you could have a passing test that doesn't catch a broken feature. If the test is written with the same mistake as the feature, it'll pass. And a green check only conveys one property. It's too easy to imagine it covers everything.

> 你也可以放弃验证。「有什么证据支持我的结论？」变成了「检查是否变绿？」代理让创建测试变得如此廉价，你会看到很多绿色，而且可能有一个通过的测试并未捕获损坏的功能。如果测试和功能犯了同样的错误，它会通过。而绿色的勾只传达一个属性。很容易想象它覆盖了所有情况。

**When a check goes green, ask what it proved. Then ask what it didn't.**

> 当检查变绿时，问问它证明了什么。然后问问它没有证明什么。

Define "verified" upfront, because post-facto, you'll rationalize any outcome.

> 提前定义「已验证」的含义，因为事后你会为任何结果找借口。

The finish line for agent work should be something tangible: a test passing, a screenshot, a log or trace. This ensures that the criteria for finishing the work is factual, and not up for interpretation (and surrender) based on something like "it looks like it's done." When you receive a finish notification from an agent, before you look at the summary, first review the code snippet of the command executed and its output.

> 代理工作的终点线应该是某个有形的东西：测试通过、截图、日志或追踪。这确保了完成工作的标准是事实依据，而不是基于诸如「看起来完成了」之类的主观解释（或放弃）。当你从代理收到完成通知时，在查看摘要之前，先审查执行的命令及其输出的代码片段。

Claude Code can also self-critique (via a subagent in a fresh context) its own work as a sanity check, and it's worth baking that into the loop so it runs every time, not just when you remember. I still ask at the end "Did I miss anything?" That sounds silly, but so often, when I finish some complex feature work using a frontier model, look at it, review it, and then ask, "Did I miss anything?" It will then come back with two or three more things. That's why I always ask.

> Claude Code 还可以通过新上下文中的子代理对自己的工作进行自我审查（作为健全性检查），值得将其纳入循环，使其每次都运行，而不仅仅是你记得时。我最后仍会问「我是否遗漏了什么？」这听起来很傻，但很多时候，当我完成某个复杂功能的开发、查看并审查后，再问「我是否遗漏了什么？」它会随即返回两三个额外的问题。这就是为什么我总会问。

None of this needs to be the norm, of course; knowing when to go deep is a skill. My favorite rule of thumb from our [write-up on how the Claude Code team does code review](https://claude.dev/blog/solving-code-review-at-anthropic/) is: "If you can't say what the checks would miss, ask for a real review rather than a quick approval."

This applies beyond code as well. If an agent has synthesized fifty customer calls for you, or a competitive analysis, check a couple of the source documents to make sure the summary is accurate. Check a number that your recommendation depends on to make sure it's being calculated correctly.
Agents have made verification cheap to set up. What's difficult for you is knowing what good verification looks like.

## Actually paying attention to what's generated

Say an agent gives you a 600-line PR. You roughly look at the structure. You don't read every line. The variable names look reasonable and the tests pass, so you approve it. But somewhere in the middle there's a subtle ordering change in a transaction boundary, or a flipped default on an edge case you never thought about. You did review it, I guess, but only for what you already knew you'd find.

Writing code and reviewing it are different skills, and there's a point where reviewing turns into rubber stamping. So read the diff as if the AI didn't write it, and then look past the diff at what the agent decided. Over a long session it makes a lot of small decisions for you: the defaults, what's out of scope, which requirement it reinterprets when two of them clash.

You won't see any of that in a summary that says everything went well, so ask it to list the decisions and assumptions it made. Then quiz yourself. Pick a few lines at random and ask, what about this line? What about that one? For a document, close it and try to write out the main argument from memory. Some have a habit I like for long sessions: have Claude write a report on the change, and then give you a quiz at the bottom, where the rule is "I only merge after I pass the quiz perfectly."

**Understand what you're shipping well enough to defend it. Because at some point, someone could ask.**

Agents can also guard your attention. For example, I have an open source project that receives a lot of pull requests. I'll use agents to help determine what's incoming, what's contrary to our guidelines, and where my attention is likely required. I rarely let the agents self-determine this, but they can narrow it down to where I should focus my attention, and then I can actually think about whether these changes are solving the right problem in the right way.

Then there's volume, and you have to be honest with yourself about it. I've called this the orchestration tax. It's the gap between what your agents generate and what you'd feel comfortable putting your name on. If finished work is piling up faster than you can get through it, another session won't help until you've fixed that: tighten the checks so less of it needs you, or slow down.

**When you're producing more than you can stand behind, you're no longer reviewing. You're hoping.**

## Quality in, quality out

The human mental model is still involved, but instead of in the middle, it's at the front and end. You're putting your energy into the front-end of the task description and context, as well as the back-end of reviewing the output. This is why good input is so important to the quality of output, and I view good prompting as a critical thinking skill.

Historically, if you made a non-specific request, someone would challenge it, and you might realize, "Oh wait, I actually didn't figure this out." An agent often won't stop you there. It fills in what you left out and hands back something that looks done, even though the idea behind it is still fuzzy. I've written about this as intent debt, the implicit goals, constraints and rationale that may exist in artifacts you didn't write. Unlike other kinds of debt, nobody else can fix this one for you. The intent has to come from you.

**Your prompt is a reflection of your understanding of the problem, and if you can't express it clearly, it may not be clear in your own mind.**

Write your own request brief in your own words before you ask for help. Describe the audience, out-of-scope items, and the definition of done. When your second round of corrections hasn't got you there, stop tweaking and rewrite your prompt.

You can have the agent help you with this too. I like the distinction Andy Clark makes between delegating to an AI system and collaborating with it. In the latter case, you're in a virtuous cycle of mutual amplification: your prompts sharpen your output, sharpen your next prompt and sharpen your mental model of the problem. If it's not clear, ask the agent to interview you about what it doesn't understand. If you close the session having refined your own mental model, that's a sign of success.

Also be careful about the input. It's easy for each agent to just pass the previous agent's summary into its context, and before long the third agent hasn't read the original document.

> 同时也要注意输入。每个代理都很容易只是将上一个代理的摘要传递到其上下文中，不久之后第三个代理甚至没有阅读过原始文档。

You also need your own standards for output. I've played around with AI in lots of different creative mediums, and most of it never gets shown because it doesn't meet my standards. Things are all coming out nicely formatted and confident, so polish is no longer a useful signal.

> 你也需要为输出制定自己的标准。我在许多不同的创意媒介中尝试过AI，但大部分作品最终都未被展示，因为它们不符合我的标准。现在的输出都格式精美且信心十足，因此‘精致’不再是一个有用的信号。

AI may have made it faster to produce, but if I wouldn't feel comfortable attributing the output to myself, I won't output it.

> AI或许让产出变得更快，但如果我自己都不愿将输出归功于自己，那么我就不会输出它。

When something doesn't meet your standards, note why in shared config, a hook or a test so that it doesn't happen again. That's how [taste compounds](https://addyo.substack.com/p/agentic-verification), and noting why something didn't make the cut is good practice on its own.

## "But the models will be better at this than me" / "但模型在这方面会比我更擅长"

If you're as bullish on the future of this space as many people around me are, you've probably had this thought for a couple of sections. In a year or two, the model will be able to detect what I'd be able to detect, so why bother maintaining the skill?

> 如果你像我周围的许多人一样对这个领域的未来感到乐观，你可能早已有这样的想法：一两年后，模型将能够察觉我能察觉的问题，那为何还要维持这项技能呢？

You may be right on a lot of that detection, and I've been arguing for increasingly pushing detection to agents myself. But here's why I think it still matters: at the end of the day, someone is responsible for what ships. Regardless of how much AI helped, [a human has to take responsibility](https://addyo.substack.com/p/code-review-in-the-age-of-ai).

The question of how much to trust an agent for any given task is itself a judgment call. Part of staying calibrated is reviewing the work, because what the models get wrong keeps changing. Anthropic's own research on its engineers and researchers [calls out the trap](https://www.anthropic.com/research/how-ai-is-transforming-work-at-anthropic) as the paradox of supervision: "supervising Claude requires the very coding skills that may atrophy from AI overuse."

These are some of the things that matter most to me and that a better model won't solve: what are you building, why is it worth it, who does it impact and what are you willing to sacrifice? Those are all questions you need to answer. An agent can be helpful in working them through, and I would like it to be, but ultimately they're still yours.

> 以下是我最看重且更好的模型无法解决的问题：你在构建什么、为什么值得构建、它会影响谁，以及你愿意为之牺牲什么？这些都是你需要回答的问题。代理可以在梳理这些问题时提供帮助，我也希望它能做到，但归根结底，这些问题仍然由你来回答。

**You may offload the work and much of the auditing, but not the accountability.**

> 你可以卸下工作和大部分审计任务，但无法卸下责任。

## Practices for the everyday / 日常实践

You don't need to do all this rigorously. Just plug in what works for your workflow.

> 你不需要严格执行所有这些。只需将适合你工作流程的部分插入即可。

Once a week, write a bit of code without an agent, or do one real thing that would suck if you forgot how to do it. (I've [called this a calibration exercise](https://addyosmani.com/blog/cognitive-surrender/), but I don't mean it as a moral one.) Once a month, write down what you've stopped doing and decide which of those you're okay not doing. [One question from an old blog post of mine](https://addyo.substack.com/p/avoiding-skill-atrophy-in-the-age) remains as valid as ever: How lost would you be if AI didn't exist?

If something is above your comprehension, go learn it. If I'm writing and I run into a phrase I haven't seen before, I could Google a one-line explanation and include it. I prefer to do a little research to properly understand it, so I can see where it fits.

> 如果某事超出了你的理解范围，那就去学习它。当我写作时遇到不熟悉的短语，我会在网上搜索一行解释并将其纳入其中。但我更倾向于做一些研究以充分理解它，这样我就能看到它在何处适用。

Checking the machine properly is real work, and pretending otherwise is how teams end up not doing it. It isn't free, so schedule it as a line item and you'll actually get it done.

> 正确检查机器是真正的工作，而假装它不存在则是团队最终无法完成检查的原因。这不是免费的，所以将其列为一个项目并安排时间，你才能真正完成它。

Skills that you stop exercising are going to go away, and probably faster than you might guess. Keep doing the ones you're not willing to let go.

> 你停止练习的技能会逐渐消退，而且可能比你想象的要快得多。 继续坚持你不愿放弃的那些技能。

## What to bring with you / 随身携带什么

Be intentional. An agent can quiz you, interview you and show you its evidence, but only if you set that up. So set it up.

> 保持目标明确。 代理可以对你进行测试、面试并向你展示其证据，但前提是你事先设定好。因此，请设定好。

Be honest about your place on the spectrum. If you can't explain the answer, even with an agent's help, you've surrendered it.

> 如实说明你在能力谱系中的位置。 如果即使在代理的帮助下也无法解释答案，那你就放弃了它。

Have a hypothesis. Formulate one before asking, even if it's bad.

> 提出假设。 在提问前先形成假设，哪怕它很糟糕。

A green check means one thing. What did it check? What did it not check?

> 绿色对勾代表一个含义。 它检查了什么？它没有检查什么？

Look for evidence. Read what it ran and what it returned before reading the summary.

> 寻找证据。 在阅读摘要前，先查看它运行的内容和返回的结果。

Read to know what decisions it made. What did it decide for you?

> 阅读以了解它做出的决策。 它为你做出了什么决策？

Craft your prompt. How you write what you prompt shows how much you understood the problem.

> 精心设计你的提示。 你如何编写提示，体现了你对问题的理解程度。

Set a bar, and stick to it. If you wouldn't put your name on it, it doesn't go out.

> 设定标准，并坚持执行。 如果你不愿意为它署名，就不要发布。

Keep yourself in the game by manually applying the skills that matter. One thing you could do: Before you ask, write down what you think will happen, and after the agent is done, write down one thing it didn't check. Let me know if that changes the way you read the output. Think independently. Ask better questions. Take responsibility for the outcome.

> 通过手动应用重要技能来让自己保持在游戏中。你可以这样做：在提问前，写下你认为会发生的结果；在代理完成后，写下它未检查的一件事。告诉我这会不会改变你对输出结果的理解。 独立思考。提出更好的问题。为结果承担责任。
