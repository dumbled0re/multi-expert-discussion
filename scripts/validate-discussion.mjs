#!/usr/bin/env node
// Validate a discussion's claims.json against the canonical schema.
// Zero external dependencies — runs on Node 18+ standard library.
//
// Usage:
//   node scripts/validate-discussion.mjs discussions/<topic-slug>
//   node scripts/validate-discussion.mjs discussions/<topic-slug> --strict
//
// --strict mode: any UNVERIFIED-load-bearing or audit-recommended-drop claim
// causes a non-zero exit, suitable for CI gating.

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SHORT_CODES = ['tl', 'ac', 'do', 'em', 'pm', 'ux', 'qa', 'sec', 'da', 'biz', 'hr', 'mk', 'rt', 'au', 'inv'];
const REVERSIBILITY = ['reversible', 'hard-to-reverse', 'irreversible'];
const BLAST_RADIUS = ['team', 'product', 'company', 'customers', 'market', 'society'];
const IMPACT_COST = ['H', 'M', 'L'];
const HORIZON = ['now', '1m', '3m', '6m+'];
const EVIDENCE_TYPES = ['SOURCED', 'USER-CONTEXT', 'ANALOGY', 'EXPERT-JUDGMENT', 'UNVERIFIED'];
const CLAIM_STATUS = ['active', 'retired', 'superseded'];
const CLAIM_ID_RE = new RegExp(`^C-(${SHORT_CODES.join('|')})-[0-9]{2}[a-z]?$`);
const QUESTION_ID_RE = new RegExp(`^Q-(${SHORT_CODES.join('|')})-[0-9]{2}$`);

const REQUIRED_TOMBSTONE_FIELDS = ['id', 'round_introduced', 'expert', 'status', 'claim'];
const REQUIRED_ACTIVE_CLAIM_FIELDS = [
  'id', 'round_introduced', 'expert', 'status', 'claim',
  'rationale', 'assumptions', 'evidence',
  'confidence', 'falsifier', 'failure_mode',
  'reversibility', 'blast_radius', 'impact', 'cost', 'horizon',
];

const errors = [];
const warnings = [];
const info = [];

function err(path, msg) { errors.push(`[ERROR] ${path}: ${msg}`); }
function warn(path, msg) { warnings.push(`[WARN]  ${path}: ${msg}`); }
function inf(msg) { info.push(`[INFO]  ${msg}`); }

function validateClaim(c, idx) {
  const path = `claims[${idx}] (id=${c.id ?? '<missing>'})`;

  const requiredFields = (c.status === 'superseded' || c.status === 'retired')
    ? REQUIRED_TOMBSTONE_FIELDS
    : REQUIRED_ACTIVE_CLAIM_FIELDS;
  if (c.status === 'superseded' && !c.superseded_by) {
    err(path, 'status=superseded requires superseded_by');
  }

  for (const f of requiredFields) {
    if (c[f] === undefined || c[f] === null) err(path, `missing required field "${f}"`);
  }

  if (c.id && !CLAIM_ID_RE.test(c.id)) {
    err(path, `id "${c.id}" violates regex C-<short>-NN[a-z]? (lowercase, 2-digit zero-padded)`);
  }

  if (typeof c.confidence !== 'number' || !Number.isInteger(c.confidence) || c.confidence < 0 || c.confidence > 100) {
    err(path, `confidence must be integer 0-100, got ${typeof c.confidence}: ${JSON.stringify(c.confidence)}`);
  }

  if (c.status && !CLAIM_STATUS.includes(c.status)) {
    err(path, `status "${c.status}" not in ${JSON.stringify(CLAIM_STATUS)}`);
  }

  if (c.reversibility && !REVERSIBILITY.includes(c.reversibility)) {
    err(path, `reversibility "${c.reversibility}" not in ${JSON.stringify(REVERSIBILITY)}`);
  }

  if (c.blast_radius && !BLAST_RADIUS.includes(c.blast_radius)) {
    err(path, `blast_radius "${c.blast_radius}" not in ${JSON.stringify(BLAST_RADIUS)}`);
  }

  if (c.impact && !IMPACT_COST.includes(c.impact)) err(path, `impact "${c.impact}" not in H|M|L`);
  if (c.cost && !IMPACT_COST.includes(c.cost)) err(path, `cost "${c.cost}" not in H|M|L`);
  if (c.horizon && !HORIZON.includes(c.horizon)) err(path, `horizon "${c.horizon}" not in ${JSON.stringify(HORIZON)}`);

  if (Array.isArray(c.evidence)) {
    c.evidence.forEach((e, ei) => {
      const ePath = `${path}.evidence[${ei}]`;
      if (!e.type) { err(ePath, 'missing type'); return; }
      if (!EVIDENCE_TYPES.includes(e.type)) {
        err(ePath, `type "${e.type}" not in ${JSON.stringify(EVIDENCE_TYPES)}`);
      }
      if (e.type === 'SOURCED') {
        if (!e.url) err(ePath, 'SOURCED requires non-null url');
        if (!e.citation_quote) err(ePath, 'SOURCED requires non-null citation_quote');
        if (!e.search_date) err(ePath, 'SOURCED requires non-null search_date');
      }
      // Heuristic: suspicious specificity in EXPERT-JUDGMENT or UNVERIFIED
      if (e.content && /\b\d+(\.\d+)?%/.test(e.content) && !['SOURCED', 'USER-CONTEXT'].includes(e.type)) {
        warn(ePath, `non-SOURCED evidence with percentage may be hallucinated specificity: "${e.content.slice(0, 80)}…"`);
      }
    });
  } else if (c.status === 'active' && !c.evidence) {
    err(path, 'active claim missing evidence array');
  }

  if (c.supersedes && !CLAIM_ID_RE.test(c.supersedes)) {
    err(path, `supersedes "${c.supersedes}" violates Claim ID regex`);
  }
  if (c.superseded_by && !CLAIM_ID_RE.test(c.superseded_by)) {
    err(path, `superseded_by "${c.superseded_by}" violates Claim ID regex`);
  }
}

function validateQuestion(q, idx) {
  const path = `questions[${idx}] (id=${q.id ?? '<missing>'})`;
  const required = ['id', 'round_introduced', 'raised_by', 'kind', 'status', 'content'];
  for (const f of required) {
    if (q[f] === undefined || q[f] === null) err(path, `missing required field "${f}"`);
  }
  if (q.id && !/^Q-[a-z]{2,4}-[0-9]{2}$/.test(q.id) && q.id !== 'Q-rt-99') {
    err(path, `id "${q.id}" violates regex Q-<short>-NN`);
  }
}

function validateAuditFinding(a, idx) {
  const path = `audit_findings[${idx}] (id=${a.id ?? '<missing>'})`;
  const required = ['id', 'target_claim_id', 'verdict', 'severity', 'recommendation'];
  for (const f of required) {
    if (a[f] === undefined || a[f] === null) err(path, `missing required field "${f}"`);
  }
  const verdicts = ['confirmed', 'confirmed-with-nuance', 'unverified', 'contradicting'];
  const severities = ['load-bearing', 'supporting', 'decorative'];
  const recommendations = ['keep', 'drop', 'reframe', 'mark-UNVERIFIED-and-keep-non-load-bearing', 'none'];
  if (a.verdict && !verdicts.includes(a.verdict)) err(path, `verdict "${a.verdict}" not in ${JSON.stringify(verdicts)}`);
  if (a.severity && !severities.includes(a.severity)) err(path, `severity "${a.severity}" not in ${JSON.stringify(severities)}`);
  if (a.recommendation && !recommendations.includes(a.recommendation)) err(path, `recommendation "${a.recommendation}" not in ${JSON.stringify(recommendations)}`);
}

function main() {
  const args = process.argv.slice(2);
  const strict = args.includes('--strict');
  const dir = args.find((a) => !a.startsWith('--'));
  if (!dir) {
    console.error('Usage: node scripts/validate-discussion.mjs <discussion-dir> [--strict]');
    process.exit(2);
  }

  const claimsPath = join(dir, 'claims.json');
  if (!existsSync(claimsPath)) {
    console.error(`✗ ${claimsPath} not found`);
    process.exit(2);
  }

  let data;
  try {
    data = JSON.parse(readFileSync(claimsPath, 'utf8'));
  } catch (e) {
    console.error(`✗ ${claimsPath} is not valid JSON: ${e.message}`);
    process.exit(2);
  }

  // Top-level
  if (!data.topic_slug) err('root', 'missing topic_slug');
  if (!data.constitution_version) err('root', 'missing constitution_version');
  if (!Array.isArray(data.rounds_run)) err('root', 'rounds_run must be array');
  if (!Array.isArray(data.claims)) err('root', 'claims must be array');
  else data.claims.forEach(validateClaim);

  if (Array.isArray(data.questions)) data.questions.forEach(validateQuestion);
  if (Array.isArray(data.audit_findings)) data.audit_findings.forEach(validateAuditFinding);

  // Cross-checks
  if (Array.isArray(data.claims)) {
    const ids = new Set(data.claims.map((c) => c.id));
    data.claims.forEach((c, i) => {
      if (c.supersedes && !ids.has(c.supersedes)) {
        warn(`claims[${i}]`, `supersedes "${c.supersedes}" references unknown claim`);
      }
    });

    // Evidence inventory
    const evCounts = { SOURCED: 0, 'USER-CONTEXT': 0, ANALOGY: 0, 'EXPERT-JUDGMENT': 0, UNVERIFIED: 0 };
    data.claims.forEach((c) => {
      (c.evidence ?? []).forEach((e) => {
        if (evCounts[e.type] !== undefined) evCounts[e.type]++;
      });
    });
    inf(`Evidence inventory: ${JSON.stringify(evCounts)}`);

    if (evCounts.SOURCED === 0) {
      warn('root', `0 SOURCED evidence across all claims — discussion relies entirely on user-context, expert judgment, and analogies. Consider re-running with WebSearch enforcement.`);
    }

    // Status distribution
    const statusCounts = {};
    data.claims.forEach((c) => { statusCounts[c.status] = (statusCounts[c.status] ?? 0) + 1; });
    inf(`Claim status: ${JSON.stringify(statusCounts)}`);

    // Active claims with load-bearing UNVERIFIED audit
    if (Array.isArray(data.audit_findings)) {
      data.audit_findings.forEach((a) => {
        if (a.severity === 'load-bearing' && a.verdict === 'unverified') {
          const target = data.claims.find((c) => c.id === a.target_claim_id);
          if (target && target.status === 'active') {
            warn('audit', `Floor rule near-trigger: active claim ${a.target_claim_id} has load-bearing UNVERIFIED audit (recommendation=${a.recommendation})`);
          }
        }
      });
    }
  }

  // Report
  const N = (errors.length === 0 && warnings.length === 0) ? 0 : (errors.length > 0 ? 1 : 0);
  for (const m of info) console.log(m);
  for (const m of warnings) console.warn(m);
  for (const m of errors) console.error(m);

  console.log('---');
  console.log(`Errors: ${errors.length}, Warnings: ${warnings.length}`);
  if (errors.length > 0) {
    console.error('✗ Validation FAILED');
    process.exit(1);
  }
  if (strict && warnings.length > 0) {
    console.error('✗ Validation passed but warnings present (strict mode)');
    process.exit(1);
  }
  console.log('✓ Validation passed');
  process.exit(0);
}

main();
