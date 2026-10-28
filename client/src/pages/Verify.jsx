import { lazy, Suspense, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Building2, Gavel, Landmark, MapPin, QrCode, Scale, Search, ShieldAlert, ShoppingBag, User, Users } from 'lucide-react';
import { api, acres, fmtDateTime, ROLE_LABELS, TYPE_LABELS, ugx } from '../api';
import { useAuth } from '../auth.jsx';
import { usePage } from '../theme.jsx';
import { Badge, Card, Flags, Person, Skeleton, Tile, VerificationResult } from '../components/ui.jsx';
import BoundaryMap from '../components/BoundaryMap.jsx';

const Plot3D = lazy(() => import('../three/Plot3D.jsx'));

const AS = [
  { id: 'buyer', label: 'Buyer', icon: ShoppingBag }, { id: 'lender', label: 'Lender', icon: Landmark },
  { id: 'mediator', label: 'Mediator', icon: Gavel }, { id: 'court', label: 'Court', icon: Building2 }, { id: 'public', label: 'Other', icon: User },
];

export default function Verify() {
  usePage('Verify a Record', 'Check that a land agreement is genuine and unaltered');
  const { code } = useParams();
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [input, setInput] = useState(code || '');
  const [as, setAs] = useState(params.get('as') || (user ? 'official' : 'public'));
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState('3d');

  useEffect(() => {
    if (!code) { setData(null); setErr(''); return; }
    setInput(code); setBusy(true); setErr('');
    api(`/verify/${encodeURIComponent(code)}?as=${as}`).then(setData).catch((e) => { setData(null); setErr(e.message); }).finally(() => setBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const submit = (e) => { e.preventDefault(); if (input.trim()) { nav(`/verify/${input.trim().toUpperCase()}`); setParams({ as }); } };
  const r = data?.record;

  return (
    <div>
      {!user && (
        <div className="page-head">
          <div><h2>Verify a land agreement</h2><div className="sub">For buyers, lenders, mediators and courts. Scan the QR code on the agreement or enter its code.</div></div>
        </div>
      )}
      <Card className="section">
        <form onSubmit={submit} className="row wrap" style={{ gap: 12 }}>
          <Tile icon={QrCode} color="purple" />
          <div className="input-icon grow" style={{ minWidth: 240 }}><Search size={16} /><input value={input} onChange={(e) => setInput(e.target.value)} placeholder="ETK-XXXX-XXXX" aria-label="Record code" style={{ fontFamily: 'var(--mono)', fontSize: '1.02rem', letterSpacing: '0.04em', textTransform: 'uppercase' }} /></div>
          <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? 'Checking…' : 'Verify record'}</button>
        </form>
        {!user && (
          <div className="row wrap mt-2" style={{ gap: 8 }}>
            <span className="small muted">I am checking as a:</span>
            {AS.map((a) => <button key={a.id} type="button" className={`btn btn-xs ${as === a.id ? 'btn-soft' : 'btn-outline'}`} onClick={() => setAs(a.id)}><a.icon size={13} /> {a.label}</button>)}
          </div>
        )}
      </Card>

      {busy && <Skeleton h={300} />}
      {err && !busy && (
        <div className="verdict verdict-bad section">
          <div className="verdict-head"><div className="verdict-icon"><ShieldAlert size={24} /></div>
            <div><div className="verdict-title">No record found</div><div className="verdict-sub">{err} Do not pay any money on the strength of this document.</div></div></div>
        </div>
      )}

      {r && !busy && (
        <>
          <div className="section"><VerificationResult verification={data.verification} /></div>
          {data.overlaps.length > 0 && (
            <div className="alert alert-danger"><ShieldAlert size={18} /><div><strong>Warning: this land overlaps another recorded plot</strong>
              {data.overlaps.map((o) => <div key={o.code}>{o.code} · {o.title} ({o.status}) · {o.pct_of_smaller}% overlap. This may be a double sale. Do not pay until the LC1 has resolved it.</div>)}</div></div>
          )}
          {data.open_disputes > 0 && <div className="alert alert-warn"><Scale size={16} /><div><strong>{data.open_disputes} open dispute{data.open_disputes === 1 ? '' : 's'} on this land</strong>Categories: {data.disputes.map((x) => x.category.replace('_', ' ')).join(', ')}.</div></div>}
          <Flags flags={data.flags.filter((f) => !f.code.startsWith('BOUNDARY_OVERLAP'))} />
          <div className="split-wide">
            <Card title={r.title} sub={`${TYPE_LABELS[r.record_type]} · ${r.code}`}>
              <div className="row-between mb-1"><div className="row small muted"><MapPin size={14} /> {r.location}</div>
                <div className="seg"><button className={view === '3d' ? 'active' : ''} onClick={() => setView('3d')}>3D</button><button className={view === 'map' ? 'active' : ''} onClick={() => setView('map')}>Map</button></div></div>
              {view === '3d' ? <Suspense fallback={<Skeleton h={360} />}><Plot3D boundary={r.boundary} height={360} title={r.title} /></Suspense> : <BoundaryMap value={r.boundary} height={360} />}
            </Card>
            <div className="stack">
              <Card title="Recorded details">
                <dl className="facts">
                  <dt>Area</dt><dd>{acres(r.area_m2)}</dd>
                  {['sale', 'gift'].includes(r.record_type) && <><dt>Price</dt><dd>{ugx(r.price_ugx)}</dd></>}
                  <dt>Family land</dt><dd>{r.family_land ? <>Yes {['sale', 'gift'].includes(r.record_type) && <Badge color={r.spouse_consent ? 'green' : 'red'}>{r.spouse_consent ? 'Spouse consented' : 'No consent'}</Badge>}</> : 'No'}</dd>
                  <dt>Sealed</dt><dd>{fmtDateTime(r.sealed_at)}</dd>
                  <dt>Checked</dt><dd>{data.times_verified} times</dd>
                </dl>
              </Card>
              <Card title="Parties" icon={Users}>
                <div className="list">{r.parties.map((p, i) => <div key={i} className="list-item"><Person name={p.full_name} gender={p.gender} sub={`${ROLE_LABELS[p.role]}${p.phone ? ` · ${p.phone}` : ''}`} /></div>)}</div>
                <h4 className="mt-2 mb-1">Witnesses</h4>
                <div className="list">{r.witnesses.map((w, i) => <div key={i} className="list-item"><Person name={w.full_name} sub={w.title} /></div>)}</div>
              </Card>
            </div>
          </div>
          <p className="xs muted center mt-2"><AlertTriangle size={12} style={{ verticalAlign: -2 }} /> An Ettaka record is evidence of land rights recorded before witnesses. It is not a certificate of title. For registered land, also search the title at the land registry.</p>
        </>
      )}
    </div>
  );
}
