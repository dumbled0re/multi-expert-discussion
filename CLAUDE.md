# Multi-Expert Discussion

## Overview
A debate-style decision panel built on Claude Code subagents. The panel produces an **auditable Decision Record**, not a tidy consensus. It enforces a written Constitution (truthfulness, falsifiability, calibrated confidence, steelman-first, preserved minority opinions, audit trail) and runs a Red Team / Evidence Audit round against every non-trivial proposal.

## Architecture (v3 — main-orchestrator)

The previous design ran a `facilitator` as a subagent. Empirically, that subagent silently simulated experts inline (the entire multi-agent system was dormant) — verified once and the result is permanent. **The orchestrator now runs in the main Claude Code session**, not a subagent. Subagents are only the experts in `.claude/agents/expert-*.md`, spawned via the `Agent` tool from the main session.

```
Main session (orchestrator)
  ├── reads .claude/discussion-constitution.md
  ├── reads .claude/playbooks/multi-discuss.md (the protocol)
  ├── validates against schemas/{brief,claims}.schema.json
  └── spawns experts in parallel via Agent
      ├── subject experts (Round 1, 2, 3, 4, 5)
      ├── expert-innovation-catalyst (Round 1.5 — TRIZ/SCAMPER/inversion)
      ├── expert-red-team (Round R, opus model)
      └── expert-evidence-auditor (Round R, sonnet)
```

## Usage

**Recommended**: invoke the slash command:
```
/discuss <topic>
```
This loads `.claude/commands/discuss.md` which embeds the hard gate (no inline simulation) and references the playbook.

**Equivalent natural-language trigger**: "discuss <topic>", "議論して: <topic>", "ideate on <topic>", "decide between A and B for <topic>".

For single-lens takes: invoke an `expert-*` directly (`Use the expert-tech-lead agent to ...`).

## Available Agents

### Cognitive function roles
- `expert-red-team` — devil's advocate, failure-mode hunter, hostile-actor scenarios, reverse-brainstorm harm vectors. Activates from Round 2; mandatory at Round R.
- `expert-evidence-auditor` — fact-checks citations, flags `[UNVERIFIED]`, reconciles contradicting evidence, scores expert calibration. Activates from Round 2; mandatory at Round R.
- `expert-innovation-catalyst` — runs Round 1.5. Applies TRIZ contradiction, SCAMPER mutation, assumption inversion, reverse brainstorming, cross-domain analogy, dominated-option mutation. Optimizes for useful surprise.

### Subject experts (12)
- `expert-tech-lead` — architecture, code quality, DX, technical strategy
- `expert-agile-coach` — process, flow efficiency, team dynamics
- `expert-devops` — CI/CD, infrastructure, automation, platform
- `expert-em` — team management, hiring, org design
- `expert-product-manager` — product strategy, roadmap, user value
- `expert-ux-designer` — UX, design thinking, accessibility
- `expert-qa-engineer` — testing strategy, quality gates, reliability
- `expert-security-engineer` — security, compliance, risk
- `expert-data-analyst` — metrics, analytics, evidence-based reasoning
- `expert-business-strategist` — business model, market, growth
- `expert-hr-specialist` — culture, talent, wellbeing
- `expert-marketing-specialist` — growth, brand, communication

### Heterogeneous models
- `expert-red-team` → `opus` (deep adversarial reasoning)
- `expert-evidence-auditor` → `sonnet` (web-heavy)
- subject experts + innovation-catalyst → `sonnet` default; `opus` only for highly technical or values-laden topics.

## Files

- `.claude/discussion-constitution.md` — 11 upper-level principles (no frontmatter; not a Claude Code agent).
- `.claude/playbooks/multi-discuss.md` — the canonical protocol (Step 0 → Synthesis).
- `.claude/commands/discuss.md` — slash command entry point with hard gate.
- `.claude/agents/expert-*.md` — 15 subagent definitions.
- `schemas/claims.schema.json` — JSON Schema for the audit log.
- `schemas/brief.schema.json` — JSON Schema for the discussion brief.
- `discussions/<slug>/` — per-discussion artifacts (auto-generated).

## Output Contract — JSON

Each expert returns **one fenced ```json block** matching the schema in their agent file. The orchestrator validates against `schemas/claims.schema.json`. Schema violations trigger one re-spawn; persistent failures are logged to `meta-metrics.md`.

## Output Structure
All discussions write to `discussions/<topic-slug>/`:
- `brief.md` (Discussion Brief — validated against `schemas/brief.schema.json`)
- `rounds/r1-<expert>.md` `r1_5-innovation-catalyst.md` `r2-<expert>.md` `r3-conflict-<n>.md` `rR-redteam.md` `rR-audit.md` `r4-<expert>.md` `r5-<expert>.md`
- `claims.json` (every claim, every revision, every audit finding — validated against `schemas/claims.schema.json`)
- `evidence-ledger.md` (cited facts, classified `[SOURCED]/[USER-CONTEXT]/[ANALOGY]/[EXPERT-JUDGMENT]/[UNVERIFIED]`)
- `decision-matrix.md` (weighted Borda + sensitivity, formula visible)
- `minority-report.md` (preserved dissent — never silently empty)
- `decision-record.md` (TL;DR + Recommendation + Confidence + Reversibility/Blast-Radius + Why with Claim IDs + Alternatives + Assumptions + Kill criteria + Open questions)
- `action-plan.md` (Now/Soon/Later with Owner, Success metric, Kill criterion)
- `meta-metrics.md` (claims/round, divergence index, position-change rate, calibration)
- (P1) `prediction-ledger.md` — measurable claims + verification dates for post-hoc calibration

Never write outputs to `.claude/` or any other directory.

## Constitution
`.claude/discussion-constitution.md` defines the upper-level rules and overrides any individual round's prompt. The main session pastes its full text into every expert prompt — subagents have isolated context and do NOT auto-load shared files.

## Language
All agents respond in the user's language. Structural keys (Claim IDs, JSON field names, enum values) stay in English for machine readability.

## Compatibility
Discussions written before v3 (`discussions/api-migration-booking-system/`, `ai-cx-improvement*/`, etc.) use the legacy single-`final-report.md` format. They are preserved as-is; new discussions use the new format. There is no automatic migration.
