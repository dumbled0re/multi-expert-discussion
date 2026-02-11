# Multi-Expert Discussion

A multi-expert discussion system powered by [Claude Code](https://claude.com/claude-code) subagents.

Input any topic, and a panel of AI experts will analyze it from diverse professional perspectives, debate their findings, and deliver unified, actionable conclusions.

## How It Works

```
Topic Input
    |
    v
Facilitator (Opus)
    |
    ├── Expert A (parallel) ──┐
    ├── Expert B (parallel) ──┤
    ├── Expert C (parallel) ──┤ Cross-analysis
    ├── Expert D (parallel) ──┘ & Synthesis
    |
    v
Structured Conclusion
```

1. You provide a topic or challenge
2. The **Facilitator** agent analyzes the topic and selects 3-5 relevant experts from 12 available specialists
3. Expert agents run **in parallel**, each analyzing from their unique perspective
4. The Facilitator performs **cross-analysis**: identifying agreements, resolving conflicts, spotting blind spots
5. A **phased action plan** with prioritized recommendations is delivered

## Available Experts

| Agent | Expertise |
|---|---|
| Tech Lead | Architecture, code quality, DX, technical strategy |
| Agile Coach | Processes, flow efficiency, continuous improvement |
| DevOps Engineer | CI/CD, automation, infrastructure, platforms |
| Engineering Manager | Team management, hiring, organizational design |
| Product Manager | Product strategy, roadmap, user value |
| UX Designer | User experience, design thinking, accessibility |
| QA Engineer | Testing strategy, quality gates, reliability |
| Security Engineer | Security, compliance, risk management |
| Data Analyst | Metrics, analytics, data-driven decisions |
| Business Strategist | Business model, market strategy, growth |
| HR Specialist | Culture, talent development, wellbeing |
| Marketing Specialist | Growth, branding, customer acquisition |

## Setup

### Prerequisites
- [Claude Code CLI](https://claude.com/claude-code) installed

### Installation

```bash
git clone https://github.com/dumbled0re/multi-expert-discussion.git
cd multi-expert-discussion
```

That's it. No dependencies, no build step. The `.claude/agents/` directory contains all agent definitions.

### Usage

Launch Claude Code in this project directory:

```bash
claude
```

Then simply describe your topic:

```
> Our development team is struggling to meet sprint commitments. Help us improve.
```

The facilitator will automatically kick in, select the right experts, and produce a comprehensive analysis.

You can also invoke the facilitator explicitly:

```
> Use the facilitator agent to discuss: How should we approach migrating our monolith to microservices?
```

Or use individual experts directly:

```
> Use the expert-tech-lead agent to review our architecture decisions.
```

## Customization

### Adding New Experts

Create a new markdown file in `.claude/agents/`:

```markdown
# .claude/agents/expert-your-role.md
---
name: expert-your-role
description: "Your Role expert for multi-expert discussions. Analyzes topics from the perspective of ..."
model: sonnet
tools: Read, Grep, Glob
---

You are a **Your Role** participating in a multi-expert discussion panel.
...
```

Then add the new expert to the facilitator's roster in `.claude/agents/facilitator.md`.

## License

MIT
