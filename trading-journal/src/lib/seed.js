// Seed data so every chart renders on first load. All numeric fields are stored
// as strings (matching form <input> values) which also keeps markdown
// round-trip byte-identical.

import {
  newTradeTicket,
  newDailyPage,
  makeId,
} from './schema.js';

function ticket(over) {
  return { ...newTradeTicket(), ...over };
}

export function seedData() {
  const tickets = [
    ticket({
      id: 'trade_seed_1',
      status: 'CLOSED',
      openedDate: '2026-06-15',
      closedDate: '2026-06-24',
      instrumentStructure: 'SPY 450 calls, 30d',
      whyThisStructure:
        'Defined risk, convex payoff into a liquidity-driven melt-up; theta acceptable given 30d window.',
      thesis: 'Fed balance-sheet stabilization re-rates risk higher into quarter-end.',
      forwardPicture:
        'Consensus is positioned for a hawkish hold; reserves are actually rising — the pain trade is up.',
      regimeTag: 'liquidity',
      confluence: {
        fundamental: { checked: true, note: 'Reserves rising, net liquidity inflecting up.' },
        tape: { checked: true, note: 'Higher lows on SPX, breadth thrust off the low.' },
        structureVol: { checked: true, note: 'VIX term structure re-steepening, dealers short gamma.' },
        divergenceNote: 'Credit not confirming yet — watch HYG.',
      },
      invalidation: 'Net liquidity rolls over OR SPX closes below the 20d for two sessions.',
      reversalCondition: 'A hawkish surprise that lifts real yields > 20bps intraday.',
      preMortem:
        'If this fails it is because I mistook a bear-market rally for a regime change and ignored credit divergence.',
      conviction: 'core',
      kellyFraction: '0.35',
      maxLossVsTargetRatio: '0.33',
      plannedTargetR: '3',
      pilotOrScaled: 'scaled',
      scaleTrigger: 'Add on a reclaim of the prior swing high with breadth confirmation.',
      stateAtEntry: 'calm-focused',
      ideaSource: 'structural-flow',
      hypothesisEngine: 'consensus-crack',
      exitReason: 'Target hit as liquidity thesis played out; trimmed into strength.',
      realizedR: '2.6',
      processGrade: 'A',
      gradeCommitted: true,
      mistakeTag: 'none',
      rightWrong: 'right-for-right',
      lesson: 'When flow, tape and vol all align, size up — pilots leave money on the table.',
      pnl: '4200',
    }),
    ticket({
      id: 'trade_seed_2',
      status: 'CLOSED',
      openedDate: '2026-06-20',
      closedDate: '2026-06-27',
      instrumentStructure: 'Long NVDA shares',
      whyThisStructure: 'Wanted clean delta, no theta bleed, willing to hold the swing.',
      thesis: 'AI capex cycle keeps beating; stock re-rates on next print.',
      forwardPicture: 'Street undermodels datacenter backlog.',
      regimeTag: 'reflexive-boom-bust',
      confluence: {
        fundamental: { checked: true, note: 'Backlog commentary strong.' },
        tape: { checked: false, note: 'Extended, chasing above the 8ema.' },
        structureVol: { checked: false, note: 'IV rich into earnings, poor R/R.' },
        divergenceNote: 'Only fundamental leg confirmed — tape and vol said no.',
      },
      invalidation: 'Break of the rising 21d trendline on volume.',
      reversalCondition: 'Guide-down on gross margin.',
      preMortem: 'If this loses it is because I chased an extended name into an expensive-vol event.',
      conviction: 'pilot',
      kellyFraction: '0.1',
      maxLossVsTargetRatio: '0.8',
      plannedTargetR: '1.5',
      pilotOrScaled: 'pilot',
      scaleTrigger: '',
      stateAtEntry: 'fomo-restless',
      ideaSource: 'screener',
      hypothesisEngine: 'screener',
      exitReason: 'Stock gapped up on unrelated sector news; I got bailed out by beta.',
      realizedR: '1.1',
      processGrade: 'D',
      gradeCommitted: true,
      mistakeTag: 'chased-extended-entry',
      rightWrong: 'right-for-wrong',
      lesson: 'Getting paid for a D-grade entry is the most dangerous outcome — do not learn the wrong lesson.',
      pnl: '900',
    }),
    ticket({
      id: 'trade_seed_3',
      status: 'CLOSED',
      openedDate: '2026-07-01',
      closedDate: '2026-07-08',
      instrumentStructure: 'TLT put spread, 45d',
      whyThisStructure: 'Cheap defined-risk short-duration expression of a re-acceleration.',
      thesis: 'Sticky services inflation forces long-end yields higher.',
      forwardPicture: 'Bond market too complacent on cut path.',
      regimeTag: 'mean-reversion',
      confluence: {
        fundamental: { checked: true, note: 'Supercore inflation not cooperating.' },
        tape: { checked: true, note: 'TLT rejecting the 200d.' },
        structureVol: { checked: false, note: 'Skew not helpful; paid up a touch.' },
        divergenceNote: 'Vol leg weak but directional edge clear.',
      },
      invalidation: 'A soft CPI print that reclaims the 200d on TLT.',
      reversalCondition: 'Dovish Fed pivot language.',
      preMortem: 'If this fails it is because I fought a disinflation trend that was already in motion.',
      conviction: 'core',
      kellyFraction: '0.25',
      maxLossVsTargetRatio: '0.4',
      plannedTargetR: '2.5',
      pilotOrScaled: 'pilot',
      scaleTrigger: 'Add on a break of the range low.',
      stateAtEntry: 'calm-focused',
      ideaSource: 'cross-market-inconsistency',
      hypothesisEngine: 'consequence-chain',
      exitReason: 'Invalidation hit — soft CPI reclaimed the 200d. Cut per plan.',
      realizedR: '-1',
      processGrade: 'B',
      gradeCommitted: true,
      mistakeTag: 'none',
      rightWrong: 'wrong-for-right',
      lesson: 'A clean, pre-registered stop turned a wrong call into a small, survivable loss.',
      pnl: '-1100',
    }),
  ];

  const dailies = [
    newDailyPage({
      id: 'daily_seed_1',
      date: '2026-07-06',
      liquidityMacro:
        'Net liquidity still grinding higher; TGA drawdown offsetting QT. Front-end pinned, back-end restless.',
      forwardPicture:
        'By late 2027 the market re-rates fiscal dominance as the dominant macro regime.',
      state: {
        physical: 'Slept 7h, rested.',
        emotional: 'Even-keeled.',
        edgeOrPnl: 'Trading my edge — no open P&L pressure distorting the read.',
      },
      watchlist: [
        { id: makeId('wl'), symbol: 'SPY', trigger: 'Reclaim of prior high with breadth thrust.' },
        { id: makeId('wl'), symbol: 'TLT', trigger: 'Rejection of the 200d on a hot CPI.' },
      ],
      riskMap: {
        netExposure: 'Net long ~40% gross, beta-adjusted ~0.3.',
        correlationClusters: 'Rate-sensitive cluster (TLT short, growth long) is my real concentration.',
      },
      oneWayBetRadar: 'Everyone short duration into CPI — crowded; fade the obvious.',
      reflection: 'Held discipline, no impulse trades. Sat on hands during the midday chop.',
    }),
    newDailyPage({
      id: 'daily_seed_2',
      date: '2026-07-13',
      liquidityMacro: 'Reserves flat week-over-week; watching bill issuance for a liquidity drain signal.',
      forwardPicture: 'Structural inflation floor higher than consensus for the rest of the decade.',
      state: {
        physical: 'Tired, poor sleep.',
        emotional: 'Slightly impatient.',
        edgeOrPnl: 'Caught myself watching P&L — flagged it, reduced size.',
      },
      watchlist: [
        { id: makeId('wl'), symbol: 'NVDA', trigger: 'Pullback to the 21d before adding.' },
      ],
      riskMap: {
        netExposure: 'Net long ~25% gross after trimming.',
        correlationClusters: 'AI/semis cluster is the dominant factor exposure.',
      },
      oneWayBetRadar: 'AI trade consensus getting one-sided again; keep a hedge sketch ready.',
      reflection: 'Good self-catch on P&L-watching. Reduced size rather than forcing a view.',
    }),
  ];

  const principles = [
    {
      id: 'prin_seed_1',
      principle: 'Getting paid for a bad process is the most expensive lesson — grade the decision, not the ticket.',
      taughtBy: 'Long NVDA shares (trade_seed_2)',
      date: '2026-06-27',
    },
    {
      id: 'prin_seed_2',
      principle: 'A pre-registered invalidation converts a wrong call into a survivable loss.',
      taughtBy: 'TLT put spread (trade_seed_3)',
      date: '2026-07-08',
    },
    {
      id: 'prin_seed_3',
      principle: 'When fundamental, tape and vol all confirm, size up — conviction unexpressed is edge wasted.',
      taughtBy: 'SPY 450 calls (trade_seed_1)',
      date: '2026-06-24',
    },
  ];

  return { version: 1, tickets, dailies, principles };
}
