---
description: "Run a multi-expert debate-style discussion on a topic. Spawns real expert subagents (no inline simulation), runs divergent generation + cross-examination + red team + audit + weighted Borda convergence, produces an auditable Decision Record."
---

# /discuss — Multi-Expert Discussion

You are running in the **MAIN Claude Code session**. You MUST NOT simulate experts inline. Read this entire file before doing anything.

## Pre-flight: ensure new agents are loaded

Claude Code reads `.claude/agents/*.md` at session start. If you (or a recent commit) added new agents like `expert-red-team`, `expert-evidence-auditor`, or `expert-innovation-catalyst`, those agents will NOT be available via `Agent` until the session is restarted. Run `claude agents` in a separate terminal to compare what's registered on disk vs what the active session has. If they differ, ask the user to restart `claude` before invoking `/discuss`.

## Hard gate (do not skip)

Before producing **any** of `r1-*.md`, `r1_5-*.md`, `r2-*.md`, `claims.json`, `decision-record.md`, or other discussion artifacts:

1. You must spawn **each selected expert** as a real subagent via the `Agent` tool. No inline simulation. If you find yourself drafting "what expert-tech-lead would say" without actually calling `Agent({ subagent_type: "expert-tech-lead", ... })`, STOP — you are violating the protocol.
2. If the `Agent` tool is unavailable in this session, stop immediately and tell the user true multi-agent debate cannot run here. Do not silently fall back to inline simulation.
3. Each expert's output must be the **raw returned output** of the `Agent` call, not your paraphrase. Save it verbatim into `discussions/<slug>/rounds/r<N>-<expert>.md`.
4. Each expert response must be **JSON** (one fenced ```json block) — no YAML, no free prose claims. If the returned output is not valid JSON conforming to `schemas/claims.schema.json`, re-spawn that expert once with the violations cited. If it still fails, log the failure and proceed with the partial set.

## Read first

In this order, before responding to the user:

1. `Read` `.claude/discussion-constitution.md` — you will paste this verbatim into every expert prompt
2. `Read` `.claude/playbooks/multi-discuss.md` — the canonical protocol (Step 0 → Synthesis)
3. `Read` `schemas/claims.schema.json` — the validation contract
4. `Read` `schemas/brief.schema.json` — the brief contract

The playbook is binding. Where this command and the playbook conflict, the playbook wins.

## Process summary (full detail in playbook)

| Step | What you do | Where outputs go |
|---|---|---|
| 0 | Clarify topic with user (interactive — pause and wait) | conversation |
| 1 | Write `brief.md` validated against `schemas/brief.schema.json` | `discussions/<slug>/brief.md` |
| 2 | Pick 3–5 subject experts + `expert-red-team` + `expert-evidence-auditor` + `expert-innovation-catalyst` (for Round 1.5). Document `excluded` list. Heterogeneous models: red-team→opus, auditor→sonnet, subjects→sonnet | `brief.md` |
| 3 | Show brief + panel to user, ask for adjustments, wait | conversation |
| R1 | **Spawn all subject experts in parallel via Agent.** Each must return JSON with ≥2 claims, one contrarian, one cross-domain analogy. | `rounds/r1-<expert>.md`, `claims.json` |
| R1.5 | Spawn `expert-innovation-catalyst` (TRIZ + SCAMPER + inversion + reverse-brainstorm). Optionally spawn 2-3 `expert-idea-scout-haiku` for cheap divergence. | `rounds/r1_5-*.md`, `claims.json` |
| R2 | Spawn subject experts in parallel with **confidence-redacted** R1+R1.5 raw claims. Steelman first; then challenge; then revise own claims. | `rounds/r2-<expert>.md`, `claims.json` |
| R3 | (only if conflicts remain) Targeted spawns to settle 2–3 unresolved disputes via falsifiable bets. | `rounds/r3-conflict-<n>.md` |
| RR | **Mandatory.** Parallel spawn `expert-red-team` (opus) and `expert-evidence-auditor` (sonnet). Floor rule: load-bearing UNVERIFIED claims are suspended from ranking. | `rounds/rR-redteam.md`, `rounds/rR-audit.md`, `claims.json` (audit_findings) |
| R4 | Spawn subject experts for ranking + criteria scores + sensitivity. Aggregate via weighted Borda formula in playbook. Tie rule: within 0.5 pts → present both. | `rounds/r4-<expert>.md`, `decision-matrix.md` |
| R5 | Only if median confidence <70 OR red-team has open objection OR sensitivity flipped top-2. Ask each expert for their single strongest remaining objection. | `rounds/r5-<expert>.md` |
| Synth | Write 7 (or 8) outputs: `decision-record.md` (TL;DR + Recommendation + Confidence + Reversibility/Blast-Radius + Why with Claim IDs + Alternatives + Assumptions + Kill criteria + Open questions); `claims.json` (full audit log); `evidence-ledger.md`; `decision-matrix.md`; `minority-report.md`; `action-plan.md`; `meta-metrics.md`; (P1) `prediction-ledger.md`. | `discussions/<slug>/` |

## Adaptive stopping (concrete)

After each round, decide stop / continue / minority-report. Concrete thresholds in the playbook (do not invent your own).

## Anti-conformity, contrarian-first, cross-domain analogy, premortem-at-scale, reverse brainstorming, outside-view base rates

These are baked into the per-round expert prompts in the playbook. Do not omit them. They are how the system surpasses a vanilla LLM monologue.

## Privacy (Constitution C11)

You and every expert you spawn must NOT put user-brief proper nouns (company, project, customer, internal team names) into `WebSearch` queries. Always re-include this rule in every expert prompt you send.

## Failure handling

- Schema validation failure → re-spawn expert once with cited violations. If still failing, append a `task_failure` entry to `meta-metrics.md` and substitute a `placeholder` claim with `status: retired, reason: spawn-failed`.
- `Agent` tool unavailable → STOP and tell the user. Do not simulate.
- Token budget overrun on a round → switch remaining experts to `haiku` and log to `meta-metrics.md`.

## Final check before delivering

Before reporting "done" to the user:

1. Run a manual schema sanity check on `claims.json`: every claim has `id`, `round_introduced`, `expert`, `status`, `confidence` (integer 0–100), `falsifier`, `failure_mode`, `reversibility`, `blast_radius`. If any miss, fix before delivery.
2. Confirm `decision-record.md` has all required sections from the playbook (TL;DR, Recommendation, Confidence with strongest dissent, Reversibility/Blast Radius, Why with Claim IDs, Alternatives, Assumptions, Kill criteria, Open questions for the user).
3. Confirm `minority-report.md` either contains verbatim dissent or states "genuine consensus reached" — never silently empty.
4. Tell the user which file to read first (`decision-record.md` is the headline; `minority-report.md` is the strongest objection).

The user's topic follows. Do Step 0 (clarify) before anything else.
