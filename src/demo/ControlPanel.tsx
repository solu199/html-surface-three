import { useState } from 'react';

type ControlPanelProps = {
  backend: 'native' | 'polyfill';
};

type ActivityItem = {
  id: number;
  time: string;
  message: string;
  tone?: 'accent' | 'muted';
};

const INITIAL_ACTIVITY: ActivityItem[] = [
  { id: 1, time: '12:45:47', message: 'uv  (0.114, 0.283)', tone: 'muted' },
  { id: 2, time: '12:45:48', message: 'hit  #monitor', tone: 'accent' },
  { id: 3, time: '12:45:51', message: 'surface connected' },
  { id: 4, time: '12:45:57', message: 'dom  (248, 202)', tone: 'muted' },
  { id: 5, time: '12:45:58', message: 'input ready' },
  { id: 6, time: '12:46:01', message: 'action.run()', tone: 'accent' },
  { id: 7, time: '12:46:04', message: 'occlusion live' },
  { id: 8, time: '12:46:08', message: 'second surface mounted' },
  { id: 9, time: '12:46:12', message: 'wheel routing ready' },
];

function currentTime(): string {
  return new Date().toLocaleTimeString('en-GB', {
    hour12: false,
  });
}

export function ControlPanel({ backend }: ControlPanelProps) {
  const [actionCount, setActionCount] = useState(0);
  const [signal, setSignal] = useState('');
  const [activity, setActivity] = useState(INITIAL_ACTIVITY);

  const prependActivity = (message: string, tone?: ActivityItem['tone']) => {
    setActivity((items) => [
      {
        id: Date.now(),
        time: currentTime(),
        message,
        tone,
      },
      ...items,
    ]);
  };

  const runAction = () => {
    setActionCount((count) => count + 1);
    prependActivity('action.run()', 'accent');
  };

  return (
    <article className="control-panel">
      <header className="control-panel__header">
        <div>
          <h2>HTML SURFACE LAB</h2>
          <p>React UI mapped onto a Three.js Mesh</p>
        </div>
        <span className="connection" aria-label="Surface connected">
          <i aria-hidden="true" />
          Surface status
        </span>
      </header>

      <div className="control-panel__body">
        <section className="control-panel__controls">
          <div className="instrument">
            <h3>Run action</h3>
            <button
              data-testid="react-action"
              onClick={runAction}
              type="button"
            >
              Run action
            </button>
            <p className="action-result" data-testid="action-count">
              completed <strong>{actionCount}</strong> times
            </p>
          </div>

          <label className="instrument field-instrument">
            <span>Input signal</span>
            <input
              data-testid="react-input"
              onBlur={() => {
                if (signal) {
                  prependActivity(`input "${signal}"`);
                }
              }}
              onChange={(event) => setSignal(event.target.value)}
              placeholder="type a signal…"
              value={signal}
            />
            <small>{signal || 'waiting for input'}</small>
          </label>

          <div className="instrument status-instrument">
            <h3>Surface status</h3>
            <dl>
              <div>
                <dt>Backend</dt>
                <dd>{backend}</dd>
              </div>
              <div>
                <dt>Surfaces</dt>
                <dd>02</dd>
              </div>
              <div>
                <dt>Occlusion</dt>
                <dd>live</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="activity">
          <h3>Activity</h3>
          <div
            className="activity__scroll"
            data-testid="react-scroll"
            tabIndex={0}
          >
            {activity.map((item) => (
              <p className={item.tone ?? ''} key={item.id}>
                <time>{item.time}</time>
                <span>{item.message}</span>
              </p>
            ))}
          </div>
        </section>
      </div>
    </article>
  );
}
