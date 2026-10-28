import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Fingerprint, Gavel, HeartHandshake, KeyRound, Landmark, LogIn, Phone, ShieldCheck, User, UserCog } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth.jsx';
import { usePage } from '../theme.jsx';
import Brand from '../components/Brand.jsx';
import Illustration from '../components/Illustration.jsx';

const Hero3D = lazy(() => import('../three/Hero3D.jsx'));
import { Field, Tile } from '../components/ui.jsx';

const DEMO = [
  { phone: '0700000001', label: 'Citizen', sub: 'Nakato Sarah · widow', icon: User, c: 'gold' },
  { phone: '0700000002', label: 'LC1 Official', sub: 'Namusoke Grace', icon: Landmark, c: 'blue' },
  { phone: '0700000005', label: 'Mediator', sub: 'Akello Harriet', icon: Gavel, c: 'purple' },
  { phone: '0700000004', label: 'Administrator', sub: 'Ochieno David', icon: UserCog, c: 'green' },
];

export default function Login() {
  usePage('Sign in');
  const { login, register, user } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState(params.get('new') ? 'register' : 'login');
  const [f, setF] = useState({ full_name: '', phone: '', pin: '' });
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [s, setS] = useState(null);
  useEffect(() => { api('/public/stats').then(setS).catch(() => {}); }, []);
  useEffect(() => { if (user) nav('/dashboard', { replace: true }); }, [user, nav]);

  const submit = async (e, demo) => {
    e?.preventDefault();
    setErr(''); setBusy(true);
    try {
      if (demo) await login(demo, '1234');
      else if (mode === 'login') await login(f.phone, f.pin);
      else await register(f.full_name, f.phone, f.pin);
      nav('/dashboard');
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };

  return (
    <div className="login">
      <div className="login-art">
        <img className="login-photo" src="/images/community-land.jpg" alt="Community members standing together outdoors" />
        <Brand />
        <h1>Welcome to <span>Ettaka</span></h1>
        <p className="lead">Record land agreements, map boundaries, seal evidence and resolve disputes, all in one place trusted by families, LC officials and mediators.</p>
        <div className="login-3d">
          <Suspense fallback={<Illustration />}><Hero3D stats={s} height={380} /></Suspense>
          <div className="float-card" style={{ top: 26, left: 10 }}><Tile icon={Fingerprint} color="blue" size="sm" /><div><span className="muted">Ledger entries</span><strong>{s ? s.ledger : '—'}</strong></div></div>
          <div className="float-card" style={{ bottom: 30, right: 4, animationDelay: '2s' }}><Tile icon={HeartHandshake} color="gold" size="sm" /><div><span className="muted">Records naming a woman</span><strong>{s ? `${s.women_pct}%` : '—'}</strong></div></div>
        </div>
        <div className="login-feats">
          <div><Tile icon={ShieldCheck} color="blue" size="xs" /><div><strong>Role-based access</strong>Citizens, LC officials, mediators</div></div>
          <div><Tile icon={Fingerprint} color="purple" size="xs" /><div><strong>Tamper-evident</strong>SHA-256 hash chain</div></div>
          <div><Tile icon={KeyRound} color="green" size="xs" /><div><strong>Phone and PIN</strong>Works on any phone</div></div>
        </div>
      </div>

      <div className="login-form">
        <div className="login-card">
          <Link to="/" className="small muted row" style={{ gap: 4, marginBottom: 22 }}><ArrowLeft size={14} /> Back to home</Link>
          <h2>{mode === 'login' ? 'Sign in to your account' : 'Create your account'}</h2>
          <p className="center muted" style={{ marginBottom: 22 }}>{mode === 'login' ? 'Continue to the Ettaka portal' : 'Free for every household'}</p>

          <form onSubmit={submit}>
            {mode === 'register' && (
              <Field label="Full name"><div className="input-icon"><User size={16} /><input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} required autoComplete="name" /></div></Field>
            )}
            <Field label="Phone number"><div className="input-icon"><Phone size={16} /><input inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="07XX XXX XXX" required autoComplete="tel" /></div></Field>
            <Field label="PIN">
              <div className="input-icon" style={{ position: 'relative' }}>
                <KeyRound size={16} />
                <input type={show ? 'text' : 'password'} inputMode="numeric" value={f.pin} onChange={(e) => setF({ ...f, pin: e.target.value })} placeholder="4 to 6 digits" required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
                <button type="button" className="btn-icon" style={{ position: 'absolute', right: 4, top: 4 }} onClick={() => setShow(!show)} aria-label={show ? 'Hide PIN' : 'Show PIN'}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
            </Field>
            {err && <div className="alert alert-danger"><ShieldCheck size={16} /><div>{err}</div></div>}
            <button className="btn btn-primary btn-lg btn-block" disabled={busy}><LogIn size={18} />{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
          </form>

          <div className="or">or explore with a demo account</div>
          <div className="role-pick">
            {DEMO.map((d) => (
              <button key={d.phone} type="button" onClick={(e) => submit(e, d.phone)} disabled={busy}>
                <Tile icon={d.icon} color={d.c} size="xs" /><div><strong>{d.label}</strong><span>{d.sub}</span></div>
              </button>
            ))}
          </div>
          <p className="center small mt-2">
            {mode === 'login' ? 'New to Ettaka? ' : 'Already registered? '}
            <button type="button" className="link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button>
          </p>
          <div className="alert alert-info mt-2"><ShieldCheck size={16} /><div className="small"><strong>Your data is protected</strong>Handled in line with the Data Protection and Privacy Act, 2019. Phone numbers are masked on the public portal.</div></div>
        </div>
      </div>
    </div>
  );
}
