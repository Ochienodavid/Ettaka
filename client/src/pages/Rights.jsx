import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen, Bot, HeartHandshake, Home, MessageCircleQuestion, Ruler, Scale, Send, ShieldAlert, ShoppingBag, Sparkles, Users } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth.jsx';
import { usePage } from '../theme.jsx';
import { Card, Seg, Tile } from '../components/ui.jsx';

const TOPICS = [
  { q: 'My husband died. Can his brothers evict me from our land?', icon: ShieldAlert, c: 'red', t: 'Widows and inheritance' },
  { q: 'Can my husband sell our family land without my consent?', icon: HeartHandshake, c: 'gold', t: 'Family land and consent' },
  { q: 'What should I check before buying a plot?', icon: ShoppingBag, c: 'blue', t: 'Buying land safely' },
  { q: 'My neighbour has moved the boundary. What can I do?', icon: Ruler, c: 'green', t: 'Boundary disputes' },
  { q: 'Can a landlord evict a kibanja holder?', icon: Home, c: 'purple', t: 'Kibanja holders' },
  { q: 'Does a land sale agreement have to be in writing?', icon: BookOpen, c: 'teal', t: 'Written agreements' },
  { q: 'Where can I take a land dispute?', icon: Scale, c: 'orange', t: 'Resolving disputes' },
  { q: 'How do I get a certificate of customary ownership?', icon: Users, c: 'pink', t: 'Customary land' },
];

export default function Rights() {
  usePage('Know My Rights', 'Plain answers about land law in Uganda, always with their source');
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [q, setQ] = useState('');
  const [lang, setLang] = useState('en');
  const [msgs, setMsgs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [library, setLibrary] = useState([]);
  const [gemini, setGemini] = useState(false);
  const end = useRef(null);
  const asked = useRef(false);

  useEffect(() => {
    api('/ai/library').then((d) => setLibrary(d.entries)).catch(() => {});
    api('/ai/status').then((d) => setGemini(d.gemini)).catch(() => {});
  }, []);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [msgs, busy]);
  useEffect(() => { const p = params.get('q'); if (p && !asked.current) { asked.current = true; ask(p); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [params]);

  async function ask(question) {
    const text = (question ?? q).trim();
    if (!text || busy) return;
    setQ(''); setBusy(true);
    setMsgs((m) => [...m, { who: 'me', text }]);
    try {
      const d = await api('/ai/rights', { method: 'POST', body: { question: text, language: lang === 'lg' ? 'lg' : 'auto' } });
      setMsgs((m) => [...m, { who: 'bot', text: d.answer, citations: d.citations, ai: d.ai }]);
    } catch (e) {
      setMsgs((m) => [...m, { who: 'bot', text: e.message, citations: [] }]);
    } finally { setBusy(false); }
  }

  return (
    <>
      {!user && <div className="page-head"><div><h2>Know your land rights</h2><div className="sub">Plain answers about land law in Uganda, always with their source. General information, not legal advice.</div></div></div>}
      <div className="split-wide">
        <Card className="chat" style={{ padding: 18 }}>
          <div className="row-between mb-1">
            <div className="row"><Tile icon={Bot} color="blue" size="sm" /><div><strong>Ettaka legal assistant</strong><div className="xs muted">{gemini ? 'Gemini, grounded in the Ettaka legal library' : 'Answers from the Ettaka legal library'}</div></div></div>
            <Seg value={lang} onChange={setLang} options={[{ id: 'en', label: 'English' }, { id: 'lg', label: 'Luganda' }]} />
          </div>
          <div className="chat-scroll">
            {msgs.length === 0 && (
              <div className="empty" style={{ paddingTop: 40 }}>
                <Tile icon={MessageCircleQuestion} color="blue" />
                <h4>Ask about your land</h4>
                <p className="small">Choose a topic on the right or type your own question. Every answer shows the law it comes from.</p>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`bubble ${m.who}`}>
                <div className="bubble-text">{m.text}</div>
                {m.citations?.length > 0 && <div className="cites">{m.citations.map((c) => <span key={c.id} className="cite" title={c.title}>{c.source} · {c.ref}</span>)}</div>}
              </div>
            ))}
            {busy && <div className="bubble bot"><div className="typing"><span /><span /><span /></div></div>}
            <div ref={end} />
          </div>
          <form className="chat-input" onSubmit={(e) => { e.preventDefault(); ask(); }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={lang === 'lg' ? 'Buuza ekibuuzo kyo…' : 'Type your question about land…'} aria-label="Your question" />
            <button className="btn btn-primary" disabled={busy || !q.trim()}><Send size={16} /> Ask</button>
          </form>
          <div className="xs muted mt-1">General information, not legal advice. For your situation, speak to a legal aid provider or an advocate.</div>
        </Card>

        <div className="stack">
          <Card title="Common questions" icon={Sparkles}>
            <div className="stack-sm">
              {TOPICS.map((t) => (
                <button key={t.q} className="chip" onClick={() => ask(t.q)} disabled={busy}>
                  <Tile icon={t.icon} color={t.c} size="xs" /><div><div className="strong small" style={{ color: 'var(--text)' }}>{t.t}</div><div className="xs muted">{t.q}</div></div>
                </button>
              ))}
            </div>
          </Card>
          <Card title="Legal library" icon={BookOpen} sub={`${library.length} plain-language summaries`}>
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {library.map((e) => (
                <details key={e.id} style={{ borderBottom: '1px solid var(--border)', padding: '8px 0' }}>
                  <summary className="small strong" style={{ cursor: 'pointer', color: 'var(--text)' }}>{e.title}</summary>
                  <div className="xs muted mt-1">{e.source} · {e.ref}</div>
                  <p className="small mt-1" style={{ color: 'var(--text-2)' }}>{e.text}</p>
                </details>
              ))}
            </div>
            <p className="xs faint mt-1" style={{ marginBottom: 0 }}>Prototype summaries, to be verified by an advocate against the current Revised Laws of Uganda.</p>
          </Card>
        </div>
      </div>
    </>
  );
}
