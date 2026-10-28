import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle, Camera, Check, FileText, Fingerprint, Gift, HeartHandshake, Home, Landmark, Plus, ScrollText, ShieldAlert, Sparkles, Trash2, Upload, Users, X,
} from 'lucide-react';
import { api, ROLE_LABELS, TENURE_LABELS, ugx } from '../api';
import { usePage } from '../theme.jsx';
import { overlapPct } from '../geo.js';
import { Badge, Card, Field, Flags, Tile, useToast } from '../components/ui.jsx';
import BoundaryMap from '../components/BoundaryMap.jsx';
import VoiceInput from '../components/VoiceInput.jsx';
import Portrait from '../components/Portrait.jsx';

const Plot3D = lazy(() => import('../three/Plot3D.jsx'));

const STEPS = [
  ['The land', 'Type and location'], ['People', 'Who has an interest'], ['Terms', 'What was agreed'],
  ['Boundary', 'Map the plot'], ['Witnesses', 'And photographs'], ['Review & seal', 'Agreement and seal'],
];
const TYPES = [
  { id: 'sale', label: 'Land sale', help: 'Someone is selling land or a kibanja to a buyer.', icon: Landmark, c: 'blue' },
  { id: 'gift', label: 'Gift of land', help: 'Land given to a family member or another person.', icon: Gift, c: 'purple' },
  { id: 'inheritance', label: 'Inheritance plan', help: 'An owner records who should inherit the land.', icon: ScrollText, c: 'orange' },
  { id: 'customary_claim', label: 'Customary claim', help: 'A family records land it already owns or occupies.', icon: Home, c: 'teal' },
];
const DEFAULT_ROLES = { sale: ['seller', 'buyer'], gift: ['donor', 'recipient'], inheritance: ['owner', 'heir'], customary_claim: ['owner', 'co_owner'] };
const ROLE_OPTIONS = {
  sale: ['seller', 'buyer', 'spouse', 'co_owner'], gift: ['donor', 'recipient', 'spouse'],
  inheritance: ['owner', 'heir', 'spouse'], customary_claim: ['owner', 'co_owner', 'spouse', 'heir'],
};
const blank = {
  record_type: 'sale', title: '', tenure: 'customary', district: '', subcounty: '', village: '', plot_description: '',
  price_ugx: '', payment_terms: '', terms_transcript: '', family_land: false, spouse_name: '', spouse_consent: false, boundary: [],
};

export default function RecordEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const loc = useLocation();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [rec, setRec] = useState(blank);
  const [parties, setParties] = useState(DEFAULT_ROLES.sale.map((role) => ({ role, full_name: '', phone: '', gender: '' })));
  const [witnesses, setWitnesses] = useState([{ full_name: '', title: 'LC1 Chairperson', phone: '', statement: '' }]);
  const [server, setServer] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState(null);
  const [geminiOn, setGeminiOn] = useState(false);
  const [caption, setCaption] = useState('');
  const [plots, setPlots] = useState([]);
  const [preview3d, setPreview3d] = useState(false);
  const pendingFile = useRef(loc.state?.file || null);
  usePage(server ? `Edit ${server.code}` : 'New Land Record', 'Record, map, witness and seal a plot of land');

  const applyServer = (r) => {
    setServer(r);
    setRec(Object.fromEntries(Object.keys(blank).map((k) => [k, r[k] ?? blank[k]])));
    if (r.parties.length) setParties(r.parties.map(({ role, full_name, phone, gender, photo_evidence_id, photo_url }) => ({ role, full_name, phone: phone || '', gender: gender || '', photo_evidence_id, photo_url })));
    if (r.witnesses.length) setWitnesses(r.witnesses.map(({ full_name, title, phone, statement, photo_evidence_id, photo_url }) => ({ full_name, title: title || '', phone: phone || '', statement: statement || '', photo_evidence_id, photo_url })));
  };

  useEffect(() => {
    api('/ai/status').then((d) => setGeminiOn(d.gemini)).catch(() => {});
    api('/analytics/map').then((d) => setPlots(d.plots)).catch(() => {});
    if (id) {
      api(`/records/${id}`).then(({ record }) => {
        if (record.status === 'sealed') nav(`/records/${id}`, { replace: true });
        else applyServer(record);
      }).catch((e) => setErr(e.message));
    } else if (loc.state?.prefill) {
      const p = loc.state.prefill;
      setRec((r) => ({ ...r, ...p.record }));
      if (p.parties) setParties(p.parties);
      if (p.witnesses?.length) setWitnesses(p.witnesses);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const set = (k) => (e) => setRec({ ...rec, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e });
  const changeType = (t) => {
    setRec({ ...rec, record_type: t });
    if (parties.every((p) => !p.full_name)) setParties(DEFAULT_ROLES[t].map((role) => ({ role, full_name: '', phone: '', gender: '' })));
  };

  async function save() {
    const body = { ...rec, parties, witnesses };
    let { record } = server ? await api(`/records/${server.id}`, { method: 'PUT', body }) : await api('/records', { method: 'POST', body });
    if (!server) {
      if (pendingFile.current) {
        const form = new FormData();
        form.append('file', pendingFile.current); form.append('kind', 'old_document'); form.append('caption', 'Original paper agreement (digitised)');
        await api(`/records/${record.id}/evidence`, { method: 'POST', form });
        pendingFile.current = null;
        record = (await api(`/records/${record.id}`)).record;
      }
      nav(`/records/${record.id}/edit`, { replace: true });
    }
    applyServer(record);
    return record;
  }

  async function go(to) {
    setErr(''); setNote(null);
    if (step === 0 && !rec.title.trim()) { setErr('Give the record a short name, for example "Plot at Seeta near the borehole".'); return; }
    setBusy(true);
    try { await save(); setStep(to); window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  async function draft() {
    setBusy(true); setErr(''); setNote(null);
    try {
      const saved = await save();
      const d = await api(`/records/${saved.id}/draft-agreement`, { method: 'POST' });
      applyServer(d.record);
      setNote(d.draft.ai ? { ok: true, text: `Drafted by Gemini in English and Luganda.${d.draft.warnings?.length ? ` Warnings: ${d.draft.warnings.join(' ')}` : ''}` } : { ok: false, text: d.draft.note });
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  async function saveAgreement(text) {
    if (!server || text === server.agreement_en) return;
    const { record } = await api(`/records/${server.id}`, { method: 'PUT', body: { agreement_en: text } });
    setServer(record);
    toast('Agreement text saved', 'success');
  }

  async function seal() {
    setBusy(true); setErr('');
    try {
      const saved = await save();
      await api(`/records/${saved.id}/seal`, { method: 'POST' });
      nav(`/records/${saved.id}`, { state: { justSealed: true } });
    } catch (e) {
      setErr(e.body?.blockers ? `Not ready to seal: ${e.body.blockers.join(' ')}` : e.message);
      setBusy(false);
    }
  }

  async function upload(e, kind) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !server) return;
    setBusy(true); setErr('');
    const pos = await new Promise((res) => {
      if (!navigator.geolocation) return res(null);
      navigator.geolocation.getCurrentPosition((p) => res(p.coords), () => res(null), { enableHighAccuracy: true, timeout: 6000 });
    });
    const form = new FormData();
    form.append('file', file); form.append('kind', kind); form.append('caption', caption);
    if (pos) { form.append('lat', pos.latitude); form.append('lng', pos.longitude); }
    try {
      await api(`/records/${server.id}/evidence`, { method: 'POST', form });
      applyServer((await api(`/records/${server.id}`)).record);
      toast('Photo fingerprinted and attached', 'success');
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); setCaption(''); }
  }

  // Identity photo of a party or witness, taken at the time of recording and sealed with the record.
  async function personPhoto(e, list, setList, i) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !server) return;
    const form = new FormData();
    form.append('file', file); form.append('kind', 'identity_photo'); form.append('caption', `Identity photo: ${list[i].full_name || 'person'}`);
    try {
      const { evidence } = await api(`/records/${server.id}/evidence`, { method: 'POST', form });
      setList(list.map((x, j) => (j === i ? { ...x, photo_evidence_id: evidence.id, photo_url: evidence.url } : x)));
      toast('Identity photo captured. It will be sealed with the record.', 'success');
    } catch (ex) { setErr(ex.message); }
  }

  async function removeEvidence(eid) {
    await api(`/records/${server.id}/evidence/${eid}`, { method: 'DELETE' });
    applyServer((await api(`/records/${server.id}`)).record);
  }

  async function remove() {
    if (!window.confirm('Delete this draft record?')) return;
    await api(`/records/${server.id}`, { method: 'DELETE' });
    toast('Draft deleted', 'info');
    nav('/records');
  }

  // Nearby recorded plots and live overlap check while drawing.
  const nearby = useMemo(() => {
    const ref = rec.boundary[0] || plots.find((p) => p.district && p.district === rec.district)?.boundary[0];
    if (!ref) return [];
    return plots.filter((p) => p.id !== server?.id && Math.abs(p.boundary[0][0] - ref[0]) < 0.015 && Math.abs(p.boundary[0][1] - ref[1]) < 0.015)
      .map((p) => ({ ...p, pct: overlapPct(rec.boundary, p.boundary) }))
      .map((p) => ({ ...p, conflict: p.pct >= 2 }));
  }, [plots, rec.boundary, rec.district, server?.id]);
  const conflicts = nearby.filter((p) => p.conflict);
  const start = rec.boundary[0] ? undefined : plots.find((p) => p.district && p.district === rec.district)?.boundary[0];

  const roleOpts = ROLE_OPTIONS[rec.record_type];
  const transfer = ['sale', 'gift'].includes(rec.record_type);

  return (
    <>
      <div className="stepper">
        {STEPS.map(([t, s], i) => (
          <button key={t} className={`step ${i === step ? 'current' : i < step ? 'done' : ''}`} onClick={() => (server || i === 0) && go(i)} disabled={busy || (!server && i > 0)}>
            <span className="step-n">{i < step ? <Check size={16} /> : i + 1}</span>
            <span className="step-t">{t}</span><span className="step-s">{s}</span>
          </button>
        ))}
      </div>

      {err && <div className="alert alert-danger"><AlertTriangle size={16} /><div>{err}</div></div>}

      <div className="split">
        <Card>
          {step === 0 && (
            <>
              <h3 className="mb-1">1. What are you recording?</h3>
              <p className="muted small">Choose the kind of land record.</p>
              <div className="choice-grid">
                {TYPES.map((t) => (
                  <button type="button" key={t.id} className={`choice ${rec.record_type === t.id ? 'active' : ''}`} onClick={() => changeType(t.id)}>
                    <Tile icon={t.icon} color={t.c} size="sm" /><div><strong>{t.label}</strong><span>{t.help}</span></div><i className="radio" />
                  </button>
                ))}
              </div>
              <div className="grid grid-2" style={{ gap: '0 16px' }}>
                <Field label="Name for this record"><input value={rec.title} onChange={set('title')} placeholder="e.g. Plot at Seeta near the borehole" /></Field>
                <Field label="Type of tenure"><select value={rec.tenure} onChange={set('tenure')}>{Object.entries(TENURE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
                <Field label="District"><input value={rec.district} onChange={set('district')} placeholder="e.g. Mukono" list="districts" /></Field>
                <Field label="Sub-county"><input value={rec.subcounty} onChange={set('subcounty')} /></Field>
                <Field label="Village / LC1"><input value={rec.village} onChange={set('village')} /></Field>
              </div>
              <datalist id="districts">{[...new Set(plots.map((p) => p.district))].map((d) => <option key={d} value={d} />)}</datalist>
              <Field label="Describe the land" hint="What is on it, and what or who borders it on each side."><textarea rows={3} value={rec.plot_description} onChange={set('plot_description')} /></Field>
              <div className="panel-soft stack">
                <label className="check"><input type="checkbox" checked={rec.family_land} onChange={set('family_land')} />
                  <span><strong>This is family land</strong><br /><span className="muted small">A family lives on it or depends on it for food or income.</span></span></label>
                {rec.family_land && transfer && (
                  <div className="grid grid-2" style={{ gap: '0 16px' }}>
                    <Field label="Spouse of the seller or giver"><input value={rec.spouse_name} onChange={set('spouse_name')} /></Field>
                    <label className="check" style={{ alignSelf: 'center' }}><input type="checkbox" checked={rec.spouse_consent} onChange={set('spouse_consent')} />
                      <span><strong>The spouse consents to this transaction</strong><br /><span className="muted small">Required by the Land Act before family land is sold or given away.</span></span></label>
                  </div>
                )}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h3 className="mb-1">2. Who is involved?</h3>
              <p className="muted small">Add everyone with an interest in the land. Include wives, widows and daughters: their rights are protected by law. Tap the camera to capture each person's photo as identity evidence.</p>
              {parties.map((p, i) => (
                <div className="person-row" key={i}>
                  <PhotoButton src={p.photo_url} name={p.full_name} gender={p.gender} onPick={(e) => personPhoto(e, parties, setParties, i)} />
                  <select value={p.role} onChange={(e) => setParties(parties.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))} aria-label="Role">
                    {[...new Set([...roleOpts, p.role])].map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                  <input placeholder="Full name" value={p.full_name} onChange={(e) => setParties(parties.map((x, j) => (j === i ? { ...x, full_name: e.target.value } : x)))} />
                  <input placeholder="Phone" inputMode="tel" value={p.phone} onChange={(e) => setParties(parties.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)))} />
                  <select value={p.gender} onChange={(e) => setParties(parties.map((x, j) => (j === i ? { ...x, gender: e.target.value } : x)))} aria-label="Gender">
                    <option value="">Gender</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option>
                  </select>
                  <button type="button" className="btn-icon" onClick={() => setParties(parties.filter((_, j) => j !== i))} aria-label="Remove"><Trash2 size={16} /></button>
                </div>
              ))}
              <button type="button" className="btn btn-soft btn-sm" onClick={() => setParties([...parties, { role: roleOpts[0], full_name: '', phone: '', gender: '' }])}><Plus size={15} /> Add person</button>
            </>
          )}

          {step === 2 && (
            <>
              <h3 className="mb-1">3. What was agreed?</h3>
              <p className="muted small">Let the parties say the terms in their own words. Ettaka turns this into a written agreement.</p>
              <VoiceInput value={rec.terms_transcript} onChange={set('terms_transcript')} geminiOn={geminiOn} />
              {transfer ? (
                <div className="grid grid-2" style={{ gap: '0 16px' }}>
                  <Field label="Price (UGX)" hint={rec.price_ugx ? ugx(String(rec.price_ugx).replace(/[^\d]/g, '')) : ''}><input inputMode="numeric" value={rec.price_ugx ?? ''} onChange={set('price_ugx')} placeholder="e.g. 18000000" /></Field>
                  <Field label="Payment terms"><input value={rec.payment_terms || ''} onChange={set('payment_terms')} placeholder="e.g. Half on signing, balance in 6 months" /></Field>
                </div>
              ) : <Field label="Terms or history of the land"><textarea rows={3} value={rec.payment_terms || ''} onChange={set('payment_terms')} /></Field>}
            </>
          )}

          {step === 3 && (
            <>
              <h3 className="mb-1">4. Map the boundary</h3>
              <p className="muted small">Walk the boundary with the neighbours and the LC1 chairperson present. Ettaka checks it against every recorded plot as you draw.</p>
              {conflicts.length > 0 && (
                <div className="alert alert-danger"><ShieldAlert size={18} /><div><strong>This boundary overlaps {conflicts.length === 1 ? 'a recorded plot' : `${conflicts.length} recorded plots`}</strong>
                  {conflicts.map((c) => <div key={c.id} className="small">{c.code} · {c.title}: about {c.pct}% overlap. This may be a double sale. Confirm with the LC1 before any money is paid.</div>)}</div></div>
              )}
              <BoundaryMap value={rec.boundary} onChange={(b) => setRec((r) => ({ ...r, boundary: b }))} height={440} others={nearby} start={start} />
              {rec.boundary.length >= 3 && (
                <div className="mt-2">
                  <button type="button" className="btn btn-soft btn-sm" onClick={() => setPreview3d(!preview3d)}>{preview3d ? 'Hide 3D preview' : 'Preview the plot in 3D'}</button>
                  {preview3d && <div className="mt-1"><Suspense fallback={null}><Plot3D boundary={rec.boundary} others={nearby} height={380} /></Suspense></div>}
                </div>
              )}
            </>
          )}

          {step === 4 && (
            <>
              <h3 className="mb-1">5. Witnesses</h3>
              <p className="muted small">The LC1 chairperson and neighbours on each side are the strongest witnesses.</p>
              {witnesses.map((w, i) => (
                <div className="witness-row" key={i}>
                  <PhotoButton src={w.photo_url} name={w.full_name} onPick={(e) => personPhoto(e, witnesses, setWitnesses, i)} />
                  <input placeholder="Full name" value={w.full_name} onChange={(e) => setWitnesses(witnesses.map((x, j) => (j === i ? { ...x, full_name: e.target.value } : x)))} />
                  <input placeholder="Title, e.g. LC1 Chairperson or Neighbour (east)" value={w.title} onChange={(e) => setWitnesses(witnesses.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                  <input placeholder="Phone" inputMode="tel" value={w.phone} onChange={(e) => setWitnesses(witnesses.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)))} />
                  <button type="button" className="btn-icon" onClick={() => setWitnesses(witnesses.filter((_, j) => j !== i))} aria-label="Remove"><Trash2 size={16} /></button>
                  <input className="wide" placeholder="What the witness confirms (optional)" value={w.statement} onChange={(e) => setWitnesses(witnesses.map((x, j) => (j === i ? { ...x, statement: e.target.value } : x)))} />
                </div>
              ))}
              <button type="button" className="btn btn-soft btn-sm" onClick={() => setWitnesses([...witnesses, { full_name: '', title: 'Neighbour', phone: '', statement: '' }])}><Plus size={15} /> Add witness</button>

              <h3 className="mt-3 mb-1">Photographs</h3>
              <p className="muted small">Photograph boundary marks (trees, stones, pegs) and any old papers. Each photo is fingerprinted and located by GPS.</p>
              <div className="row wrap mb-2">
                <input className="grow" style={{ minWidth: 220 }} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption, e.g. Jackfruit tree, east corner" aria-label="Photo caption" />
                <label className="btn btn-gold"><Camera size={16} /> Boundary mark<input type="file" accept="image/*" capture="environment" hidden onChange={(e) => upload(e, 'boundary_photo')} /></label>
                <label className="btn btn-outline"><Upload size={16} /> Old paper<input type="file" accept="image/*,application/pdf" hidden onChange={(e) => upload(e, 'old_document')} /></label>
              </div>
              <div className="gallery">
                {server?.evidence.filter((e) => e.kind !== 'identity_photo').map((e) => (
                  <figure key={e.id}>
                    {e.mime?.startsWith('image/') ? <img src={e.url} alt={e.caption || e.kind} /> : <div className="file-tile">{e.mime}</div>}
                    <figcaption><strong>{e.caption || e.kind.replace('_', ' ')}</strong><code>{e.sha256.slice(0, 16)}…</code></figcaption>
                    <button type="button" className="btn-icon" onClick={() => removeEvidence(e.id)} aria-label="Remove photo"><X size={14} /></button>
                  </figure>
                ))}
              </div>
            </>
          )}

          {step === 5 && server && (
            <>
              <div className="row-between mb-2">
                <h3>6. Review the agreement</h3>
                <button type="button" className="btn btn-primary" onClick={draft} disabled={busy}><Sparkles size={16} />{busy ? 'Working…' : server.agreement_en ? 'Redraft agreement' : `Draft agreement${geminiOn ? ' with Gemini' : ''}`}</button>
              </div>
              <Flags flags={server.flags} />
              {note && <div className={`alert ${note.ok ? 'alert-ok' : 'alert-info'}`}><Sparkles size={16} /><div>{note.text}</div></div>}
              {server.agreement_en ? (
                <div className="grid grid-2">
                  <Field label="English (edit before sealing)"><textarea rows={20} defaultValue={server.agreement_en} key={server.agreement_en} onBlur={(e) => saveAgreement(e.target.value)} className="agreement-text" /></Field>
                  <Field label="Luganda">
                    {server.agreement_lg ? <textarea rows={20} readOnly value={server.agreement_lg} className="agreement-text" />
                      : <div className="panel-soft center small muted" style={{ display: 'grid', placeItems: 'center', minHeight: 300 }}>The Luganda version is produced by Gemini when a GEMINI_API_KEY is configured on the server.</div>}
                  </Field>
                </div>
              ) : <div className="panel-soft center muted">Press <strong>Draft agreement</strong> to turn the recorded terms into a written agreement.</div>}
              {server.blockers.length > 0 ? (
                <div className="alert alert-warn mt-2"><AlertTriangle size={16} /><div><strong>Before sealing</strong><ul>{server.blockers.map((b) => <li key={b}>{b}</li>)}</ul></div></div>
              ) : (
                <div className="alert alert-ok mt-2" style={{ alignItems: 'center' }}>
                  <Fingerprint size={22} />
                  <div className="grow"><strong>Ready to seal</strong>Sealing fingerprints this record with SHA-256 and adds it to the Ettaka ledger. After sealing it cannot be changed, and any alteration will be detected.</div>
                  <button type="button" className="btn btn-gold btn-lg" onClick={seal} disabled={busy}><Fingerprint size={18} /> Seal record</button>
                </div>
              )}
            </>
          )}

          <div className="wizard-foot">
            <button type="button" className="btn btn-outline" onClick={() => go(step - 1)} disabled={busy || step === 0}>Back</button>
            {server && <button type="button" className="btn btn-ghost btn-sm" onClick={remove} style={{ color: 'var(--red)' }}><Trash2 size={15} /> Delete draft</button>}
            {step < STEPS.length - 1 && <button type="button" className="btn btn-primary" onClick={() => go(step + 1)} disabled={busy}>{busy ? 'Saving…' : 'Save and continue'}</button>}
          </div>
        </Card>

        <div className="stack">
          <Card title="Record summary" icon={FileText}>
            <dl className="facts" style={{ gridTemplateColumns: '96px 1fr' }}>
              <dt>Code</dt><dd className="mono">{server?.code || 'Assigned on save'}</dd>
              <dt>Type</dt><dd>{TYPES.find((t) => t.id === rec.record_type)?.label}</dd>
              <dt>Location</dt><dd>{[rec.village, rec.district].filter(Boolean).join(', ') || '—'}</dd>
              <dt>People</dt><dd>{parties.filter((p) => p.full_name).length}</dd>
              <dt>Witnesses</dt><dd>{witnesses.filter((w) => w.full_name).length}</dd>
              <dt>Boundary</dt><dd>{rec.boundary.length} points</dd>
              <dt>Photos</dt><dd>{server?.evidence.length || 0}</dd>
            </dl>
          </Card>
          <Card title="Protection checks" icon={HeartHandshake}>
            <div className="list">
              {[
                [parties.some((p) => p.gender === 'female'), 'A woman is named on the record'],
                [!rec.family_land || !transfer || rec.spouse_consent, 'Spousal consent for family land'],
                [witnesses.some((w) => /lc ?1|chair/i.test(w.title)), 'LC1 chairperson is a witness'],
                [witnesses.filter((w) => w.full_name).length >= 2, 'At least two witnesses'],
                [rec.boundary.length >= 3, 'Boundary mapped'],
                [conflicts.length === 0, 'No overlap with recorded plots'],
              ].map(([ok, label]) => (
                <div key={label} className="list-item" style={{ padding: '8px 0' }}>
                  <div className={`tile tile-xs ${ok ? 't-green' : 't-orange'}`}>{ok ? <Check size={14} /> : <AlertTriangle size={14} />}</div>
                  <span className="small grow">{label}</span>
                  {!ok && <Badge color="orange">Check</Badge>}
                </div>
              ))}
            </div>
          </Card>
          <Card title="Tip" icon={Users}><p className="small muted" style={{ margin: 0 }}>Record the deal on the land itself, with the neighbours present. Evidence captured on the day is far stronger than memories years later.</p></Card>
        </div>
      </div>
    </>
  );
}

function PhotoButton({ src, name, gender, onPick }) {
  return (
    <label className="photo-btn" title={src ? 'Retake identity photo' : 'Take identity photo'}>
      {src ? <img src={src} alt={name || 'Identity photo'} /> : <Portrait name={name || '?'} gender={gender} size={38} />}
      <span className="cam"><Camera size={10} /></span>
      <input type="file" accept="image/*" capture="user" hidden onChange={onPick} aria-label={`Identity photo for ${name || 'person'}`} />
    </label>
  );
}
