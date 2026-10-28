import { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Blocks, Check, Clock, Download, Fingerprint, Link2, Loader2, ShieldAlert, ShieldCheck, X } from 'lucide-react';
import { api, download, fmtDateTime, timeAgo, TYPE_LABELS } from '../api';
import { usePage } from '../theme.jsx';
import { Badge, Card, Drawer, Pagination, Skeleton, Stat, Tile, useToast } from '../components/ui.jsx';

const Chain3D = lazy(() => import('../three/Chain3D.jsx'));

export default function Ledger() {
  usePage('Ledger Explorer', 'The append-only, hash-chained ledger behind every sealed record');
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [check, setCheck] = useState(null);
  const [checking, setChecking] = useState(false);
  const [block, setBlock] = useState(null);

  useEffect(() => { api(`/ledger?page=${page}&pageSize=12`).then(setData).catch(() => {}); }, [page]);
  const runCheck = async () => {
    setChecking(true);
    try {
      const r = await api('/ledger/verify');
      await new Promise((res) => setTimeout(res, 500));
      setCheck(r);
      toast(r.valid ? `All ${r.length} entries verified. The chain is intact.` : `Problem found at entry #${r.first_problem}`, r.valid ? 'success' : 'error', 'Ledger check complete');
    } catch (e) { toast(e.message, 'error'); } finally { setChecking(false); }
  };
  const openBlock = async (pos) => { try { setBlock((await api(`/ledger/${pos}`)).block); } catch (e) { toast(e.message, 'error'); } };

  if (!data) return <Skeleton h={500} />;
  const head = data.blocks[0];
  const status = check ? new Map(check.blocks.map((b) => [b.position, b])) : null;
  const bad = check?.blocks.filter((b) => !b.ok) || [];

  return (
    <>
      <div className="grid grid-4 section">
        <Stat icon={Blocks} color="blue" label="Chain length" value={data.total} foot={<span className="trend flat"><span>sealed records</span></span>} />
        <Stat icon={check ? (check.valid ? ShieldCheck : ShieldAlert) : Fingerprint} color={check ? (check.valid ? 'green' : 'red') : 'purple'} label="Chain status"
          value={check ? (check.valid ? 'Intact' : 'Broken') : 'Not checked'} foot={<span className="trend flat"><span>{check ? `checked ${timeAgo(check.checked_at)}` : 'run a full check'}</span></span>} />
        <Stat icon={Link2} color="gold" label="Head hash" value={<span className="mono" style={{ fontSize: '1.05rem' }}>{head?.seal_hash.slice(0, 12)}…</span>} foot={<span className="trend flat"><span>entry #{head?.position}</span></span>} />
        <Stat icon={Clock} color="teal" label="Last sealed" value={<span style={{ fontSize: '1.2rem' }}>{timeAgo(head?.sealed_at)}</span>} foot={<span className="trend flat"><span>{head?.code}</span></span>} />
      </div>

      <Card title="Chain view" icon={Blocks} sub={`Entries #${data.blocks[data.blocks.length - 1]?.position} to #${data.blocks[0]?.position} · click a block to inspect it · drag to orbit`} className="section"
        actions={check && <Badge color={check.valid ? 'green' : 'red'} dot>{check.valid ? 'All blocks verified' : 'Broken link found'}</Badge>}>
        <div className="three-wrap" style={{ height: 260, background: 'linear-gradient(180deg, var(--primary-soft), var(--surface-2))' }}>
          <Suspense fallback={<Skeleton h={260} />}><Chain3D blocks={data.blocks} status={status} onSelect={openBlock} height={260} /></Suspense>
        </div>
      </Card>

      <div className="split">
        <Card flush>
          <div className="toolbar">
            <h3>Ledger entries</h3>
            <div className="row" style={{ marginLeft: 'auto' }}>
              <button className="btn btn-outline btn-sm" onClick={() => download('/reports/ledger.csv', 'ettaka-ledger.csv')}><Download size={15} /> Export</button>
              <button className="btn btn-primary btn-sm" onClick={runCheck} disabled={checking}>{checking ? <Loader2 size={15} className="spin" /> : <ShieldCheck size={15} />} {checking ? 'Verifying every entry…' : 'Verify entire ledger'}</button>
            </div>
          </div>
          {check && (
            <div style={{ padding: '14px 20px 0' }}>
              <div className={`alert ${check.valid ? 'alert-ok' : 'alert-danger'}`} style={{ marginBottom: 6 }}>
                {check.valid ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
                <div><strong>{check.valid ? `All ${check.length} entries verified` : `${bad.length} entr${bad.length === 1 ? 'y' : 'ies'} failed`}</strong>
                  {check.valid ? 'Every stored payload matches its hash, every link points to the previous entry, and every record still matches its seal.'
                    : bad.map((b) => <div key={b.position}>#{b.position} {b.code}: {!b.content_ok && 'record contents changed'} {!b.link_ok && 'chain link broken'} {!b.entry_ok && 'ledger entry altered'}</div>)}
                </div>
              </div>
            </div>
          )}
          <div className="chain">
            {data.blocks.map((b) => {
              const st = status?.get(b.position);
              return (
                <div key={b.position} className={`block ${st ? (st.ok ? 'ok' : 'bad') : ''}`} onClick={() => openBlock(b.position)}>
                  <div className="block-n">#{b.position}</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="row wrap" style={{ gap: 8 }}><strong className="truncate" style={{ color: 'var(--text)' }}>{b.title}</strong><span className="code-chip">{b.code}</span><Badge color="gray">{TYPE_LABELS[b.record_type]}</Badge></div>
                    <div className="h truncate"><span>hash </span>{b.seal_hash}</div>
                    <div className="h truncate"><span>prev </span>{b.prev_hash}</div>
                  </div>
                  <div className="right small">
                    {st && (st.ok ? <Badge color="green"><Check size={11} /> Valid</Badge> : <Badge color="red"><X size={11} /> Invalid</Badge>)}
                    <div className="muted xs mt-1">{fmtDateTime(b.sealed_at)}</div>
                    <div className="muted xs">by {b.sealed_by}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <Pagination page={data.page} pages={data.pages} total={data.total} pageSize={12} onPage={setPage} noun="entries" />
        </Card>

        <div className="stack">
          <Card title="How the chain protects records" icon={Fingerprint}>
            <div className="timeline">
              {[
                ['Canonical payload', 'Every field, party, witness, boundary point and file hash, in a fixed order.'],
                ['SHA-256 seal', 'hash = SHA-256(payload + previous hash + time).'],
                ['Chained', 'Each entry includes the previous entry\'s hash, so changing one breaks every later link.'],
                ['Append-only', 'A database trigger rejects any UPDATE or DELETE on the ledger.'],
              ].map(([t, s]) => (
                <div key={t} className="tl-item"><div className="tl-dot t-gold"><Link2 size={13} /></div><div className="tl-body"><div className="title">{t}</div><div className="sub">{s}</div></div></div>
              ))}
            </div>
          </Card>
          <Card title="Genesis">
            <div className="row"><Tile icon={Blocks} color="blue" size="sm" /><div className="grow"><div className="small strong">Chain starts from a zero hash</div><div className="hash mt-1">{'0'.repeat(64)}</div></div></div>
          </Card>
        </div>
      </div>

      {block && (
        <Drawer title={`Ledger entry #${block.id}`} sub={`${block.code} · ${block.title}`} onClose={() => setBlock(null)}
          footer={<Link className="btn btn-primary" to={`/records/${block.record_id}`}>Open record</Link>}>
          <dl className="facts mb-2"><dt>Sealed</dt><dd>{fmtDateTime(block.sealed_at)}</dd><dt>Sealed by</dt><dd>{block.sealed_by_name}</dd></dl>
          <div className="field-label mb-1">Seal hash</div><div className="hash mb-2">{block.seal_hash}</div>
          <div className="field-label mb-1">Previous hash</div><div className="hash mb-2">{block.prev_hash}</div>
          <div className="field-label mb-1">Sealed payload</div>
          <pre className="json">{JSON.stringify(block.payload, null, 2)}</pre>
        </Drawer>
      )}
    </>
  );
}
