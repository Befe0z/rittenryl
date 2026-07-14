import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
  ReferenceLine,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import {
  gradeDistribution,
  gradeOutcomeCrossTab,
  byDimension,
  plannedVsRealizedR,
  stateOutcome,
  mistakeTagOverTime,
  dangerousQuadrantTickets,
} from '../lib/aggregations.js';

const AXIS = { fontSize: 10, fill: '#7d8791' };
const GRID = '#1c262d';
const ACCENT = '#2dd4bf';
const DANGER = '#f7768e';
const GOOD = '#7ee787';
const WARN = '#e3b341';
const SERIES = ['#2dd4bf', '#e3b341', '#f7768e', '#7ee787', '#a5a5ff', '#ff9e64'];

const tooltipStyle = {
  background: '#11171d',
  border: '1px solid #2a3942',
  fontSize: 11,
  color: '#c9d1d9',
};

function ChartPanel({ title, note, children }) {
  return (
    <div className="panel chart-cell">
      <h2>{title}</h2>
      {note && <div className="faint" style={{ marginBottom: 8, fontSize: 11 }}>{note}</div>}
      {children}
    </div>
  );
}

function NoData() {
  return <div className="empty">no closed &amp; graded tickets in scope</div>;
}

export function GradeDistributionChart({ tickets }) {
  const data = gradeDistribution(tickets);
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <ChartPanel title="Process-Grade Distribution">
      {total === 0 ? (
        <NoData />
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="grade" tick={AXIS} stroke={GRID} />
            <YAxis allowDecimals={false} tick={AXIS} stroke={GRID} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#11171d' }} />
            <Bar dataKey="count">
              {data.map((d) => (
                <Cell
                  key={d.grade}
                  fill={
                    ['A', 'B'].includes(d.grade)
                      ? GOOD
                      : d.grade === 'C'
                        ? WARN
                        : DANGER
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartPanel>
  );
}

export function GradeOutcomeChart({ tickets }) {
  const data = gradeOutcomeCrossTab(tickets);
  const dq = dangerousQuadrantTickets(tickets);
  const total = data.reduce((s, d) => s + d.wins + d.losses, 0);
  return (
    <ChartPanel
      title="Grade × Outcome"
      note="Dangerous quadrant = a WIN on a D/E/F process (bars outlined red)."
    >
      {dq.length > 0 && (
        <div className="danger-banner">
          ⚠ {dq.length} ticket{dq.length > 1 ? 's' : ''} in the dangerous
          quadrant: won money on a low-grade process.
        </div>
      )}
      {total === 0 ? (
        <NoData />
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="grade" tick={AXIS} stroke={GRID} />
            <YAxis allowDecimals={false} tick={AXIS} stroke={GRID} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#11171d' }} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Bar dataKey="wins" stackId="a" name="wins">
              {data.map((d) => (
                <Cell
                  key={`w-${d.grade}`}
                  fill={GOOD}
                  stroke={d.dangerous ? DANGER : 'none'}
                  strokeWidth={d.dangerous ? 2 : 0}
                />
              ))}
            </Bar>
            <Bar dataKey="losses" stackId="a" fill={DANGER} name="losses" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartPanel>
  );
}

function DimensionChart({ tickets, dimKey, title, note }) {
  const data = byDimension(tickets, dimKey);
  return (
    <ChartPanel title={title} note={note}>
      {data.length === 0 ? (
        <NoData />
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid stroke={GRID} horizontal={false} />
            <XAxis type="number" tick={AXIS} stroke={GRID} />
            <YAxis
              type="category"
              dataKey="key"
              tick={AXIS}
              width={130}
              stroke={GRID}
            />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#11171d' }} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Bar dataKey="avgGrade" fill={ACCENT} name="avg grade (A=4)" />
            <Bar dataKey="avgR" fill={WARN} name="avg R" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartPanel>
  );
}

export function IdeaSourceChart({ tickets }) {
  return (
    <DimensionChart
      tickets={tickets}
      dimKey="ideaSource"
      title="Idea Source × Grade / R"
      note="Which sourcing produces A-trades vs held-too-long losers."
    />
  );
}

export function HypothesisEngineChart({ tickets }) {
  return (
    <DimensionChart
      tickets={tickets}
      dimKey="hypothesisEngine"
      title="Hypothesis Engine × Grade / R"
      note="Which reasoning engine generates your best decisions."
    />
  );
}

export function PlannedVsRealizedChart({ tickets }) {
  const data = plannedVsRealizedR(tickets);
  return (
    <ChartPanel
      title="Planned vs Realized R"
      note="Points below the diagonal = asymmetry estimate was optimistic."
    >
      {data.length === 0 ? (
        <NoData />
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <ScatterChart margin={{ left: 0, bottom: 4 }}>
            <CartesianGrid stroke={GRID} />
            <XAxis
              type="number"
              dataKey="planned"
              name="planned R"
              tick={AXIS}
              stroke={GRID}
              label={{ value: 'planned R', position: 'insideBottom', fill: '#4b555d', fontSize: 10, dy: 10 }}
            />
            <YAxis
              type="number"
              dataKey="realized"
              name="realized R"
              tick={AXIS}
              stroke={GRID}
            />
            <ZAxis range={[60, 60]} />
            <ReferenceLine
              segment={[
                { x: -2, y: -2 },
                { x: 6, y: 6 },
              ]}
              stroke="#4b555d"
              strokeDasharray="3 3"
            />
            <ReferenceLine y={0} stroke={GRID} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: '3 3' }} />
            <Scatter data={data} fill={ACCENT}>
              {data.map((d, i) => (
                <Cell
                  key={i}
                  fill={d.realized >= d.planned ? GOOD : DANGER}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      )}
    </ChartPanel>
  );
}

export function StateOutcomeChart({ tickets }) {
  const data = stateOutcome(tickets);
  return (
    <ChartPanel
      title="Entry State × Outcome"
      note="Which somatic/emotional states precede wins vs losses."
    >
      {data.length === 0 ? (
        <NoData />
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid stroke={GRID} horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={AXIS} stroke={GRID} />
            <YAxis type="category" dataKey="state" tick={AXIS} width={120} stroke={GRID} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#11171d' }} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Bar dataKey="wins" stackId="a" fill={GOOD} name="wins" />
            <Bar dataKey="losses" stackId="a" fill={DANGER} name="losses" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartPanel>
  );
}

export function MistakeTagChart({ tickets }) {
  const { rows, tags } = mistakeTagOverTime(tickets);
  return (
    <ChartPanel
      title="Mistake-Tag Frequency Over Time"
      note="Recurring mistake tags grouped by month."
    >
      {rows.length === 0 ? (
        <NoData />
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={rows}>
            <CartesianGrid stroke={GRID} />
            <XAxis dataKey="period" tick={AXIS} stroke={GRID} />
            <YAxis allowDecimals={false} tick={AXIS} stroke={GRID} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            {tags.map((tag, i) => (
              <Line
                key={tag}
                type="monotone"
                dataKey={tag}
                stroke={SERIES[i % SERIES.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartPanel>
  );
}
