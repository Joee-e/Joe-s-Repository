import { useMemo } from 'react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

const MONTHS = [
  { key: 'mar', label: 'Mar', month: 2, year: 2026 },
  { key: 'apr', label: 'Apr', month: 3, year: 2026 },
  { key: 'may', label: 'May', month: 4, year: 2026 },
  { key: 'jun', label: 'Jun', month: 5, year: 2026 },
]

const STATUS_COLORS = {
  'Not started': '#666',
  'In Progress': '#F4D4A7',
  'Review': '#A7D8F4',
  'Done': '#B9F4A7',
}

const cardStyle = {
  background: '#111', border: '1px solid #1a1a1a', borderRadius: 14, padding: 20,
}

function getWeekOfMonth(date) {
  const d = new Date(date)
  return Math.ceil(d.getDate() / 7)
}

function getWeeksForMonth(m) {
  const weeks = []
  for (let w = 1; w <= Math.ceil(m.label === 'Mar' || m.label === 'May' ? 31 / 7 : 30 / 7); w++) {
    weeks.push({ key: `${m.label} W${w}`, monthKey: m.key, week: w })
  }
  return weeks
}

function daysRemaining(ddl) {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const due = new Date(ddl)
  due.setHours(0, 0, 0, 0)
  return Math.ceil((due - now) / (1000 * 60 * 60 * 24))
}

function urgencyColor(days) {
  if (days < 0) return '#e74c3c'
  if (days === 0) return '#e74c3c'
  if (days <= 3) return '#c0457b'
  if (days <= 7) return '#f0c040'
  return '#4caf50'
}

function exportCSV(tasks) {
  const header = 'title,content,progress,ddl,color,done'
  const escape = (s) => `"${(s || '').replace(/"/g, '""')}"`
  const rows = tasks.map(t =>
    [escape(t.title), escape(t.content), escape(t.progress), escape(t.ddl), escape(t.color), t.done].join(',')
  )
  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'q2-planner-export.csv'
  a.click()
  URL.revokeObjectURL(url)
}

/* Custom donut center label */
function CenterLabel({ viewBox, value }) {
  const { cx, cy } = viewBox
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
      <tspan x={cx} y={cy - 8} style={{ fontFamily: 'Cormorant Garamond', fontSize: 28, fill: '#eee', fontWeight: 700 }}>
        {value}
      </tspan>
      <tspan x={cx} y={cy + 16} style={{ fontFamily: 'DM Sans', fontSize: 11, fill: '#888' }}>
        tasks
      </tspan>
    </text>
  )
}

export default function Analytics({ tasks }) {
  const stats = useMemo(() => {
    const total = tasks.length
    const done = tasks.filter(t => t.done).length
    const completionRate = total ? Math.round((done / total) * 100) : 0

    // This week
    const now = new Date()
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay())
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 7)
    const thisWeekTasks = tasks.filter(t => {
      const created = new Date(t.createdAt)
      return created >= weekStart && created < weekEnd
    })
    const weekRate = thisWeekTasks.length
      ? Math.round((thisWeekTasks.filter(t => t.done).length / thisWeekTasks.length) * 100)
      : 0

    // Overdue
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const overdue = tasks.filter(t => !t.done && t.ddl && new Date(t.ddl) < today).length

    return { total, completionRate, weekRate, overdue }
  }, [tasks])

  // Monthly completion data
  const monthlyCompletion = useMemo(() =>
    MONTHS.map(m => {
      const mt = tasks.filter(t => t.month === m.key)
      const done = mt.filter(t => t.done).length
      return { name: m.label, rate: mt.length ? Math.round((done / mt.length) * 100) : 0 }
    }), [tasks])

  // Weekly completion data
  const weeklyCompletion = useMemo(() => {
    const weeks = MONTHS.flatMap(getWeeksForMonth)
    return weeks.map(w => {
      const wt = tasks.filter(t => {
        if (t.month !== w.monthKey) return false
        const created = new Date(t.createdAt)
        return getWeekOfMonth(created) === w.week
      })
      const done = wt.filter(t => t.done).length
      return { name: w.key, rate: wt.length ? Math.round((done / wt.length) * 100) : 0 }
    })
  }, [tasks])

  // Monthly stacked bar data
  const monthlyStacked = useMemo(() =>
    MONTHS.map(m => {
      const mt = tasks.filter(t => t.month === m.key)
      return {
        name: m.label,
        'Not started': mt.filter(t => t.progress === 'Not started').length,
        'In Progress': mt.filter(t => t.progress === 'In Progress').length,
        'Review': mt.filter(t => t.progress === 'Review').length,
        'Done': mt.filter(t => t.progress === 'Done').length,
      }
    }), [tasks])

  // Status distribution for donut
  const statusData = useMemo(() =>
    Object.entries(STATUS_COLORS).map(([name, color]) => ({
      name, value: tasks.filter(t => t.progress === name).length, color,
    })).filter(d => d.value > 0), [tasks])

  // DDL urgency list
  const urgentTasks = useMemo(() =>
    tasks
      .filter(t => !t.done && t.ddl)
      .sort((a, b) => new Date(a.ddl) - new Date(b.ddl))
      .map(t => ({ ...t, _days: daysRemaining(t.ddl) })),
    [tasks])

  const metricCards = [
    { label: 'Total Tasks', value: stats.total },
    { label: 'Completion', value: `${stats.completionRate}%` },
    { label: 'This Week', value: `${stats.weekRate}%` },
    { label: 'Overdue', value: stats.overdue, alert: stats.overdue > 0 },
  ]

  return (
    <div style={{ padding: '0 20px 100px' }}>
      {/* ─── Metric Cards ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 24 }}>
        {metricCards.map(c => (
          <div key={c.label} style={cardStyle}>
            <div style={{ fontFamily: 'DM Sans', fontSize: 12, color: '#888', marginBottom: 6 }}>{c.label}</div>
            <div style={{
              fontFamily: 'Cormorant Garamond', fontSize: 32, fontWeight: 700,
              color: c.alert ? '#e74c3c' : '#F4A7B9',
            }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* ─── Monthly Completion Line Chart ─── */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <h3 style={{ fontFamily: 'Cormorant Garamond', color: '#F4A7B9', margin: '0 0 16px', fontSize: 18 }}>
          Monthly Completion Rate
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={monthlyCompletion}>
            <CartesianGrid strokeDasharray="3 3" stroke="#222" />
            <XAxis dataKey="name" stroke="#666" style={{ fontFamily: 'DM Sans', fontSize: 12 }} />
            <YAxis domain={[0, 100]} stroke="#666" style={{ fontFamily: 'DM Sans', fontSize: 12 }} tickFormatter={v => `${v}%`} />
            <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, fontFamily: 'DM Sans' }}
              formatter={v => [`${v}%`, 'Rate']} />
            <Line type="monotone" dataKey="rate" stroke="#F4A7B9" strokeWidth={2.5} dot={{ fill: '#F4A7B9', r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ─── Weekly Completion Line Chart ─── */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <h3 style={{ fontFamily: 'Cormorant Garamond', color: '#F4A7B9', margin: '0 0 16px', fontSize: 18 }}>
          Weekly Completion Rate
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={weeklyCompletion}>
            <CartesianGrid strokeDasharray="3 3" stroke="#222" />
            <XAxis dataKey="name" stroke="#666" style={{ fontFamily: 'DM Sans', fontSize: 10 }} angle={-45} textAnchor="end" height={50} />
            <YAxis domain={[0, 100]} stroke="#666" style={{ fontFamily: 'DM Sans', fontSize: 12 }} tickFormatter={v => `${v}%`} />
            <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, fontFamily: 'DM Sans' }}
              formatter={v => [`${v}%`, 'Rate']} />
            <Line type="monotone" dataKey="rate" stroke="#A7D8F4" strokeWidth={2} dot={{ fill: '#A7D8F4', r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ─── Monthly Stacked Bar ─── */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <h3 style={{ fontFamily: 'Cormorant Garamond', color: '#F4A7B9', margin: '0 0 16px', fontSize: 18 }}>
          Monthly Task Volume
        </h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={monthlyStacked}>
            <CartesianGrid strokeDasharray="3 3" stroke="#222" />
            <XAxis dataKey="name" stroke="#666" style={{ fontFamily: 'DM Sans', fontSize: 12 }} />
            <YAxis stroke="#666" style={{ fontFamily: 'DM Sans', fontSize: 12 }} />
            <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, fontFamily: 'DM Sans' }} />
            <Legend wrapperStyle={{ fontFamily: 'DM Sans', fontSize: 11 }} />
            {Object.entries(STATUS_COLORS).map(([key, color]) => (
              <Bar key={key} dataKey={key} stackId="a" fill={color} radius={key === 'Done' ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ─── Status Donut ─── */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <h3 style={{ fontFamily: 'Cormorant Garamond', color: '#F4A7B9', margin: '0 0 16px', fontSize: 18 }}>
          Status Distribution
        </h3>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={statusData} dataKey="value" nameKey="name"
              cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={3}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={{ stroke: '#444' }}
              style={{ fontFamily: 'DM Sans', fontSize: 11 }}
            >
              {statusData.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            <Pie data={[{ value: 1 }]} dataKey="value" cx="50%" cy="50%" innerRadius={0} outerRadius={0}>
              <Cell fill="transparent" />
              <CenterLabel viewBox={{ cx: 0, cy: 0 }} value={stats.total} />
            </Pie>
            <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, fontFamily: 'DM Sans' }} />
          </PieChart>
        </ResponsiveContainer>
        {/* Center text overlay */}
        <div style={{
          position: 'relative', marginTop: -170, textAlign: 'center', pointerEvents: 'none', height: 0,
        }}>
          <div style={{ fontFamily: 'Cormorant Garamond', fontSize: 32, fontWeight: 700, color: '#eee' }}>
            {stats.total}
          </div>
          <div style={{ fontFamily: 'DM Sans', fontSize: 12, color: '#888' }}>tasks</div>
        </div>
      </div>

      {/* ─── DDL Urgency List ─── */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <h3 style={{ fontFamily: 'Cormorant Garamond', color: '#F4A7B9', margin: '0 0 16px', fontSize: 18 }}>
          Deadline Urgency
        </h3>
        {urgentTasks.length === 0 ? (
          <div style={{ fontFamily: 'DM Sans', fontSize: 14, color: '#555', textAlign: 'center', padding: 20 }}>
            No upcoming deadlines
          </div>
        ) : (
          urgentTasks.map(t => {
            const color = urgencyColor(t._days)
            const maxDays = 30
            const progress = Math.max(0, Math.min(1, 1 - t._days / maxDays))
            return (
              <div key={t.id} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontFamily: 'DM Sans', fontSize: 14, color: '#ddd' }}>{t.title}</span>
                  <span style={{
                    fontFamily: 'DM Sans', fontSize: 12, fontWeight: 600,
                    color, background: color + '22', padding: '2px 8px', borderRadius: 10,
                  }}>
                    {t._days < 0 ? `${Math.abs(t._days)}d overdue` : t._days === 0 ? 'Today' : `${t._days}d left`}
                  </span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: '#222', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 3, width: `${progress * 100}%`,
                    background: `linear-gradient(90deg, ${color}88, ${color})`,
                    transition: 'width 0.5s',
                  }} />
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ─── Export CSV Button ─── */}
      <button onClick={() => exportCSV(tasks)} style={{
        width: '100%', padding: '14px', borderRadius: 12, border: '1px solid #1a1a1a',
        background: '#111', color: '#F4A7B9', fontFamily: 'DM Sans', fontWeight: 600,
        fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center',
        justifyContent: 'center', gap: 8,
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Export CSV
      </button>
    </div>
  )
}
