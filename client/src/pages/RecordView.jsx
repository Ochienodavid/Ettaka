import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Activity, ArrowLeft, CalendarClock, Copy, ExternalLink, FileText, Fingerprint, Gavel, Image as ImageIcon, MapPin, Pencil, Printer, RotateCcw,
  Scale, ShieldAlert, Users, Package,
} from 'lucide-react';
import { api, acres, fmtDate, fmtDateTime, isOfficial, ROLE_LABELS, STAGE_BADGE, TENURE_LABELS, timeAgo, TYPE_COLORS, TYPE_LABELS, ugx, CATEGORIES } from '../api';
import { useAuth } from '../auth.jsx';
import { usePage } from '../theme.jsx';
import { Badge, Card, Empty, Flags, Person, Skeleton, StatusBadge, Tabs, Tile, useToast, VerificationResult } from '../components/ui.jsx';
import BoundaryMap from '../components/BoundaryMap.jsx';
import DisputeForm from '../components/DisputeForm.jsx';
import { actionMeta } from './Dashboard.jsx';

const Plot3D = lazy(() => import('../three/Plot3D.jsx'));

export default function RecordView() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const toast = useToast();
  const [r, setR] = useState(null);
  const [qr, setQr] = useState(null);
  const [tab, setTab] = useState('overview');
  const [lang, setLang] = useState('en');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [others, setOthers] = useState([]);
  const [view, setView] = useState('3d');
  usePage('Land Record', r ? `${r.code} · ${TYPE_LABELS[r.record_type]} · ${[r.village, r.district].filter(Boolean).join(', ')}` : '');

  const load = () => api(`/records/${id}`).then(({ record }) => {
    setR(record);
    if (record.status === 'sealed') api(`/records/${id}/qr`).then(setQr).catch(() => {});
  }).catch((e) => setErr(e.message));
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);
  useEffect(() => {
    if (!r) return;
    const conflict = new Set(r.overlaps.map((o) => o.id));
    api('/analytics/map').then((d) => {
      const [y, x] = r.boundary[0] || [0, 0];
      setOthers(d.plots.filter((p) => p.id !== r.id && Math.abs(p.boundary[0][0] - y) < 0.02 && Math.abs(p.boundary[0][1] - x) < 0.02)
        .map((p) => ({ ...p, conflict: conflict.has(p.id) })));
    }).catch(() => {});
  }, [r]);
  useEffect(() => { if (loc.state?.justSealed) toast('The record is now in the Ettaka ledger and can be verified with its QR code.', 'success', 'Record sealed'); }, [loc.state, toast]);

  const print = (mode) => { document.body.dataset.print = mode; setTimeout(() => { window.print(); delete document.body.dataset.print; }, 60); };
  const copy = async () => { try { await navigator.clipboard.writeText(qr.url); toast('Verification link copied', 'success'); } catch { toast(qr.url, 'info', 'Verification link'); } };
  async function tamper(field) { setBusy(true); try { await api(`/demo/tamper/${r.code}`, { method: 'POST', body: { field } }); await load(); toast('The record was edited directly in the database. The seal now fails.', 'warning', 'Tampering simulated'); } finally { setBusy(false); } }
  async function restore() { setBusy(true); try { await api(`/demo/restore/${r.code}`, { method: 'POST' }); await load(); toast('Sealed values restored. Verification passes again.', 'success'); } finally { setBusy(false); } }

  if (err) return <div className="alert alert-danger"><ShieldAlert size={16} />{err}</div>;
  if (!r) return <div className="stack"><Skeleton h={60} /><div className="split-wide"><Skeleton h={480} /><Skeleton h={480} /></div></div>;

  const v = r.verification;
  const location = [r.village, r.subcounty, r.district].filter(Boolean).join(', ');
  const transfer = ['sale', 'gift'].includes(r.record_type);
  const women = r.parties.filter((p) => p.gender === 'female').length;

  return (
    <>
      <div className="page-head no-print">
        <div>
          <div className="crumbs"><Link to="/records"><ArrowLeft size={13} style={{ verticalAlign: -2 }} /> Land Records</Link> / <span className="mono">{r.code}</span></div>
          <h2>{r.title} <StatusBadge status={r.status} valid={v?.valid} /> <Badge color={TYPE_COLORS[r.record_type]}>{TYPE_LABELS[r.record_type]}</Badge></h2>
          <div className="sub row wrap"><MapPin size={14} /> {location || 'No location'} · {TENURE_LABELS[r.tenure]} tenure · Recorded by {r.created_by_name} {timeAgo(r.created_at)}</div>
        </div>
        <div className="row wrap">
          {r.status === 'draft' && <Link to={`/records/${r.id}/edit`} className="btn btn-primary"><Pencil size={16} /> Continue editing</Link>}
          {qr && <button className="btn btn-outline" onClick={copy}><Copy size={16} /> Copy verify link</button>}
          {r.agreement_en && <button className="btn btn-outline" onClick={() => print('agreement')}><Printer size={16} /> Agreement</button>}
          {r.status === 'sealed' && <button className="btn btn-outline" onClick={() => print('pack')}><Package size={16} /> Evidence pack</button>}
          {r.status === 'sealed' && <button className="btn btn-gold" onClick={() => setDisputeOpen(true)}><Scale size={16} /> Report dispute</button>}
        </div>
      </div>

      <div className="no-print"><Flags flags={r.flags} onOpen={(rid) => nav(`/records/${rid}`)} /></div>

      <div className="split-wide no-print">
        <div style={{ minWidth: 0 }}>
          <Card>
            <Tabs value={tab} onChange={setTab} tabs={[
              { id: 'overview', label: 'Overview', icon: MapPin }, { id: 'agreement', label: 'Agreement', icon: FileText },
              { id: 'evidence', label: 'Evidence', icon: ImageIcon, count: r.evidence.length }, { id: 'disputes', label: 'Disputes', icon: Scale, count: r.disputes.length },
              { id: 'activity', label: 'Activity', icon: Activity, count: r.activity.length },
            ]} />

            {tab === 'overview' && (
              <div className="stack">
                <div className="row-between">
                  <div className="seg"><button className={view === '3d' ? 'active' : ''} onClick={() => setView('3d')}>3D model</button><button className={view === 'map' ? 'active' : ''} onClick={() => setView('map')}>Map</button></div>
                  <span className="xs muted">{r.boundary.length} GPS points · {acres(r.area_m2)}</span>
                </div>
                {view === '3d'
                  ? <Suspense fallback={<Skeleton h={400} />}><Plot3D boundary={r.boundary} others={others} height={420} title={r.title} /></Suspense>
                  : <BoundaryMap value={r.boundary} height={400} others={others} />}
                {r.overlaps.length > 0 && <div className="small muted">Red dashed outlines show recorded plots that overlap this boundary. Grey outlines are neighbouring plots.</div>}
                <div>
                  <h4 className="mb-1 row"><Users size={16} /> People with an interest</h4>
                  <div className="table-wrap"><table className="table">
                    <thead><tr><th>Name</th><th>Role</th><th>Phone</th><th>Confirmed</th></tr></thead>
                    <tbody>{r.parties.map((p) => (
                      <tr key={p.id}><td><Person name={p.full_name} src={p.photo_url} gender={p.gender} sub={p.photo_url ? 'Identity photo sealed' : p.gender === 'female' ? 'Woman named on record' : null} /></td><td><Badge color="blue">{ROLE_LABELS[p.role]}</Badge></td><td>{p.phone || '—'}</td><td className="small">{p.confirmed ? fmtDateTime(p.confirmed_at) : <Badge>Pending</Badge>}</td></tr>
                    ))}</tbody>
                  </table></div>
                </div>
                <div>
                  <h4 className="mb-1 row"><Gavel size={16} /> Witnesses</h4>
                  <div className="table-wrap"><table className="table">
                    <thead><tr><th>Name</th><th>Title</th><th>Statement</th></tr></thead>
                    <tbody>{r.witnesses.map((w) => <tr key={w.id}><td><Person name={w.full_name} src={w.photo_url} sub={w.photo_url ? 'Identity photo sealed' : null} /></td><td>{w.title || '—'}</td><td className="small">{w.statement || '—'}</td></tr>)}</tbody>
                  </table></div>
                </div>
              </div>
            )}

            {tab === 'agreement' && (
              r.agreement_en ? (
                <>
                  {r.agreement_lg && <div className="seg mb-2"><button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>English</button><button className={lang === 'lg' ? 'active' : ''} onClick={() => setLang('lg')}>Luganda</button></div>}
                  <pre className="agreement">{lang === 'lg' && r.agreement_lg ? r.agreement_lg : r.agreement_en}</pre>
                </>
              ) : <Empty icon={FileText} title="No agreement yet">Draft the agreement in the record editor.</Empty>
            )}

            {tab === 'evidence' && (
              r.evidence.length ? (
                <div className="gallery">
                  {r.evidence.map((e) => (
                    <figure key={e.id}>
                      {e.mime?.startsWith('image/') ? <a href={e.url} target="_blank" rel="noreferrer"><img src={e.url} alt={e.caption || e.kind} /></a> : <a href={e.url} className="file-tile">{e.mime}</a>}
                      <figcaption><strong>{e.caption || e.kind.replace('_', ' ')}</strong>{e.lat && <span className="muted">{e.lat.toFixed(5)}, {e.lng.toFixed(5)}</span>}<code>SHA-256 {e.sha256.slice(0, 20)}…</code></figcaption>
                    </figure>
                  ))}
                </div>
              ) : <Empty icon={ImageIcon} title="No photographs or documents">Boundary-mark photos and old papers appear here, each fingerprinted.</Empty>
            )}

            {tab === 'disputes' && (
              <>
                {r.disputes.length === 0 ? <Empty icon={Scale} title="No disputes on this land" action={r.status === 'sealed' && <button className="btn btn-primary" onClick={() => setDisputeOpen(true)}>Report a dispute</button>} /> : (
                  <div className="list">
                    {r.disputes.map((d) => (
                      <div key={d.id} className="list-item" style={{ alignItems: 'flex-start' }}>
                        <Tile icon={Scale} color="orange" size="sm" />
                        <div className="grow">
                          <div className="title">{d.title}</div>
                          <div className="sub">{CATEGORIES[d.category]} · {d.complainant || '—'} v {d.respondent || '—'} · referred to {d.referred_to}</div>
                          <p className="small mt-1" style={{ color: 'var(--text-2)' }}>{d.description}</p>
                          {d.session_at && <div className="small row"><CalendarClock size={14} /> Session {fmtDateTime(d.session_at)} · {d.venue} {d.mediator_name && `· ${d.mediator_name}`}</div>}
                          {d.outcome && <div className="alert alert-ok mt-1"><Gavel size={16} /><div><strong>Outcome</strong>{d.outcome}</div></div>}
                        </div>
                        <Badge color={STAGE_BADGE[d.stage]}>{d.stage.replace('_', ' ')}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {tab === 'activity' && (
              <div className="timeline">
                {r.activity.map((a) => {
                  const [label, color, I] = actionMeta(a.action);
                  return (
                    <div className="tl-item" key={a.id}>
                      <div className={`tl-dot t-${color}`}><I size={14} /></div>
                      <div className="tl-body"><div className="title">{a.summary}</div><div className="sub">{label} · {a.actor_name} · {fmtDateTime(a.created_at)}</div></div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <div className="stack">
          <Card title="Integrity" icon={Fingerprint}>
            <VerificationResult verification={v || { sealed: false }} />
            {qr && (
              <div className="qr-box mt-2">
                <img src={qr.dataUrl} alt={`QR code for ${r.code}`} />
                <span className="mono small strong">{r.code}</span>
                <a href={qr.url} target="_blank" rel="noreferrer" className="small row" style={{ gap: 4 }}>Open public verification <ExternalLink size={12} /></a>
              </div>
            )}
            {v?.sealed && (
              <>
                <div className="field-label mt-2 mb-1">Seal (SHA-256)</div>
                <div className="hash">{v.seal_hash}</div>
                <div className="row-between mt-1 small"><span className="muted">Verified</span><strong>{r.verifications.total} times · {r.verifications.lenders} by lenders</strong></div>
                <div className="row-between small"><span className="muted">Last check</span><strong>{timeAgo(r.verifications.last)}</strong></div>
              </>
            )}
            {v?.sealed && isOfficial(user) && (
              <div className="panel-soft mt-2">
                <div className="strong small row"><ShieldAlert size={15} color="var(--red)" /> Demo: simulate fraud</div>
                <p className="xs muted mt-1">Edits this record directly in the database, bypassing Ettaka, to show the seal detects it.</p>
                <div className="row wrap">
                  <button className="btn btn-danger-soft btn-xs" onClick={() => tamper('price')} disabled={busy}>Change price</button>
                  <button className="btn btn-danger-soft btn-xs" onClick={() => tamper('boundary')} disabled={busy}>Move boundary</button>
                  <button className="btn btn-outline btn-xs" onClick={restore} disabled={busy}><RotateCcw size={12} /> Restore</button>
                </div>
              </div>
            )}
          </Card>

          <Card title="Summary">
            <dl className="facts">
              <dt>Area</dt><dd>{acres(r.area_m2)} <span className="muted small">({Math.round(r.area_m2 || 0).toLocaleString()} m²)</span></dd>
              {transfer && <><dt>Price</dt><dd>{ugx(r.price_ugx)}</dd></>}
              {r.payment_terms && <><dt>Terms</dt><dd className="small">{r.payment_terms}</dd></>}
              <dt>Family land</dt><dd>{r.family_land ? <>Yes {transfer && <Badge color={r.spouse_consent ? 'green' : 'red'}>{r.spouse_consent ? 'Spouse consented' : 'No consent'}</Badge>}</> : 'No'}</dd>
              <dt>Women named</dt><dd>{women} of {r.parties.length}</dd>
              <dt>Boundary</dt><dd>{r.boundary.length} GPS points</dd>
              <dt>Created</dt><dd>{fmtDate(r.created_at)}</dd>
              <dt>Sealed</dt><dd>{fmtDate(r.sealed_at)}</dd>
            </dl>
          </Card>
        </div>
      </div>

      {/* Printable documents */}
      <div className="print-doc">
        {document.body.dataset.print !== 'pack' && <PrintAgreement r={r} qr={qr} v={v} />}
        <PrintPack r={r} qr={qr} v={v} location={location} />
      </div>
      {disputeOpen && <DisputeForm record={r} onClose={() => setDisputeOpen(false)} onSaved={load} />}
    </>
  );
}

function PrintAgreement({ r, qr, v }) {
  return (
    <div className="print-agreement">
      <pre className="agreement">{r.agreement_en}</pre>
      <div className="signatures">
        {[...r.parties, ...r.witnesses].map((p, i) => <div key={i} className="sig"><div className="sig-line" />{p.full_name}<span>{p.role ? ROLE_LABELS[p.role] : p.title}</span></div>)}
      </div>
      {qr && <div className="print-qr"><img src={qr.dataUrl} alt="" /><div>Verify at {qr.url}<br />Seal {v?.seal_hash}</div></div>}
    </div>
  );
}

function PrintPack({ r, qr, v, location }) {
  return (
    <div className="print-pack">
      <h1>Ettaka Dispute Evidence Pack</h1>
      <p>Record {r.code} · {r.title} · {location}</p>
      <p>Generated {fmtDateTime(new Date())}. Seal {v?.seal_hash}. Status: {v?.valid ? 'AUTHENTIC AND UNALTERED' : 'ALTERED: DO NOT RELY ON THIS RECORD'}</p>
      <h2>Disputes</h2>
      {r.disputes.length ? r.disputes.map((d) => <p key={d.id}>{fmtDate(d.created_at)} · {d.title} ({CATEGORIES[d.category]}) · {d.stage}: {d.description}</p>) : <p>None recorded.</p>}
      <h2>Boundary points (latitude, longitude)</h2>
      <ol>{r.boundary.map((p, i) => <li key={i}>{p[0]}, {p[1]}</li>)}</ol>
      <p>Area: {acres(r.area_m2)}</p>
      {r.overlaps.length > 0 && <><h2>Boundary overlaps</h2><ul>{r.overlaps.map((o) => <li key={o.id}>{o.code} · {o.title}: {o.pct_of_smaller}% ({o.area_m2} m²)</li>)}</ul></>}
      <h2>Parties and witnesses</h2>
      <ul>{r.parties.map((p) => <li key={p.id}>{p.full_name}, {ROLE_LABELS[p.role]}</li>)}{r.witnesses.map((w) => <li key={w.id}>{w.full_name}, {w.title}{w.statement ? `: ${w.statement}` : ''}</li>)}</ul>
      <h2>Evidence fingerprints</h2>
      <ul>{r.evidence.map((e) => <li key={e.id}>{e.caption || e.kind}: {e.sha256}</li>)}</ul>
      <h2>Agreement</h2>
      <pre className="agreement">{r.agreement_en}</pre>
      {qr && <img src={qr.dataUrl} alt="" width="120" />}
    </div>
  );
}
