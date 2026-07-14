import { useState } from 'react';
import { useJournal } from './store.js';
import Dashboard from './components/Dashboard.jsx';
import TradeTickets from './components/TradeTickets.jsx';
import DailyPages from './components/DailyPages.jsx';
import WeeklyReview from './components/WeeklyReview.jsx';
import Principles from './components/Principles.jsx';
import DataMenu from './components/DataMenu.jsx';

const VIEWS = [
  { id: 'dashboard', label: 'Aggregation Deck', section: 'analyze' },
  { id: 'weekly', label: 'Weekly Review', section: 'analyze' },
  { id: 'tickets', label: 'Trade Tickets', section: 'journal' },
  { id: 'daily', label: 'Daily Pages', section: 'journal' },
  { id: 'principles', label: 'Principles Ledger', section: 'journal' },
  { id: 'data', label: 'Export / Import', section: 'system' },
];

export default function App() {
  const [view, setView] = useState('dashboard');
  const journal = useJournal();
  const { doc } = journal;

  const sections = ['analyze', 'journal', 'system'];
  const sectionLabels = { analyze: 'analyze', journal: 'journal', system: 'system' };

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="brand">
          rittenryl
          <small>decision journal // not a P&amp;L log</small>
        </div>
        {sections.map((sec) => (
          <div key={sec}>
            <div className="nav-section">{sectionLabels[sec]}</div>
            {VIEWS.filter((v) => v.section === sec).map((v) => (
              <button
                key={v.id}
                className={`navbtn ${view === v.id ? 'active' : ''}`}
                onClick={() => setView(v.id)}
                style={{ display: 'block', width: '100%' }}
              >
                {v.label}
              </button>
            ))}
          </div>
        ))}
        <div className="nav-spacer" />
        <div className="faint" style={{ fontSize: 10, padding: '8px' }}>
          {doc.tickets.length} tickets · {doc.dailies.length} dailies
        </div>
      </nav>

      <main className="main">
        {view === 'dashboard' && <Dashboard doc={doc} />}
        {view === 'weekly' && <WeeklyReview doc={doc} />}
        {view === 'tickets' && (
          <TradeTickets
            doc={doc}
            upsertTicket={journal.upsertTicket}
            deleteTicket={journal.deleteTicket}
          />
        )}
        {view === 'daily' && (
          <DailyPages
            doc={doc}
            upsertDaily={journal.upsertDaily}
            deleteDaily={journal.deleteDaily}
          />
        )}
        {view === 'principles' && (
          <Principles doc={doc} setPrinciples={journal.setPrinciples} />
        )}
        {view === 'data' && <DataMenu doc={doc} replaceDoc={journal.replaceDoc} />}
      </main>
    </div>
  );
}
