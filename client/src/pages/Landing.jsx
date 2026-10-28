import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, Blocks, FileCheck2, Fingerprint, Landmark, Map, Mic, QrCode, Scale, ScanText, ShieldCheck, Users, Search, Sparkles, HeartHandshake,
} from 'lucide-react';
import { api } from '../api';
import { usePage } from '../theme.jsx';
import PublicNav from '../components/PublicNav.jsx';
import { Mark } from '../components/Brand.jsx';
import { Tile } from '../components/ui.jsx';

const Hero3D = lazy(() => import('../three/Hero3D.jsx'));

const FEATURES = [
  { icon: Mic, c: 'blue', t: 'Voice-first agreements', d: 'Parties speak the terms in Luganda or English. Gemini drafts a clear bilingual agreement for review.' },
  { icon: Map, c: 'green', t: 'GPS boundary walk', d: 'Walk the boundary with a phone. Ettaka records every corner, the area and photos of boundary marks.' },
  { icon: Fingerprint, c: 'purple', t: 'Tamper-evident seal', d: 'Each record is SHA-256 fingerprinted and chained in an append-only ledger. Any edit is detected.' },
  { icon: ShieldCheck, c: 'orange', t: 'Spousal consent guard', d: 'Family land cannot be sealed for sale without the spouse\'s consent, as the Land Act requires.' },
  { icon: Blocks, c: 'red', t: 'Double-sale detection', d: 'New boundaries are checked against every recorded plot. Overlaps are flagged before money changes hands.' },
  { icon: Scale, c: 'teal', t: 'Mediation pipeline', d: 'Disputes move from LC review to court-annexed mediation with a complete, verifiable evidence pack.' },
];
const SDGS = [
  [16, 'Peace, Justice and Strong Institutions', '#00689D'], [1, 'No Poverty', '#E5243B'], [5, 'Gender Equality', '#FF3A21'], [2, 'Zero Hunger', '#DDA63A'],
  [8, 'Decent Work and Economic Growth', '#A21942'], [10, 'Reduced Inequalities', '#DD1367'], [15, 'Life on Land', '#56C02B'], [17, 'Partnerships for the Goals', '#19486A'],
];

export default function Landing() {
  usePage('');
  const nav = useNavigate();
  const [s, setS] = useState(null);
  const [code, setCode] = useState('');
  useEffect(() => { api('/public/stats').then(setS).catch(() => {}); }, []);
  const n = (v, d = 0) => (s ? Number(v).toLocaleString(undefined, { maximumFractionDigits: d }) : '—');

  return (
    <div className="public">
      <PublicNav />
      <div className="pub-wrap">
        <section className="hero">
          <div>
            <span className="pill"><Sparkles size={14} /> AI-powered land rights evidence for Uganda</span>
            <h1>Every plot <em>remembered.</em><br />Every right <span className="gold">protected.</span></h1>
            <p className="lead">Over 80% of land in Uganda has no written proof of ownership. Ettaka turns spoken agreements, GPS boundaries and witnesses into tamper-evident evidence that mediators, lenders and courts can trust.</p>
            <div className="hero-cta">
              <Link to="/login?new=1" className="btn btn-primary btn-lg">Start a land record <ArrowRight size={18} /></Link>
              <Link to="/verify/ETK-NKT4-2009" className="btn btn-outline btn-lg"><QrCode size={18} /> See a verified record</Link>
            </div>
            <div className="hero-trust">
              <div><Tile icon={Fingerprint} color="blue" size="xs" /><div><strong>SHA-256 sealed</strong>Hash-chained ledger</div></div>
              <div><Tile icon={HeartHandshake} color="gold" size="xs" /><div><strong>Women protected</strong>Consent built in</div></div>
              <div><Tile icon={Landmark} color="green" size="xs" /><div><strong>Grounded in law</strong>Land and Succession Acts</div></div>
            </div>
          </div>
          <div className="hero-visual hero-3d">
            <Suspense fallback={<img className="hero-shot" src="/hero-dashboard.png" alt="Ettaka dashboard" />}><Hero3D stats={s} height={540} /></Suspense>
            <div className="float-card" style={{ top: -18, left: -24 }}><Tile icon={FileCheck2} color="green" size="sm" /><div><span className="muted">Records sealed</span><strong>{n(s?.sealed)}</strong></div></div>
            <div className="float-card" style={{ bottom: 40, left: -30, animationDelay: '1.5s' }}><Tile icon={ShieldCheck} color="blue" size="sm" /><div><span className="muted">Verifications</span><strong>{n(s?.verifications)}</strong></div></div>
            <div className="float-card" style={{ top: 70, right: -22, animationDelay: '3s' }}><Tile icon={Users} color="gold" size="sm" /><div><span className="muted">Records naming a woman</span><strong>{s ? `${s.women_pct}%` : '—'}</strong></div></div>
          </div>
        </section>

        <form className="card row wrap" style={{ gap: 14, padding: 16 }} onSubmit={(e) => { e.preventDefault(); if (code.trim()) nav(`/verify/${code.trim().toUpperCase()}`); }}>
          <Tile icon={QrCode} color="purple" size="sm" />
          <div style={{ minWidth: 200 }}><strong>Buying land or approving a loan?</strong><div className="small muted">Check any Ettaka agreement in seconds. No account needed.</div></div>
          <div className="input-icon grow" style={{ minWidth: 220 }}><Search size={16} /><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter a record code, e.g. ETK-NKT4-2009" aria-label="Record code" style={{ fontFamily: 'var(--mono)' }} /></div>
          <button className="btn btn-primary">Verify record</button>
        </form>

        <div className="section-title" id="features">
          <span className="pill">Platform</span>
          <h2>Everything a family needs to prove its land</h2>
          <p>From the first conversation under the mango tree to the mediation room, Ettaka keeps the evidence complete and trustworthy.</p>
        </div>
        <div className="features">
          {FEATURES.map((f) => (
            <div className="feature" key={f.t}><Tile icon={f.icon} color={f.c} /><h4>{f.t}</h4><p>{f.d}</p></div>
          ))}
        </div>

        <div className="section-title">
          <span className="pill">The platform</span>
          <h2>One workspace for families, LC officials and mediators</h2>
          <p>Records, boundary maps, the seal ledger, disputes and SDG impact, live in one dashboard.</p>
        </div>
        <div className="product-shot"><img src="/hero-dashboard.png" alt="Ettaka dashboard showing land records, seals, disputes and mediation sessions" loading="lazy" /></div>
        <div style={{ height: 40 }} />

        <div className="statband" id="impact">
          <div><Tile icon={FileCheck2} color="blue" /><div><strong>{n(s?.sealed)}</strong><span className="muted small">Records sealed</span></div></div>
          <div><Tile icon={Map} color="green" /><div><strong>{n(s?.acres)}</strong><span className="muted small">Acres secured</span></div></div>
          <div><Tile icon={ShieldCheck} color="purple" /><div><strong>{n(s?.verifications)}</strong><span className="muted small">Verifications</span></div></div>
          <div><Tile icon={Scale} color="orange" /><div><strong>{n(s?.districts)}</strong><span className="muted small">Districts</span></div></div>
        </div>
        <p className="center xs faint mt-1">Live figures from this demonstration deployment.</p>

        <div className="section-title" id="how">
          <span className="pill">How it works</span>
          <h2>From memory to evidence in five steps</h2>
        </div>
        <div className="flow">
          {[
            [Mic, 'Record', 'Speak the terms. Gemini transcribes, translates and drafts the agreement.'],
            [Map, 'Map', 'Walk the boundary. Ettaka checks it against every recorded plot.'],
            [Users, 'Witness', 'Add the LC1 chairperson, neighbours and photographs of the marks.'],
            [Fingerprint, 'Seal', 'Fingerprint and chain the record. Issue a QR code.'],
            [ScanText, 'Verify', 'Anyone checks authenticity. Any alteration is detected and shown.'],
          ].map(([I, t, d], i) => (
            <div className="flow-step" key={t}><div className="row-between"><span className="n">0{i + 1}</span><I size={18} color="var(--primary)" /></div><h4>{t}</h4><p>{d}</p></div>
          ))}
        </div>

        <div className="section-title">
          <span className="pill">Impact</span>
          <h2>One root cause. Eight Sustainable Development Goals.</h2>
          <p>Secure tenure is itself an official SDG measure (indicators 1.4.2 and 5.a.1), so Ettaka's impact is tracked against the UN's own metrics.</p>
        </div>
        <div className="sdg-grid">
          {SDGS.map(([num, label, color]) => <div className="sdg" key={num} style={{ background: color }}><b>{num}</b><span>{label}</span></div>)}
        </div>

        <div className="cta">
          <div>
            <h2>Protect your family's land today</h2>
            <p>Free for households. Built for LC officials, mediators, legal aid providers and lenders.</p>
          </div>
          <div className="row wrap">
            <Link to="/login?new=1" className="btn btn-gold btn-lg">Create a free account <ArrowRight size={18} /></Link>
            <Link to="/rights" className="btn btn-lg" style={{ background: 'rgba(255,255,255,.12)', color: '#fff' }}>Ask about your rights</Link>
          </div>
        </div>
        <footer className="pub-foot">
          <div className="row"><Mark size={26} /> <span>© 2026 Ettaka · Pre-DevFest Hackathon Kampala</span></div>
          <div>Ettaka records are evidence of land rights, not land titles. General legal information, not legal advice.</div>
        </footer>
      </div>
    </div>
  );
}
