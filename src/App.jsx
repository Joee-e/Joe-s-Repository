import { useState, useEffect, useRef, useCallback } from 'react'
import Analytics from './Analytics.jsx'

const STORAGE_KEY = 'q2planner_v1'

const MONTHS = [
  { label: 'March', key: 'mar', days: 31, year: 2026, month: 2 },
  { label: 'April', key: 'apr', days: 30, year: 2026, month: 3 },
  { label: 'May', key: 'may', days: 31, year: 2026, month: 4 },
  { label: 'June', key: 'jun', days: 30, year: 2026, month: 5 },
]

const TASK_COLORS = ['#F4A7B9', '#A7D8F4', '#B9F4A7', '#F4D4A7', '#D4A7F4', '#F4F4A7']

const PROGRESS_OPTIONS = ['Not started', 'In Progress', 'Review', 'Done']

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveTasks(tasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
}

/* ─── Swipeable Card ─── */
function TaskCard({ task, onDelete, onToggleDone, onEdit }) {
  const ref = useRef(null)
  const startX = useRef(0)
  const currentX = useRef(0)
  const swiping = useRef(false)
  const [offset, setOffset] = useState(0)

  const onTouchStart = (e) => {
    startX.current = e.touches[0].clientX
    swiping.current = true
  }
  const onTouchMove = (e) => {
    if (!swiping.current) return
    currentX.current = e.touches[0].clientX
    const diff = currentX.current - startX.current
    setOffset(diff)
  }
  const onTouchEnd = () => {
    swiping.current = false
    if (offset < -80) { onDelete(task.id) }
    else if (offset > 80) { onToggleDone(task.id) }
    setOffset(0)
  }

  const progressColor = {
    'Not started': '#666',
    'In Progress': '#F4D4A7',
    'Review': '#A7D8F4',
    'Done': '#B9F4A7',
  }[task.progress] || '#666'

  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 12, marginBottom: 10 }}>
      {/* Swipe backgrounds */}
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
        justifyContent: offset > 0 ? 'flex-start' : 'flex-end',
        background: offset > 0 ? '#2d5a2d' : '#5a2d2d',
        padding: '0 20px', color: '#fff', fontFamily: 'DM Sans', fontSize: 14,
      }}>
        {offset > 0 ? '✓ Done' : '✕ Delete'}
      </div>
      <div
        ref={ref}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={() => onEdit(task)}
        style={{
          position: 'relative',
          transform: `translateX(${offset}px)`,
          transition: swiping.current ? 'none' : 'transform 0.3s',
          background: '#111', border: '1px solid #1a1a1a', borderRadius: 12,
          padding: '14px 16px', cursor: 'pointer',
          borderLeft: `4px solid ${task.color || '#F4A7B9'}`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{
            fontFamily: 'DM Sans', fontSize: 15, fontWeight: 600,
            color: task.done ? '#666' : '#eee',
            textDecoration: task.done ? 'line-through' : 'none',
          }}>{task.title}</span>
          <span style={{
            fontFamily: 'DM Sans', fontSize: 11, padding: '2px 8px',
            borderRadius: 20, background: progressColor + '22', color: progressColor,
          }}>{task.progress}</span>
        </div>
        {task.content && (
          <div style={{ fontFamily: 'DM Sans', fontSize: 13, color: '#888', marginTop: 6, lineHeight: 1.4 }}>
            {task.content}
          </div>
        )}
        <div style={{ display: 'flex', gap: 12, marginTop: 8, alignItems: 'center' }}>
          {task.ddl && (
            <span style={{ fontFamily: 'DM Sans', fontSize: 11, color: '#999' }}>
              DDL: {task.ddl}
            </span>
          )}
          {task.recurring && (
            <span style={{ fontFamily: 'DM Sans', fontSize: 11, color: '#F4A7B9' }}>
              ↻ Weekly
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Search with Highlight ─── */
function HighlightText({ text, query }) {
  if (!query || !text) return <>{text}</>
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  const parts = text.split(regex)
  return <>
    {parts.map((part, i) =>
      regex.test(part)
        ? <mark key={i} style={{ background: '#F4A7B9', color: '#000', borderRadius: 2, padding: '0 1px' }}>{part}</mark>
        : <span key={i}>{part}</span>
    )}
  </>
}

/* ─── Add/Edit Modal ─── */
function TaskModal({ task, onSave, onClose }) {
  const [title, setTitle] = useState(task?.title || '')
  const [content, setContent] = useState(task?.content || '')
  const [progress, setProgress] = useState(task?.progress || 'Not started')
  const [ddl, setDdl] = useState(task?.ddl || '')
  const [color, setColor] = useState(task?.color || TASK_COLORS[0])
  const [recurring, setRecurring] = useState(task?.recurring || false)

  const handleSave = () => {
    if (!title.trim()) return
    onSave({ title: title.trim(), content, progress, ddl, color, recurring })
  }

  const inputStyle = {
    width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8,
    border: '1px solid #1a1a1a', background: '#0C0C0C', color: '#eee',
    fontFamily: 'DM Sans', fontSize: 14, outline: 'none',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: '#111', border: '1px solid #1a1a1a', borderRadius: 16,
        padding: 24, width: '100%', maxWidth: 420,
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontFamily: 'Cormorant Garamond', color: '#F4A7B9', margin: '0 0 20px', fontSize: 22 }}>
          {task ? 'Edit Task' : 'New Task'}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} />
          <textarea placeholder="Content (optional)" value={content} onChange={e => setContent(e.target.value)}
            rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          <select value={progress} onChange={e => setProgress(e.target.value)} style={inputStyle}>
            {PROGRESS_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <input type="date" value={ddl} onChange={e => setDdl(e.target.value)} style={inputStyle} />
          <div style={{ display: 'flex', gap: 8 }}>
            {TASK_COLORS.map(c => (
              <div key={c} onClick={() => setColor(c)} style={{
                width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer',
                border: color === c ? '3px solid #fff' : '3px solid transparent',
              }} />
            ))}
          </div>
          {/* Recurring toggle - only for new tasks */}
          {!task && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: 'DM Sans', fontSize: 14, color: '#ccc' }}>Repeat weekly</span>
              <div onClick={() => setRecurring(!recurring)} style={{
                width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
                background: recurring ? '#F4A7B9' : '#333', position: 'relative',
                transition: 'background 0.2s',
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', background: '#fff',
                  position: 'absolute', top: 3,
                  left: recurring ? 23 : 3, transition: 'left 0.2s',
                }} />
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button onClick={onClose} style={{
              flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #333',
              background: 'transparent', color: '#999', fontFamily: 'DM Sans', cursor: 'pointer',
            }}>Cancel</button>
            <button onClick={handleSave} style={{
              flex: 1, padding: '10px', borderRadius: 8, border: 'none',
              background: '#F4A7B9', color: '#000', fontFamily: 'DM Sans', fontWeight: 600, cursor: 'pointer',
            }}>Save</button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Main App ─── */
export default function App() {
  const [tasks, setTasks] = useState(loadTasks)
  const [monthIdx, setMonthIdx] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [editTask, setEditTask] = useState(null)
  const [activeTab, setActiveTab] = useState('planner')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => { saveTasks(tasks) }, [tasks])

  const currentMonth = MONTHS[monthIdx]

  const addTask = ({ title, content, progress, ddl, color, recurring }) => {
    const baseTask = {
      id: generateId(), title, content, progress, ddl, color,
      done: progress === 'Done',
      month: currentMonth.key,
      createdAt: new Date().toISOString(),
    }
    const newTasks = [baseTask]

    if (recurring) {
      baseTask.recurring = true
      const baseDate = ddl ? new Date(ddl) : new Date()
      for (let w = 2; w <= 9; w++) {
        const futureDate = new Date(baseDate)
        futureDate.setDate(futureDate.getDate() + 7 * (w - 1))
        const futureMonth = MONTHS.find(m => m.month === futureDate.getMonth())
        newTasks.push({
          id: generateId() + w,
          title: `${title} W${w}`,
          content, progress: 'Not started', color,
          ddl: futureDate.toISOString().split('T')[0],
          done: false,
          month: futureMonth ? futureMonth.key : currentMonth.key,
          createdAt: new Date().toISOString(),
          recurring: true,
        })
      }
    }
    setTasks(prev => [...prev, ...newTasks])
    setShowModal(false)
  }

  const updateTask = ({ title, content, progress, ddl, color }) => {
    setTasks(prev => prev.map(t =>
      t.id === editTask.id
        ? { ...t, title, content, progress, ddl, color, done: progress === 'Done' }
        : t
    ))
    setEditTask(null)
    setShowModal(false)
  }

  const deleteTask = (id) => {
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  const toggleDone = (id) => {
    setTasks(prev => prev.map(t =>
      t.id === id ? { ...t, done: !t.done, progress: t.done ? 'Not started' : 'Done' } : t
    ))
  }

  const filteredTasks = tasks
    .filter(t => t.month === currentMonth.key)
    .filter(t => {
      if (!searchQuery) return true
      const q = searchQuery.toLowerCase()
      return (t.title || '').toLowerCase().includes(q) || (t.content || '').toLowerCase().includes(q)
    })

  const isAnalytics = activeTab === 'analytics'

  return (
    <div style={{
      minHeight: '100vh', background: '#0C0C0C', color: '#eee',
      fontFamily: 'DM Sans, sans-serif', paddingBottom: 70,
    }}>
      {/* ─── Top Bar ─── */}
      <div style={{
        padding: '16px 20px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', borderBottom: '1px solid #1a1a1a',
      }}>
        <h1 style={{
          fontFamily: 'Cormorant Garamond', fontSize: 26, fontWeight: 700,
          color: '#F4A7B9', margin: 0,
        }}>Q2 2026</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Search icon */}
          <button onClick={() => { setSearchOpen(!searchOpen); setSearchQuery('') }} style={{
            background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: 20, padding: 4,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
          </button>
          {!isAnalytics && (
            <button onClick={() => { setEditTask(null); setShowModal(true) }} style={{
              background: '#F4A7B9', color: '#000', border: 'none', borderRadius: 8,
              padding: '8px 16px', fontFamily: 'DM Sans', fontWeight: 600, cursor: 'pointer', fontSize: 14,
            }}>+ Add</button>
          )}
        </div>
      </div>

      {/* ─── Search Bar ─── */}
      {searchOpen && (
        <div style={{ padding: '0 20px 12px', borderBottom: '1px solid #1a1a1a' }}>
          <input
            autoFocus placeholder="Search tasks..."
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 8,
              border: '1px solid #333', background: '#111', color: '#eee',
              fontFamily: 'DM Sans', fontSize: 14, outline: 'none',
            }}
          />
        </div>
      )}

      {/* ─── Month Switcher ─── */}
      {!isAnalytics && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 20, padding: '16px 20px',
        }}>
          <button onClick={() => setMonthIdx(Math.max(0, monthIdx - 1))} disabled={monthIdx === 0}
            style={{
              background: 'none', border: 'none', color: monthIdx === 0 ? '#333' : '#F4A7B9',
              fontSize: 22, cursor: 'pointer',
            }}>‹</button>
          <span style={{
            fontFamily: 'Cormorant Garamond', fontSize: 22, fontWeight: 600, color: '#eee',
            minWidth: 100, textAlign: 'center',
          }}>{currentMonth.label}</span>
          <button onClick={() => setMonthIdx(Math.min(MONTHS.length - 1, monthIdx + 1))}
            disabled={monthIdx === MONTHS.length - 1}
            style={{
              background: 'none', border: 'none',
              color: monthIdx === MONTHS.length - 1 ? '#333' : '#F4A7B9',
              fontSize: 22, cursor: 'pointer',
            }}>›</button>
        </div>
      )}

      {/* ─── Content ─── */}
      {isAnalytics ? (
        <Analytics tasks={tasks} />
      ) : (
        <div style={{ padding: '0 20px' }}>
          {filteredTasks.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '60px 20px', color: '#555',
              fontFamily: 'DM Sans', fontSize: 15,
            }}>
              {searchQuery ? 'No matching tasks' : 'No tasks yet. Tap + Add to create one.'}
            </div>
          ) : (
            filteredTasks.map(task => (
              <TaskCard
                key={task.id}
                task={searchQuery ? {
                  ...task,
                  title: <HighlightText text={task.title} query={searchQuery} />,
                  content: <HighlightText text={task.content} query={searchQuery} />,
                  _rawTitle: task.title,
                } : task}
                onDelete={deleteTask}
                onToggleDone={toggleDone}
                onEdit={(t) => { setEditTask(task); setShowModal(true) }}
              />
            ))
          )}
        </div>
      )}

      {/* ─── Bottom Tab Bar ─── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#111', borderTop: '1px solid #1a1a1a',
        display: 'flex', height: 56, zIndex: 900,
      }}>
        <button onClick={() => setActiveTab('planner')} style={{
          flex: 1, background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
          color: activeTab === 'planner' ? '#F4A7B9' : '#666',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <rect x="3" y="3" width="7" height="7" rx="1.5"/>
            <rect x="14" y="3" width="7" height="7" rx="1.5"/>
            <rect x="3" y="14" width="7" height="7" rx="1.5"/>
            <rect x="14" y="14" width="7" height="7" rx="1.5"/>
          </svg>
          <span style={{ fontFamily: 'DM Sans', fontSize: 11, fontWeight: 600 }}>Planner</span>
        </button>
        <button onClick={() => setActiveTab('analytics')} style={{
          flex: 1, background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
          color: activeTab === 'analytics' ? '#F4A7B9' : '#666',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <rect x="3" y="12" width="4" height="9" rx="1"/>
            <rect x="10" y="7" width="4" height="14" rx="1"/>
            <rect x="17" y="3" width="4" height="18" rx="1"/>
          </svg>
          <span style={{ fontFamily: 'DM Sans', fontSize: 11, fontWeight: 600 }}>Analytics</span>
        </button>
      </div>

      {/* ─── Modal ─── */}
      {showModal && (
        <TaskModal
          task={editTask}
          onSave={editTask ? updateTask : addTask}
          onClose={() => { setShowModal(false); setEditTask(null) }}
        />
      )}
    </div>
  )
}
