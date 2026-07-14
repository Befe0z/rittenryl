import { useState } from 'react';
import { makeId, todayISO } from '../lib/schema.js';

export default function Principles({ doc, setPrinciples }) {
  const rows = doc.principles;
  const [draft, setDraft] = useState({ principle: '', taughtBy: '', date: todayISO() });

  const add = () => {
    if (!draft.principle.trim()) return;
    setPrinciples([...rows, { id: makeId('prin'), ...draft }]);
    setDraft({ principle: '', taughtBy: '', date: todayISO() });
  };

  const update = (id, patch) =>
    setPrinciples(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const remove = (id) => setPrinciples(rows.filter((r) => r.id !== id));

  return (
    <div>
      <div className="view-head">
        <h1>Standing Principles Ledger</h1>
        <span className="sub">principle · trade that taught it · date</span>
      </div>

      <div className="panel">
        <table>
          <thead>
            <tr>
              <th style={{ width: '50%' }}>Principle</th>
              <th>Taught By (trade)</th>
              <th style={{ width: 120 }}>Date</th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="faint">
                  no principles recorded
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <input value={r.principle} onChange={(e) => update(r.id, { principle: e.target.value })} />
                </td>
                <td>
                  <input value={r.taughtBy} onChange={(e) => update(r.id, { taughtBy: e.target.value })} />
                </td>
                <td>
                  <input type="date" value={r.date} onChange={(e) => update(r.id, { date: e.target.value })} />
                </td>
                <td>
                  <button className="btn sm danger" onClick={() => remove(r.id)}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            <tr>
              <td>
                <input
                  placeholder="new principle…"
                  value={draft.principle}
                  onChange={(e) => setDraft((d) => ({ ...d, principle: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && add()}
                />
              </td>
              <td>
                <input
                  placeholder="trade"
                  value={draft.taughtBy}
                  onChange={(e) => setDraft((d) => ({ ...d, taughtBy: e.target.value }))}
                />
              </td>
              <td>
                <input type="date" value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} />
              </td>
              <td>
                <button className="btn sm primary" onClick={add}>
                  +
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
