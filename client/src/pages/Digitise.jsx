import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Camera, FileSearch, ScanText, Sparkles } from 'lucide-react';
import { api, ugx } from '../api';
import { usePage } from '../theme.jsx';
import { Badge, Card, Empty, Tile } from '../components/ui.jsx';

export default function Digitise() {
  usePage('Old Papers', 'Bring a handwritten or printed land agreement into Ettaka');
  const nav = useNavigate();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  function choose(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f); setRes(null); setErr('');
    setPreview(f.type.startsWith('image/') ? URL.createObjectURL(f) : null);
  }
  async function read() {
    setBusy(true); setErr('');
    const form = new FormData();
    form.append('image', file);
    try { setRes(await api('/ai/digitise', { method: 'POST', form })); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  function createRecord() {
    const f = res.fields;
    const [village, ...rest] = (f.location || '').split(',').map((s) => s.trim());
    nav('/records/new', {
      state: {
        file,
        prefill: {
          record: {
            record_type: 'sale', title: `${f.document_type || 'Land agreement'}${f.date ? ` (${f.date.slice(0, 4)})` : ''}`,
            village: village || '', district: rest[rest.length - 1] || '', subcounty: rest.length > 1 ? rest[0] : '',
            plot_description: f.plot_description || '', price_ugx: f.price_ugx || '',
            terms_transcript: f.transcription || `Digitised from an old paper agreement dated ${f.date || 'unknown'}.`,
          },
          parties: [{ role: 'seller', full_name: f.seller || '', phone: '', gender: '' }, { role: 'buyer', full_name: f.buyer || '', phone: '', gender: '' }],
          witnesses: (f.witnesses || []).map((w) => { const m = /^(.*?)\s*\((.*)\)$/.exec(w); return { full_name: m ? m[1] : w, title: m ? m[2] : '', phone: '', statement: '' }; }),
        },
      },
    });
  }
  const f = res?.fields;

  return (
    <div className="grid grid-2">
      <Card title="1. Photograph the document" icon={Camera}>
        <label className="panel-soft" style={{ display: 'grid', placeItems: 'center', minHeight: 320, cursor: 'pointer', borderStyle: 'dashed', overflow: 'hidden', padding: preview ? 0 : 14 }}>
          {preview ? <img src={preview} alt="Document preview" style={{ maxWidth: '100%', maxHeight: 420, display: 'block' }} /> : (
            <div className="center"><Tile icon={ScanText} color="blue" /><div className="strong mt-1">{file ? file.name : 'Tap to take a photo or choose a file'}</div><div className="small muted">JPG, PNG or PDF · up to 15 MB</div></div>
          )}
          <input type="file" accept="image/*,application/pdf" capture="environment" hidden onChange={choose} />
        </label>
        <button className="btn btn-primary btn-lg btn-block mt-2" disabled={!file || busy} onClick={read}><Sparkles size={18} />{busy ? 'Reading the document…' : 'Read with Gemini'}</button>
        {err && <div className="alert alert-danger mt-2"><AlertTriangle size={16} />{err}</div>}
        <p className="small muted mt-2" style={{ marginBottom: 0 }}>Gemini reads handwritten English or Luganda, extracts the names, date, price and land description, and flags anything missing such as spousal consent.</p>
      </Card>
      <Card title="2. What Ettaka found" icon={FileSearch}>
        {!res ? <Empty icon={FileSearch} title="No document read yet">Results appear here.</Empty> : (
          <>
            {res.demo && <div className="alert alert-warn"><AlertTriangle size={16} /><div>{res.note}</div></div>}
            <dl className="facts">
              <dt>Document</dt><dd>{f.document_type}</dd><dt>Date</dt><dd>{f.date || '—'}</dd>
              <dt>Seller</dt><dd>{f.seller || '—'}</dd><dt>Buyer</dt><dd>{f.buyer || '—'}</dd>
              <dt>Price</dt><dd>{ugx(f.price_ugx)}</dd><dt>Location</dt><dd>{f.location || '—'}</dd>
              <dt>Land</dt><dd>{f.plot_description || '—'}</dd><dt>Witnesses</dt><dd>{(f.witnesses || []).join('; ') || '—'}</dd>
              <dt>Confidence</dt><dd><Badge color={f.confidence === 'high' ? 'green' : f.confidence === 'low' ? 'red' : 'orange'}>{f.confidence}</Badge></dd>
            </dl>
            {f.issues?.length > 0 && <div className="flags mt-2">{f.issues.map((i) => <div key={i} className="flag flag-warning"><AlertTriangle size={16} />{i}</div>)}</div>}
            {f.transcription && <details className="mb-2"><summary className="small strong">Full transcription</summary><pre className="agreement mt-1">{f.transcription}</pre></details>}
            <button className="btn btn-gold btn-lg btn-block" onClick={createRecord}>Create a land record from this <ArrowRight size={18} /></button>
          </>
        )}
      </Card>
    </div>
  );
}
