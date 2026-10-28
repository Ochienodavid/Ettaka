import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, fmtDateTime, qs, timeAgo } from '../api';
import { usePage } from '../theme.jsx';
import { Badge, Card, Pagination, Person, Skeleton, Tabs } from '../components/ui.jsx';
import { actionMeta } from './Dashboard.jsx';

const FILTERS = [
  { id: '', label: 'All activity' }, { id: 'record', label: 'Records' }, { id: 'evidence', label: 'Evidence' },
  { id: 'dispute', label: 'Disputes' }, { id: 'ledger', label: 'Ledger' }, { id: 'auth', label: 'Sign-ins' }, { id: 'demo', label: 'Demo' },
];

export default function Activity() {
  usePage('Audit Trail', 'Every significant action, recorded with who did it and when');
  const nav = useNavigate();
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const [d, setD] = useState(null);
  useEffect(() => { api(`/activity${qs({ action, page, pageSize: 15 })}`).then(setD).catch(() => {}); }, [action, page]);
  return (
    <Card flush>
      <div className="toolbar" style={{ paddingBottom: 0, borderBottom: 0 }}><Tabs value={action} onChange={(a) => { setAction(a); setPage(1); }} tabs={FILTERS} /></div>
      {!d ? <div style={{ padding: 20 }}><Skeleton h={400} /></div> : (
        <div className="table-wrap" style={{ borderTop: '1px solid var(--border)' }}>
          <table className="table">
            <thead><tr><th>Who</th><th>Action</th><th>Details</th><th>Record</th><th>When</th></tr></thead>
            <tbody>
              {d.activity.map((a) => {
                const [label, color, I] = actionMeta(a.action);
                return (
                  <tr key={a.id} className={a.record_id ? 'clickable' : ''} onClick={() => a.record_id && nav(`/records/${a.record_id}`)}>
                    <td><Person name={a.actor_name || 'System'} src={a.actor_photo} /></td>
                    <td><Badge color={color}><I size={11} /> {label}</Badge></td>
                    <td style={{ maxWidth: 420 }}>{a.summary}</td>
                    <td>{a.code ? <span className="code-chip">{a.code}</span> : <span className="faint">—</span>}</td>
                    <td className="nowrap"><div>{timeAgo(a.created_at)}</div><div className="xs muted">{fmtDateTime(a.created_at)}</div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {d && <Pagination page={d.page} pages={d.pages} total={d.total} pageSize={15} onPage={setPage} noun="events" />}
    </Card>
  );
}
