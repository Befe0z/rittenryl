import { useState } from 'react';
import { Text, Area, Select, Check } from './Fields.jsx';
import {
  newTradeTicket,
  newConfluence,
  REGIME_TAGS,
  CONVICTION_LEVELS,
  IDEA_SOURCES,
  HYPOTHESIS_ENGINES,
  PROCESS_GRADES,
  RIGHT_WRONG,
  validateOpenGate,
  isPnlUnlocked,
  TICKET_STATUS,
} from '../lib/schema.js';

// ---- List view -------------------------------------------------------------

function pnlClass(v) {
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return '';
  return n >= 0 ? 'pos' : 'neg';
}

function TicketRow({ t, onEdit }) {
  return (
    <tr onClick={() => onEdit(t)} style={{ cursor: 'pointer' }}>
      <td>
        <span className={`tag ${t.status === 'OPEN' ? 'open' : 'closed'}`}>
          {t.status}
        </span>
      </td>
      <td>{t.instrumentStructure || <span className="faint">—</span>}</td>
      <td>
        <span className="tag">{t.regimeTag}</span>
      </td>
      <td>{t.openedDate}</td>
      <td>{t.closedDate || <span className="faint">—</span>}</td>
      <td>
        {t.gradeCommitted && t.processGrade ? (
          <span className={`grade ${t.processGrade}`}>{t.processGrade}</span>
        ) : (
          <span className="faint">—</span>
        )}
      </td>
      <td className="mono-num">
        {t.gradeCommitted && t.pnl !== '' ? (
          <span className={pnlClass(t.pnl)}>{t.pnl}</span>
        ) : (
          <span className="faint">—</span>
        )}
      </td>
      <td>{t.realizedR !== '' ? t.realizedR : <span className="faint">—</span>}</td>
    </tr>
  );
}

export default function TradeTickets({ doc, upsertTicket, deleteTicket }) {
  const [editing, setEditing] = useState(null);

  if (editing) {
    return (
      <TicketForm
        initial={editing}
        onSave={(t) => {
          upsertTicket(t);
          setEditing(null);
        }}
        onDelete={(id) => {
          deleteTicket(id);
          setEditing(null);
        }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  const sorted = [...doc.tickets].sort((a, b) =>
    (b.openedDate || '') < (a.openedDate || '') ? -1 : 1
  );

  return (
    <div>
      <div className="view-head">
        <h1>Trade Tickets</h1>
        <button className="btn primary" onClick={() => setEditing(newTradeTicket())}>
          + New Ticket
        </button>
      </div>

      <div className="panel">
        {sorted.length === 0 ? (
          <div className="empty">no tickets — open one to start</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Instrument / Structure</th>
                <th>Regime</th>
                <th>Opened</th>
                <th>Closed</th>
                <th>Grade</th>
                <th className="mono-num">P&amp;L</th>
                <th>R</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => (
                <TicketRow key={t.id} t={t} onEdit={setEditing} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ---- Ticket form -----------------------------------------------------------

function TicketForm({ initial, onSave, onDelete, onCancel }) {
  const [t, setT] = useState({ ...initial, confluence: initial.confluence || newConfluence() });
  const [errors, setErrors] = useState({});
  const [msg, setMsg] = useState('');

  const set = (patch) => setT((prev) => ({ ...prev, ...patch }));
  const setConf = (dim, patch) =>
    setT((prev) => ({
      ...prev,
      confluence: { ...prev.confluence, [dim]: { ...prev.confluence[dim], ...patch } },
    }));

  const pnlUnlocked = isPnlUnlocked(t);

  // --- GATE 1: required-before-open --------------------------------------
  function saveOpen() {
    const gate = validateOpenGate(t);
    if (!gate.ok) {
      setErrors(gate.errors);
      setMsg('');
      return;
    }
    setErrors({});
    onSave({ ...t, status: TICKET_STATUS.OPEN });
  }

  // --- GATE 2: commit grade ----------------------------------------------
  function commitGrade() {
    if (!t.processGrade) {
      setErrors((e) => ({ ...e, processGrade: 'Pick a grade (A–F) before committing.' }));
      return;
    }
    setErrors((e) => ({ ...e, processGrade: undefined }));
    set({ gradeCommitted: true });
    setMsg('Grade committed — P&L revealed. Grade the decision, not the result.');
  }

  function reviseGrade() {
    set({ gradeCommitted: false });
    setMsg('');
  }

  function closeTicket() {
    if (!t.gradeCommitted) {
      setMsg('Commit a process grade before closing — grade the decision first.');
      return;
    }
    onSave({
      ...t,
      status: TICKET_STATUS.CLOSED,
      closedDate: t.closedDate || new Date().toISOString().slice(0, 10),
    });
  }

  const hasOpenErrors = errors.invalidation || errors.preMortem;

  return (
    <div>
      <div className="view-head">
        <h1>
          {initial.instrumentStructure ? 'Edit Ticket' : 'New Ticket'}{' '}
          <span className={`tag ${t.status === 'OPEN' ? 'open' : 'closed'}`}>{t.status}</span>
        </h1>
        <button className="btn" onClick={onCancel}>
          ← Back
        </button>
      </div>

      {hasOpenErrors && (
        <div className="error-summary">
          Cannot save as OPEN — the required-before-open gate is blocking:
          <ul>
            {errors.invalidation && <li>{errors.invalidation}</li>}
            {errors.preMortem && <li>{errors.preMortem}</li>}
          </ul>
        </div>
      )}

      {/* ENTRY */}
      <div className="panel">
        <h2>Entry — Thesis &amp; Structure</h2>
        <Text
          label="Instrument &amp; Structure"
          hint='e.g. "SPY 450 calls, 30d"'
          value={t.instrumentStructure}
          onChange={(v) => set({ instrumentStructure: v })}
        />
        <Area
          label="Why This Structure"
          value={t.whyThisStructure}
          onChange={(v) => set({ whyThisStructure: v })}
        />
        <Area
          label="Thesis (one sentence)"
          rows={2}
          value={t.thesis}
          onChange={(v) => set({ thesis: v })}
        />
        <Area
          label="Forward Picture / What's Mispriced"
          value={t.forwardPicture}
          onChange={(v) => set({ forwardPicture: v })}
        />
        <div className="inline-row">
          <Select
            label="Regime Tag"
            value={t.regimeTag}
            onChange={(v) => set({ regimeTag: v })}
            options={REGIME_TAGS}
          />
          <Text label="Opened" type="date" value={t.openedDate} onChange={(v) => set({ openedDate: v })} />
        </div>
      </div>

      {/* CONFLUENCE */}
      <div className="panel">
        <h2>Confluence Checklist</h2>
        {[
          ['fundamental', 'Fundamental'],
          ['tape', 'Tape'],
          ['structureVol', 'Structure / Vol'],
        ].map(([dim, lbl]) => (
          <div className="checkbox-row" key={dim}>
            <input
              type="checkbox"
              checked={t.confluence[dim].checked}
              onChange={(e) => setConf(dim, { checked: e.target.checked })}
            />
            <div className="cb-body">
              <div className="cb-label">{lbl}</div>
              <input
                placeholder={`${lbl} note`}
                value={t.confluence[dim].note}
                onChange={(e) => setConf(dim, { note: e.target.value })}
              />
            </div>
          </div>
        ))}
        <Area
          label="Divergence Note"
          rows={2}
          hint="Where do the three dimensions disagree?"
          value={t.confluence.divergenceNote}
          onChange={(v) =>
            setT((p) => ({
              ...p,
              confluence: { ...p.confluence, divergenceNote: v },
            }))
          }
        />
      </div>

      {/* RISK / GATE 1 fields */}
      <div className="panel">
        <h2>Pre-Registration (required before OPEN)</h2>
        <Area
          label="Pre-Registered Invalidation"
          required
          hint="What single observable proves the thesis wrong? REQUIRED to save OPEN."
          value={t.invalidation}
          onChange={(v) => set({ invalidation: v })}
          error={errors.invalidation}
        />
        <Area
          label="Reversal Condition"
          rows={2}
          value={t.reversalCondition}
          onChange={(v) => set({ reversalCondition: v })}
        />
        <Area
          label="Pre-Mortem"
          required
          hint="It's 3 months out and this failed — why? REQUIRED to save OPEN."
          value={t.preMortem}
          onChange={(v) => set({ preMortem: v })}
          error={errors.preMortem}
        />
      </div>

      {/* SIZING */}
      <div className="panel">
        <h2>Sizing &amp; State</h2>
        <div className="inline-row">
          <Select label="Conviction" value={t.conviction} onChange={(v) => set({ conviction: v })} options={CONVICTION_LEVELS} />
          <Text label="Kelly Fraction" type="number" step="0.01" value={t.kellyFraction} onChange={(v) => set({ kellyFraction: v })} />
          <Text label="Max-Loss vs Target Ratio" type="number" step="0.01" value={t.maxLossVsTargetRatio} onChange={(v) => set({ maxLossVsTargetRatio: v })} />
          <Text label="Planned Target R" type="number" step="0.1" hint="asymmetry estimate" value={t.plannedTargetR} onChange={(v) => set({ plannedTargetR: v })} />
        </div>
        <div className="inline-row">
          <Select label="Pilot or Scaled" value={t.pilotOrScaled} onChange={(v) => set({ pilotOrScaled: v })} options={['pilot', 'scaled']} />
          <Text label="State at Entry" hint="physical/emotional tag" value={t.stateAtEntry} onChange={(v) => set({ stateAtEntry: v })} />
        </div>
        <Area label="Scale Trigger" rows={2} value={t.scaleTrigger} onChange={(v) => set({ scaleTrigger: v })} />
      </div>

      {/* ANALYTICS TAGS */}
      <div className="panel">
        <h2>Analytics Tags (on every ticket)</h2>
        <div className="inline-row">
          <Select label="Idea Source" value={t.ideaSource} onChange={(v) => set({ ideaSource: v })} options={IDEA_SOURCES} />
          <Select label="Hypothesis Engine" value={t.hypothesisEngine} onChange={(v) => set({ hypothesisEngine: v })} options={HYPOTHESIS_ENGINES} />
        </div>
      </div>

      {/* EXIT / AUDIT with GATE 2 */}
      <div className="panel">
        <h2>Exit &amp; Audit</h2>
        <Area label="Exit Reason" rows={2} value={t.exitReason} onChange={(v) => set({ exitReason: v })} />
        <div className="inline-row">
          <Text label="Realized R (vs planned max loss)" type="number" step="0.1" value={t.realizedR} onChange={(v) => set({ realizedR: v })} />
          <Select label="Right / Wrong" value={t.rightWrong} onChange={(v) => set({ rightWrong: v })} options={[{ value: '', label: '—' }, ...RIGHT_WRONG]} />
          <Text label="Mistake Tag" hint="free text or 'none'" value={t.mistakeTag} onChange={(v) => set({ mistakeTag: v })} />
        </div>
        <Area label="One Lesson" rows={2} value={t.lesson} onChange={(v) => set({ lesson: v })} />

        {/* GATE 2: grade-before-P&L */}
        <div className={`gate-box ${pnlUnlocked ? 'locked' : ''}`}>
          <div className="gate-title">
            Grade-before-P&amp;L gate {pnlUnlocked ? '· unlocked' : '· locked'}
          </div>
          <div className="faint" style={{ marginBottom: 8 }}>
            Grade the decision quality first. P&amp;L stays hidden until the grade
            is committed, so the result can&apos;t bias the grade.
          </div>
          <div className="inline-row" style={{ alignItems: 'end' }}>
            <Select
              label="Process Grade (A–F)"
              value={t.processGrade}
              onChange={(v) => set({ processGrade: v })}
              options={[{ value: '', label: '—' }, ...PROCESS_GRADES]}
            />
            {!t.gradeCommitted ? (
              <button className="btn primary" onClick={commitGrade} disabled={!t.processGrade}>
                Commit Grade
              </button>
            ) : (
              <button className="btn" onClick={reviseGrade}>
                Revise Grade
              </button>
            )}
          </div>
          {errors.processGrade && <div className="field-error">{errors.processGrade}</div>}

          {/* P&L — blurred + disabled until grade committed */}
          <div style={{ marginTop: 12, position: 'relative' }}>
            {!pnlUnlocked && (
              <div className="faint" style={{ marginBottom: 4 }}>
                🔒 P&amp;L locked — commit a grade to reveal.
              </div>
            )}
            <div className={pnlUnlocked ? '' : 'blurred'} aria-hidden={!pnlUnlocked}>
              <Text
                label="Realized P&amp;L"
                type="number"
                data-testid="pnl-input"
                value={t.pnl}
                onChange={(v) => (pnlUnlocked ? set({ pnl: v }) : null)}
                disabled={!pnlUnlocked}
                readOnly={!pnlUnlocked}
              />
            </div>
          </div>
        </div>
      </div>

      {msg && <div className="toast" onAnimationEnd={() => setMsg('')}>{msg}</div>}

      <div className="panel">
        <div className="btn-row">
          <button className="btn primary" onClick={saveOpen}>
            Save as OPEN
          </button>
          <button className="btn" onClick={closeTicket}>
            Close Ticket (CLOSED)
          </button>
          <button className="btn danger" onClick={() => onDelete(t.id)}>
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
