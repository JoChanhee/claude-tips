# The spectrum of agentic coding: From vibe coding to high-quality software engineering

After spending over a billion tokens on AI-assisted coding over the past two and a half years - ever since I created my first agentic coding tool [Kaguya](https://github.com/ykdojo/kaguya) - I've come to a realization: vibe coding and traditional software engineering are not opposites. You can enhance vibe coding by injecting your software engineering knowledge and traditional software engineering practices. With that, vibe coding becomes *agentic coding with discipline*, *agentic software engineering*, and eventually, just high-quality software engineering. In other words, vibe coding is a spectrum.

![Spectrum of agentic coding](https://raw.githubusercontent.com/ykdojo/claude-code-tips/main/content/spectrum-chart.png)

## Four levels of agentic/vibe coding

![50 shades of agentic coding](https://raw.githubusercontent.com/ykdojo/claude-code-tips/main/content/50-shades-of-agentic-coding.jpeg)

### Level 1: Vibe coding

At its shallowest, vibe coding means you forget the code even exists. You just let AI go wild and let it write, write, write. Error logs? Don't even read them - just throw them at the AI. Let AI handle everything.

Version control? What's that? Security? Yeah, I lock my door at night.

This level is perfectly fine for one-off projects, quick prototypes, throwaway scripts. But don't expect it to be maintainable in the long term.

### Level 2: Agentic coding with discipline

At this level, you start introducing some structure:

- **Version control**: You're using Git and GitHub or similar
- **File-level understanding**: You know roughly what each file does and how they interact with each other
- **Basic security precautions**
- **Testing**: You make sure your app actually works in most cases

### Level 3: Agentic software engineering

This is where it starts becoming production-ready.

- **Tests**: AI-written or human-written, but you verify they're actually testing what they're supposed to test. You don't always read every line, but you make sure they look good.
- **Pre-commit hooks**: These solve a lot of what I sometimes see people use Claude Code hooks for - formatting issues, linting, simple checks.
- **CI jobs**: For continuous testing
- **Function-level understanding**: You know what each class and function does. You might not read every line, but you have deeper understanding than just file-level.
- **Quality control measures**: Careful manual testing, end-to-end tests, one-shot AI code reviews, regression checks

### Level 4: High-quality software engineering

Even though this is still AI-assisted coding, the quality is indistinguishable from handwritten code by, say, a staff engineer - ideally done faster.

- **Line-by-line understanding**: When sending a PR, you might send it as a draft first and ensure each line is correct and makes sense
- **Self-reflection loops**: By asking questions like "Are you sure about this? What about these different approaches?" you're able to get the model to reflect on itself to catch its own mistakes and have big picture trade-off discussions.
- **AI-powered interactive code reviews**: Not just one-shot AI reviews. You pull changes locally and first make sure they run. Then you interview AI about each file, function, class, and even individual lines - dig as deep as you need to.
- **Advanced research methods**: For architectural decisions:
  - Postgres vs. Cassandra?
  - AWS vs. Google Cloud vs. Render?
  - The best way to run a local transcription model on Mac?

  You use tools like deep research or Claude Code with web search and [Reddit fetch](https://github.com/ykdojo/claude-code-tips?tab=readme-ov-file#tip-11-use-gemini-cli-as-a-fallback-for-blocked-sites) to do the research, but also check the sources if necessary.
- **AI-powered quality control**: In addition to everything we've discussed so far, you may also have things like [background Claude Code jobs testing your CLI](https://github.com/ykdojo/claude-code-tips?tab=readme-ov-file#tip-9-complete-the-write-test-cycle-for-autonomous-tasks) if you're creating a CLI, or [AI with browser access testing your UI](https://github.com/ykdojo/claude-code-tips?tab=readme-ov-file#creative-testing-strategies) if you're working on a web app. In addition, you might have things like multi-platform testing (Windows, Linux, Mac), security and performance checks, and so on.
- **Accelerated learning**: Instead of just letting AI write code, you ask questions like "Why did you write it this way?" or "What does this particular line mean?" Essentially, you use AI to deepen your domain expertise instead of letting it handle everything.

## The agentic coding matrix

To summarize, I created this simple matrix as a shorthand for these four levels:

| Level | Code Quality | Speed | Testing | Code Reviews |
|-------|--------------|-------|---------|--------------|
| **Vibe Coding** | Low | Lightning | Bare minimum | None |
| **Agentic Coding with Discipline** | Okay | Faster | Sufficient | Brief |
| **Agentic Software Engineering** | Medium | Fast | Thorough | One-shot |
| **High-Quality Software Engineering** | High | Decent | Rock solid | Interactive |

## Be flexible

At the end of the day, you should master all four levels and be flexible about which one you use.

Sometimes staying at the vibe coding level is fine - quick prototypes, one-off scripts, experiments. Sometimes you need high-quality software engineering - medical software, large-scale systems, other mission-critical software.

The first iteration of your code might be "slop" - low-quality AI-generated code. That's okay. You can improve it over time before you send your PR or mark your draft PR as ready.

## The real problem with "slop"

![Midwit meme about AI-assisted coding](https://raw.githubusercontent.com/ykdojo/claude-code-tips/main/content/midwit-meme.png)

People complain about AI-generated code being slop. But the thing is, it's only slop because they don't put enough work into it.

More tokens spent doesn't necessarily have to mean you produce more s**t. Depending on how you use AI, it could also mean higher quality of code, better research, and better understanding of your own work.
