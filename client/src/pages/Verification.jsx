import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Landmark, QrCode, Search, ShieldAlert, ShieldCheck, ShieldX, TrendingUp } from 'lucide-react';
import { api, download, fmtDateTime, isOfficial, qs, timeAgo, VERIFIER_LABELS } from '../api';
import { useAuth } from '../auth.jsx';
import { usePage } from '../theme.jsx';
import { Badge, Card, Pagination, Skeleton, Stat, Tabs, Tile } from '../components/ui.jsx';
import { Bars, Donut, Legend } from '../components/charts.jsx';
import Verify from './Verify.jsx';

export default function Verification() {
  const { user } = useAuth();
  if (!isOfficial(user)) return <Verify />;
  return <VerificationLog />;
}

function VerificationLog() {
  usePage('Verification', 'Every check made by buyers, lenders, mediators and courts');
  const nav = useNavigate();
  const [o, setO] = useState(null);
  const [log, setLog] = useState(null);
  const [tab, setTab] = useState('all');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [code, setCode] = useState('');
  useEffect(() => { api('/analytics/overview').then(setO).catch(() => {}); }, []);
  useEffect(() => {
    api(`/verifications${qs({ page, result: tab === 'all' ? '' : tab, type })}`).then(setLog).catch(() => {});
  }, [page, tab, type]);

  if (!o) return <Skeleton h={500} />;
  const v = o.verifTotals;
  const types = o.verifierTypes.map((x) => ({ name: VERIFIER_LABELS[x.id], value: x.value }));
  return (
    <>
      <div className="grid grid-4 section">
        <Stat icon={ShieldCheck} color="green" label="Total verifications" value={v.total} foot={<span className="trend up"><TrendingUp size={13} />{v.last_7d}<span>in the last 7 days</span></span>} />
        <Stat icon={Landmark} color="blue" label="Lender checks" value={v.lenders} foot={<span className="trend flat"><span>supporting access to credit (SDG 8.10)</span></span>} />
        <Stat icon={ShieldX} color="red" label="Failed or forged" value={v.failed} foot={<span className="trend down"><span>codes not in the ledger</span></span>} />
        <Stat icon={QrCode} color="purple" label="Authentic rate" value={`${v.total ? Math.round(((v.total - v.failed) / v.total) * 100) : 0}%`} foot={<span className="trend up"><span>of all checks</span></span>} />
      </div>

      <div className="grid g-2a section">
        <Card title="Checks per day" sub="Last 14 days">
          <Bars data={o.verifications} stacked height={250} series={[{ key: 'authentic', name: 'Authentic', color: '#16a34a' }, { key: 'failed', name: 'Failed', color: '#dc2626' }]} />
        </Card>
        <Card title="Who is verifying">
          <Donut data={types} center={v.total} sub="Checks" height={170} inner={52} outer={74} />
          <div className="mt-2"><Legend data={types} /></div>
        </Card>
      </div>

      <div className="split">
        <Card flush>
          <div className="toolbar" style={{ paddingBottom: 0, borderBottom: 0 }}>
            <Tabs value={tab} onChange={(t) => { setTab(t); setPage(1); }} tabs={[{ id: 'all', label: 'All checks' }, { id: 'authentic', label: 'Authentic' }, { id: 'failed', label: 'Failed' }]} />
          </div>
          <div className="toolbar">
            <select className="select-sm" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} aria-label="Verifier">
              <option value="">All verifiers</option>{Object.entries(VERIFIER_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <button className="btn btn-outline btn-sm" style={{ marginLeft: 'auto' }} onClick={() => download('/reports/verifications.csv', 'ettaka-verifications.csv')}><Download size={15} /> Export</button>
          </div>
          {!log ? <div style={{ padding: 20 }}><Skeleton h={300} /></div> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Result</th><th>Code</th><th>Record</th><th>Verifier</th><th>When</th></tr></thead>
                <tbody>
                  {log.verifications.map((x) => (
                    <tr key={x.id} className={x.record_id ? 'clickable' : ''} onClick={() => x.record_id && nav(`/records/${x.record_id}`)}>
                      <td>{!x.found ? <Badge color="red" dot>Not found</Badge> : x.valid ? <Badge color="green" dot>Authentic</Badge> : <Badge color="red" dot>Altered</Badge>}</td>
                      <td><span className="code-chip">{x.code}</span></td>
                      <td className="truncate" style={{ maxWidth: 260 }}>{x.title || <span className="muted">Possible forged document</span>}<div className="xs muted">{x.district}</div></td>
                      <td><Badge color={x.verifier_type === 'lender' ? 'blue' : x.verifier_type === 'court' ? 'purple' : 'gray'}>{VERIFIER_LABELS[x.verifier_type]}</Badge></td>
                      <td className="nowrap muted small" title={fmtDateTime(x.created_at)}>{timeAgo(x.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {log && <Pagination page={log.page} pages={log.pages} total={log.total} pageSize={12} onPage={setPage} noun="checks" />}
        </Card>
        <div className="stack">
          <Card title="Verify a record">
            <form onSubmit={(e) => { e.preventDefault(); if (code.trim()) nav(`/verify/${code.trim().toUpperCase()}`); }} className="stack">
              <div className="input-icon"><Search size={16} /><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="ETK-XXXX-XXXX" style={{ fontFamily: 'var(--mono)' }} aria-label="Record code" /></div>
              <button className="btn btn-primary">Verify</button>
            </form>
          </Card>
          <Card title="How verification works" icon={ShieldAlert}>
            <div className="timeline">
              {[['Scan or enter the code', 'Anyone can check, no account needed.'], ['Recompute the seal', 'SHA-256 of the record as it is now.'], ['Compare to the ledger', 'Contents, chain link and evidence files.'], ['Show the verdict', 'Any change is listed field by field.']].map(([t, s], i) => (
                <div key={t} className="tl-item"><div className="tl-dot t-blue"><span className="xs strong">{i + 1}</span></div><div className="tl-body"><div className="title">{t}</div><div className="sub">{s}</div></div></div>
              ))}
            </div>
          </Card>
          <Card><div className="row"><Tile icon={Landmark} color="gold" size="sm" /><p className="small muted" style={{ margin: 0 }}>Owners are notified each time their record is verified, so they know when a lender or buyer has checked it.</p></div></Card>
        </div>
      </div>
    </>
  );
}
