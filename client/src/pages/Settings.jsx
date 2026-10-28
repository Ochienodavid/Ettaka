import { useEffect, useState } from 'react';
import {
  Bell, Bot, Camera, Building2, CheckCircle2, Cloud, Cpu, Database, Fingerprint, HardDrive, KeyRound, Lock, Map, MessageSquare, RefreshCw, Server,
  ShieldCheck, Smartphone, SlidersHorizontal, TriangleAlert, Users, Wrench, XCircle, Wallet,
} from 'lucide-react';
import { api, fmtDateTime, timeAgo, USER_ROLES } from '../api';
import { useAuth } from '../auth.jsx';
import { usePage } from '../theme.jsx';
import { Avatar, Badge, Card, Field, Person, Skeleton, Switch, Tabs, Tile, useToast } from '../components/ui.jsx';

const PERMS = [
  ['Record land', [1, 1, 1, 1]], ['See all records', [0, 1, 1, 1]], ['Seal records', [1, 1, 1, 1]], ['Manage disputes', [0, 1, 1, 1]],
  ['Verification log', [0, 1, 1, 1]], ['Tamper demo', [0, 1, 1, 1]], ['Change settings', [0, 0, 0, 1]], ['Manage users', [0, 0, 0, 1]],
];
const ROLE_COLOR = { citizen: 'gray', lc_official: 'blue', mediator: 'purple', admin: 'green' };

export default function Settings() {
  usePage('Settings', 'Organisation, policies, roles, integrations and system health');
  const { user } = useAuth();
  const toast = useToast();
  const admin = user.role === 'admin';
  const official = user.role !== 'citizen';
  const [tab, setTab] = useState(official ? 'general' : 'profile');
  const [s, setS] = useState(null);
  const [users, setUsers] = useState([]);
  const [health, setHealth] = useState(null);
  const [ai, setAi] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/settings').then((d) => setS(d.settings)).catch(() => {});
    api('/ai/status').then(setAi).catch(() => {});
    if (official) {
      api('/users').then((d) => setUsers(d.users)).catch(() => {});
      api('/system/health').then(setHealth).catch(() => {});
    }
  }, [official]);

  const setK = (sec, k, v) => setS({ ...s, [sec]: { ...s[sec], [k]: v } });
  async function save(sections) {
    setBusy(true);
    try {
      const body = Object.fromEntries(sections.map((x) => [x, s[x]]));
      const d = await api('/settings', { method: 'PUT', body });
      setS(d.settings); toast('Settings saved', 'success');
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  }
  async function setRole(u, role) {
    try { await api(`/users/${u.id}`, { method: 'PATCH', body: { role } }); setUsers(users.map((x) => (x.id === u.id ? { ...x, role } : x))); toast(`${u.full_name} is now ${USER_ROLES[role]}`, 'success'); } catch (e) { toast(e.message, 'error'); }
  }
  async function setActive(u, active) {
    try { await api(`/users/${u.id}`, { method: 'PATCH', body: { active } }); setUsers(users.map((x) => (x.id === u.id ? { ...x, active } : x))); } catch (e) { toast(e.message, 'error'); }
  }
  async function reset() {
    if (!window.confirm('Reset all demonstration data? Every record, dispute and ledger entry will be replaced with the demo dataset.')) return;
    setBusy(true);
    try { const r = await api('/system/reset-demo', { method: 'POST' }); toast(r.output, 'success', 'Demo data reset'); setTimeout(() => window.location.reload(), 900); } catch (e) { toast(e.message, 'error'); setBusy(false); }
  }

  if (!s) return <Skeleton h={500} />;
  const tabs = official
    ? [{ id: 'general', label: 'General', icon: SlidersHorizontal }, { id: 'users', label: 'Users & roles', icon: Users }, { id: 'integrations', label: 'Integrations', icon: Cloud },
      { id: 'security', label: 'Security', icon: Lock }, { id: 'system', label: 'System health', icon: Server }, { id: 'profile', label: 'My profile', icon: KeyRound }]
    : [{ id: 'profile', label: 'My profile', icon: KeyRound }, { id: 'integrations', label: 'Integrations', icon: Cloud }];
  const ro = !admin;

  return (
    <div className="split">
      <div style={{ minWidth: 0 }}>
        <Tabs value={tab} onChange={setTab} tabs={tabs} />
        {ro && official && tab !== 'profile' && <div className="alert alert-info"><ShieldCheck size={16} /><div>Only an administrator can change these settings. You can view them.</div></div>}

        {tab === 'general' && (
          <div className="stack">
            <Card style={{ background: 'linear-gradient(120deg, var(--primary-soft), var(--gold-soft))' }}>
              <div className="row" style={{ gap: 18, alignItems: 'flex-start' }}>
                <Tile icon={Wrench} color="blue" />
                <div className="grow">
                  <h3>Policy control centre</h3><p className="small muted">Rules Ettaka enforces on every record before it can be sealed.</p>
                  <div className="grid grid-2 mt-2" style={{ gap: 12 }}>
                    {[
                      ['block_family_land_without_consent', 'Spousal consent guard', 'Block sealing family-land transfers without consent', HeartIcon],
                      ['require_lc1_witness', 'Require LC1 witness', 'Flag records without a local leader as witness', Building2],
                    ].map(([k, t, d, I]) => (
                      <div key={k} className="card" style={{ padding: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
                        <Tile icon={I} color="gold" size="sm" /><div className="grow"><div className="strong small">{t}</div><div className="xs muted">{d}</div></div>
                        <Switch checked={s.policy[k]} disabled={ro} onChange={(v) => setK('policy', k, v)} label={t} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
            <Card title="Organisation profile" icon={Building2} actions={admin && <button className="btn btn-primary btn-sm" onClick={() => save(['organisation', 'policy'])} disabled={busy}>Save changes</button>}>
              <div className="grid grid-2" style={{ gap: '0 16px' }}>
                <Field label="Organisation name"><input value={s.organisation.name} disabled={ro} onChange={(e) => setK('organisation', 'name', e.target.value)} /></Field>
                <Field label="Deployment"><input value={s.organisation.deployment} disabled={ro} onChange={(e) => setK('organisation', 'deployment', e.target.value)} /></Field>
                <Field label="Contact email"><input value={s.organisation.contact_email} disabled={ro} onChange={(e) => setK('organisation', 'contact_email', e.target.value)} /></Field>
                <Field label="Time zone"><input value={s.organisation.timezone} disabled /></Field>
                <Field label="Minimum witnesses"><input type="number" min="1" max="6" value={s.policy.min_witnesses} disabled={ro} onChange={(e) => setK('policy', 'min_witnesses', Number(e.target.value))} /></Field>
                <Field label="Overlap alert threshold (%)" hint="Overlaps smaller than this are treated as GPS noise."><input type="number" min="1" max="50" value={s.policy.overlap_threshold_pct} disabled={ro} onChange={(e) => setK('policy', 'overlap_threshold_pct', Number(e.target.value))} /></Field>
              </div>
            </Card>
            <Card title="Notifications" icon={Bell} actions={admin && <button className="btn btn-primary btn-sm" onClick={() => save(['notifications'])} disabled={busy}>Save</button>}>
              {[['notify_on_verification', 'Notify owners when their record is verified'], ['notify_on_overlap', 'Alert officials about boundary overlaps'], ['email', 'Email notifications'], ['sms', 'SMS notifications (requires an SMS gateway)']].map(([k, l]) => (
                <div key={k} className="list-item"><span className="grow small">{l}</span><Switch checked={s.notifications[k]} disabled={ro} onChange={(v) => setK('notifications', k, v)} label={l} /></div>
              ))}
            </Card>
          </div>
        )}

        {tab === 'users' && (
          <div className="stack">
            <Card title="Users" icon={Users} sub={`${users.length} accounts`} flush>
              <div className="table-wrap"><table className="table">
                <thead><tr><th>User</th><th>Role</th><th>District</th><th>Records</th><th>Last sign-in</th><th>Active</th></tr></thead>
                <tbody>{users.map((u) => (
                  <tr key={u.id}>
                    <td><Person name={u.full_name} src={u.photo_url} sub={`${u.title || USER_ROLES[u.role]} · ${u.phone}`} /></td>
                    <td>{admin && u.id !== user.id ? (
                      <select className="select-sm" value={u.role} onChange={(e) => setRole(u, e.target.value)} aria-label={`Role for ${u.full_name}`}>{Object.entries(USER_ROLES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                    ) : <Badge color={ROLE_COLOR[u.role]}>{USER_ROLES[u.role]}</Badge>}</td>
                    <td>{u.district || '—'}</td><td>{u.records}</td>
                    <td className="small muted nowrap">{u.last_login_at ? timeAgo(u.last_login_at) : 'Never'}</td>
                    <td><Switch checked={u.active} disabled={!admin || u.id === user.id} onChange={(v) => setActive(u, v)} label="Active" /></td>
                  </tr>
                ))}</tbody>
              </table></div>
            </Card>
            <Card title="Permission matrix" icon={ShieldCheck} flush>
              <div className="table-wrap"><table className="table">
                <thead><tr><th>Permission</th>{Object.values(USER_ROLES).map((r) => <th key={r} className="center">{r}</th>)}</tr></thead>
                <tbody>{PERMS.map(([p, v]) => (
                  <tr key={p}><td className="strong" style={{ color: 'var(--text)' }}>{p}</td>{v.map((x, i) => <td key={i} className="center">{x ? <CheckCircle2 size={17} color="var(--green)" /> : <span className="faint">—</span>}</td>)}</tr>
                ))}</tbody>
              </table></div>
            </Card>
          </div>
        )}

        {tab === 'integrations' && (
          <div className="grid grid-2">
            {[
              [Bot, 'Google Gemini', ai?.gemini ? `Connected · ${ai.model}` : 'Not configured. Set GEMINI_API_KEY on the server.', ai?.gemini, 'Voice transcription, Luganda drafting, document reading and grounded legal answers.'],
              [Map, 'Google Maps Platform', import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? 'Connected' : 'Not configured. Using OpenStreetMap and Esri imagery.', Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY), 'Boundary mapping and satellite imagery.'],
              [Database, 'PostgreSQL', 'Connected', true, 'Records, seal ledger, audit trail and analytics.'],
              [MessageSquare, 'SMS gateway', 'Not connected', false, 'SMS alerts and USSD verification for basic phones (planned).'],
              [Wallet, 'Mobile money', 'Not connected', false, 'Plot Check fees for buyers (planned).'],
              [Smartphone, 'Legalfinder', 'Not connected', false, 'Referral to vetted advocates (planned).'],
            ].map(([I, t, st, ok, d]) => (
              <Card key={t}>
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  <Tile icon={I} color={ok ? 'green' : 'gray'} />
                  <div className="grow"><div className="row-between"><strong>{t}</strong><Badge color={ok ? 'green' : 'gray'} dot>{ok ? 'Connected' : 'Off'}</Badge></div>
                    <div className="small muted mt-1">{d}</div><div className="xs mt-1" style={{ color: ok ? 'var(--green)' : 'var(--muted)' }}>{st}</div></div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {tab === 'security' && (
          <Card title="Security and compliance" icon={Lock} actions={admin && <button className="btn btn-primary btn-sm" onClick={() => save(['security'])} disabled={busy}>Save</button>}>
            <div className="grid grid-2" style={{ gap: '0 16px' }}>
              <Field label="Minimum PIN length"><input type="number" min="4" max="6" value={s.security.pin_min_length} disabled={ro} onChange={(e) => setK('security', 'pin_min_length', Number(e.target.value))} /></Field>
              <Field label="Session length (days)"><input type="number" min="1" max="30" value={s.security.session_days} disabled={ro} onChange={(e) => setK('security', 'session_days', Number(e.target.value))} /></Field>
            </div>
            {[['audit_logging', 'Audit logging', 'Record every significant action in the audit trail'], ['mask_phones_on_portal', 'Mask phone numbers on the public portal', 'Required by the Data Protection and Privacy Act, 2019']].map(([k, t, d]) => (
              <div key={k} className="list-item"><div className="grow"><div className="small strong">{t}</div><div className="xs muted">{d}</div></div><Switch checked={s.security[k]} disabled={ro} onChange={(v) => setK('security', k, v)} label={t} /></div>
            ))}
            <div className="list-item"><div className="grow"><div className="small strong">Append-only seal ledger</div><div className="xs muted">Enforced by a database trigger. Cannot be turned off.</div></div><Badge color="green" dot>Enforced</Badge></div>
            <div className="list-item"><div className="grow"><div className="small strong">PIN hashing</div><div className="xs muted">bcrypt, cost factor 10</div></div><Badge color="green" dot>Enabled</Badge></div>
          </Card>
        )}

        {tab === 'system' && (
          <div className="stack">
            <Card title="System health" icon={Cpu} actions={<button className="btn btn-outline btn-sm" onClick={() => api('/system/health').then(setHealth)}><RefreshCw size={14} /> Refresh</button>}>
              {!health ? <Skeleton h={200} /> : (
                <div className="timeline">
                  {health.services.map((x) => (
                    <div key={x.id} className="tl-item">
                      <div className={`tl-dot ${x.ok ? 't-green' : 't-orange'}`}>{x.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}</div>
                      <div className="tl-body"><div className="row-between"><span className="title">{x.label}</span><Badge color={x.ok ? 'green' : 'orange'}>{x.ok ? 'Healthy' : 'Attention'}</Badge></div><div className="sub">{x.detail}</div></div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
            {health && (
              <Card title="Storage" icon={HardDrive}>
                <dl className="facts"><dt>Users</dt><dd>{health.counts.users}</dd><dt>Records</dt><dd>{health.counts.records}</dd><dt>Audit events</dt><dd>{health.counts.activity}</dd><dt>Last activity</dt><dd>{fmtDateTime(health.counts.last_activity)}</dd><dt>Ledger head</dt><dd className="mono xs" style={{ wordBreak: 'break-all' }}>{health.ledger_head}</dd></dl>
              </Card>
            )}
            {admin && s.system.demo_mode && (
              <Card title="Danger zone" icon={TriangleAlert} style={{ borderColor: 'color-mix(in srgb, var(--red) 35%, transparent)' }}>
                <div className="row-between wrap"><div><div className="strong small">Reset demonstration data</div><div className="xs muted">Replaces every record, dispute and ledger entry with the demo dataset. Cannot be undone.</div></div>
                  <button className="btn btn-danger-soft" onClick={reset} disabled={busy}><RefreshCw size={15} /> Reset demo data</button></div>
              </Card>
            )}
          </div>
        )}

        {tab === 'profile' && (
          <Card title="My profile" icon={KeyRound}>
            <ProfilePhoto />
            <dl className="facts"><dt>Phone</dt><dd>{user.phone}</dd><dt>District</dt><dd>{user.district || '—'}</dd><dt>Role</dt><dd>{USER_ROLES[user.role]}</dd><dt>Signed in</dt><dd>{fmtDateTime(user.last_login_at)}</dd></dl>
          </Card>
        )}
      </div>

      <div className="stack">
        <Card title="Your account">
          <div className="row"><Avatar name={user.full_name} src={user.photo_url} size="lg" /><div className="grow"><div className="strong">{user.full_name}</div><div className="small muted">{user.title || USER_ROLES[user.role]}</div></div><Badge color="green" dot>Online</Badge></div>
          <div className="divider" />
          <dl className="facts" style={{ gridTemplateColumns: '80px 1fr' }}><dt>Phone</dt><dd>{user.phone}</dd><dt>District</dt><dd>{user.district || '—'}</dd></dl>
        </Card>
        {health && (
          <Card title="Status">
            {health.services.map((x) => <div key={x.id} className="list-item" style={{ padding: '7px 0' }}><span className={`bdot`} style={{ width: 8, height: 8, borderRadius: '50%', background: x.ok ? 'var(--green)' : 'var(--orange)' }} /><span className="small grow">{x.label}</span><span className="xs muted">{x.ok ? 'Healthy' : 'Off'}</span></div>)}
          </Card>
        )}
        <Card><div className="row"><Tile icon={Fingerprint} color="blue" size="sm" /><p className="small muted" style={{ margin: 0 }}>Personal data is processed in line with Uganda's Data Protection and Privacy Act, 2019.</p></div></Card>
      </div>
    </div>
  );
}

function HeartIcon(props) { return <ShieldCheck {...props} />; }

function ProfilePhoto() {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function upload(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    const form = new FormData();
    form.append('photo', file);
    try { const d = await api('/auth/me/photo', { method: 'POST', form }); updateUser({ photo_url: d.photo_url }); toast('Profile photo updated', 'success'); }
    catch (ex) { toast(ex.message, 'error'); } finally { setBusy(false); }
  }
  async function remove() {
    await api('/auth/me/photo', { method: 'DELETE' }); updateUser({ photo_url: null }); toast('Profile photo removed', 'info');
  }
  return (
    <div className="row wrap mb-2" style={{ gap: 18 }}>
      <Avatar name={user.full_name} src={user.photo_url} size="xxl" />
      <div className="grow">
        <h3>{user.full_name}</h3>
        <div className="muted small">{user.title || USER_ROLES[user.role]}</div>
        <Badge color={ROLE_COLOR[user.role]} className="mt-1">{USER_ROLES[user.role]}</Badge>
        <div className="row wrap mt-2">
          <label className="btn btn-primary btn-sm"><Camera size={15} /> {busy ? 'Uploading…' : user.photo_url ? 'Change photo' : 'Upload a photo'}
            <input type="file" accept="image/jpeg,image/png,image/webp" capture="user" hidden onChange={upload} disabled={busy} /></label>
          {user.photo_url && <button className="btn btn-outline btn-sm" onClick={remove}>Remove</button>}
        </div>
        <div className="xs muted mt-1">JPG, PNG or WebP, up to 5 MB. Your photo appears to officials and on your activity.</div>
      </div>
    </div>
  );
}
