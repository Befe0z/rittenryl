import { useState } from 'react';
import { scopeToWeek, closedTickets, dangerousQuadrantTickets } from '../lib/aggregations.js';
import { todayISO } from '../lib/schema.js';
import {
  GradeDistributionChart,
  GradeOutcomeChart,
  IdeaSourceChart,
  HypothesisEngineChart,
  PlannedVsRealizedChart,
} from './Charts.jsx';

export default function WeeklyReview({ doc }) {
  const [anchor, setAnchor] = useState(todayISO());
  const scoped = scopeToWeek(doc, anchor);
  const { start, end } = scoped._week;
  const closed = closedTickets(scoped.tickets);
  const dq = dangerousQuadrantTickets(scoped.tickets);

  return (
    <div>
      <div className="view-head">
        <h1>Weekly Review</h1>
        <span className="sub">
          {start} → {end}
        </span>
      </div>

      <div className="panel">
        <div className="inline-row" style={{ alignItems: 'end' }}>
          <div className="field">
            <label>Pick any day in the week</label>
            <input type="date" value={anchor} onChange={(e) => setAnchor(e.target.value)} />
          </div>
          <div className="stat">
            <span className="k">tickets closed</span>
            <span className="v">{closed.length}</span>
          </div>
          <div className="stat">
            <span className="k">daily pages</span>
            <span className="v">{scoped.dailies.length}</span>
          </div>
          <div className="stat">
            <span className="k">danger quadrant</span>
            <span className="v" style={{ color: dq.length ? '#f7768e' : undefined }}>
              {dq.length}
            </span>
          </div>
        </div>
      </div>

      {closed.length === 0 && scoped.dailies.length === 0 ? (
        <div className="empty">no activity in this week — pick another date</div>
      ) : (
        <>
          <div className="grid-charts">
            <GradeDistributionChart tickets={scoped.tickets} />
            <GradeOutcomeChart tickets={scoped.tickets} />
            <IdeaSourceChart tickets={scoped.tickets} />
            <HypothesisEngineChart tickets={scoped.tickets} />
            <PlannedVsRealizedChart tickets={scoped.tickets} />
          </div>

          {scoped.dailies.length > 0 && (
            <div className="panel">
              <h2>Daily Pages This Week</h2>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Edge or P&amp;L?</th>
                    <th>Reflection</th>
                  </tr>
                </thead>
                <tbody>
                  {scoped.dailies.map((d) => (
                    <tr key={d.id}>
                      <td>{d.date}</td>
                      <td className="faint">{d.state?.edgeOrPnl}</td>
                      <td>{d.reflection}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {closed.length > 0 && (
            <div className="panel">
              <h2>Lessons Booked This Week</h2>
              <ul>
                {closed.map((t) => (
                  <li key={t.id}>
                    <span className={`grade ${t.processGrade}`}>{t.processGrade}</span>{' '}
                    <strong>{t.instrumentStructure}</strong> — {t.lesson}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
