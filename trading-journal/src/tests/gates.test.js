import { describe, it, expect } from 'vitest';
import {
  newTradeTicket,
  validateOpenGate,
  isPnlUnlocked,
} from '../lib/schema.js';

describe('GATE 1 — required-before-open', () => {
  it('blocks save when invalidation is empty', () => {
    const t = newTradeTicket({ preMortem: 'have a premortem', invalidation: '' });
    const gate = validateOpenGate(t);
    expect(gate.ok).toBe(false);
    expect(gate.errors.invalidation).toBeTruthy();
  });

  it('blocks save when pre-mortem is empty', () => {
    const t = newTradeTicket({ invalidation: 'break of trend', preMortem: '' });
    const gate = validateOpenGate(t);
    expect(gate.ok).toBe(false);
    expect(gate.errors.preMortem).toBeTruthy();
  });

  it('blocks save when both are empty (whitespace only)', () => {
    const t = newTradeTicket({ invalidation: '   ', preMortem: '\n\t' });
    const gate = validateOpenGate(t);
    expect(gate.ok).toBe(false);
    expect(gate.errors.invalidation).toBeTruthy();
    expect(gate.errors.preMortem).toBeTruthy();
  });

  it('allows save when both invalidation and pre-mortem are present', () => {
    const t = newTradeTicket({
      invalidation: 'net liquidity rolls over',
      preMortem: 'mistook a bear rally for a regime change',
    });
    const gate = validateOpenGate(t);
    expect(gate.ok).toBe(true);
    expect(gate.errors).toEqual({});
  });
});

describe('GATE 2 — grade-before-P&L (logic)', () => {
  it('P&L is locked before a grade is committed', () => {
    const t = newTradeTicket({ processGrade: 'A', gradeCommitted: false });
    expect(isPnlUnlocked(t)).toBe(false);
  });

  it('P&L is locked if committed flag set but no valid grade', () => {
    const t = newTradeTicket({ processGrade: '', gradeCommitted: true });
    expect(isPnlUnlocked(t)).toBe(false);
  });

  it('P&L unlocks only once a valid grade is committed', () => {
    const t = newTradeTicket({ processGrade: 'C', gradeCommitted: true });
    expect(isPnlUnlocked(t)).toBe(true);
  });
});
