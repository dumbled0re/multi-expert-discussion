# Multi-Expert Discussion

A debate-style decision panel powered by [Claude Code](https://claude.com/claude-code) subagents.

Give it a topic. A panel of AI experts will generate divergent options, challenge each other under a written Constitution, fact-check claims, run a Red Team round, and produce an **auditable Decision Record** — not a tidy consensus.

## How It Works

```
Topic Input
    |
    v
Facilitator (Opus)  — clarifies brief, picks panel by cognitive diversity
    |
    ├── Round 1: Divergent Generation     (≥2 competing claims per expert)
    ├── Round 2: Cross-Examination        (steelman first, raw Claim IDs)
    ├── Round 3: Conflict Deep Dive       (force a falsifiable bet)
    ├── Round R: Red Team + Evidence Audit
    ├── Round 4: Convergence              (weighted Borda + sensitivity)
    └── Round 5: Final Objections (if needed)
    |
    v
discussions/<topic>/
    decision-record.md   ← the headline (ADR-style)
    claims.json          ← every claim, every revision
    evidence-ledger.md   ← every cited fact, classified
    decision-matrix.md   ← weighted ranking + sensitivity
    minority-report.md   ← preserved dissent
    action-plan.md       ← 30/60/90 with kill criteria
    meta-metrics.md      ← discussion quality metrics
```

The system optimizes for **decision quality and traceability**, not for harmony. A `4-vs-1` split is preserved as a Minority Report, not rounded into a consensus.

### Design Principles (Constitution)

The panel runs under a written Constitution (`.claude/discussion-constitution.md`) that overrides any individual round's instructions:

1. **Truthfulness over persuasion** — every fact is tagged `[SOURCED]` / `[USER-CONTEXT]` / `[ANALOGY]` / `[EXPERT-JUDGMENT]` / `[UNVERIFIED]`. `[UNVERIFIED]` claims cannot be load-bearing.
2. **Falsifiability** — every proposal must answer "what would prove this wrong?".
3. **Calibrated confidence** — claims report 0–100 probability, and miscalibration is surfaced.
4. **Steelman before strawman** — restate the opposing claim in its strongest form before criticizing.
5. **Minority opinions are preserved**, never rounded into consensus.
6. **Reversibility** is annotated and irreversible decisions face Red Team scrutiny.
7. **Cognitive diversity is mandatory** — agreement reached too easily is a defect.
8. **Audit trail** — stable Claim IDs, every revision tracked.
9. **User autonomy** — the system produces a record, not a decision.
10. **Stop when done** — quality over round count.

Drawn from current research: Du et al. (Multiagent Debate, ICML 2024), Liang et al. (Encouraging Divergent Thinking, EMNLP 2024), Yao et al. (Tree of Thoughts), Anthropic (Constitutional AI), Free-MAD anti-conformity prompts (2025), and Minsky's Society of Mind cognitive-function roles.

## Available Agents

### Cognitive function roles (always available, often required)
| Agent | Function |
|---|---|
| Red Team | Devil's advocate, failure-mode hunter, blind-spot finder. Required on every non-trivial panel. |
| Evidence Auditor | Fact-checks citations, flags `[UNVERIFIED]`, surfaces contradicting evidence, scores expert calibration. Required when claims cite external facts. |

### Subject experts (pick by topic relevance)
| Agent | Expertise |
|---|---|
| Tech Lead | Architecture, code quality, DX, technical strategy |
| Agile Coach | Process, flow efficiency, team dynamics |
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

Invoke the discussion via slash command (recommended):

```
/discuss Our development team is struggling to meet sprint commitments. Help us improve.
```

This loads `.claude/commands/discuss.md` which embeds a hard gate: the main session must spawn real expert subagents (no inline simulation). The orchestration runs in the main session, not as a `facilitator` subagent — that pattern was retired in v3 because subagents silently simulated experts inline, voiding the multi-agent design.

You can also use natural-language triggers:

```
> Discuss: How should we approach migrating our monolith to microservices?
> 議論して: チームの心理的安全性を上げるには？
```

Or use individual experts directly:

```
> Use the expert-tech-lead agent to review our architecture decisions.
```

## Customization

### Adding a New Expert

1. Create `.claude/agents/expert-your-role.md` using the structure of an existing expert (e.g. `expert-tech-lead.md`) as a starting template:

   ```markdown
   ---
   name: expert-your-role
   description: "Your Role expert for multi-expert discussions. Analyzes topics from the perspective of ..."
   model: sonnet
   tools: Read, Grep, Glob, WebSearch
   ---

   You are a **Your Role** participating in a multi-expert discussion panel.

   ## Your Perspective
   - <lens 1>
   - <lens 2>

   <copy the full Response Format / Multi-Round Discussion Mode / Evidence Standard / Confidence Calibration / Guidelines sections from any existing expert — they are the canonical contract>
   ```

2. Add a row to the **Short-Code Table** in `.claude/agents/facilitator.md` (e.g. `expert-your-role` → `yr`). Claim IDs will be `C-yr-NN`.

3. Add the agent + lens to the "Subject experts" table in `facilitator.md` and `README.md`.

4. The new agent will only be loaded by Claude Code on next session start (`.claude/agents/` is read at startup).

### What's Shared Across Agents

- `.claude/discussion-constitution.md` — the upper-level rule set, pasted into every expert prompt by the facilitator. Edit it to change the panel's operating principles globally.
- The Response Format / Evidence Standard / Confidence Calibration sections of each expert file are intentionally near-identical so panels behave consistently. When editing one, consider whether the change should apply to all 14 expert files.

## Schema validation

After a discussion completes, validate `claims.json` against the canonical schema:

```bash
node scripts/validate-discussion.mjs discussions/<topic-slug>
```

The validator (zero external deps, pure Node) catches:
- Claim ID format violations (e.g. uppercase, decimal confidence, wrong enum values)
- Missing required fields per claim status (active vs superseded vs retired)
- `SOURCED` evidence missing url / citation_quote / search_date
- Cross-references to unknown claim IDs
- Suspicious specificity in non-SOURCED evidence (heuristic)
- 0 SOURCED evidence across the whole discussion (warning)

Regression guard:

```bash
bash scripts/test-validator.sh
# Asserts that the v2-broken-output fixture still fails.
```

## Compatibility Note

Discussions written before the v1 Constitution (`discussions/api-migration-booking-system/`, `discussions/ai-cx-improvement*/`, etc.) use the legacy single-`final-report.md` format. They are preserved as-is; new discussions use the seven-file audit-trail format described above. There is no automatic migration.

## ⚠️ Important: Restart Claude Code after adding/modifying agents

Claude Code reads `.claude/agents/*.md` **at session startup**. If you:
- add a new expert agent
- rename an existing one
- update an agent's frontmatter (`name`, `description`, `model`, `tools`)

…you must **exit and relaunch `claude`** for the changes to take effect inside the running session. Otherwise the new agents will not be invokable via `Agent` and `/discuss` will fail when it tries to spawn them.

Empirically verified during v3 build: newly created `expert-red-team`, `expert-evidence-auditor`, and `expert-innovation-catalyst` were visible to `claude agents` (a separate process that re-scans) but unavailable to the running session's `Agent` tool. Session restart fixes this.

If you fork this repo or pull updates, restart Claude Code in the project directory before running `/discuss`.

## License

MIT
