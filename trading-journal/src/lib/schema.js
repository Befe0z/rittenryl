// Schema factories and enumerations for the decision journal.
// Keeping these centralized makes the storage seam (localStorage -> SQLite)
// and the markdown round-trip logic trivial to keep in sync.

export const REGIME_TAGS = [
  'reflexive-boom-bust',
  'liquidity',
  'mean-reversion',
  'event-vol',
  'other',
];

export const CONVICTION_LEVELS = ['pilot', 'core', 'pig-out'];

export const IDEA_SOURCES = [
  'screener',
  'structural-flow',
  'cross-market-inconsistency',
  'variant-perception',
  'other',
];

export const HYPOTHESIS_ENGINES = [
  'consensus-crack',
  'consequence-chain',
  'inversion',
  'screener',
];

export const PROCESS_GRADES = ['A', 'B', 'C', 'D', 'E', 'F'];
export const LOW_GRADES = ['D', 'E', 'F'];

export const RIGHT_WRONG = [
  'right-for-right',
  'right-for-wrong',
  'wrong-for-right',
  'wrong-for-wrong',
];

export const TICKET_STATUS = { OPEN: 'OPEN', CLOSED: 'CLOSED' };

// Simple, dependency-free unique id.
export function makeId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function newWatchlistItem() {
  return { id: makeId('wl'), symbol: '', trigger: '' };
}

export function newDailyPage(overrides = {}) {
  return {
    id: makeId('daily'),
    kind: 'daily',
    date: todayISO(),
    liquidityMacro: '',
    forwardPicture: '', // one-line, 18-24mo horizon
    state: {
      physical: '',
      emotional: '',
      edgeOrPnl: '', // "am I trading my edge or my P&L?"
    },
    watchlist: [],
    riskMap: {
      netExposure: '',
      correlationClusters: '',
    },
    oneWayBetRadar: '',
    reflection: '',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function newConfluence() {
  return {
    fundamental: { checked: false, note: '' },
    tape: { checked: false, note: '' },
    structureVol: { checked: false, note: '' },
    divergenceNote: '',
  };
}

export function newTradeTicket(overrides = {}) {
  return {
    id: makeId('trade'),
    kind: 'trade',
    status: TICKET_STATUS.OPEN,
    openedDate: todayISO(),
    closedDate: '',

    // ENTRY
    instrumentStructure: '', // e.g. "SPY 450 calls, 30d"
    whyThisStructure: '',
    thesis: '', // one sentence
    forwardPicture: '', // what's mispriced
    regimeTag: 'other',
    confluence: newConfluence(),
    invalidation: '', // REQUIRED before OPEN
    reversalCondition: '',
    preMortem: '', // REQUIRED before OPEN
    conviction: 'pilot',
    kellyFraction: '',
    maxLossVsTargetRatio: '', // planned asymmetry (max-loss vs target)
    plannedTargetR: '', // planned target R-multiple (for planned-vs-realized)
    pilotOrScaled: 'pilot', // toggle: 'pilot' | 'scaled'
    scaleTrigger: '',
    stateAtEntry: '',
    ideaSource: 'other',
    hypothesisEngine: 'screener',

    // EXIT / AUDIT
    exitReason: '',
    realizedR: '', // R-multiple vs planned max loss
    processGrade: '', // A-F, committed via gate
    gradeCommitted: false, // gate flag: P&L hidden until true
    mistakeTag: '',
    rightWrong: '',
    lesson: '',
    pnl: '', // number, revealed only after grade committed

    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---- Gate helpers (pure, unit-tested) --------------------------------------

// A ticket may only be saved in OPEN state if invalidation AND pre-mortem
// are both non-empty. Returns { ok, errors: {field: msg} }.
export function validateOpenGate(ticket) {
  const errors = {};
  if (!ticket.invalidation || !ticket.invalidation.trim()) {
    errors.invalidation =
      'Pre-registered invalidation is required before a ticket can be OPEN.';
  }
  if (!ticket.preMortem || !ticket.preMortem.trim()) {
    errors.preMortem = 'Pre-mortem is required before a ticket can be OPEN.';
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

// The P&L field is only accessible once the process grade has been committed.
export function isPnlUnlocked(ticket) {
  return Boolean(
    ticket.gradeCommitted &&
      ticket.processGrade &&
      PROCESS_GRADES.includes(ticket.processGrade)
  );
}
