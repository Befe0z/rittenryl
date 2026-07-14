import { describe, it, expect } from 'vitest';
import {
  hasDangerousQuadrant,
  dangerousQuadrantTickets,
  gradeOutcomeCrossTab,
  gradeDistribution,
  plannedVsRealizedR,
} from '../lib/aggregations.js';
import { newTradeTicket } from '../lib/schema.js';

function closed(over) {
  return newTradeTicket({ status: 'CLOSED', gradeCommitted: true, ...over });
}

describe('dangerous quadrant — win on a low-grade process', () => {
  it('flags a WIN (pnl > 0) on a D/E/F grade', () => {
    const tickets = [
      closed({ id: 'a', processGrade: 'A', pnl: '500' }), // good process win — safe
      closed({ id: 'b', processGrade: 'D', pnl: '900' }), // DANGER: won on D
      closed({ id: 'c', processGrade: 'F', pnl: '-100' }), // bad process loss — not dangerous
    ];
    expect(hasDangerousQuadrant(tickets)).toBe(true);
    const dq = dangerousQuadrantTickets(tickets);
    expect(dq.map((t) => t.id)).toEqual(['b']);
  });

  it('does NOT flag when low grades only produced losses', () => {
    const tickets = [
      closed({ id: 'a', processGrade: 'A', pnl: '500' }),
      closed({ id: 'b', processGrade: 'F', pnl: '-200' }),
    ];
    expect(hasDangerousQuadrant(tickets)).toBe(false);
    expect(dangerousQuadrantTickets(tickets)).toHaveLength(0);
  });

  it('cross-tab marks the dangerous row', () => {
    const tickets = [closed({ processGrade: 'D', pnl: '300' })];
    const rows = gradeOutcomeCrossTab(tickets);
    const dRow = rows.find((r) => r.grade === 'D');
    expect(dRow.wins).toBe(1);
    expect(dRow.dangerous).toBe(true);
    const aRow = rows.find((r) => r.grade === 'A');
    expect(aRow.dangerous).toBe(false);
  });

  it('ignores tickets that are open or ungraded', () => {
    const tickets = [
      newTradeTicket({ status: 'OPEN', processGrade: 'F', pnl: '900', gradeCommitted: false }),
    ];
    expect(hasDangerousQuadrant(tickets)).toBe(false);
    expect(gradeDistribution(tickets).every((d) => d.count === 0)).toBe(true);
  });

  it('planned-vs-realized scatter pairs the numbers', () => {
    const tickets = [closed({ plannedTargetR: '3', realizedR: '2.6' })];
    const pts = plannedVsRealizedR(tickets);
    expect(pts).toHaveLength(1);
    expect(pts[0]).toMatchObject({ planned: 3, realized: 2.6 });
  });
});
