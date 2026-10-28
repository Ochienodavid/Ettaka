import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity as ActivityIcon, AlertTriangle, ArrowRight, Blocks, CalendarClock, CheckCircle2, FilePlus2, FileText, Fingerprint, Gavel, HeartHandshake,
  Landmark, Map, MapPin, MessageCircleQuestion, QrCode, Scale, ScanText, ShieldAlert, ShieldCheck, Sparkles, BarChart3, Upload, Users,
} from 'lucide-react';
import { api, acres, fmtDateTime, fmtTime, greeting, isOfficial, pct, timeAgo, TYPE_LABELS, CATEGORIES } from '../api';
import { useAuth } from '../auth.jsx';
import { usePage } from '../theme.jsx';
import { Badge, Card, Empty, MiniCalendar, Person, Seg, Skeleton, Stat, StatusBadge, Tile } from '../components/ui.jsx';
import { AreaTrend, Bars, Donut, Legend, PALETTE } from '../components/charts.jsx';

const ACTION_STYLE = {
  'record.created': ['Record created', 'blue', FileText], 'record.sealed': ['Sealed', 'green', Fingerprint], 'evidence.added': ['Evidence', 'purple', Upload],
  'dispute.reported': ['Dispute', 'orange', Scale], 'dispute.updated': ['Mediation', 'purple', Gavel], 'auth.login': ['Sign-in', 'gray', Users],
  'agreement.drafted': ['Agreement', 'teal', FileText], 'ledger.verified': ['Ledger check', 'green', Blocks], 'demo.tamper': ['Tamper demo', 'red', ShieldAlert],
  'demo.restore': ['Restore', 'gray', ShieldCheck], 'user.photo': ['Profile photo', 'blue', Users], 'settings.updated': ['Settings', 'gray', Sparkles], 'user.updated': ['Users', 'gray', Users], 'record.deleted': ['Deleted', 'red', FileText],
};
export const actionMeta = (a) => ACTION_STYLE[a] || [a, 'gray', ActivityIcon];

export default function Dashboard() {
  const { user } = useAuth();
  const official = isOfficial(user);
  usePage(`${greeting()}, ${user.full_name.split(' ')[1] || user.full_name.split(' ')[0]} 👋`,
    official ? "Here's what is happening with land records in your area today." : "Here's the latest on your family's land.");
  return official ? <OfficialDashboard /> : <CitizenDashboard />;
}

function useDashboardData() {
  const [d, setD] = useState(null);
  useEffect(() => {
    Promise.all([
      api('/analytics/overview'), api('/activity?pageSize=7&exclude=auth'), api('/disputes'), api('/analytics/map'),
      api('/ledger?pageSize=1'), api('/records?flag=consent&pageSize=5'),
    ]).then(([overview, activity, disputes, map, ledger, consent]) => setD({ overview, activity, disputes, map, ledger, consent })).catch(() => setD({ error: true }));
  }, []);
  return d;
}

function OfficialDashboard() {
  const d = useDashboardData();
  const nav = useNavigate();
  const [series, setSeries] = useState('records');
  if (!d) return <DashSkeleton />;
  if (d.error) return <div className="alert alert-danger"><AlertTriangle size={16} />Could not load the dashboard.</div>;
  const { overview: o, activity, disputes, map, ledger } = d;
  const t = o.totals;
  const growth = t.new_prev_30d ? Math.round(((t.new_30d - t.new_prev_30d) / t.new_prev_30d) * 100) : null;
  const typeData = o.byType.map((x) => ({ name: TYPE_LABELS[x.id], value: x.value }));
  const alerts = [
    ...map.overlaps.map((x) => ({ kind: 'danger', icon: ShieldAlert, title: `Boundary overlap: ${x.a.code} ↔ ${x.b.code}`, sub: `${x.pct_of_smaller}% of the smaller plot (${x.area_m2.toLocaleString()} m²). Possible double sale.`, to: `/records/${x.a.id}` })),
    ...d.consent.records.map((r) => ({ kind: 'warning', icon: HeartHandshake, title: `Spousal consent missing: ${r.code}`, sub: r.title, to: `/records/${r.id}` })),
    ...(o.verifTotals.failed ? [{ kind: 'warning', icon: QrCode, title: `${o.verifTotals.failed} failed verification attempts`, sub: 'Codes that did not match any record: possible forged papers.', to: '/verification' }] : []),
  ];
  const head = ledger.blocks[0];

  return (
    <>
      <div className="grid grid-6 kpis section">
        <Stat icon={FileText} color="blue" label="Land records" value={t.records.toLocaleString()} trend={growth} trendLabel="vs last 30 days" onClick={() => nav('/records')} />
        <Stat icon={Fingerprint} color="green" label="Sealed in ledger" value={t.sealed} foot={<span className="trend up"><CheckCircle2 size={13} />{pct(t.sealed, t.records)}%<span>of all records</span></span>} />
        <Stat icon={Map} color="teal" label="Acres secured" value={Math.round(t.sealed_area_m2 / 4046.86).toLocaleString()} foot={<span className="trend flat"><MapPin size={13} /><span>across {t.districts} districts</span></span>} onClick={() => nav('/map')} />
        <Stat icon={HeartHandshake} color="gold" label="Records naming a woman" value={`${pct(t.with_women, t.records)}%`} foot={<span className="trend up"><Sparkles size={13} /><span>SDG 5.a.1</span></span>} />
        <Stat icon={Scale} color="orange" label="Open disputes" value={o.disputes.open} foot={<span className="trend warn"><CalendarClock size={13} />{o.disputes.upcoming_sessions}<span>sessions scheduled</span></span>} onClick={() => nav('/disputes')} />
        <Stat icon={ShieldCheck} color="purple" label="Verifications (7 days)" value={o.verifTotals.last_7d} foot={<span className="trend up"><Landmark size={13} />{o.verifTotals.lenders}<span>by lenders</span></span>} onClick={() => nav('/verification')} />
      </div>

      <div className="grid g-3a section">
        <Card title="Records and seals" sub="Last 12 months" actions={<Seg value={series} onChange={setSeries} options={[{ id: 'records', label: 'Records' }, { id: 'acres', label: 'Acres' }]} />}>
          {series === 'records'
            ? <AreaTrend data={o.monthly} series={[{ key: 'created', name: 'Recorded', color: '#2563eb' }, { key: 'sealed', name: 'Sealed', color: '#16a34a' }]} />
            : <AreaTrend data={o.monthly} series={[{ key: 'acres', name: 'Acres sealed', color: '#b8922a' }]} fmt={(v) => Math.round(v)} />}
        </Card>
        <Card title="Records by type" sub="All recorded land">
          <Donut data={typeData} center={t.records} sub="Records" height={170} inner={52} outer={76} />
          <div className="mt-2"><Legend data={typeData} /></div>
        </Card>
        <Card title="Ledger integrity" icon={Blocks} footer={<Link to="/ledger">Open ledger explorer <ArrowRight size={14} /></Link>}>
          <div className="verdict verdict-ok" style={{ padding: 14 }}>
            <div className="verdict-head"><div className="verdict-icon" style={{ width: 40, height: 40 }}><ShieldCheck size={20} /></div>
              <div><div className="verdict-title" style={{ fontSize: '0.98rem' }}>Chain intact</div><div className="verdict-sub">{o.ledger.length} entries · SHA-256</div></div></div>
          </div>
          <dl className="facts mt-2" style={{ gridTemplateColumns: '92px 1fr' }}>
            <dt>Head</dt><dd className="mono truncate" title={head?.seal_hash}>{head?.seal_hash.slice(0, 18)}…</dd>
            <dt>Last sealed</dt><dd>{timeAgo(o.ledger.last_sealed)}</dd>
            <dt>Latest</dt><dd className="truncate">{head ? <Link to={`/records/${head.record_id}`}>{head.code}</Link> : '—'}</dd>
          </dl>
        </Card>
      </div>

      <div className="split-wide section">
        <Card title="Recent activity" flush footer={<Link to="/activity">View full audit trail <ArrowRight size={14} /></Link>}>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Who</th><th>Action</th><th>Details</th><th>Record</th><th>When</th></tr></thead>
              <tbody>
                {activity.activity.map((a) => {
                  const [label, color] = actionMeta(a.action);
                  return (
                    <tr key={a.id} className={a.record_id ? 'clickable' : ''} onClick={() => a.record_id && nav(`/records/${a.record_id}`)}>
                      <td><Person name={a.actor_name || 'System'} src={a.actor_photo} /></td>
                      <td><Badge color={color}>{label}</Badge></td>
                      <td className="truncate" style={{ maxWidth: 300 }}>{a.summary}</td>
                      <td>{a.code ? <span className="code-chip">{a.code}</span> : '—'}</td>
                      <td className="nowrap muted">{timeAgo(a.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="stack">
          <Card title="Mediation calendar" icon={CalendarClock}>
            <MiniCalendar marks={disputes.sessions.map((s) => s.session_at)} />
          </Card>
          <Card title="Upcoming sessions" footer={<Link to="/disputes">View all disputes <ArrowRight size={14} /></Link>}>
            {disputes.sessions.length === 0 ? <Empty title="No sessions scheduled" /> : (
              <div className="list">
                {disputes.sessions.slice(0, 4).map((s) => (
                  <div className="list-item" key={s.id}>
                    <Tile icon={Gavel} color="purple" size="sm" />
                    <div className="grow"><div className="title truncate">{s.title}</div><div className="sub">{fmtDateTime(s.session_at)} · {s.venue || s.district}</div></div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <div className="grid g-3b section">
        <Card title="Needs your attention" icon={AlertTriangle} sub={`${alerts.length} alert${alerts.length === 1 ? '' : 's'}`}>
          {alerts.length === 0 ? <Empty icon={CheckCircle2} title="Nothing needs attention" /> : (
            <div className="list">
              {alerts.slice(0, 5).map((a, i) => (
                <div className="list-item" key={i} style={{ cursor: 'pointer' }} onClick={() => nav(a.to)}>
                  <Tile icon={a.icon} color={a.kind === 'danger' ? 'red' : 'orange'} size="sm" />
                  <div className="grow"><div className="title">{a.title}</div><div className="sub">{a.sub}</div></div>
                  <ArrowRight size={16} color="var(--faint)" />
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card title="Records by district" sub="Top districts">
          <Bars data={o.byDistrict.slice(0, 7).map((x) => ({ label: x.id, sealed: x.sealed, draft: x.records - x.sealed }))} layout="vertical" stacked height={230}
            series={[{ key: 'sealed', name: 'Sealed', color: '#2563eb' }, { key: 'draft', name: 'Draft', color: '#cbd5e1' }]} />
        </Card>
        <Card title="Quick actions">
          <div className="grid grid-2" style={{ gap: 10 }}>
            {[
              ['/records/new', FilePlus2, 'New record', 'blue'], ['/disputes', Scale, 'Disputes', 'orange'], ['/map', Map, 'Land map', 'green'],
              ['/verification', QrCode, 'Verify', 'purple'], ['/digitise', ScanText, 'Old papers', 'teal'], ['/reports', BarChart3, 'Reports', 'gold'],
            ].map(([to, I, l, c]) => (
              <Link key={to} to={to} className="chip" style={{ flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '14px 8px', textDecoration: 'none' }}>
                <Tile icon={I} color={c} size="sm" /><span className="small strong" style={{ color: 'var(--text-2)' }}>{l}</span>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

function CitizenDashboard() {
  const nav = useNavigate();
  const [d, setD] = useState(null);
  useEffect(() => {
    Promise.all([api('/records?pageSize=20'), api('/disputes'), api('/analytics/overview'), api('/notifications')])
      .then(([records, disputes, overview, notes]) => setD({ records, disputes, overview, notes })).catch(() => setD({ error: true }));
  }, []);
  const tips = useMemo(() => [
    ['Can my husband sell our family land without my consent?', HeartHandshake],
    ['My husband died. Can his brothers evict me from our land?', ShieldAlert],
    ['What should I check before buying a plot?', FileText],
  ], []);
  if (!d) return <DashSkeleton />;
  if (d.error) return <div className="alert alert-danger"><AlertTriangle size={16} />Could not load your dashboard.</div>;
  const recs = d.records.records;
  const t = d.overview.totals;
  return (
    <>
      <div className="grid grid-4 section">
        <Stat icon={FileText} color="blue" label="My land records" value={t.records} foot={<span className="trend flat"><span>{t.drafts} draft{t.drafts === 1 ? '' : 's'}</span></span>} />
        <Stat icon={Fingerprint} color="green" label="Sealed and protected" value={t.sealed} foot={<span className="trend up"><CheckCircle2 size={13} /><span>tamper-evident</span></span>} />
        <Stat icon={Map} color="teal" label="Land documented" value={(t.area_m2 / 4046.86).toFixed(2)} unit="acres" foot={<span className="trend flat"><span>GPS mapped</span></span>} />
        <Stat icon={ShieldCheck} color="purple" label="Times verified" value={d.overview.verifTotals.total} foot={<span className="trend up"><Landmark size={13} />{d.overview.verifTotals.lenders}<span>by lenders</span></span>} />
      </div>
      <div className="split-wide section">
        <Card title="My land records" actions={<Link to="/records/new" className="btn btn-primary btn-sm"><FilePlus2 size={15} /> New record</Link>} flush>
          {recs.length === 0 ? <Empty icon={FileText} title="No records yet" action={<Link className="btn btn-primary" to="/records/new">Record your first plot</Link>}>Record a plot to protect it.</Empty> : (
            <div className="table-wrap"><table className="table"><tbody>
              {recs.map((r) => (
                <tr key={r.id} className="clickable" onClick={() => nav(r.status === 'draft' ? `/records/${r.id}/edit` : `/records/${r.id}`)}>
                  <td><div className="row"><Tile icon={FileText} color={r.status === 'sealed' ? 'green' : 'gray'} size="sm" /><div><div className="strong" style={{ color: 'var(--text)' }}>{r.title}</div><div className="small muted">{TYPE_LABELS[r.record_type]} · {[r.village, r.district].filter(Boolean).join(', ')}</div></div></div></td>
                  <td>{acres(r.area_m2)}</td>
                  <td><span className="code-chip">{r.code}</span></td>
                  <td><StatusBadge status={r.status} />{r.open_disputes > 0 && <Badge color="orange" className="mt-1">Dispute</Badge>}</td>
                </tr>
              ))}
            </tbody></table></div>
          )}
        </Card>
        <div className="stack">
          <Card title="Updates" icon={ActivityIcon}>
            {d.notes.notifications.length === 0 ? <Empty title="No updates yet" /> : (
              <div className="list">{d.notes.notifications.slice(0, 5).map((n) => (
                <div key={n.id} className="list-item" style={{ cursor: n.link ? 'pointer' : 'default' }} onClick={() => n.link && nav(n.link)}>
                  <Tile icon={n.kind === 'danger' ? ShieldAlert : n.kind === 'warning' ? AlertTriangle : n.kind === 'success' ? CheckCircle2 : ShieldCheck} color={n.kind === 'danger' ? 'red' : n.kind === 'warning' ? 'orange' : n.kind === 'success' ? 'green' : 'blue'} size="sm" />
                  <div className="grow"><div className="title">{n.title}</div><div className="sub">{timeAgo(n.created_at)}</div></div>
                </div>
              ))}</div>
            )}
          </Card>
          <Card title="My disputes" icon={Scale}>
            {d.disputes.disputes.length === 0 ? <Empty title="No disputes" /> : d.disputes.disputes.map((x) => (
              <div key={x.id} className="list-item">
                <div className="grow"><div className="title">{x.title}</div><div className="sub">{CATEGORIES[x.category]} · {x.session_at ? `Session ${fmtDateTime(x.session_at)}` : 'No session yet'}</div></div>
                <Badge color={x.stage === 'resolved' ? 'green' : 'purple'}>{x.stage.replace('_', ' ')}</Badge>
              </div>
            ))}
          </Card>
        </div>
      </div>
      <Card title="Know your rights" icon={MessageCircleQuestion} sub="Answers grounded in Ugandan law, with sources">
        <div className="grid grid-3" style={{ gap: 10 }}>
          {tips.map(([q, I]) => <button key={q} className="chip" onClick={() => nav(`/rights?q=${encodeURIComponent(q)}`)}><I size={16} color="var(--primary)" style={{ flex: 'none', marginTop: 2 }} />{q}</button>)}
        </div>
      </Card>
    </>
  );
}

function DashSkeleton() {
  return (
    <div className="stack">
      <div className="grid grid-6">{[...Array(6)].map((_, i) => <div className="stat" key={i}><div className="grow stack-sm"><Skeleton h={12} w="60%" /><Skeleton h={26} w="45%" /><Skeleton h={10} w="70%" /></div></div>)}</div>
      <div className="grid grid-3">{[...Array(3)].map((_, i) => <div className="card" key={i}><Skeleton h={230} /></div>)}</div>
    </div>
  );
}

export { PALETTE, fmtTime };
