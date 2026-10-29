import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, Check, CheckCircle2, ChevronLeft, ChevronRight, Info, ShieldAlert, ShieldCheck, ShieldQuestion, X, XCircle, Minus,
} from 'lucide-react';
import { assetUrl, avatarColor, fmtDateTime } from '../api';
import Portrait from './Portrait.jsx';
import { guessGender } from './Portrait.jsx';

const PROFILE_PHOTOS = {
  female: ['/images/profiles/female-1.jpg', '/images/profiles/female-2.jpg', '/images/profiles/female-3.jpg', '/images/profiles/female-4.jpg'],
  male: ['/images/profiles/male-1.jpg', '/images/profiles/male-2.jpg', '/images/profiles/male-3.jpg', '/images/profiles/male-4.jpg'],
};

function defaultProfilePhoto(name, gender) {
  const bucket = (gender || guessGender(name)) === 'female' ? PROFILE_PHOTOS.female : PROFILE_PHOTOS.male;
  const hash = [...name].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 7);
  return bucket[hash % bucket.length];
}

export function Card({ title, icon: Icon, sub, actions, children, className = '', flush, footer, ...rest }) {
  return (
    <section className={`card ${flush ? 'card-flush' : ''} ${className}`} {...rest}>
      {(title || actions) && (
        <div className="card-head" style={flush ? { padding: '18px 20px 0', marginBottom: 14 } : undefined}>
          <div>
            {title && <h3>{Icon && <Icon size={17} />}{title}</h3>}
            {sub && <div className="card-sub">{sub}</div>}
          </div>
          {actions && <div className="row wrap">{actions}</div>}
        </div>
      )}
      {children}
      {footer && <div className="card-foot" style={flush ? { margin: 0 } : undefined}>{footer}</div>}
    </section>
  );
}

export const Tile = ({ icon: Icon, color = 'blue', size = 'md', iconSize }) => (
  <div className={`tile ${size === 'sm' ? 'tile-sm' : size === 'xs' ? 'tile-xs' : ''} t-${color}`}>
    <Icon size={iconSize || (size === 'xs' ? 15 : size === 'sm' ? 18 : 22)} strokeWidth={2} />
  </div>
);

export function Trend({ value, label, invert, suffix = '%', tone }) {
  if (value === null || value === undefined) return label ? <span className="trend flat"><span>{label}</span></span> : null;
  const n = Number(value);
  const dir = n > 0 ? 'up' : n < 0 ? 'down' : 'flat';
  const good = invert ? dir === 'down' : dir === 'up';
  const cls = tone || (dir === 'flat' ? 'flat' : good ? 'up' : 'down');
  const Icon = dir === 'up' ? ArrowUpRight : dir === 'down' ? ArrowDownRight : Minus;
  return <span className={`trend ${cls}`}><Icon size={13} strokeWidth={2.5} />{Math.abs(n)}{suffix}<span>{label}</span></span>;
}

export function Stat({ icon, color, label, value, unit, trend, trendLabel, invert, foot, tone, onClick }) {
  return (
    <div className="stat" onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      <div className="stat-body">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}{unit && <small>{unit}</small>}</div>
        {foot ?? <Trend value={trend} label={trendLabel} invert={invert} tone={tone} />}
      </div>
      {icon && <Tile icon={icon} color={color} />}
    </div>
  );
}

export const Badge = ({ color = 'gray', children, dot, className = '' }) => (
  <span className={`badge b-${color} ${className}`}>{dot && <span className="bdot" />}{children}</span>
);

export function StatusBadge({ status, valid }) {
  if (status === 'sealed' && valid === false) return <Badge color="red" dot>Altered</Badge>;
  if (status === 'sealed') return <Badge color="green" dot>Sealed</Badge>;
  return <Badge color="gray" dot>Draft</Badge>;
}

const PX = { sm: 28, '': 36, lg: 48, xl: 64, xxl: 96 };
export function Avatar({ name = '', size = '', src, gender }) {
  const [broken, setBroken] = useState(false);
  const px = PX[size] ?? 36;
  const photo = assetUrl(src) || defaultProfilePhoto(name, gender);
  return (
    <div className={`avatar ${size ? `avatar-${size}` : ''}`} style={{ background: avatarColor(name), overflow: 'hidden', padding: 0 }} title={name}>
      {!broken
        ? <img src={photo} alt={name} width={px} height={px} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={() => setBroken(true)} />
        : <Portrait name={name} gender={gender} size={px} />}
    </div>
  );
}

export function Avatars({ names = [], people, max = 3, size = 'sm' }) {
  const list = people || names.map((n) => ({ name: n }));
  const shown = list.slice(0, max);
  return (
    <div className="avatars">
      {shown.map((p, i) => <Avatar key={i} name={p.name} src={p.photo} gender={p.gender} size={size} />)}
      {list.length > max && <div className={`avatar avatar-${size}`} style={{ background: 'var(--surface-3)', color: 'var(--muted)' }}>+{list.length - max}</div>}
    </div>
  );
}

export const Person = ({ name, sub, size = 'sm', src, gender }) => (
  <div className="person"><Avatar name={name} size={size} src={src} gender={gender} /><div className="grow"><div className="person-name truncate">{name}</div>{sub && <div className="person-sub truncate">{sub}</div>}</div></div>
);

export function Tabs({ tabs, value, onChange, className = '' }) {
  return (
    <div className={`tabs ${className}`} role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} className={value === t.id ? 'active' : ''} onClick={() => onChange(t.id)}>
          {t.icon && <t.icon size={15} />}{t.label}{t.count !== undefined && <span className="count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export const Seg = ({ options, value, onChange }) => (
  <div className="seg">{options.map((o) => <button key={o.id} className={value === o.id ? 'active' : ''} onClick={() => onChange(o.id)}>{o.label}</button>)}</div>
);

export function Pagination({ page, pages, total, pageSize, onPage, onPageSize, noun = 'records' }) {
  const nums = [];
  for (let i = 1; i <= pages; i++) if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i); else if (nums[nums.length - 1] !== '…') nums.push('…');
  const from = total ? (page - 1) * pageSize + 1 : 0;
  return (
    <div className="pager">
      <span>Showing {from} to {Math.min(page * pageSize, total)} of {total.toLocaleString()} {noun}</span>
      <div className="pages">
        <button onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page"><ChevronLeft size={15} /></button>
        {nums.map((n, i) => (n === '…' ? <span key={`e${i}`} className="faint">…</span> : <button key={n} className={n === page ? 'active' : ''} onClick={() => onPage(n)}>{n}</button>))}
        <button onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label="Next page"><ChevronRight size={15} /></button>
      </div>
      {onPageSize && (
        <select className="select-sm" value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))} aria-label="Rows per page">
          {[10, 20, 50].map((n) => <option key={n} value={n}>{n} / page</option>)}
        </select>
      )}
    </div>
  );
}

export function Modal({ title, onClose, children, footer, size }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size === 'lg' ? 'modal-lg' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head"><h3>{title}</h3><button className="btn-icon" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>, document.body);
}

export function Drawer({ title, sub, onClose, children, footer }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return createPortal(
    <div className="drawer-wrap" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head"><div><h3>{title}</h3>{sub && <div className="card-sub">{sub}</div>}</div><button className="btn-icon" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        <div className="modal-body" style={{ flex: 1 }}>{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </aside>
    </div>, document.body);
}

export const Empty = ({ icon, title, children, action }) => (
  <div className="empty">{icon && <Tile icon={icon} color="gray" />}<h4>{title}</h4><div className="small">{children}</div>{action && <div className="mt-2">{action}</div>}</div>
);

export const Skeleton = ({ h = 16, w = '100%', style }) => <div className="skeleton" style={{ height: h, width: w, ...style }} />;

export const Switch = ({ checked, onChange, disabled, label }) => (
  <label className="switch" title={label}><input type="checkbox" checked={!!checked} disabled={disabled} onChange={(e) => onChange?.(e.target.checked)} aria-label={label} /><span /></label>
);

export function Field({ label, children, hint, className = '' }) {
  return <label className={`field ${className}`}><span className="field-label">{label}</span>{children}{hint && <span className="field-hint">{hint}</span>}</label>;
}

export const Progress = ({ value, color }) => (
  <div className="progress"><div style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} /></div>
);

export function useClickOutside(onOut) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onOut(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onOut]);
  return ref;
}

// ---- Toasts
const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, type = 'info', title) => {
    const id = Math.random().toString(36).slice(2);
    setItems((x) => [...x, { id, message, type, title }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 4200);
  }, []);
  const Icon = { success: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Info };
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => {
          const I = Icon[t.type] || Info;
          return (
            <div key={t.id} className={`toast ${t.type}`}>
              <I size={18} color={`var(--${t.type === 'success' ? 'green' : t.type === 'error' ? 'red' : t.type === 'warning' ? 'orange' : 'blue'})`} />
              <div>{t.title && <strong>{t.title}</strong>}<div className={t.title ? 'small muted' : ''}>{t.message}</div></div>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

// ---- Domain components
export function Flags({ flags = [], onOpen }) {
  if (!flags.length) return null;
  const Icon = { danger: ShieldAlert, warning: AlertTriangle, info: Info };
  return (
    <div className="flags">
      {flags.map((f) => {
        const I = Icon[f.level] || Info;
        return (
          <div key={f.code} className={`flag flag-${f.level}`}>
            <I size={17} />
            <div className="grow">{f.message}</div>
            {f.record_id && onOpen && <button className="btn btn-xs btn-outline" onClick={() => onOpen(f.record_id)}>View {f.related}</button>}
          </div>
        );
      })}
    </div>
  );
}

export function VerificationResult({ verification, compact }) {
  if (!verification) return null;
  if (!verification.sealed) {
    return (
      <div className="verdict verdict-draft">
        <div className="verdict-head"><div className="verdict-icon"><ShieldQuestion size={24} /></div>
          <div><div className="verdict-title">Not yet sealed</div><div className="verdict-sub">This record is a draft and cannot be relied on as evidence yet.</div></div></div>
      </div>
    );
  }
  const ok = verification.valid;
  return (
    <div className={`verdict ${ok ? 'verdict-ok' : 'verdict-bad'}`}>
      <div className="verdict-head">
        <div className="verdict-icon">{ok ? <ShieldCheck size={24} /> : <ShieldAlert size={24} />}</div>
        <div>
          <div className="verdict-title">{ok ? 'Authentic and unaltered' : 'Warning: this record has been altered'}</div>
          <div className="verdict-sub">Sealed {fmtDateTime(verification.sealed_at)} · ledger entry #{verification.ledger_position}</div>
        </div>
      </div>
      {!compact && (
        <ul className="checks">
          {verification.checks.map((c) => <li key={c.id} className={c.ok ? 'ok' : 'bad'}>{c.ok ? <Check size={15} /> : <X size={15} />} {c.label}</li>)}
        </ul>
      )}
      {!ok && verification.changes?.length > 0 && (
        <div className="changes">
          <div className="strong small mb-1" style={{ color: 'var(--red)' }}>Changes found since sealing</div>
          <table>
            <thead><tr><th>Field</th><th>Sealed value</th><th>Value now</th></tr></thead>
            <tbody>{verification.changes.map((c) => <tr key={c.field}><td>{c.field}</td><td>{show(c.sealed)}</td><td className="bad">{show(c.current)}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
const show = (v) => {
  if (v === null || v === undefined) return '—';
  if (Array.isArray(v) && Array.isArray(v[0])) return v.map((p) => p.join(', ')).join(' | ');
  if (typeof v === 'object') return JSON.stringify(v);
  return /^\d{6,}$/.test(String(v)) ? Number(v).toLocaleString() : String(v);
};

export function MiniCalendar({ marks = [], month: initial }) {
  const [month, setMonth] = useState(() => { const d = initial ? new Date(initial) : new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const today = new Date();
  const start = new Date(month); start.setDate(1 - ((month.getDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  const key = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const marked = new Set(marks.map((m) => key(new Date(m))));
  return (
    <div>
      <div className="row-between mb-1">
        <button className="btn-icon" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month"><ChevronLeft size={16} /></button>
        <strong className="small">{month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</strong>
        <button className="btn-icon" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month"><ChevronRight size={16} /></button>
      </div>
      <div className="cal">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => <div key={d} className="dow">{d}</div>)}
        {days.map((d) => (
          <div key={key(d)} className={`d ${d.getMonth() !== month.getMonth() ? 'out' : ''} ${key(d) === key(today) ? 'today' : ''} ${marked.has(key(d)) ? 'has' : ''}`}>{d.getDate()}</div>
        ))}
      </div>
    </div>
  );
}
