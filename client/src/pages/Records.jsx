import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Download, Eye, FileClock, FilePlus2, FileText, Fingerprint, HeartHandshake, MapPin, Pencil, Scale, Search, SlidersHorizontal } from 'lucide-react';
import { api, acres, download, fmtDate, isOfficial, qs, timeAgo, TYPE_COLORS, TYPE_LABELS, TENURE_LABELS } from '../api';
import { useAuth } from '../auth.jsx';
import { usePage } from '../theme.jsx';
import { Avatars, Badge, Card, Empty, Pagination, Skeleton, Stat, StatusBadge, Tabs, Tile, useToast } from '../components/ui.jsx';
import { Donut, Legend } from '../components/charts.jsx';

export default function Records() {
  const { user } = useAuth();
  usePage(isOfficial(user) ? 'Land Records' : 'My Land Records', 'Search, filter and manage every recorded plot');
  const nav = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'all';
  const [q, setQ] = useState(params.get('q') || '');
  const [f, setF] = useState({ district: params.get('district') || '', type: '', tenure: '', sort: 'recent' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [data, setData] = useState(null);
  const [counts, setCounts] = useState(null);
  const [recent, setRecent] = useState([]);

  const tabFilter = { all: {}, sealed: { status: 'sealed' }, draft: { status: 'draft' }, consent: { flag: 'consent' }, dispute: { flag: 'dispute' } }[tab];

  useEffect(() => {
    const t = setTimeout(() => {
      api(`/records${qs({ ...tabFilter, ...f, q, page, pageSize })}`).then(setData).catch((e) => toast(e.message, 'error'));
    }, q ? 220 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, f, q, page, pageSize]);

  useEffect(() => {
    Promise.all(['', 'sealed', 'draft'].map((s) => api(`/records${qs({ status: s, pageSize: 1 })}`)).concat([api('/records?flag=consent&pageSize=1'), api('/records?flag=dispute&pageSize=1'), api('/activity?pageSize=6&action=record')]))
      .then(([all, sealed, draft, consent, dispute, act]) => {
        setCounts({ all: all.total, sealed: sealed.total, draft: draft.total, consent: consent.total, dispute: dispute.total, districts: all.facets.districts });
        setRecent(act.activity);
      }).catch(() => {});
  }, []);

  const setTab = (t) => { setPage(1); setParams((p) => { p.set('tab', t); return p; }); };
  const setFilter = (k, v) => { setPage(1); setF({ ...f, [k]: v }); };
  const districts = counts?.districts || [];

  return (
    <>
      <div className="grid grid-4 section">
        <Stat icon={FileText} color="blue" label="Total records" value={counts?.all ?? '—'} foot={<span className="trend flat"><MapPin size={13} /><span>{districts.length} districts</span></span>} />
        <Stat icon={Fingerprint} color="green" label="Sealed" value={counts?.sealed ?? '—'} foot={<span className="trend up"><span>tamper-evident evidence</span></span>} />
        <Stat icon={FileClock} color="orange" label="Drafts" value={counts?.draft ?? '—'} foot={<span className="trend warn"><span>awaiting witnesses or consent</span></span>} />
        <Stat icon={HeartHandshake} color="red" label="Consent flags" value={counts?.consent ?? '—'} foot={<span className="trend down"><span>family land without consent</span></span>} onClick={() => setTab('consent')} />
      </div>

      <div className="split split-narrow">
        <Card flush>
          <div className="toolbar" style={{ paddingBottom: 0, borderBottom: 0 }}>
            <Tabs value={tab} onChange={setTab} tabs={[
              { id: 'all', label: 'All records', count: counts?.all }, { id: 'sealed', label: 'Sealed', count: counts?.sealed },
              { id: 'draft', label: 'Drafts', count: counts?.draft }, { id: 'consent', label: 'Consent flags', count: counts?.consent },
              { id: 'dispute', label: 'In dispute', count: counts?.dispute },
            ]} />
          </div>
          <div className="toolbar">
            <div className="input-icon toolbar-search"><Search size={16} /><input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search title, code, village or person" aria-label="Search records" /></div>
            <select className="select-sm" value={f.district} onChange={(e) => setFilter('district', e.target.value)} aria-label="District">
              <option value="">All districts</option>{districts.map((d) => <option key={d.district} value={d.district}>{d.district} ({d.n})</option>)}
            </select>
            <select className="select-sm" value={f.type} onChange={(e) => setFilter('type', e.target.value)} aria-label="Type">
              <option value="">All types</option>{Object.entries(TYPE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <select className="select-sm" value={f.tenure} onChange={(e) => setFilter('tenure', e.target.value)} aria-label="Tenure">
              <option value="">All tenure</option>{Object.entries(TENURE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <select className="select-sm" value={f.sort} onChange={(e) => setFilter('sort', e.target.value)} aria-label="Sort">
              <option value="recent">Recently updated</option><option value="oldest">Oldest first</option><option value="area">Largest area</option><option value="title">Title A–Z</option>
            </select>
            <div className="row" style={{ marginLeft: 'auto' }}>
              <button className="btn btn-outline btn-sm" onClick={() => download('/reports/records.csv', 'ettaka-records.csv').then(() => toast('Records exported to CSV', 'success'))}><Download size={15} /> Export</button>
              <Link to="/records/new" className="btn btn-primary btn-sm"><FilePlus2 size={15} /> New record</Link>
            </div>
          </div>

          {!data ? <div style={{ padding: 20 }} className="stack">{[...Array(6)].map((_, i) => <Skeleton key={i} h={38} />)}</div> : data.records.length === 0 ? (
            <Empty icon={SlidersHorizontal} title="No records match these filters">Try clearing the search or filters.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Record</th><th>People</th><th>Type</th><th>Area</th><th>Status</th><th>Updated</th><th /></tr></thead>
                <tbody>
                  {data.records.map((r) => {
                    const names = (r.parties || []).map((p) => p.name);
                    const open = () => nav(r.status === 'draft' ? `/records/${r.id}/edit` : `/records/${r.id}`);
                    return (
                      <tr key={r.id} className="clickable" onClick={open}>
                        <td style={{ minWidth: 220 }}>
                          <div className="row"><Tile icon={FileText} color={TYPE_COLORS[r.record_type]} size="sm" />
                            <div style={{ minWidth: 0 }}><div className="strong truncate" style={{ color: 'var(--text)', maxWidth: 260 }}>{r.title}</div><div className="xs muted"><span className="mono">{r.code}</span> · {[r.village, r.district].filter(Boolean).join(', ')}</div></div></div>
                        </td>
                        <td><div title={names.join(', ')}><Avatars people={r.parties || []} /></div></td>
                        <td><Badge color={TYPE_COLORS[r.record_type]}>{TYPE_LABELS[r.record_type]}</Badge></td>
                        <td className="nowrap">{acres(r.area_m2)}</td>
                        <td>
                          <div className="stack-sm" style={{ alignItems: 'flex-start' }}>
                            <StatusBadge status={r.status} />
                            {r.family_land && !r.spouse_consent && ['sale', 'gift'].includes(r.record_type) && <Badge color="red">No consent</Badge>}
                            {r.open_disputes > 0 && <Badge color="orange"><Scale size={11} /> Dispute</Badge>}
                          </div>
                        </td>
                        <td className="nowrap muted small" title={fmtDate(r.updated_at)}>{timeAgo(r.updated_at)}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="table-actions">
                            <button className="btn-icon" onClick={() => nav(`/records/${r.id}`)} aria-label="View"><Eye size={16} /></button>
                            {r.status === 'draft' && <button className="btn-icon" onClick={() => nav(`/records/${r.id}/edit`)} aria-label="Edit"><Pencil size={16} /></button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {data && <Pagination page={data.page} pages={data.pages} total={data.total} pageSize={pageSize} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} />}
        </Card>

        <div className="stack">
          <Card title="By district">
            {districts.length ? (
              <>
                <Donut data={districts.slice(0, 6).map((d) => ({ name: d.district, value: d.n })).concat(districts.length > 6 ? [{ name: 'Other', value: districts.slice(6).reduce((s, d) => s + d.n, 0) }] : [])} center={counts.all} sub="Records" height={180} inner={54} outer={78} />
                <div className="mt-2"><Legend data={districts.slice(0, 6).map((d) => ({ name: d.district, value: d.n })).concat(districts.length > 6 ? [{ name: 'Other', value: districts.slice(6).reduce((s, d) => s + d.n, 0) }] : [])} /></div>
              </>
            ) : <Skeleton h={180} />}
          </Card>
          <Card title="Recent updates" footer={<Link to="/activity">View all updates</Link>}>
            <div className="list">
              {recent.map((a) => (
                <div key={a.id} className="list-item" style={{ cursor: 'pointer' }} onClick={() => a.record_id && nav(`/records/${a.record_id}`)}>
                  <Tile icon={a.action === 'record.sealed' ? Fingerprint : FileText} color={a.action === 'record.sealed' ? 'green' : 'blue'} size="xs" />
                  <div className="grow"><div className="title truncate">{a.title || a.summary}</div><div className="sub">{a.action === 'record.sealed' ? 'Sealed' : 'Created'} · {timeAgo(a.created_at)}</div></div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
