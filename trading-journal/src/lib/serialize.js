// Export / import for the journal document.
//
// Two formats:
//   * JSON  — the reliable, byte-exact path.
//   * Markdown — a clean, heading-per-field representation that ALSO round-trips
//     (export -> import -> identical data) for the data this app emits.
//
// The markdown format is driven by field-spec tables so the serializer and the
// parser can never drift out of sync.

import { emptyDoc, DOC_VERSION } from './storage.js';
import { newDailyPage, newTradeTicket, newConfluence } from './schema.js';

// ---------------------------------------------------------------------------
// JSON
// ---------------------------------------------------------------------------

export function exportJSON(doc) {
  return JSON.stringify(doc, null, 2);
}

export function importJSON(text) {
  const parsed = JSON.parse(text);
  const base = emptyDoc();
  return {
    version: parsed.version || DOC_VERSION,
    tickets: Array.isArray(parsed.tickets) ? parsed.tickets : base.tickets,
    dailies: Array.isArray(parsed.dailies) ? parsed.dailies : base.dailies,
    principles: Array.isArray(parsed.principles)
      ? parsed.principles
      : base.principles,
  };
}

// ---------------------------------------------------------------------------
// Field specifications (dotted key -> label / kind)
// kind: 'inline' (single line) | 'block' (multi-line textarea)
// ---------------------------------------------------------------------------

const DAILY_FIELDS = [
  ['id', 'ID', 'inline'],
  ['date', 'Date', 'inline'],
  ['createdAt', 'Created At', 'inline'],
  ['liquidityMacro', 'Liquidity / Macro Read', 'block'],
  ['forwardPicture', 'Forward Picture (18-24mo)', 'block'],
  ['state.physical', 'Physical State', 'inline'],
  ['state.emotional', 'Emotional State', 'inline'],
  ['state.edgeOrPnl', 'Edge or P&L?', 'inline'],
  ['riskMap.netExposure', 'Net Exposure', 'inline'],
  ['riskMap.correlationClusters', 'Correlation Clusters', 'block'],
  ['oneWayBetRadar', 'One-Way-Bet Radar', 'block'],
  ['reflection', 'End-of-Day Reflection', 'block'],
];

const TRADE_FIELDS = [
  ['id', 'ID', 'inline'],
  ['status', 'Status', 'inline'],
  ['openedDate', 'Opened', 'inline'],
  ['closedDate', 'Closed', 'inline'],
  ['createdAt', 'Created At', 'inline'],
  ['instrumentStructure', 'Instrument & Structure', 'inline'],
  ['whyThisStructure', 'Why This Structure', 'block'],
  ['thesis', 'Thesis', 'block'],
  ['forwardPicture', "Forward Picture / What's Mispriced", 'block'],
  ['regimeTag', 'Regime Tag', 'inline'],
  ['invalidation', 'Pre-Registered Invalidation', 'block'],
  ['reversalCondition', 'Reversal Condition', 'block'],
  ['preMortem', 'Pre-Mortem', 'block'],
  ['conviction', 'Conviction', 'inline'],
  ['kellyFraction', 'Kelly Fraction', 'inline'],
  ['maxLossVsTargetRatio', 'Max-Loss vs Target Ratio', 'inline'],
  ['plannedTargetR', 'Planned Target R', 'inline'],
  ['pilotOrScaled', 'Pilot or Scaled', 'inline'],
  ['scaleTrigger', 'Scale Trigger', 'block'],
  ['stateAtEntry', 'State at Entry', 'inline'],
  ['ideaSource', 'Idea Source', 'inline'],
  ['hypothesisEngine', 'Hypothesis Engine', 'inline'],
  // exit / audit
  ['exitReason', 'Exit Reason', 'block'],
  ['realizedR', 'Realized R', 'inline'],
  ['processGrade', 'Process Grade', 'inline'],
  ['gradeCommitted', 'Grade Committed', 'inline'],
  ['mistakeTag', 'Mistake Tag', 'inline'],
  ['rightWrong', 'Right/Wrong', 'inline'],
  ['lesson', 'Lesson', 'block'],
  ['pnl', 'P&L', 'inline'],
];

const HEADING_RE = /^#{1,6}\s/;

// ---- dotted path helpers ---------------------------------------------------

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function setPath(obj, path, value) {
  const keys = path.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (cur[keys[i]] == null || typeof cur[keys[i]] !== 'object') {
      cur[keys[i]] = {};
    }
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}

// Preserve non-string types (booleans stored as inline) on the way back.
function coerce(raw, template) {
  if (typeof template === 'boolean') return raw === 'true';
  return raw;
}

// ---- serialize a single record ---------------------------------------------

function serializeFields(record, fields) {
  const out = [];
  for (const [key, label, kind] of fields) {
    const val = getPath(record, key);
    const str = val == null ? '' : String(val);
    if (kind === 'inline') {
      out.push(`- **${label}:** ${str}`);
    } else {
      out.push(`#### ${label}`);
      out.push(str);
    }
  }
  return out.join('\n');
}

function serializeConfluence(c) {
  const cc = c || newConfluence();
  const box = (b) => (b ? '[x]' : '[ ]');
  return [
    '#### Confluence',
    `- **Fundamental:** ${box(cc.fundamental.checked)} ${cc.fundamental.note}`,
    `- **Tape:** ${box(cc.tape.checked)} ${cc.tape.note}`,
    `- **Structure/Vol:** ${box(cc.structureVol.checked)} ${cc.structureVol.note}`,
    `- **Divergence:** ${cc.divergenceNote}`,
  ].join('\n');
}

function serializeWatchlist(items) {
  const lines = ['#### Watchlist'];
  for (const it of items || []) {
    // The `[id]` token preserves the item id so the list round-trips exactly.
    lines.push(`- [${it.id}] ${it.symbol} :: ${it.trigger}`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Markdown export
// ---------------------------------------------------------------------------

export function exportMarkdown(doc) {
  const parts = [];
  parts.push('# rittenryl // decision journal');
  parts.push(`<!-- rittenryl:doc version=${doc.version || DOC_VERSION} -->`);
  parts.push('');

  parts.push('## Daily Pages');
  parts.push('');
  for (const d of doc.dailies || []) {
    parts.push(`### Daily — ${d.date}`);
    parts.push(serializeFields(d, DAILY_FIELDS));
    parts.push(serializeWatchlist(d.watchlist));
    parts.push('');
  }

  parts.push('## Trade Tickets');
  parts.push('');
  for (const t of doc.tickets || []) {
    parts.push(`### Trade — ${t.instrumentStructure || t.id}`);
    parts.push(serializeFields(t, TRADE_FIELDS));
    parts.push(serializeConfluence(t.confluence));
    parts.push('');
  }

  parts.push('## Standing Principles Ledger');
  parts.push('');
  for (const p of doc.principles || []) {
    parts.push(`### Principle`);
    parts.push(`- **ID:** ${p.id}`);
    parts.push(`- **Principle:** ${p.principle}`);
    parts.push(`- **Taught By:** ${p.taughtBy}`);
    parts.push(`- **Date:** ${p.date}`);
    parts.push('');
  }

  return parts.join('\n').replace(/\n+$/, '\n');
}

// ---------------------------------------------------------------------------
// Markdown import
// ---------------------------------------------------------------------------

// Split the document into records. Returns { section, headingLine, bodyLines }.
function splitRecords(text) {
  const lines = text.split('\n');
  let section = null;
  const records = [];
  let current = null;

  for (const line of lines) {
    if (line.startsWith('## ')) {
      // flush
      if (current) records.push(current);
      current = null;
      const title = line.slice(3).trim();
      if (title.startsWith('Daily')) section = 'daily';
      else if (title.startsWith('Trade')) section = 'trade';
      else if (title.startsWith('Standing Principles')) section = 'principle';
      else section = null;
      continue;
    }
    if (line.startsWith('### ')) {
      if (current) records.push(current);
      current = { section, headingLine: line, bodyLines: [] };
      continue;
    }
    if (current) current.bodyLines.push(line);
  }
  if (current) records.push(current);
  return records;
}

const INLINE_RE = /^- \*\*(.+?):\*\* ?(.*)$/;

// Parse a record's body lines into a flat map of { label: value } for inline
// fields and { label: text } for block fields, plus raw watchlist/confluence.
function parseBody(bodyLines) {
  const inline = {};
  const blocks = {};
  const rawLists = {}; // label -> array of list lines (for watchlist/confluence)
  let i = 0;

  while (i < bodyLines.length) {
    const line = bodyLines[i];

    if (line.startsWith('#### ')) {
      const label = line.slice(5).trim();
      // Special list-style blocks are captured raw.
      if (label === 'Watchlist' || label === 'Confluence') {
        const listLines = [];
        i++;
        while (i < bodyLines.length && !bodyLines[i].startsWith('#### ')) {
          if (bodyLines[i].startsWith('- ')) listLines.push(bodyLines[i]);
          i++;
        }
        rawLists[label] = listLines;
        continue;
      }
      // Generic block: capture until the next heading OR the next inline
      // `- **Label:**` field. (A block's own body never contains a bold-key
      // list item, so INLINE_RE is a safe terminator.)
      const content = [];
      i++;
      while (
        i < bodyLines.length &&
        !HEADING_RE.test(bodyLines[i]) &&
        !INLINE_RE.test(bodyLines[i])
      ) {
        content.push(bodyLines[i]);
        i++;
      }
      blocks[label] = content.join('\n').replace(/^\n+/, '').replace(/\n+$/, '');
      continue;
    }

    const m = line.match(INLINE_RE);
    if (m) {
      inline[m[1]] = m[2];
    }
    i++;
  }
  return { inline, blocks, rawLists };
}

function labelMap(fields) {
  const m = {};
  for (const [key, label, kind] of fields) m[label] = { key, kind };
  return m;
}

function hydrateRecord(parsed, fields, template) {
  const record = template;
  const map = labelMap(fields);
  const seen = { ...parsed.inline, ...parsed.blocks };
  for (const [label, value] of Object.entries(seen)) {
    const spec = map[label];
    if (!spec) continue;
    const tmplVal = getPath(template, spec.key);
    setPath(record, spec.key, coerce(value, tmplVal));
  }
  return record;
}

function parseConfluence(listLines) {
  const c = newConfluence();
  for (const line of listLines || []) {
    const m = line.match(INLINE_RE);
    if (!m) continue;
    const label = m[1];
    const rest = m[2];
    if (label === 'Divergence') {
      c.divergenceNote = rest;
      continue;
    }
    const cm = rest.match(/^\[(x| )\] ?(.*)$/);
    const checked = cm ? cm[1] === 'x' : false;
    const note = cm ? cm[2] : rest;
    if (label === 'Fundamental') c.fundamental = { checked, note };
    else if (label === 'Tape') c.tape = { checked, note };
    else if (label === 'Structure/Vol') c.structureVol = { checked, note };
  }
  return c;
}

function parseWatchlist(listLines) {
  const items = [];
  for (const line of listLines || []) {
    let body = line.replace(/^- /, '');
    let id = `wl_${items.length}`;
    const idm = body.match(/^\[([^\]]*)\]\s(.*)$/);
    if (idm) {
      id = idm[1];
      body = idm[2];
    }
    const idx = body.indexOf(' :: ');
    const symbol = idx >= 0 ? body.slice(0, idx) : body;
    const trigger = idx >= 0 ? body.slice(idx + 4) : '';
    items.push({ id, symbol, trigger });
  }
  return items;
}

export function importMarkdown(text) {
  const doc = emptyDoc();
  const records = splitRecords(text);

  for (const rec of records) {
    const parsed = parseBody(rec.bodyLines);
    if (rec.section === 'daily') {
      const daily = newDailyPage();
      hydrateRecord(parsed, DAILY_FIELDS, daily);
      daily.watchlist = parseWatchlist(parsed.rawLists.Watchlist);
      doc.dailies.push(daily);
    } else if (rec.section === 'trade') {
      const trade = newTradeTicket();
      hydrateRecord(parsed, TRADE_FIELDS, trade);
      trade.confluence = parseConfluence(parsed.rawLists.Confluence);
      doc.tickets.push(trade);
    } else if (rec.section === 'principle') {
      doc.principles.push({
        id: parsed.inline.ID || '',
        principle: parsed.inline.Principle || '',
        taughtBy: parsed.inline['Taught By'] || '',
        date: parsed.inline.Date || '',
      });
    }
  }
  return doc;
}
