import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, FileText, Scale, Search, User } from 'lucide-react';
import { api } from '../api';

export default function CommandPalette({ open, onClose, pages }) {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [res, setRes] = useState({ records: [], people: [], disputes: [] });
  const [idx, setIdx] = useState(0);
  const input = useRef(null);

  useEffect(() => { if (open) { setQ(''); setIdx(0); setTimeout(() => input.current?.focus(), 20); } }, [open]);
  useEffect(() => {
    if (q.trim().length < 2) { setRes({ records: [], people: [], disputes: [] }); return; }
    const t = setTimeout(() => api(`/search?q=${encodeURIComponent(q.trim())}`).then(setRes).catch(() => {}), 160);
    return () => clearTimeout(t);
  }, [q]);

  const items = useMemo(() => {
    const ql = q.toLowerCase();
    const pg = pages.filter((p) => !ql || p.label.toLowerCase().includes(ql)).slice(0, ql ? 5 : 8)
      .map((p) => ({ group: 'Go to', icon: p.icon, label: p.label, sub: p.hint, to: p.to }));
    return [
      ...pg,
      ...res.records.map((r) => ({ group: 'Land records', icon: FileText, label: r.title, sub: `${r.code} · ${r.village || r.district || ''}`, to: `/records/${r.id}` })),
      ...res.people.map((p) => ({ group: 'People', icon: User, label: p.full_name, sub: `${p.role.replace('_', '-')} on ${p.code}`, to: `/records/${p.record_id}` })),
      ...res.disputes.map((d) => ({ group: 'Disputes', icon: Scale, label: d.title, sub: d.code, to: '/disputes' })),
    ];
  }, [q, res, pages]);

  useEffect(() => { setIdx(0); }, [items.length]);
  if (!open) return null;

  const go = (it) => { onClose(); nav(it.to); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(items.length - 1, i + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
    if (e.key === 'Enter' && items[idx]) go(items[idx]);
    if (e.key === 'Escape') onClose();
  };

  let last = '';
  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal palette" role="dialog" aria-label="Search">
        <div className="palette-input">
          <Search size={18} color="var(--muted)" />
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="Search records, people, codes, disputes or pages…" aria-label="Search" />
          <span className="kbd">Esc</span>
        </div>
        <div style={{ maxHeight: 420, overflowY: 'auto', paddingBottom: 8 }}>
          {items.length === 0 && <div className="empty small">No matches for “{q}”.</div>}
          {items.map((it, i) => {
            const head = it.group !== last ? <div className="palette-group">{it.group}</div> : null;
            last = it.group;
            const I = it.icon;
            return (
              <div key={`${it.group}-${i}`}>
                {head}
                <div className={`palette-item ${i === idx ? 'active' : ''}`} onMouseEnter={() => setIdx(i)} onClick={() => go(it)}>
                  <I size={16} /><span className="truncate">{it.label}</span>
                  <span className="sub truncate">{it.sub}</span>
                  {i === idx && <CornerDownLeft size={14} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>, document.body);
}
