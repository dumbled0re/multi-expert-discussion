# Multi-Expert Discussion — Orchestration Protocol

This document is the **playbook** the main Claude Code session executes when a user asks for a multi-expert discussion. It is **not** an agent definition — it intentionally lives outside `.claude/agents/` so it is executed by the main session (which has reliable `Agent` access), not by a subagent.

## When to invoke

Trigger this protocol when the user:
- explicitly asks for a "discussion", "議論", "debate", "ideate", "decide", "brainstorm" on a topic with non-trivial trade-offs
- explicitly asks to use `facilitator` or `discuss` (legacy)
- presents a strategic, organizational, or design decision that benefits from multi-lens analysis

Do NOT invoke for: trivial questions, simple lookups, single-expert-only work (use a specific `expert-*` directly).

## Architecture

```
[main session]                      [Task subagents]
     │
     │  Step 0: clarify with user (interactive)
     │  Step 1: write brief.md
     │  Step 2: select panel
     │
     │  Round 1: parallel Agent → ───►  expert-tl  expert-pm  expert-sec  …
     │           validate JSON schema
     │           save rounds/r1-*.md
     │
     │  Round 2: parallel Agent (with redacted Round 1 raw claims) → expert-* …
     │
     │  Round 3: targeted Agent spawn on conflicts                       → expert-* …
     │
     │  Round R: parallel Agent                                    → red-team, auditor
     │
     │  Round 4: parallel Agent                                    → expert-* (ranking)
     │
     │  Synthesis: write 7 output files
     │
     ▼
discussions/<slug>/  (audit trail)
```

Why main session, not a `facilitator` subagent: a subagent that runs the protocol has been observed to **simulate experts inline** instead of spawning real subagents, which silently disables the entire multi-agent system. The main session has stronger `Agent` affordance and can pause for user input on Step 0.

## Step 0 — Clarify with the User (mandatory, interactive)

The main session pauses here and asks the user clarifying questions. Do NOT proceed without answers.

1. Restate the user's topic in your own words.
2. List what is unclear, assumed, or missing.
3. Ask 2–5 focused questions covering: goal, decision criteria, constraints, risk tolerance, reversibility, past attempts, missing stakeholders.
4. Wait for the user.

## Step 1 — Discussion Brief

Write `discussions/<topic-slug>/brief.md` conforming to `schemas/brief.schema.json`. Slug rule: lowercase kebab-case, ≤50 chars, alphanumeric + hyphens.

Validate against the schema before proceeding. If invalid, fix and retry.

## Step 2 — Panel Selection (cognitive diversity)

Pick **3–5 subject experts** plus the function agents.

Required role coverage across subject experts (one expert can wear two hats):
- **Proposer**: generates options
- **Outside View**: structurally different lens from the topic owner
- **Implementation Owner**: someone on the hook to ship

Always added on top:
- `expert-red-team` (activates from Round 2)
- `expert-evidence-auditor` (activates from Round 2)

**Heterogeneous models** — assign per role:
- `expert-red-team` → `opus` (deep adversarial reasoning is high-value)
- `expert-evidence-auditor` → `sonnet` (web-heavy, cost-sensitive)
- subject experts → `sonnet` default; `opus` only for highly technical or values-laden topics; `haiku` only for trivial subtopics

Document selection in `brief.md` under `panel:`, `function_agents:`, and `excluded:`. The `excluded` list is required — what view are we losing?

## Step 3 — Confirm with User

Show the brief and panel back in compact form. Ask: "Anything to adjust before I launch?" Wait for ack (or treat silence as ack after one prompt).

---

## Round 1 — Divergent Generation (parallel)

Activate: subject experts only. Red-team and auditor sit out.

For each subject expert, spawn `Agent({ subagent_type: "expert-X", model: <selected>, prompt: ROUND1_PROMPT })` **in parallel** (single message, multiple tool calls).

`ROUND1_PROMPT` template:

```text
You are participating in a multi-expert discussion as expert-<X> with short_code `<short>`.

## Discussion Constitution
<paste full text of .claude/discussion-constitution.md verbatim>

## Discussion Brief
<paste full content of discussions/<slug>/brief.md>

## Round 1 — Divergent Generation
Produce **at least two materially different claims**. At least ONE must be a "contrarian" claim — a position that pushes against what looks like the user's apparent default. Convergent thinking is the failure mode (Liang et al., EMNLP 2024); divergence is the cure.

Output JSON per the **Round 1 schema in your agent file** — exactly one fenced ```json block, no YAML.

Required per claim: `falsifier`, `failure_mode`, `reversibility`, `blast_radius`, `confidence` as integer 0–100.

**SOURCED enforcement (mandatory)**: across your full Round 1 output, you must include **≥1 evidence entry with `type: SOURCED`**. To produce a SOURCED entry you MUST:
1. Run `WebSearch` (you have it) with **generic descriptors only** — never include proper nouns from the brief (Constitution C11).
2. Use the actual top-result URL in `evidence.url`, the verbatim quoted excerpt in `citation_quote`, and today's date in `search_date`.
3. If after 3 search attempts you cannot verify a source, do **not** fabricate one — produce that claim with `[ANALOGY]` or `[UNVERIFIED]` evidence and note in your output's `top_recommendation` that you tried to source but could not. The orchestrator will accept this. **Fabricating a SOURCED entry is a worse failure than producing zero**.
4. The Evidence Auditor will run `WebSearch` on your `url` + `citation_quote` and flag mismatches. Don't game the contract.

After your claims, add:
- **Top recommendation** — your single calibrated bet from your lens.
- **What I'm not saying** — one important consideration outside your lens.
- **Cross-domain analogy** — invoke at least one analogy from a domain OUTSIDE your professional lens (biology, military strategy, sports, art, history, physics, ecology). Mark it `[ANALOGY]`.

Privacy (Constitution C11): never put user-brief proper nouns into WebSearch.

Return your output. The orchestrator (main session) will save it.
```

After all parallel Agents return:
1. Validate each expert's YAML claims against `schemas/claims.schema.json` `Claim` definition.
2. If invalid, re-spawn (Agent) that expert with explicit fix instructions (cite the schema fields they violated).
3. Save raw text as `discussions/<slug>/rounds/r1-<expert>.md`.
4. Aggregate validated claims into `discussions/<slug>/claims.json`.

## Round 1.5 — Divergence Amplifier (parallel, fast)

Activate: `expert-innovation-catalyst` (always) + optionally 2-3 `expert-idea-scout-haiku` instances for cheap parallel divergence.

Purpose: avoid LLM consensus collapse by deliberately generating useful surprise. The catalyst runs **TRIZ + SCAMPER + assumption inversion + reverse brainstorming + cross-domain analogy** as explicit moves. Output is structured claims (not just brainstorm bullets) so they enter the same audit pipeline as Round 1 claims.

`ROUND1_5_PROMPT` template for catalyst:

```text
You are expert-innovation-catalyst, short_code `inv`. This is Round 1.5 — Divergence Amplifier.

## Discussion Constitution
<paste full>

## Discussion Brief
<paste>

## Round 1 raw claims
<paste claims.json filtered to round_introduced==1>

## Your moves (apply at least 4 of the 6 to generate options)

1. **Assumption Inversion**: take an assumption from `brief.md.open_assumptions` or one implicit in Round 1 claims. Negate it. Re-derive a claim under that inversion.
2. **TRIZ Contradiction**: name a tension where improving X harms Y. Use TRIZ-style separation (in time, in space, by part, by condition) to dissolve the contradiction.
3. **SCAMPER**: take the leading Round 1 claim. Apply Substitute / Combine / Adapt / Modify / Put-to-other-uses / Eliminate / Reverse. Pick the 2 most surprising mutations.
4. **Reverse Brainstorming**: how would you maximize the harm of the leading claim? Use the harm vectors as risk surface for a more robust alternative claim.
5. **Cross-Domain Analogy**: import a structural pattern from a domain outside any panel expert's lens (biology / military / sports / art / history / physics / ecology / economics). Map the structure to this brief.
6. **Dominated-Option Mutation**: any Round 1 claim being dominated? Mutate it once before retiring — sometimes the dominated form has a hidden variant that wins.

## Output

Generate up to **8 claims** in canonical claim JSON. **At least 4 must violate at least one assumption from the brief or a Round 1 claim** while still respecting hard constraints. Do NOT optimize for acceptability. Optimize for useful surprise.

Each claim still needs `falsifier`, `failure_mode`, `reversibility`, `blast_radius`. If a claim is too speculative to falsify, drop it — that's the discipline that turns brainstorm into decision.
```

After Round 1.5: validate, append claims to `claims.json` with `round_introduced: 1.5`, save raw to `rounds/r1_5-innovation-catalyst.md`.

## Round 2 — Cross-Examination (parallel)

Activate: subject experts. Optionally activate red-team early if Round 1 cosine-similar (>80% claim convergence).

**Confidence redaction**: when distributing Round 1 claims to peers, replace each claim's `confidence` field with the string `<redacted-until-round-3>` to avoid anchoring cascades (cognitive-bias literature).

`ROUND2_PROMPT` template:

```text
You are expert-<X>, short_code `<short>`. This is Round 2 — Cross-Examination.

## Discussion Constitution
<paste full>

## Discussion Brief
<paste>

## Round 1 raw claims from all experts (confidence redacted)
<paste claims.json filtered to round_introduced==1 with confidence replaced by "<redacted-until-round-3>">

## Your Round 2 deliverables (Constitution C4 = Steelman first is binding)

1. **Steelman**: pick the strongest claim from another expert. Restate it in their language as well as you can. (1 paragraph.)
2. **Challenge**: identify a specific claim you disagree with. Your challenge must name:
   - the disputed assumption (cite assumption ID),
   - the evidence gap or counter-evidence,
   - the failure mode you predict,
   - and a *better* alternative.
3. **Revise**: update your own claims as `C-<short>-NN → C-<short>-NNb` with a one-line diff explaining what changed and why.
4. **Blind spots**: name one important consideration the panel as a whole has missed.
5. **Cross-pollination**: which other expert's claim, if combined with one of yours, produces something stronger than either alone? Describe the merge.

Anti-conformity mandate: if the panel is converging too fast on a single answer, your job in Round 2 is to construct the strongest counter-argument that's been politely ignored, even if it's not the bet you'd personally make. Productive initial chaos > false consensus.

Return your output. Save will be done by the orchestrator.
```

Run in parallel. Validate. Append revised claims and challenge questions to `claims.json` (claims with `b`, `c` suffixes; questions as `Q-<short>-NN`).

## Round 3 — Conflict Deep Dive (targeted)

Confidence is unredacted from Round 3 onward.

The orchestrator (main session) identifies the **top 2–3 unresolved conflicts** from Round 2's challenge questions. For each conflict, send each side a targeted prompt:

```text
You are expert-<X>. Conflict <N> between C-<a>-NN and C-<b>-NN.

Position A (yours): <quote raw claim>
Position B (opposing): <quote raw claim>

Answer:
1. What is your *strongest* evidence for A? (Cite source if [SOURCED]; auditor will check.)
2. What concrete observation would change your mind?
3. Under what conditions is B correct, and is the user actually in those conditions?
4. The bet: name one observable outcome over a stated horizon that would settle the question. Output as:

```yaml
bet:
  if_true: <observation>
  by_when: <date>
  measurement: <how to verify>
  C-id-this-supports: C-<a>-NN
```
```

If a conflict is values-based (not facts-based), label as `kind: values-conflict` and route to Decision Record's "Open questions for the user" section. Do not force resolve.

## Round R — Red Team & Evidence Audit (parallel)

**Mandatory** unless topic is genuinely trivial.

Spawn in parallel:
- `Agent({ subagent_type: "expert-red-team", model: "opus", prompt: REDTEAM_PROMPT })`
- `Agent({ subagent_type: "expert-evidence-auditor", model: "sonnet", prompt: AUDITOR_PROMPT })`

`REDTEAM_PROMPT` includes the Constitution, brief, current top 3 claims (plus all claims with `blast_radius >= customers` or `reversibility == irreversible`), and the schema from `expert-red-team.md`. Specifically:

```text
[Constitution + brief]

## Top proposals to attack
<top 3 by impact + all irreversible/customers+>

## Mandatory deliverables (Round R):

1. **Strongest case against each top proposal** (per the schema in your agent file)
2. **Pre-mortem** — 3 distinct failure narratives (different root causes, not variants)
3. **Hostile-actor scenario** — if any proposal has blast_radius >= customers
4. **Reverse brainstorming** — for the leading proposal, answer: "How would I deliberately MAXIMIZE the harm of this proposal?" The harm vectors you generate are the risks the proposal must defend against.
5. **The Question No One Asked** — one question that, if answered honestly, could kill or reshape the leading proposal

Output YAML matching the Q-rt-NN schema. Save will be done by orchestrator.
```

`AUDITOR_PROMPT` includes the full claims.json plus instructions per `expert-evidence-auditor.md`.

**Floor rule**: any top-ranked proposal that fails evidence audit (≥1 finding rated `severity: load-bearing` AND `recommendation: drop`/`reframe`) is suspended from ranking until reframed or re-evidenced. Append `audit_findings` to `claims.json`.

## Round 4 — Convergence with Sensitivity (parallel)

Activate subject experts only.

For each subject expert, send the post-Red-Team set of surviving claims and ask for ranking + criteria scores + sensitivity, per the schema in their agent file.

Aggregation formula (write into `decision-matrix.md` with values shown):

```
score(p) = mean_over_experts( borda_points(p) )
         + sum_over_criteria( median_criterion_score(p) × weight / 5 )
         - 2.0 if Floor Rule triggered for p else 0
         - 1.0 if median_expert_confidence(p) < 50 else 0
```

Tie rule: if top two are within 0.5 points, present both as tied and let the user pick.

## Round 5 — Final Objections (only if needed)

Run only if (a) median expert confidence on top proposal < 70, (b) Red Team has `status: open`, or (c) sensitivity flipped top-2 ordering on a plausible assumption. Each expert delivers one strongest remaining objection. Synthesis must address each.

## Adaptive Stopping (concrete thresholds)

After each round, the orchestrator writes a one-line stop/continue note to `meta-metrics.md`. Concrete rules:

- **Stop early after Round 2 if** all of:
  - same proposal ranked #1 by ≥80% of subject experts (need at least 4 to test),
  - zero `[UNVERIFIED]` claims rated `severity: load-bearing`,
  - no expert holds an opposing claim with `confidence ≥ 80` AND a falsifier.
- **Continue if**: any of: rankings still shifting, audit open, Red Team `status: open`, Round 3 produced a `values-conflict`.
- **Escalate to Minority Report if**: by Round 5 a coherent dissent persists (same expert, same claim, ≥2 rounds, with falsifier specified). Do not force agreement.

---

## Synthesis: Final Outputs

Write to `discussions/<topic-slug>/`:

1. `decision-record.md` — headline ADR-style. Required sections: TL;DR (2 sentences), Recommendation, Confidence (panel 0-100, with strongest dissent + Claim ID), Reversibility, Blast Radius, Why (with Claim IDs), Alternatives considered (with rejection reasons + Claim IDs), Assumptions this depends on (Assumption IDs), Kill criteria, Open questions for the user.
2. `claims.json` — full audit log validated against `schemas/claims.schema.json`.
3. `evidence-ledger.md` — every cited fact with auditor verdict.
4. `decision-matrix.md` — Borda + criteria-weighted scores with formula visible + sensitivity analysis + Open Bets from Round 3.
5. `minority-report.md` — verbatim dissent. If genuine consensus, file states so explicitly with one sentence — never silently empty.
6. `action-plan.md` — Now/Soon/Later with Owner, Success metric, Kill criterion per item.
7. `meta-metrics.md` — claims/round, divergence index, position-change rate, evidence inventory, calibration, rounds-run vs budgeted.

Also recommended (P1):
8. `prediction-ledger.md` — every measurable claim from the Decision Record gets `{claim_id, prediction, by_date, measurement_method, status}`. After the by_date passes, the user can re-open the discussion and update calibration.

---

## "Surpass humans" — techniques baked into the prompts

These are NOT optional additions; they are part of the prompts above. Key ones:

| Technique | Where it fires | Why |
|---|---|---|
| Contrarian-first | Round 1 (one mandatory contrarian claim) | Avoids LLM consensus bias |
| Cross-domain analogy | Round 1 (each expert injects ≥1) | Imports outside-domain pattern matching |
| Steelman before strawman | Round 2, every challenge | Constitution C4 |
| Confidence redaction | Round 2 distribution only | Prevents anchoring cascade |
| Reverse brainstorming | Round R (red-team mandatory) | Surfaces hidden harm vectors |
| Premortem at scale | Round R (3+ distinct narratives) | One pre-mortem hides; multiple separate root causes |
| Outside-view base-rates | Round 4 (one expert ranks by reference cases only) | Counters LLM inside-view confidence |
| Falsifiable bet | Round 3 conflicts | Forces verifiable claims, not just opinions |
| Floor rule | Round R (audit) | Stops unverified claims from leading |
| Tie rule (0.5 pt) | Round 4 aggregation | Avoids artificial pick-a-winner when matrix says tied |
| Open questions for user | Synthesis | Hands values-conflicts to the user, not to the panel |
| Prediction ledger | Post-synthesis | Future-proofs calibration |

## Privacy

- Never put user-brief proper nouns (company, project, internal team, customer names) into your or experts' `WebSearch` queries. Use generic descriptors. (Constitution C11.)
- The orchestrator must repeat this rule in every expert prompt.

## Output Language

Match the user's language (Japanese for ja-JP users). YAML/JSON keys, enum values, and Claim IDs stay in English for machine readability.

## Failure handling

- Schema validation fails → re-spawn (Agent) expert with cited fix list (max 1 retry).
- Task returns malformed output → log to `meta-metrics.md` under `task_failures` and substitute a `placeholder` claim with `status: retired, reason: spawn-failed`.
- Subagent refuses → escalate to user, do not silently drop.
- Token budget overrun → switch experts to `haiku` for the round, log to `meta-metrics.md`.

## Branching (advanced, optional)

A user can fork a discussion to explore an alternative brief: `discussions/<slug>/branches/<branch-name>/`. Each branch has its own brief.md and its own audit trail. A `branch-comparison.md` at the root summarizes diffs.
