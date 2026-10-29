import { useEffect, useMemo, useState } from 'react';
import { simulate, breakEven, fromRecords } from './engine.js';

const DEFAULTS = {
  cur: 'KES', price: 250, cost: 90, low: 25, mid: 40, high: 60,
  days: 26, fixed: 90000, start: 250000, money: 400000, ramp: 3,
};

const pct = (x) => Math.round(x * 100) + '%';
const money = (cur, n) => (n < 0 ? '−' : '') + cur + ' ' + Math.round(Math.abs(n)).toLocaleString('en');
const short = (n) => {
  const a = Math.abs(n), s = n < 0 ? '−' : '';
  return a >= 1e6 ? s + (a / 1e6).toFixed(1) + 'M' : a >= 1e3 ? s + Math.round(a / 1e3) + 'K' : s + Math.round(a);
};

function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span>{label} {hint && <small>{hint}</small>}</span>
      {children}
    </label>
  );
}

function Chart({ s }) {
  const W = 600, H = 260, L = 48, R = 10, T = 12, B = 26;
  const lo = Math.min(0, ...s.p10), hi = Math.max(0, ...s.p90), span = hi - lo || 1;
  const x = (i) => L + ((W - L - R) * i) / 12;
  const y = (n) => T + (H - T - B) * (1 - (n - lo) / span);
  const line = (arr) => arr.map((n, i) => `${x(i)},${y(n)}`).join(' L');
  const band = `M${line(s.p90)} L${[...s.p10.map((n, i) => `${x(i)},${y(n)}`)].reverse().join(' L')} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Cash over 12 months">
      {[0, 1, 2, 3, 4].map((i) => {
        const v = lo + (span * i) / 4;
        return <g key={i}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="grid-line" />
          <text x={L - 6} y={y(v) + 4} textAnchor="end">{short(v)}</text></g>;
      })}
      {[0, 2, 4, 6, 8, 10, 12].map((i) => <text key={i} x={x(i)} y={H - 6} textAnchor="middle">{i}</text>)}
      <path d={band} className="band" />
      <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} className="zero" />
      <path d={`M${line(s.p50)}`} className="median" />
    </svg>
  );
}

export default function App() {
  const [mode, setMode] = useState('new');
  const [v, setV] = useState(DEFAULTS);
  const [records, setRecords] = useState('');
  const [msg, setMsg] = useState('');
  const [saved, setSaved] = useState([]);
  const [name, setName] = useState('');

  const set = (k) => (e) => setV({ ...v, [k]: k === 'cur' ? e.target.value : Math.max(0, +e.target.value || 0) });
  const inputs = { ...v, ramp: mode === 'new' ? v.ramp : 0 };
  const [lo, mid, hi] = [v.low, v.mid, v.high].sort((a, b) => a - b);
  const model = { ...inputs, low: lo, mid, high: hi };

  const base = useMemo(() => simulate(model), [JSON.stringify(model)]);
  const scenarios = useMemo(() => [
    ['Your numbers', base],
    ['Sales 30% lower', simulate(model, { sales: 0.7 })],
    ['Ingredient costs 15% higher', simulate(model, { cost: 1.15 })],
    ['Both at once', simulate(model, { sales: 0.7, cost: 1.15 })],
  ], [JSON.stringify(model)]);

  const be = breakEven(model);
  const unitLoss = v.price <= v.cost;
  const tone = unitLoss || base.broke >= 0.3 ? 'bad' : base.broke >= 0.1 ? 'warn' : 'good';
  const head = unitLoss ? 'Each sale loses money'
    : tone === 'good' ? 'Looks workable on these numbers'
    : tone === 'warn' ? 'Possible, but risky' : 'High risk of running out of cash';

  const loadList = () => fetch('/api/scenarios').then((r) => r.json()).then(setSaved).catch(() => {});
  useEffect(() => { loadList(); }, []);

  const save = async () => {
    if (!name.trim()) return setMsg('Give your scenario a name first.');
    const res = await fetch('/api/scenarios', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mode, inputs: v }),
    });
    setMsg(res.ok ? 'Saved.' : 'Could not save. Is the server running?');
    if (res.ok) { setName(''); loadList(); }
  };
  const open = async (id) => {
    const s = await (await fetch(`/api/scenarios/${id}`)).json();
    setMode(s.mode); setV(s.inputs);
  };
  const remove = async (id) => { await fetch(`/api/scenarios/${id}`, { method: 'DELETE' }); loadList(); };
  const useRecords = () => {
    const r = fromRecords(records);
    if (!r) return setMsg('Add at least 5 daily counts.');
    setV({ ...v, low: r.low, mid: r.mid, high: r.high });
    setMsg(`Filled from ${r.days} days of records.`);
  };

  return (
    <div className="wrap">
      <h1>Try your business on screen before you risk your money</h1>
      <p className="lead">Enter your idea in numbers. The simulator plays out the next 12 months 2,000 times and shows how often it works.</p>

      <div className="layout">
        <section className="panel">
          <div className="seg">
            <button aria-pressed={mode === 'new'} onClick={() => setMode('new')}>I’m planning one</button>
            <button aria-pressed={mode === 'old'} onClick={() => setMode('old')}>I already run one</button>
          </div>
          <Field label="Currency"><input value={v.cur} onChange={set('cur')} maxLength={5} /></Field>
          <div className="row2">
            <Field label="Price per sale"><input type="number" value={v.price} onChange={set('price')} /></Field>
            <Field label="Cost per sale"><input type="number" value={v.cost} onChange={set('cost')} /></Field>
          </div>
          <Field label="Customers per day" hint="slow, usual, great day">
            <div className="row3">
              <input type="number" value={v.low} onChange={set('low')} aria-label="Slow day" />
              <input type="number" value={v.mid} onChange={set('mid')} aria-label="Usual day" />
              <input type="number" value={v.high} onChange={set('high')} aria-label="Great day" />
            </div>
          </Field>
          {mode === 'old' && (
            <div>
              <Field label="Paste recent daily customer counts" hint="at least 5">
                <textarea value={records} onChange={(e) => setRecords(e.target.value)} placeholder="38, 42, 55, 31, 47" />
              </Field>
              <button className="ghost" onClick={useRecords}>Use my records</button>
            </div>
          )}
          <div className="row2">
            <Field label="Days open per month"><input type="number" value={v.days} onChange={set('days')} /></Field>
            <Field label="Fixed costs per month"><input type="number" value={v.fixed} onChange={set('fixed')} /></Field>
          </div>
          <div className="row2">
            <Field label={mode === 'new' ? 'Startup cost' : 'Cost of the change'}><input type="number" value={v.start} onChange={set('start')} /></Field>
            <Field label="Money you have"><input type="number" value={v.money} onChange={set('money')} /></Field>
          </div>
          {mode === 'new' && <Field label="Months to reach usual customers"><input type="number" value={v.ramp} onChange={set('ramp')} /></Field>}

          <div className="save">
            <input placeholder="Name this scenario" value={name} onChange={(e) => setName(e.target.value)} />
            <button className="ghost" onClick={save}>Save</button>
          </div>
          {msg && <p className="hint">{msg}</p>}
          {saved.length > 0 && (
            <ul className="saved">
              {saved.map((s) => (
                <li key={s.id}>
                  <button className="link" onClick={() => open(s.id)}>{s.name}</button>
                  <button className="x" aria-label={`Delete ${s.name}`} onClick={() => remove(s.id)}>×</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-live="polite">
          <div className={`verdict ${tone}`}>
            <h2>{head}</h2>
            <p>{unitLoss ? 'Your cost per sale is at or above your price. Fix that first.'
              : `You ran out of cash in ${pct(base.broke)} of 2,000 simulated years.`}</p>
          </div>
          <div className="stats">
            <div className="stat"><b>{pct(base.broke)}</b><span>chance of running out of cash within 12 months</span></div>
            <div className="stat"><b>{money(v.cur, base.s50)}</b><span>typical monthly profit once settled (bad {money(v.cur, base.s10)}, good {money(v.cur, base.s90)})</span></div>
            <div className="stat"><b>{be === Infinity ? 'n/a' : Math.ceil(be)}</b><span>customers per day to break even (you expect {mid})</span></div>
          </div>
          <div className="panel"><h2>Your cash over 12 months</h2><Chart s={base} />
            <p className="note">Line: typical path. Shaded: middle 80% of outcomes. Axis: months.</p></div>
          <div className="panel"><h2>What if things go wrong?</h2>
            <table><thead><tr><th>Scenario</th><th>Chance of running out</th><th>Typical monthly profit</th></tr></thead>
              <tbody>{scenarios.map(([n, r]) => (
                <tr key={n}><td>{n}</td><td><b>{pct(r.broke)}</b></td><td>{money(v.cur, r.s50)}</td></tr>))}</tbody></table></div>
          <p className="note">A planning aid, not a promise. It only knows what you tell it.</p>
        </section>
      </div>
    </div>
  );
}
