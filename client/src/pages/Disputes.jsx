import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Clock, Download, Gavel, MapPin, Plus, Scale, Search, Timer, TrendingUp, Users } from 'lucide-react';
import { api, CATEGORIES, download, fmtDateTime, fmtTime, isOfficial, STAGES, STAGE_BADGE, timeAgo } from '../api';
import { useAuth } from '../auth.jsx';
import { usePage } from '../theme.jsx';
import { Badge, Card, Drawer, Empty, Field, Person, Skeleton, Stat, Tile, useToast } from '../components/ui.jsx';
import { Donut, Legend } from '../components/charts.jsx';
import DisputeForm from '../components/DisputeForm.jsx';

const CAT_COLOR = { boundary: 'blue', ownership: 'purple', inheritance: 'gold', eviction: 'red', double_sale: 'red', payment: 'orange', other: 'gray' };
const toLocal = (d) => { if (!d) return ''; const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };

export default function Disputes() {
  usePage('Disputes & Mediation', 'Move land disputes from LC review to resolution with sealed evidence');
  const { user } = useAuth();
  const toast = useToast();
  const official = isOfficial(user);
  const [d, setD] = useState(null);
  const [mediators, setMediators] = useState([]);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [open, setOpen] = useState(null);
  const [form, setForm] = useState(false);
  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState(null);

  const load = useCallback(() => api(`/disputes${q || cat ? `?${new URLSearchParams({ ...(q && { q }), ...(cat && { category: cat }) })}` : ''}`).then(setD).catch((e) => toast(e.message, 'error')), [q, cat, toast]);
  useEffect(() => { const t = setTimeout(load, q ? 200 : 0); return () => clearTimeout(t); }, [load, q]);
  useEffect(() => { if (official) api('/disputes/mediators').then((x) => setMediators(x.mediators)).catch(() => {}); }, [official]);

  async function update(id, body, msg) {
    try {
      const { dispute } = await api(`/disputes/${id}`, { method: 'PATCH', body });
      await load();
      if (open?.id === id) setOpen(dispute);
      if (msg) toast(msg, 'success');
    } catch (e) { toast(e.message, 'error'); }
  }
  const onDrop = (stage) => {
    setOver(null);
    if (!drag || drag.stage === stage) return;
    update(drag.id, { stage }, `Moved to ${STAGES.find((s) => s.id === stage).label}`);
    setDrag(null);
  };

  if (!d) return <Skeleton h={600} />;
  const all = d.disputes;
  const resolved = all.filter((x) => x.stage === 'resolved');
  const avgDays = resolved.length ? Math.round(resolved.reduce((s, x) => s + Number(x.age_days), 0) / resolved.length) : 0;
  const cats = Object.entries(all.reduce((m, x) => ({ ...m, [x.category]: (m[x.category] || 0) + 1 }), {})).map(([k, v]) => ({ name: CATEGORIES[k], value: v })).sort((a, b) => b.value - a.value);

  return (
    <>
      <div className="grid grid-4 section">
        <Stat icon={Scale} color="orange" label="Open disputes" value={all.filter((x) => x.stage !== 'resolved').length} foot={<span className="trend warn"><span>{all.filter((x) => x.priority === 'high' && x.stage !== 'resolved').length} high priority</span></span>} />
        <Stat icon={Gavel} color="purple" label="In mediation" value={all.filter((x) => x.stage === 'mediation').length} foot={<span className="trend flat"><CalendarClock size={13} /><span>{d.sessions.length} sessions scheduled</span></span>} />
        <Stat icon={TrendingUp} color="green" label="Resolved" value={resolved.length} foot={<span className="trend up"><span>{all.length ? Math.round((resolved.length / all.length) * 100) : 0}% resolution rate</span></span>} />
        <Stat icon={Timer} color="blue" label="Average days to resolve" value={avgDays} unit="days" foot={<span className="trend flat"><span>vs years in court</span></span>} />
      </div>

      <div className="stack">
        <Card flush>
          <div className="toolbar">
            <h3 style={{ marginRight: 8 }}>Mediation pipeline</h3>
            <div className="input-icon toolbar-search"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search disputes" aria-label="Search disputes" /></div>
            <select className="select-sm" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
              <option value="">All categories</option>{Object.entries(CATEGORIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <div className="row" style={{ marginLeft: 'auto' }}>
              {official && <button className="btn btn-outline btn-sm" onClick={() => download('/reports/disputes.csv', 'ettaka-disputes.csv')}><Download size={15} /> Export</button>}
              <button className="btn btn-primary btn-sm" onClick={() => setForm(true)}><Plus size={15} /> Report dispute</button>
            </div>
          </div>
          <div style={{ padding: 16 }}>
            {official && <p className="xs muted" style={{ marginTop: -4 }}>Drag a card to move it between stages, or open it to schedule mediation.</p>}
            <div className="kanban">
              {STAGES.map((s) => {
                const items = all.filter((x) => x.stage === s.id);
                return (
                  <div key={s.id} className={`lane ${over === s.id ? 'drop' : ''}`} style={{ '--lane': s.color }}
                    onDragOver={(e) => { if (official) { e.preventDefault(); setOver(s.id); } }} onDragLeave={() => setOver(null)} onDrop={() => onDrop(s.id)}>
                    <div className="lane-head"><span>{s.label}</span><span className="lane-count">{items.length}</span></div>
                    <div className="lane-body">
                      {items.length === 0 && <div className="xs faint center" style={{ padding: 16 }}>No disputes</div>}
                      {items.map((x) => (
                        <div key={x.id} className={`kcard ${drag?.id === x.id ? 'dragging' : ''}`} draggable={official} onDragStart={() => setDrag(x)} onDragEnd={() => setDrag(null)} onClick={() => setOpen(x)}>
                          <div className="row-between"><Badge color={CAT_COLOR[x.category]}>{CATEGORIES[x.category]}</Badge><span className={`prio prio-${x.priority}`} title={`${x.priority} priority`} /></div>
                          <div className="t">{x.title}</div>
                          <div className="m"><MapPin size={12} /> {x.code} · {x.village || x.district}</div>
                          {x.session_at && x.stage !== 'resolved' && <div className="m" style={{ color: 'var(--purple)', marginTop: 4 }}><CalendarClock size={12} /> {fmtDateTime(x.session_at)}</div>}
                          <div className="row-between mt-1">
                            <div className="m"><Users size={12} /> {x.complainant?.split(' ').slice(0, 2).join(' ') || '—'}</div>
                            <div className="m"><Clock size={12} /> {Math.max(1, Math.round(x.age_days))}d</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        <div className="grid g-2a">
          <Card title="Upcoming sessions" icon={CalendarClock}>
            {d.sessions.length === 0 ? <Empty title="Nothing scheduled" /> : (
              <div className="timeline">
                {d.sessions.slice(0, 8).map((s) => (
                  <div key={s.id} className="tl-item" style={{ cursor: 'pointer' }} onClick={() => setOpen(s)}>
                    <div className="tl-dot t-purple"><Gavel size={14} /></div>
                    <div className="tl-body">
                      <div className="row-between"><span className="title truncate">{s.title}</span><Badge color="purple">{fmtTime(s.session_at)}</Badge></div>
                      <div className="sub">{new Date(s.session_at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · {s.venue || s.district}</div>
                      {s.mediator_name && <div className="sub">Mediator: {s.mediator_name}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card title="By category">
            {cats.length ? <><Donut data={cats} center={all.length} sub="Disputes" height={170} inner={52} outer={74} /><div className="mt-2"><Legend data={cats} /></div></> : <Empty title="No disputes" />}
          </Card>
        </div>
      </div>

      {open && <DisputeDrawer d={open} official={official} mediators={mediators} onClose={() => setOpen(null)} onUpdate={update} />}
      {form && <DisputeForm onClose={() => setForm(false)} onSaved={load} />}
    </>
  );
}

function DisputeDrawer({ d, official, mediators, onClose, onUpdate }) {
  const [s, setS] = useState({ mediator_id: d.mediator_id || '', session_at: toLocal(d.session_at), venue: d.venue || '', outcome: d.outcome || '' });
  useEffect(() => { setS({ mediator_id: d.mediator_id || '', session_at: toLocal(d.session_at), venue: d.venue || '', outcome: d.outcome || '' }); }, [d]);
  const save = () => onUpdate(d.id, { mediator_id: s.mediator_id ? Number(s.mediator_id) : null, session_at: s.session_at ? new Date(s.session_at).toISOString() : null, venue: s.venue, outcome: s.outcome }, 'Dispute updated');
  return (
    <Drawer title={d.title} sub={`${d.code} · reported ${timeAgo(d.created_at)}`} onClose={onClose}
      footer={official ? <><button className="btn btn-outline" onClick={onClose}>Close</button><button className="btn btn-primary" onClick={save}>Save changes</button></> : null}>
      <div className="row wrap mb-2">
        <Badge color={STAGE_BADGE[d.stage]} dot>{STAGES.find((x) => x.id === d.stage)?.label}</Badge>
        <Badge color={CAT_COLOR[d.category]}>{CATEGORIES[d.category]}</Badge>
        <Badge color={d.priority === 'high' ? 'red' : d.priority === 'medium' ? 'orange' : 'green'}>{d.priority} priority</Badge>
      </div>
      <p style={{ color: 'var(--text-2)' }}>{d.description}</p>
      <div className="grid grid-2 mb-2" style={{ gap: 12 }}>
        <div className="panel-soft"><div className="xs muted mb-1">Complainant</div><Person name={d.complainant || 'Not stated'} /></div>
        <div className="panel-soft"><div className="xs muted mb-1">Respondent</div><Person name={d.respondent || 'Not stated'} /></div>
      </div>
      <dl className="facts mb-2">
        <dt>Land record</dt><dd><Link to={`/records/${d.record_id}`}>{d.code}</Link> · {d.record_title}</dd>
        <dt>Referred to</dt><dd>{d.referred_to || '—'}</dd>
        <dt>Open for</dt><dd>{Math.max(1, Math.round(d.age_days))} days</dd>
        {d.resolved_at && <><dt>Resolved</dt><dd>{fmtDateTime(d.resolved_at)}</dd></>}
      </dl>
      {official ? (
        <>
          <div className="field-label mb-1">Stage</div>
          <div className="row wrap mb-2">
            {STAGES.map((st) => <button key={st.id} className={`btn btn-sm ${d.stage === st.id ? 'btn-primary' : 'btn-outline'}`} onClick={() => onUpdate(d.id, { stage: st.id }, `Moved to ${st.label}`)}>{st.label}</button>)}
          </div>
          <div className="grid grid-2" style={{ gap: 12 }}>
            <Field label="Mediator"><select value={s.mediator_id} onChange={(e) => setS({ ...s, mediator_id: e.target.value })}><option value="">Unassigned</option>{mediators.map((m) => <option key={m.id} value={m.id}>{m.full_name} · {m.title || m.role}</option>)}</select></Field>
            <Field label="Mediation session"><input type="datetime-local" value={s.session_at} onChange={(e) => setS({ ...s, session_at: e.target.value })} /></Field>
          </div>
          <Field label="Venue"><input value={s.venue} onChange={(e) => setS({ ...s, venue: e.target.value })} placeholder="e.g. Sub-county hall" /></Field>
          <Field label="Outcome / agreement reached"><textarea rows={3} value={s.outcome} onChange={(e) => setS({ ...s, outcome: e.target.value })} placeholder="Record what the parties agreed" /></Field>
        </>
      ) : (
        <>
          {d.session_at && <div className="alert alert-info"><CalendarClock size={16} /><div><strong>Mediation session</strong>{fmtDateTime(d.session_at)} · {d.venue} {d.mediator_name && `· ${d.mediator_name}`}</div></div>}
          {d.outcome && <div className="alert alert-ok"><Gavel size={16} /><div><strong>Outcome</strong>{d.outcome}</div></div>}
        </>
      )}
      <div className="panel-soft small mt-1"><Tile icon={Scale} color="blue" size="xs" /> The sealed record, boundary and evidence fingerprints form the evidence pack for this dispute. <Link to={`/records/${d.record_id}`}>Open the record</Link> to print it.</div>
    </Drawer>
  );
}
