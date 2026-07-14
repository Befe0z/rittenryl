import {
  GradeDistributionChart,
  GradeOutcomeChart,
  IdeaSourceChart,
  HypothesisEngineChart,
  PlannedVsRealizedChart,
  StateOutcomeChart,
  MistakeTagChart,
} from './Charts.jsx';
import { closedTickets, dangerousQuadrantTickets } from '../lib/aggregations.js';

export default function Dashboard({ doc }) {
  const tickets = doc.tickets;
  const closed = closedTickets(tickets);
  const open = tickets.filter((t) => t.status === 'OPEN');
  const dq = dangerousQuadrantTickets(tickets);
  const gradeA = closed.filter((t) => ['A', 'B'].includes(t.processGrade)).length;

  return (
    <div>
      <div className="view-head">
        <h1>Aggregation Deck</h1>
        <span className="sub">
          the reason this beats a markdown folder
        </span>
      </div>

      <div className="panel">
        <div className="stat-row">
          <div className="stat">
            <span className="k">closed &amp; graded</span>
            <span className="v">{closed.length}</span>
          </div>
          <div className="stat">
            <span className="k">open</span>
            <span className="v">{open.length}</span>
          </div>
          <div className="stat">
            <span className="k">A/B process</span>
            <span className="v">{gradeA}</span>
          </div>
          <div className="stat">
            <span className="k">danger quadrant</span>
            <span className="v" style={{ color: dq.length ? '#f7768e' : undefined }}>
              {dq.length}
            </span>
          </div>
        </div>
      </div>

      <div className="grid-charts">
        <GradeDistributionChart tickets={tickets} />
        <GradeOutcomeChart tickets={tickets} />
        <IdeaSourceChart tickets={tickets} />
        <HypothesisEngineChart tickets={tickets} />
        <PlannedVsRealizedChart tickets={tickets} />
        <StateOutcomeChart tickets={tickets} />
        <MistakeTagChart tickets={tickets} />
      </div>
    </div>
  );
}
