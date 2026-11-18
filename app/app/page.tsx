import Link from 'next/link'
import './landing.css'
import {
  DayClock,
  HeroLedger,
  LandingMotion,
  MarginSum,
  RoleAgenda,
  StartDialog,
  TaskJourney,
} from '@/components/landing/landing-interactive'
import { DEPARTMENTS } from '@/types/database'
import { DEPARTMENT_COLOR_CLASSES, STATUS_COLOR_CLASSES } from '@/lib/taskColors'

// Landing page. The idea: WhizTask's own sum (salary ÷ 176 hours, hours × rate,
// taken off the retainer) is the page. Every picture is a working piece of the
// product's interface, and the visitor can type their own numbers into it.
//
// Sample data only: the clients, people and amounts shown are illustrative.

function Arrow({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 12h15M13 6l6 6-6 6" stroke="currentColor" strokeWidth={size > 30 ? 2 : 2.2} strokeLinecap="square" />
    </svg>
  )
}

export default function Page() {
  return (
    <div className="lp">
      <LandingMotion />

      {/* ---------- first screen ---------- */}
      <header className="lp-hero">
        <nav className="lp-nav" aria-label="Main">
          <Link href="/" className="lp-wordmark">
            WhizTask
          </Link>
          <div className="lp-nav-links">
            <a href="#how" className="lp-hide-phone">
              How it works
            </a>
            <a href="#sum" className="lp-hide-phone">
              The sum
            </a>
            <a href="#roles">Roles</a>
            <Link href="/auth/login">Sign in</Link>
          </div>
        </nav>

        <div className="lp-hero-copy">
          <h1 className="lp-display">
            Tasks, hours and
            <br />
            client profit.
          </h1>
          <p>
            WhizTask is the task tracker for agencies. Every hour your team logs is costed against the client it was
            for, so you can see which accounts pay for the work they take.
          </p>
          <Link href="/auth/signup" className="lp-btn">
            Create your account <Arrow />
          </Link>
        </div>

        <div className="lp-stage">
          <HeroLedger />
        </div>
      </header>

      <main>
        {/* ---------- how a task moves (pinned fragment) ---------- */}
        <section id="how" className="lp-section">
          <h2 className="lp-h2 lp-wrap" data-reveal>
            How a task moves
          </h2>
          <TaskJourney />
        </section>

        {/* ---------- the sum (input half, output half) ---------- */}
        <MarginSum />

        {/* ---------- what else is in it (staggered fragment cells) ---------- */}
        <section className="lp-section lp-wrap">
          <h2 className="lp-h2" data-reveal>
            Built for agency work
          </h2>

          <div className="lp-cells">
            <article className="lp-cell" data-reveal style={{ ['--i' as string]: 0 }}>
              <div className="lp-cell-text">
                <h3>Ten departments, not one inbox</h3>
                <p>
                  Work is filed the way an agency is organised, and people only see the departments they are in.
                </p>
              </div>
              <div className="lp-cell-frag">
                <div data-ui>
                  <div className="ui-chips">
                    {DEPARTMENTS.map((d) => (
                      <span key={d.value} className={`ui-pill ${DEPARTMENT_COLOR_CLASSES[d.value]}`}>
                        {d.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </article>

            <article className="lp-cell lp-cell--flip" data-reveal style={{ ['--i' as string]: 1 }}>
              <div className="lp-cell-text">
                <h3>A day is 1,440 minutes</h3>
                <p>
                  The time logger is one 24-hour line. Drag a block onto it for each task; two blocks can never overlap.
                </p>
              </div>
              <div className="lp-cell-frag">
                <div data-ui>
                  <div className="ui-title" style={{ fontSize: 14 }}>
                    Wednesday, November 18
                  </div>
                  <div className="ui-timeline">
                    <span className="ui-block" style={{ left: '4%', width: '34%', background: '#eaca08' }}>
                      Meridian Dental
                    </span>
                    <span className="ui-block" style={{ left: '40%', width: '22%', background: '#2dd4bf' }}>
                      Bolt Cycles
                    </span>
                    <span className="ui-block" style={{ left: '70%', width: '40%', background: '#fb7185' }}>
                      Northline Realty
                    </span>
                  </div>
                  <div className="ui-hours">
                    <span>09:00</span>
                    <span>10:00</span>
                    <span>11:00</span>
                    <span>12:00</span>
                  </div>
                </div>
              </div>
            </article>

            <article className="lp-cell" data-reveal style={{ ['--i' as string]: 2 }}>
              <div className="lp-cell-text">
                <h3>Status you can read across the room</h3>
                <p>
                  A task with subtasks takes its status from them: done only when every part is done.
                </p>
              </div>
              <div className="lp-cell-frag">
                <div data-ui>
                  {[
                    { label: 'Carousel for Kettle & Crumb', status: 'in_progress', text: 'In progress' },
                    { label: 'Monthly report, Bolt Cycles', status: 'completed', text: 'Completed' },
                    { label: 'Landing page copy', status: 'pending', text: 'Pending' },
                    { label: 'Ad set refresh', status: 'overdue', text: 'Overdue' },
                  ].map((row) => (
                    <div key={row.label} className="ui-list-row">
                      <span>{row.label}</span>
                      <span className={`ui-pill ${STATUS_COLOR_CLASSES[row.status as keyof typeof STATUS_COLOR_CLASSES]}`}>
                        {row.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </article>

            <article className="lp-cell lp-cell--flip" data-reveal style={{ ['--i' as string]: 0 }}>
              <div className="lp-cell-text">
                <h3>Remove access, keep the work</h3>
                <p>
                  When someone leaves, block their login in one click. Their tasks and time logs stay on the record.
                </p>
              </div>
              <div className="lp-cell-frag">
                <div data-ui>
                  <div className="ui-list-row">
                    <span>
                      <span style={{ fontWeight: 500 }}>Arjun Mehta</span>
                      <br />
                      <span className="ui-muted" style={{ fontSize: 13 }}>
                        Design, Editing
                      </span>
                    </span>
                    <span className="ui-btn" style={{ color: '#f87171', height: 32 }}>
                      Remove access
                    </span>
                  </div>
                  <div className="ui-list-row">
                    <span>
                      <span style={{ fontWeight: 500 }}>Neha Rao</span>
                      <br />
                      <span className="ui-muted" style={{ fontSize: 13 }}>
                        Removed Nov 3 · 41 tasks kept
                      </span>
                    </span>
                    <span className="ui-btn" style={{ height: 32 }}>
                      Restore access
                    </span>
                  </div>
                </div>
              </div>
            </article>

            <article className="lp-cell" data-reveal style={{ ['--i' as string]: 1 }}>
              <div className="lp-cell-text">
                <h3>Deadlines in your own day</h3>
                <p>
                  Filter by when work is due. A day means your day, wherever the server happens to be.
                </p>
              </div>
              <div className="lp-cell-frag">
                <div data-ui>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingRight: 16 }}>
                    <div>
                      <div className="ui-muted" style={{ fontSize: 13, marginBottom: 6 }}>
                        Due from
                      </div>
                      <div className="ui-field">18 Nov 2026</div>
                    </div>
                    <div>
                      <div className="ui-muted" style={{ fontSize: 13, marginBottom: 6 }}>
                        Due until
                      </div>
                      <div className="ui-field ui-muted">Any date</div>
                    </div>
                  </div>
                  <div className="ui-muted" style={{ fontSize: 13, marginTop: 12 }}>
                    6 tasks due from today
                  </div>
                </div>
              </div>
            </article>

            <article className="lp-cell lp-cell--flip" data-reveal style={{ ['--i' as string]: 2 }}>
              <div className="lp-cell-text">
                <h3>Files stay with the task</h3>
                <p>Attach briefs and references to a task or to any subtask, up to 50 MB each.</p>
              </div>
              <div className="lp-cell-frag">
                <div data-ui>
                  {[
                    { name: 'brief-november.pdf', size: '2.4 MB' },
                    { name: 'clinic-photos.zip', size: '38.1 MB' },
                    { name: 'caption-drafts.docx', size: '86 KB' },
                  ].map((file) => (
                    <div key={file.name} className="ui-list-row">
                      <span>{file.name}</span>
                      <span className="ui-muted ui-num" style={{ fontSize: 13 }}>
                        {file.size}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          </div>
        </section>

        {/* ---------- roles (tabs and bands) ---------- */}
        <section id="roles" className="lp-section lp-wrap">
          <div className="lp-roles-head">
            <h2 className="lp-h2" data-reveal>
              <span className="lp-muted">Three roles,</span>
              <br />
              one set of tasks.
            </h2>
            <Link href="/auth/signup" className="lp-btn" data-reveal style={{ ['--i' as string]: 1 }}>
              Create your account <Arrow />
            </Link>
          </div>
          <RoleAgenda />
        </section>

        {/* ---------- the first step, already open ---------- */}
        <section className="lp-cta lp-section lp-on-accent">
          <div className="lp-cta-copy">
            <h2 className="lp-display" data-reveal>
              Start with
              <br />
              one client.
            </h2>
            <p data-reveal style={{ ['--i' as string]: 1 }}>
              Create your account, enter your organization’s code, and the first task can be assigned today.
            </p>
          </div>
          <div className="lp-cta-dialog" data-reveal="scale" style={{ ['--i' as string]: 2 }}>
            <StartDialog />
          </div>
        </section>
      </main>

      {/* ---------- footer of tiles ---------- */}
      <footer className="lp-foot">
        <div className="lp-tile" style={{ gridColumn: 'span 4' }}>
          <p className="lp-lead" style={{ margin: 0 }}>
            Know what each client costs you.
          </p>
          <p className="lp-small lp-muted" style={{ margin: 0 }}>
            © {new Date().getFullYear()} WhizTask. All rights reserved.
          </p>
        </div>

        <div className="lp-tile" style={{ gridColumn: 'span 3' }}>
          <nav aria-label="Footer">
            <a href="#how">How it works</a>
            <a href="#sum">The sum</a>
            <a href="#roles">Roles</a>
          </nav>
        </div>

        <div className="lp-tile" style={{ gridColumn: 'span 2' }}>
          <DayClock />
        </div>

        <Link href="/auth/login" className="lp-tile" style={{ gridColumn: 'span 3' }}>
          <span className="lp-small lp-muted">Have an account?</span>
          <span className="lp-lead">Sign in</span>
        </Link>

        <div className="lp-tile lp-tile--wordmark" aria-hidden="true">
          WhizTask
        </div>

        <Link href="/auth/signup" className="lp-tile lp-tile--go">
          <span className="lp-lead">
            Create your
            <br />
            account
          </span>
          <Arrow size={64} />
        </Link>
      </footer>
    </div>
  )
}
