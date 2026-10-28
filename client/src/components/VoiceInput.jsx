import { useEffect, useRef, useState } from 'react';
import { api } from '../api';

const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

// Two ways to capture spoken terms:
//  1. Record audio and send it to Gemini (handles Luganda and mixed speech, returns an English translation).
//  2. Live browser dictation (English), which works without an API key.
export default function VoiceInput({ value, onChange, geminiOn }) {
  const [recording, setRecording] = useState(false);
  const [dictating, setDictating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [seconds, setSeconds] = useState(0);
  const rec = useRef(null);
  const chunks = useRef([]);
  const sr = useRef(null);
  const timer = useRef(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => () => { clearInterval(timer.current); sr.current?.stop(); rec.current?.stream?.getTracks().forEach((t) => t.stop()); }, []);

  const append = (text) => onChange([valueRef.current, text].filter(Boolean).join(valueRef.current ? '\n' : ''));

  async function startRecording() {
    setMsg('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      mr.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        clearInterval(timer.current);
        const blob = new Blob(chunks.current, { type: mr.mimeType || 'audio/webm' });
        const form = new FormData();
        form.append('audio', blob, 'terms.webm');
        setBusy(true); setMsg('Gemini is transcribing and translating…');
        try {
          const d = await api('/ai/transcribe', { method: 'POST', form });
          if (!d.ai) { setMsg(d.note); return; }
          append(d.language && !/english/i.test(d.language) ? `${d.english}\n[Original, ${d.language}]: ${d.transcript}` : d.english || d.transcript);
          setMsg(`Transcribed (${d.language || 'detected language'}).`);
        } catch (e) { setMsg(e.message); } finally { setBusy(false); }
      };
      mr.start();
      rec.current = mr;
      setRecording(true); setSeconds(0);
      timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setMsg('Microphone access was blocked. Allow the microphone or type the terms.');
    }
  }
  const stopRecording = () => { rec.current?.stop(); setRecording(false); };

  function toggleDictation() {
    if (dictating) { sr.current?.stop(); return; }
    const r = new SR();
    r.lang = 'en-UG'; r.continuous = true; r.interimResults = false;
    r.onresult = (e) => {
      const text = Array.from(e.results).slice(e.resultIndex).filter((x) => x.isFinal).map((x) => x[0].transcript).join(' ');
      if (text) append(text.trim());
    };
    r.onend = () => setDictating(false);
    r.onerror = (e) => { setMsg(`Dictation error: ${e.error}`); setDictating(false); };
    r.start(); sr.current = r; setDictating(true); setMsg('Listening… speak the terms in English.');
  }

  return (
    <div className="voice">
      <div className="voice-buttons">
        {!recording ? (
          <button type="button" className="btn btn-gold" onClick={startRecording} disabled={busy || dictating}>
            <span className="rec-dot" /> Record terms {geminiOn ? '(Luganda or English)' : ''}
          </button>
        ) : (
          <button type="button" className="btn btn-danger" onClick={stopRecording}>Stop · {seconds}s</button>
        )}
        {SR && (
          <button type="button" className="btn btn-ghost" onClick={toggleDictation} disabled={recording || busy}>
            {dictating ? 'Stop dictation' : 'Dictate (English)'}
          </button>
        )}
      </div>
      {msg && <p className="hint">{msg}</p>}
      <textarea rows={6} value={value || ''} onChange={(e) => onChange(e.target.value)}
        placeholder="For example: I, Mukasa, am selling my plot near the borehole to Okello for eighteen million shillings. He pays ten million today and the rest within six months…" />
    </div>
  );
}
