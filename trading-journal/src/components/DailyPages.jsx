import { useState } from 'react';
import { Text, Area } from './Fields.jsx';
import { newDailyPage, newWatchlistItem } from '../lib/schema.js';

export default function DailyPages({ doc, upsertDaily, deleteDaily }) {
  const [editing, setEditing] = useState(null);

  if (editing) {
    return (
      <DailyForm
        initial={editing}
        onSave={(d) => {
          upsertDaily(d);
          setEditing(null);
        }}
        onDelete={(id) => {
          deleteDaily(id);
          setEditing(null);
        }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  const sorted = [...doc.dailies].sort((a, b) => (b.date < a.date ? -1 : 1));

  return (
    <div>
      <div className="view-head">
        <h1>Daily Pages</h1>
        <button className="btn primary" onClick={() => setEditing(newDailyPage())}>
          + New Daily
        </button>
      </div>
      <div className="panel">
        {sorted.length === 0 ? (
          <div className="empty">no daily pages yet</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Forward Picture</th>
                <th>Edge or P&amp;L?</th>
                <th>Watchlist</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((d) => (
                <tr key={d.id} style={{ cursor: 'pointer' }} onClick={() => setEditing(d)}>
                  <td>{d.date}</td>
                  <td>{d.forwardPicture || <span className="faint">—</span>}</td>
                  <td className="faint">{d.state?.edgeOrPnl || '—'}</td>
                  <td>
                    {(d.watchlist || []).map((w) => (
                      <span className="tag" key={w.id}>
                        {w.symbol}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function DailyForm({ initial, onSave, onDelete, onCancel }) {
  const [d, setD] = useState(initial);
  const set = (patch) => setD((p) => ({ ...p, ...patch }));
  const setState = (patch) => setD((p) => ({ ...p, state: { ...p.state, ...patch } }));
  const setRisk = (patch) => setD((p) => ({ ...p, riskMap: { ...p.riskMap, ...patch } }));

  const setWl = (id, patch) =>
    setD((p) => ({
      ...p,
      watchlist: p.watchlist.map((w) => (w.id === id ? { ...w, ...patch } : w)),
    }));
  const addWl = () => setD((p) => ({ ...p, watchlist: [...p.watchlist, newWatchlistItem()] }));
  const delWl = (id) => setD((p) => ({ ...p, watchlist: p.watchlist.filter((w) => w.id !== id) }));

  return (
    <div>
      <div className="view-head">
        <h1>Daily Page — {d.date}</h1>
        <button className="btn" onClick={onCancel}>
          ← Back
        </button>
      </div>

      <div className="panel">
        <h2>Read</h2>
        <Text label="Date" type="date" value={d.date} onChange={(v) => set({ date: v })} />
        <Area
          label="Liquidity / Macro Read"
          value={d.liquidityMacro}
          onChange={(v) => set({ liquidityMacro: v })}
        />
        <Area
          label="Forward Picture (one line, 18–24mo)"
          rows={2}
          value={d.forwardPicture}
          onChange={(v) => set({ forwardPicture: v })}
        />
      </div>

      <div className="panel">
        <h2>State Check</h2>
        <div className="inline-row">
          <Text label="Physical State" value={d.state.physical} onChange={(v) => setState({ physical: v })} />
          <Text label="Emotional State" value={d.state.emotional} onChange={(v) => setState({ emotional: v })} />
        </div>
        <Area
          label="Edge or P&amp;L?"
          rows={2}
          hint="Am I trading my edge or my P&L?"
          value={d.state.edgeOrPnl}
          onChange={(v) => setState({ edgeOrPnl: v })}
        />
      </div>

      <div className="panel">
        <h2>Watchlist</h2>
        {d.watchlist.length === 0 && <div className="faint" style={{ marginBottom: 8 }}>no items</div>}
        {d.watchlist.map((w) => (
          <div className="wl-item" key={w.id}>
            <input placeholder="SYMBOL" value={w.symbol} onChange={(e) => setWl(w.id, { symbol: e.target.value })} />
            <input placeholder="trigger condition" value={w.trigger} onChange={(e) => setWl(w.id, { trigger: e.target.value })} />
            <button className="btn sm danger" onClick={() => delWl(w.id)}>
              ✕
            </button>
          </div>
        ))}
        <button className="btn sm list-add" onClick={addWl}>
          + Add Symbol
        </button>
      </div>

      <div className="panel">
        <h2>Risk Map</h2>
        <Text label="Net Exposure" value={d.riskMap.netExposure} onChange={(v) => setRisk({ netExposure: v })} />
        <Area
          label="Correlation Clusters"
          value={d.riskMap.correlationClusters}
          onChange={(v) => setRisk({ correlationClusters: v })}
        />
        <Area label="One-Way-Bet Radar" value={d.oneWayBetRadar} onChange={(v) => set({ oneWayBetRadar: v })} />
      </div>

      <div className="panel">
        <h2>End-of-Day Reflection</h2>
        <Area rows={4} value={d.reflection} onChange={(v) => set({ reflection: v })} />
      </div>

      <div className="panel">
        <div className="btn-row">
          <button className="btn primary" onClick={() => onSave(d)}>
            Save Daily
          </button>
          <button className="btn danger" onClick={() => onDelete(d.id)}>
            Delete
          </button>
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
