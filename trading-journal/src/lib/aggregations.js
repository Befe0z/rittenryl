// Pure aggregation functions that turn the raw ticket list into chart-ready
// data. Kept free of React so they can be unit-tested directly.

import { LOW_GRADES, PROCESS_GRADES } from './schema.js';

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

export function closedTickets(tickets) {
  return (tickets || []).filter(
    (t) => t.status === 'CLOSED' && t.gradeCommitted
  );
}

// Is a P&L a "win"? Treat >0 as win.
export function isWin(ticket) {
  const p = num(ticket.pnl);
  return p != null && p > 0;
}

export function isLowGrade(grade) {
  return LOW_GRADES.includes(grade);
}

// --- Mistake-tag frequency over time ---------------------------------------
// Returns [{ period, [tag]: count, ... }] grouped by YYYY-MM.
export function mistakeTagOverTime(tickets) {
  const byPeriod = {};
  const tags = new Set();
  for (const t of closedTickets(tickets)) {
    const tag = (t.mistakeTag || '').trim();
    if (!tag) continue;
    const period = (t.closedDate || t.openedDate || '').slice(0, 7) || 'unknown';
    byPeriod[period] = byPeriod[period] || { period };
    byPeriod[period][tag] = (byPeriod[period][tag] || 0) + 1;
    tags.add(tag);
  }
  const rows = Object.values(byPeriod).sort((a, b) =>
    a.period < b.period ? -1 : 1
  );
  return { rows, tags: [...tags] };
}

// --- Process-grade distribution --------------------------------------------
export function gradeDistribution(tickets) {
  const counts = Object.fromEntries(PROCESS_GRADES.map((g) => [g, 0]));
  for (const t of closedTickets(tickets)) {
    if (counts[t.processGrade] != null) counts[t.processGrade] += 1;
  }
  return PROCESS_GRADES.map((g) => ({ grade: g, count: counts[g] }));
}

// --- Grade x outcome cross-tab + dangerous-quadrant flag -------------------
// The dangerous quadrant: a WIN produced by a LOW-grade (D/E/F) process — you
// got paid for a bad decision, which reinforces the wrong behavior.
export function gradeOutcomeCrossTab(tickets) {
  const rows = PROCESS_GRADES.map((g) => ({
    grade: g,
    wins: 0,
    losses: 0,
    dangerous: false,
  }));
  const byGrade = Object.fromEntries(rows.map((r) => [r.grade, r]));
  for (const t of closedTickets(tickets)) {
    const row = byGrade[t.processGrade];
    if (!row) continue;
    if (isWin(t)) row.wins += 1;
    else row.losses += 1;
  }
  for (const r of rows) {
    if (isLowGrade(r.grade) && r.wins > 0) r.dangerous = true;
  }
  return rows;
}

// Returns the list of tickets sitting in the dangerous quadrant.
export function dangerousQuadrantTickets(tickets) {
  return closedTickets(tickets).filter(
    (t) => isLowGrade(t.processGrade) && isWin(t)
  );
}

export function hasDangerousQuadrant(tickets) {
  return dangerousQuadrantTickets(tickets).length > 0;
}

// --- Idea-source / hypothesis-engine breakdowns ----------------------------
// Generic grouping over a dimension key, returning avg grade points, avg R,
// and count. Grade points: A=4 ... F/E lower (E,F=0..).
const GRADE_POINTS = { A: 4, B: 3, C: 2, D: 1, E: 0.5, F: 0 };

export function byDimension(tickets, dimKey) {
  const groups = {};
  for (const t of closedTickets(tickets)) {
    const key = t[dimKey] || 'unknown';
    groups[key] = groups[key] || { key, count: 0, gradeSum: 0, rSum: 0, rN: 0 };
    groups[key].count += 1;
    groups[key].gradeSum += GRADE_POINTS[t.processGrade] ?? 0;
    const r = num(t.realizedR);
    if (r != null) {
      groups[key].rSum += r;
      groups[key].rN += 1;
    }
  }
  return Object.values(groups).map((g) => ({
    key: g.key,
    count: g.count,
    avgGrade: g.count ? +(g.gradeSum / g.count).toFixed(2) : 0,
    avgR: g.rN ? +(g.rSum / g.rN).toFixed(2) : 0,
  }));
}

export const ideaSourceBreakdown = (t) => byDimension(t, 'ideaSource');
export const hypothesisEngineBreakdown = (t) => byDimension(t, 'hypothesisEngine');

// --- Planned vs realized R scatter -----------------------------------------
// Is the asymmetry estimate honest? Compare planned target R to realized R.
export function plannedVsRealizedR(tickets) {
  const pts = [];
  for (const t of closedTickets(tickets)) {
    const planned = num(t.plannedTargetR);
    const realized = num(t.realizedR);
    if (planned == null || realized == null) continue;
    pts.push({
      planned,
      realized,
      label: t.instrumentStructure || t.id,
      grade: t.processGrade,
    });
  }
  return pts;
}

// --- Emotional/somatic-state tag x outcome ---------------------------------
export function stateOutcome(tickets) {
  const groups = {};
  for (const t of closedTickets(tickets)) {
    const key = (t.stateAtEntry || 'unspecified').trim() || 'unspecified';
    groups[key] = groups[key] || { state: key, wins: 0, losses: 0 };
    if (isWin(t)) groups[key].wins += 1;
    else groups[key].losses += 1;
  }
  return Object.values(groups);
}

// Scope a document's tickets/dailies to an ISO week (Mon-Sun) containing `date`.
export function weekBounds(dateISO) {
  const d = new Date(dateISO + 'T00:00:00');
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  const monday = new Date(d);
  monday.setDate(d.getDate() - day);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const iso = (x) => x.toISOString().slice(0, 10);
  return { start: iso(monday), end: iso(sunday) };
}

export function scopeToWeek(doc, dateISO) {
  const { start, end } = weekBounds(dateISO);
  const inWeek = (d) => d >= start && d <= end;
  return {
    ...doc,
    tickets: (doc.tickets || []).filter((t) =>
      inWeek(t.closedDate || t.openedDate || '')
    ),
    dailies: (doc.dailies || []).filter((d) => inWeek(d.date || '')),
    _week: { start, end },
  };
}
