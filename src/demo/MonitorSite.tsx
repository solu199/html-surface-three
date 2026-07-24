import { useState } from 'react';

import type { BackendKind } from '../index';

type MonitorSiteProps = {
  backend: BackendKind;
};

type Page = 'dashboard' | 'activity' | 'settings';

const NAV_ITEMS: ReadonlyArray<{
  id: Page;
  label: string;
}> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'activity', label: 'Activity' },
  { id: 'settings', label: 'Settings' },
];

const EVENTS = Array.from({ length: 18 }, (_, index) => ({
  id: index,
  time: `12:${String(14 + Math.floor(index / 6)).padStart(2, '0')}:${String(
    (index * 7) % 60,
  ).padStart(2, '0')}`,
  label: `Surface event ${String(index + 1).padStart(2, '0')}`,
  detail: index % 3 === 0
    ? 'pointer routed'
    : 'texture invalidated',
}));

export function MonitorSite({ backend }: MonitorSiteProps) {
  const [page, setPage] = useState<Page>('dashboard');
  const [actionCount, setActionCount] = useState(0);
  const [signal, setSignal] = useState('');
  const [notifications, setNotifications] = useState(true);
  const [intensity, setIntensity] = useState(42);
  const status = signal.trim() || '入力待ち';

  return (
    <article className="monitor-site" data-page={page}>
      <header className="monitor-site__header">
        <div className="monitor-site__brand">
          <i aria-hidden="true" />
          <div>
            <b>ORBITAL DESK</b>
            <span>HTML Surface control center</span>
          </div>
        </div>
        <span className="monitor-site__backend">
          <i aria-hidden="true" />
          {backend}
        </span>
      </header>

      <nav aria-label="サイト内ナビゲーション">
        {NAV_ITEMS.map((item) => (
          <button
            aria-current={page === item.id ? 'page' : undefined}
            data-testid={`nav-${item.id}`}
            key={item.id}
            onClick={() => setPage(item.id)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </nav>

      <main>
        {page === 'dashboard'
          ? (
            <section
              aria-label="Dashboard"
              className="monitor-site__page dashboard-page"
            >
              <div className="metric-grid">
                <div>
                  <span>Backend</span>
                  <strong>{backend}</strong>
                  <small>stable path</small>
                </div>
                <div>
                  <span>Actions</span>
                  <strong data-testid="action-count">{actionCount}</strong>
                  <small>completed</small>
                </div>
                <div>
                  <span>Signal</span>
                  <strong>{status}</strong>
                  <small>live input</small>
                </div>
              </div>

              <div className="dashboard-grid">
                <section className="site-card">
                  <span className="site-card__eyebrow">Action runner</span>
                  <h2>Dispatch a surface event</h2>
                  <p>
                    React state is painted back to the monitor Texture.
                  </p>
                  <button
                    className="primary-action"
                    data-testid="react-action"
                    onClick={() => {
                      setActionCount((value) => value + 1);
                    }}
                    type="button"
                  >
                    Run surface action
                  </button>
                </section>

                <label className="site-card signal-card">
                  <span className="site-card__eyebrow">Signal channel</span>
                  <b>Name this input</b>
                  <input
                    aria-label="Signal name"
                    data-testid="react-input"
                    onChange={(event) => {
                      setSignal(event.target.value);
                    }}
                    placeholder="alpha-7"
                    value={signal}
                  />
                  <small>{status}</small>
                </label>
              </div>
            </section>
          )
          : null}

        {page === 'activity'
          ? (
            <section
              aria-label="Activity"
              className="monitor-site__page activity-page"
            >
              <header>
                <div>
                  <span>Live routing log</span>
                  <h2>Activity stream</h2>
                </div>
                <b>{EVENTS.length} events</b>
              </header>
              <div
                className="monitor-site__scroll"
                data-testid="react-scroll"
                tabIndex={0}
              >
                {EVENTS.map((event) => (
                  <p key={event.id}>
                    <time>{event.time}</time>
                    <b>{event.label}</b>
                    <span>{event.detail}</span>
                  </p>
                ))}
              </div>
            </section>
          )
          : null}

        {page === 'settings'
          ? (
            <section
              aria-label="Settings"
              className="monitor-site__page settings-page"
            >
              <header>
                <span>Surface preferences</span>
                <h2>Display &amp; interaction</h2>
              </header>

              <label className="setting-row toggle-row">
                <span>
                  <b>Surface notifications</b>
                  <small>Report interaction events in the activity feed.</small>
                </span>
                <input
                  checked={notifications}
                  data-testid="react-checkbox"
                  onChange={(event) => {
                    setNotifications(event.target.checked);
                  }}
                  type="checkbox"
                />
              </label>

              <label className="setting-row range-row">
                <span>
                  <b>Display intensity</b>
                  <small>Drag continues through temporary occlusion.</small>
                </span>
                <output data-testid="range-value">{intensity}</output>
                <input
                  data-testid="react-range"
                  max="100"
                  min="0"
                  onChange={(event) => {
                    setIntensity(Number(event.target.value));
                  }}
                  type="range"
                  value={intensity}
                />
              </label>

              <div className="settings-note">
                <i aria-hidden="true" />
                <span>
                  Browser focus and keyboard input remain on the live DOM.
                </span>
              </div>
            </section>
          )
          : null}
      </main>
    </article>
  );
}
