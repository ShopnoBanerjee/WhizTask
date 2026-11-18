'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

// The working pieces of the landing page. Each one is a real fragment of the
// product's interface (root marked data-ui) driven by the same sums the app
// uses, so every figure on the page is computed, not typed in.
//
// All clients, people and amounts here are SAMPLE DATA for the demo.

const WORKING_HOURS_PER_MONTH = 22 * 8 // the app's own rule: 22 days × 8 hours

const rupees = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value)

// ============ motion: reveal on scroll ============

// Marks <html> so the CSS may hide [data-reveal] elements, then shows each one
// as it enters. If this never runs, nothing is hidden.
export function LandingMotion() {
  useEffect(() => {
    const root = document.documentElement
    root.classList.add('lp-js')

    const items = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))
    const show = (el: Element) => el.classList.add('is-in')

    if (!('IntersectionObserver' in window)) {
      items.forEach(show)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            show(entry.target)
            observer.unobserve(entry.target)
          }
        })
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    )
    items.forEach((el) => observer.observe(el))

    return () => {
      observer.disconnect()
      root.classList.remove('lp-js')
    }
  }, [])

  return null
}

// ============ hero: the client ledger ============

interface LedgerClient {
  name: string
  retainer: number
  software: number
  overhead: number
  hours: { november: number; october: number }
}

const BLENDED_RATE = 256 // ₹45,056 a month ÷ 176 hours

const LEDGER: LedgerClient[] = [
  { name: 'Northline Realty', retainer: 90000, software: 4000, overhead: 9000, hours: { november: 118, october: 104 } },
  { name: 'Meridian Dental', retainer: 60000, software: 2000, overhead: 6000, hours: { november: 62, october: 70 } },
  { name: 'Kettle & Crumb', retainer: 40000, software: 1500, overhead: 4000, hours: { november: 96, october: 58 } },
  { name: 'Bolt Cycles', retainer: 25000, software: 1000, overhead: 2500, hours: { november: 40, october: 44 } },
  { name: 'Saffron Travels', retainer: 14000, software: 500, overhead: 1400, hours: { november: 71, october: 36 } },
]

type Month = 'november' | 'october'

function ledgerRow(client: LedgerClient, month: Month) {
  const hours = client.hours[month]
  const labour = hours * BLENDED_RATE
  const net = client.retainer - labour - client.software - client.overhead
  return { ...client, hours, labour, net, margin: (net / client.retainer) * 100 }
}

export function HeroLedger() {
  const [month, setMonth] = useState<Month>('november')
  const [open, setOpen] = useState<string | null>('Saffron Travels')

  const rows = LEDGER.map((client) => ledgerRow(client, month))
  const worst = rows.reduce((a, b) => (b.net < a.net ? b : a))

  return (
    <div data-ui className="ui-ledger">
      <div className="ui-head">
        <span className="ui-title">Client profitability</span>
        <div className="ui-seg" role="group" aria-label="Month">
          {(['october', 'november'] as Month[]).map((m) => (
            <button key={m} type="button" aria-pressed={month === m} onClick={() => setMonth(m)}>
              {m === 'october' ? 'October' : 'November'}
            </button>
          ))}
        </div>
      </div>

      {worst.net < 0 ? (
        <p className="ui-finding">
          {worst.name} took {worst.hours} hours on a {rupees(worst.retainer)} retainer: a loss of{' '}
          {rupees(Math.abs(worst.net))}.
        </p>
      ) : (
        <p className="ui-finding" style={{ background: '#172a1d', color: '#86efac' }}>
          Every client covered its hours this month. Lowest margin: {worst.name} at {worst.margin.toFixed(0)}%.
        </p>
      )}

      <table>
        <thead>
          <tr>
            <th scope="col">Client</th>
            <th scope="col">Retainer</th>
            <th scope="col">Hours</th>
            <th scope="col">Labour</th>
            <th scope="col">Net</th>
            <th scope="col">Margin</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const selected = open === row.name
            return [
              <tr
                key={row.name}
                aria-selected={selected}
                tabIndex={0}
                onClick={() => setOpen(selected ? null : row.name)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setOpen(selected ? null : row.name)
                  }
                }}
              >
                <td style={{ fontWeight: 500 }}>{row.name}</td>
                <td className="ui-num">{rupees(row.retainer)}</td>
                <td className="ui-num ui-muted">{row.hours}</td>
                <td className="ui-num ui-muted">{rupees(row.labour)}</td>
                <td className={`ui-num ${row.net < 0 ? 'ui-neg' : ''}`} style={{ fontWeight: 500 }}>
                  {row.net < 0 ? '−' : ''}
                  {rupees(Math.abs(row.net))}
                </td>
                <td className={`ui-num ${row.net < 0 ? 'ui-neg' : 'ui-muted'}`}>{row.margin.toFixed(0)}%</td>
              </tr>,
              selected && (
                <tr key={`${row.name}-detail`} className="ui-breakdown" aria-selected="true">
                  <td colSpan={6}>
                    {rupees(row.retainer)} retainer − {row.hours} h × {rupees(BLENDED_RATE)} − {rupees(row.software)}{' '}
                    software − {rupees(row.overhead)} overhead
                  </td>
                </tr>
              ),
            ]
          })}
        </tbody>
      </table>
    </div>
  )
}

// ============ how it works: one task, three states ============

const JOURNEY = [
  {
    lead: 'First, a task goes to a client and a department.',
    note: 'Every task belongs to one client, so the hours spent on it land on that client’s account.',
  },
  {
    lead: 'Then split it across the people doing it.',
    note: 'Each subtask has its own department, person and deadline. The task is due when its last subtask is.',
  },
  {
    lead: 'Last, each person logs the hours it took.',
    note: 'Time goes onto a 24-hour day against the subtask, and is costed at that person’s hourly rate.',
  },
]

const SUBTASKS = [
  { title: 'Write the three captions', person: 'Priya', department: 'Content', due: 'Nov 20', minutes: 90 },
  { title: 'Design the carousel', person: 'Arjun', department: 'Design', due: 'Nov 22', minutes: 240 },
  { title: 'Schedule and report', person: 'Neha', department: 'Posting & Reporting', due: 'Nov 25', minutes: 120 },
]

const hoursLabel = (minutes: number) => {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} h` : `${h} h ${m} m`
}

export function TaskJourney() {
  const [active, setActive] = useState(0)
  const steps = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const pick = () => {
      const middle = window.innerHeight / 2
      let best = 0
      let bestDistance = Infinity
      steps.current.forEach((el, i) => {
        if (!el) return
        const rect = el.getBoundingClientRect()
        const distance = Math.abs(rect.top + rect.height / 2 - middle)
        if (distance < bestDistance) {
          bestDistance = distance
          best = i
        }
      })
      setActive(best)
    }
    pick()
    window.addEventListener('scroll', pick, { passive: true })
    window.addEventListener('resize', pick)
    return () => {
      window.removeEventListener('scroll', pick)
      window.removeEventListener('resize', pick)
    }
  }, [])

  const split = active >= 1
  const logged = active >= 2
  const totalMinutes = SUBTASKS.reduce((sum, s) => sum + s.minutes, 0)
  const cost = Math.round((totalMinutes / 60) * BLENDED_RATE)

  return (
    <div className="lp-how">
      <div className="lp-how-copy">
        {JOURNEY.map((step, i) => (
          <div
            key={step.lead}
            ref={(el) => {
              steps.current[i] = el
            }}
            className="lp-how-step"
            data-active={active === i}
          >
            <p className="lp-lead lp-how-lead">{step.lead}</p>
            <p className="lp-how-note">{step.note}</p>
          </div>
        ))}
      </div>

      <div className="lp-how-stage">
        <div data-ui className="ui-task" aria-live="polite">
          <div className="ui-task-row" style={{ justifyContent: 'space-between' }}>
            <span className="ui-title">Diwali campaign, week two</span>
            <span className="ui-pill" style={{ background: logged ? '#172a1d' : '#2b2503', color: logged ? '#86efac' : '#f3e27a' }}>
              {logged ? 'Completed' : split ? 'In progress' : 'Pending'}
            </span>
          </div>
          <p className="ui-muted" style={{ margin: '2px 0 14px' }}>
            Meridian Dental
          </p>

          <div className="ui-task-row" style={{ flexWrap: 'wrap' }}>
            <span className="ui-pill" style={{ background: 'rgb(236 72 153 / 0.15)', color: '#f9a8d4' }}>
              {split ? 'Content' : 'Design'}
            </span>
            <span className="ui-muted">
              Due {split ? 'Nov 25' : 'Nov 22'}
              {split ? ' · set by the last subtask' : ' · unassigned'}
            </span>
          </div>

          <div style={{ marginTop: 14, position: 'relative' }}>
            {/* before the split the task is one piece of work: say so instead of leaving a hole */}
            <div className="ui-empty" data-show={!split}>
              One piece of work for now.
              <br />
              Split it when more than one person is needed.
            </div>
            {SUBTASKS.map((sub, i) => (
              <div key={sub.title} className="ui-sub" data-show={split} style={{ transitionDelay: `${i * 90}ms` }}>
                <span className="ui-check" data-done={logged} />
                <div>
                  <div style={{ fontWeight: 500 }}>{sub.title}</div>
                  <div className="ui-muted" style={{ fontSize: 13 }}>
                    {sub.person} · {sub.department} · {sub.due}
                  </div>
                </div>
                <span className="ui-num" style={{ fontSize: 13, color: logged ? '#f5f5f5' : '#a3a3a3' }}>
                  {logged ? hoursLabel(sub.minutes) : '—'}
                </span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 16 }}>
            <div className="ui-progress">
              <span style={{ transform: `scaleX(${logged ? 1 : 0})` }} />
            </div>
            <div className="ui-task-row ui-muted" style={{ justifyContent: 'space-between', marginTop: 8, fontSize: 13 }}>
              <span>{logged ? '3 of 3 subtasks done' : split ? '0 of 3 subtasks done' : 'No subtasks yet'}</span>
              <span className="ui-num">
                {logged ? `${hoursLabel(totalMinutes)} · ${rupees(cost)} of labour` : 'No time logged'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============ the sum: type your own numbers ============

function NumberField({
  value,
  onChange,
  label,
  narrow,
  max,
}: {
  value: number
  onChange: (value: number) => void
  label: string
  narrow?: boolean
  max: number
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      max={max}
      aria-label={label}
      className={narrow ? 'lp-narrow' : undefined}
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => onChange(Math.min(max, Math.max(0, Number(e.target.value) || 0)))}
    />
  )
}

export function MarginSum() {
  const [retainer, setRetainer] = useState(60000)
  const [salary, setSalary] = useState(45000)
  const [hours, setHours] = useState(62)
  const [other, setOther] = useState(8000)

  // The same sum the app runs: salary ÷ 176 hours, hours × rate, taken off the retainer
  const rate = salary / WORKING_HOURS_PER_MONTH
  const labour = Math.round(hours * rate)
  const net = retainer - labour - other
  const margin = retainer > 0 ? (net / retainer) * 100 : 0
  const breakEvenHours = rate > 0 ? Math.max(0, Math.floor((retainer - other) / rate)) : 0

  return (
    <section id="sum" className="lp-sum lp-section" aria-labelledby="sum-heading">
      <div className="lp-sum-in">
        <p className="lp-sum-sentence" data-reveal>
          The client pays ₹
          <NumberField value={retainer} onChange={setRetainer} label="Retainer per month in rupees" max={9999999} /> a
          month. The person on the account costs ₹
          <NumberField value={salary} onChange={setSalary} label="Salary per month in rupees" max={9999999} /> a month
          and logged <NumberField value={hours} onChange={setHours} label="Hours logged this month" narrow max={744} />{' '}
          hours on it. Software and overheads add ₹
          <NumberField value={other} onChange={setOther} label="Software and overheads in rupees" max={9999999} />.
        </p>
        <h2 id="sum-heading" className="lp-sum-half" aria-label="Hours in, margin out">
          Hours in,
        </h2>
      </div>

      <div className="lp-sum-out">
        <div data-ui className="ui-sum" data-reveal="scale" aria-live="polite">
          <div className="ui-sum-row">
            <span>Retainer</span>
            <span className="ui-num">{rupees(retainer)}</span>
          </div>
          <div className="ui-sum-row">
            <span>
              Hourly rate
              <br />
              <span className="ui-muted" style={{ fontSize: 13 }}>
                {rupees(salary)} ÷ {WORKING_HOURS_PER_MONTH} hours (22 days × 8)
              </span>
            </span>
            <span className="ui-num">₹{rate.toFixed(2)}</span>
          </div>
          <div className="ui-sum-row">
            <span>
              Labour
              <br />
              <span className="ui-muted" style={{ fontSize: 13 }}>
                {hours} h × ₹{rate.toFixed(2)}
              </span>
            </span>
            <span className="ui-num">−{rupees(labour)}</span>
          </div>
          <div className="ui-sum-row">
            <span>Software and overheads</span>
            <span className="ui-num">−{rupees(other)}</span>
          </div>
          <div className="ui-sum-row" style={{ alignItems: 'end', paddingTop: 16 }}>
            <span>
              What the client makes you
              <br />
              <span className="ui-muted" style={{ fontSize: 13 }}>
                {net < 0
                  ? `It stopped paying for itself after ${breakEvenHours} hours`
                  : `${margin.toFixed(1)}% margin · breaks even at ${breakEvenHours} hours`}
              </span>
            </span>
            <span className={`ui-num ui-sum-total ${net < 0 ? 'ui-neg' : ''}`}>
              {net < 0 ? '−' : ''}
              {rupees(Math.abs(net))}
            </span>
          </div>
        </div>
        <p className="lp-sum-half" aria-hidden="true">
          margin out.
        </p>
      </div>
    </section>
  )
}

// ============ roles: tabs and bands ============

const ROLES = [
  {
    id: 'admin',
    name: 'Admin',
    sub: 'Runs the agency',
    pages: [
      { page: 'Tasks', title: 'Create work and give it to anyone', note: 'Single tasks or split into subtasks across departments', scope: 'Everyone’s tasks' },
      { page: 'History', title: 'See what changed and when', note: 'Filter by date, client or person, including subtask work', scope: 'Whole organization' },
      { page: 'Analytics', title: 'Read revenue, cost and margin per client', note: 'Salaries turn logged hours into labour cost', scope: 'Admins only' },
      { page: 'Clients', title: 'Keep retainers, software and overheads', note: 'Retainership or project basis, with an audit log', scope: 'Admins only' },
      { page: 'Members', title: 'Remove or restore someone’s access', note: 'Their tasks and time logs are kept', scope: 'Everyone' },
    ],
  },
  {
    id: 'client_servicing',
    name: 'Client servicing',
    sub: 'Runs the accounts',
    pages: [
      { page: 'Tasks', title: 'Create work and give it to anyone', note: 'The same task screen the admin uses', scope: 'Everyone’s tasks' },
      { page: 'History', title: 'See what changed and when', note: 'Filter by date, client or person', scope: 'Whole organization' },
      { page: 'Members', title: 'Remove or restore access', note: 'For employees and other client servicing', scope: 'Not admins' },
      { page: 'My Tasks', title: 'Work through what is assigned to you', note: 'Opens on what is due from today', scope: 'Your own' },
      { page: 'Time Logger', title: 'Log the day against tasks', note: 'Drag a block onto a 24-hour timeline', scope: 'Your own' },
    ],
  },
  {
    id: 'employee',
    name: 'Employee',
    sub: 'Does the work',
    pages: [
      { page: 'My Tasks', title: 'See what is due, and add your own', note: 'Tasks you add are always assigned to you', scope: 'Your own' },
      { page: 'Time Logger', title: 'Log the day against tasks', note: 'Drag a block onto a 24-hour timeline; no overlaps', scope: 'Your own' },
      { page: 'History', title: 'Look back at what you finished', note: 'Completed tasks and subtasks, by date', scope: 'Your own' },
      { page: 'Profile', title: 'Choose the departments you work in', note: 'Ten departments, from Planning to Online Ads', scope: 'Your own' },
    ],
  },
]

export function RoleAgenda() {
  const [roleId, setRoleId] = useState('admin')
  const role = ROLES.find((r) => r.id === roleId) ?? ROLES[0]

  return (
    <div className="lp-roles">
      <div className="lp-tabs" role="tablist" aria-label="Roles">
        {ROLES.map((r) => (
          <button
            key={r.id}
            type="button"
            role="tab"
            id={`role-tab-${r.id}`}
            aria-selected={r.id === roleId}
            aria-controls="role-panel"
            className="lp-tab"
            onClick={() => setRoleId(r.id)}
          >
            {r.name}
            <small>{r.sub}</small>
          </button>
        ))}
      </div>

      <div className="lp-bands" role="tabpanel" id="role-panel" aria-labelledby={`role-tab-${role.id}`}>
        {role.pages.map((p) => (
          <div key={`${role.id}-${p.page}`} className="lp-band">
            <span className="lp-band-page">{p.page}</span>
            <span>
              <span className="lp-band-title">{p.title}</span>
              <br />
              <span className="lp-band-note">{p.note}</span>
            </span>
            <span className="lp-band-scope">{p.scope}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============ call to action: the first step, already open ============

export function StartDialog() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [role, setRole] = useState<'admin' | 'employee'>('admin')

  return (
    <form
      data-ui
      className="ui-dialog"
      onSubmit={(e) => {
        e.preventDefault()
        // Only the name and role travel in the link; email and password are
        // entered on the sign-up page itself
        const params = new URLSearchParams({ role })
        if (name.trim()) params.set('name', name.trim())
        router.push(`/auth/signup?${params.toString()}`)
      }}
    >
      <div className="ui-title">Create an account</div>
      <div className="ui-muted" style={{ marginTop: 2 }}>
        Then enter your organization’s code to join your team.
      </div>

      <label htmlFor="start-name">Full name</label>
      <input
        id="start-name"
        className="ui-field"
        autoComplete="name"
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <label id="start-role-label">Role</label>
      <div className="ui-seg" role="group" aria-labelledby="start-role-label">
        <button type="button" aria-pressed={role === 'admin'} onClick={() => setRole('admin')}>
          Admin
        </button>
        <button type="button" aria-pressed={role === 'employee'} onClick={() => setRole('employee')}>
          Employee
        </button>
      </div>

      <button type="submit" className="ui-btn ui-btn--primary" style={{ width: '100%', marginTop: 20 }}>
        Continue
      </button>
    </form>
  )
}

// ============ footer: the visitor's own clock ============

export function DayClock() {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    const tick = () => setNow(new Date())
    const first = window.setTimeout(tick, 0)
    const timer = window.setInterval(tick, 30000)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(timer)
    }
  }, [])

  // Rendered after mount only: the server does not know the visitor's clock
  if (!now) {
    return <span>A day is 1,440 minutes.</span>
  }

  const minutes = now.getHours() * 60 + now.getMinutes()
  const time = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

  return (
    <span>
      It is {time} where you are.
      <br />
      <span className="lp-muted">
        {minutes.toLocaleString('en-IN')} of today’s 1,440 minutes are gone.
      </span>
    </span>
  )
}
