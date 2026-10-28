import { useEffect, useState } from 'react';
import { api, CATEGORIES } from '../api';
import { Field, Modal, useToast } from './ui.jsx';

const REFERRALS = ['LC1 Court (village Local Council Court)', 'Judiciary court-annexed mediation', 'Legal aid service provider', 'Advocate via Legalfinder', 'Clan leaders'];

export default function DisputeForm({ record, onClose, onSaved }) {
  const toast = useToast();
  const [records, setRecords] = useState([]);
  const [f, setF] = useState({
    record_id: record?.id || '', title: '', category: 'ownership', priority: 'medium',
    complainant: '', respondent: '', description: '', referred_to: REFERRALS[0],
  });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!record) api('/records?status=sealed&pageSize=100&sort=title').then((d) => setRecords(d.records)).catch(() => {}); }, [record]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function save() {
    if (!f.record_id) return toast('Choose the land record', 'warning');
    if (!f.description.trim()) return toast('Describe the dispute', 'warning');
    setBusy(true);
    try {
      await api('/disputes', { method: 'POST', body: f });
      toast('The dispute has been referred and officials notified.', 'success', 'Dispute reported');
      onSaved?.();
      onClose();
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <Modal title="Report a land dispute" onClose={onClose} size="lg"
      footer={<><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Refer dispute'}</button></>}>
      {!record && (
        <Field label="Land record">
          <select value={f.record_id} onChange={set('record_id')}>
            <option value="">Choose a sealed record…</option>
            {records.map((r) => <option key={r.id} value={r.id}>{r.code} · {r.title}</option>)}
          </select>
        </Field>
      )}
      {record && <div className="panel-soft mb-2 small"><strong>{record.code}</strong> · {record.title}</div>}
      <div className="grid grid-3" style={{ gap: 12 }}>
        <Field label="Category"><select value={f.category} onChange={set('category')}>{Object.entries(CATEGORIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Priority"><select value={f.priority} onChange={set('priority')}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></Field>
        <Field label="Refer to"><select value={f.referred_to} onChange={set('referred_to')}>{REFERRALS.map((r) => <option key={r}>{r}</option>)}</select></Field>
      </div>
      <Field label="Short title"><input value={f.title} onChange={set('title')} placeholder="e.g. Neighbour moved the boundary marks" /></Field>
      <div className="grid grid-2" style={{ gap: 12 }}>
        <Field label="Complainant"><input value={f.complainant} onChange={set('complainant')} placeholder="Who is raising the dispute" /></Field>
        <Field label="Respondent"><input value={f.respondent} onChange={set('respondent')} placeholder="Who the dispute is against" /></Field>
      </div>
      <Field label="What happened?"><textarea rows={4} value={f.description} onChange={set('description')} placeholder="Describe the dispute in plain words." /></Field>
      <p className="small muted">The sealed record, boundary, witnesses and evidence fingerprints are attached automatically as the evidence pack.</p>
    </Modal>
  );
}
