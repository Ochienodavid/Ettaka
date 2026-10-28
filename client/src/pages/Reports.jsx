import { useEffect, useState } from 'react';
import { Blocks, Download, FileSpreadsheet, FileText, Printer, Scale, ShieldCheck, Target } from 'lucide-react';
import { api, download, fmtDate, TENURE_LABELS, CATEGORIES } from '../api';
import { usePage } from '../theme.jsx';
import { Card, Progress, Skeleton, Tile, useToast } from '../components/ui.jsx';
import { AreaTrend, Bars, Donut, Legend, Spark } from '../components/charts.jsx';

const SDG_COLOR = { 1: '#E5243B', 2: '#DDA63A', 5: '#FF3A21', 8: '#A21942', 16: '#00689D' };

export default function Reports() {
  usePage('Reports & Impact', 'SDG impact, district performance and data exports');
  const toast = useToast();
  const [o, setO] = useState(null);
  useEffect(() => { api('/analytics/overview').then(setO).catch(() => {}); }, []);
  if (!o) return <Skeleton h={600} />;
  const t = o.totals;
  const gender = o.gender.map((g) => ({ name: g.id === 'female' ? 'Women' : g.id === 'male' ? 'Men' : 'Not recorded', value: g.value, color: g.id === 'female' ? '#db2777' : g.id === 'male' ? '#2563eb' : '#94a3b8' }));
  const tenure = o.byTenure.map((x) => ({ name: TENURE_LABELS[x.id] || x.id, value: x.value }));
  const exp = async (set) => { await download(`/reports/${set}.csv`, `ettaka-${set}.csv`); toast(`${set[0].toUpperCase()}${set.slice(1)} exported`, 'success'); };
  const print = () => { document.body.dataset.print = 'report'; setTimeout(() => { window.print(); delete document.body.dataset.print; }, 60); };

  return (
    <>
      <div className="page-head">
        <div><h2>Monthly impact summary</h2><div className="sub">{fmtDate(new Date(Date.now() - 365 * 86400e3))} to {fmtDate(new Date())} · all districts</div></div>
        <div className="row no-print"><button className="btn btn-outline" onClick={print}><Printer size={16} /> Print / PDF</button><button className="btn btn-primary" onClick={() => exp('records')}><Download size={16} /> Export records</button></div>
      </div>

      <Card title="SDG impact scorecard" icon={Target} sub="Measured against the UN's own indicators" className="section">
        <div className="grid grid-6 kpis" style={{ gap: 12 }}>
          {o.sdg.map((s) => (
            <div key={s.indicator} className="panel-soft" style={{ borderTop: `3px solid ${SDG_COLOR[s.sdg]}` }}>
              <div className="row-between"><span className="xs strong" style={{ color: SDG_COLOR[s.sdg] }}>SDG {s.indicator}</span></div>
              <div className="stat-value" style={{ fontSize: '1.5rem' }}>{s.value.toLocaleString()}{s.unit === '%' ? '%' : ''}</div>
              <div className="xs muted">{s.label}</div>
              {s.unit === '%' && <div className="mt-1"><Progress value={s.value} color={SDG_COLOR[s.sdg]} /></div>}
            </div>
          ))}
        </div>
      </Card>

      <div className="grid g-2a section">
        <Card title="Acres sealed per month">
          <Bars data={o.monthly.map((m) => ({ ...m, acres: Math.round(m.acres * 10) / 10 }))} series={[{ key: 'acres', name: 'Acres sealed', color: '#b8922a' }]} height={250} />
        </Card>
        <Card title="Parties by gender" sub="SDG 5: women's land rights">
          <Donut data={gender} center={`${Math.round(((gender.find((g) => g.name === 'Women')?.value || 0) / (gender.reduce((s, g) => s + g.value, 0) || 1)) * 100)}%`} sub="Women" height={170} inner={52} outer={74} />
          <div className="mt-2"><Legend data={gender} /></div>
        </Card>
      </div>

      <Card title="District performance" flush className="section">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>District</th><th>Records</th><th>Sealed</th><th>Seal rate</th><th>Acres</th><th>Open disputes</th></tr></thead>
            <tbody>
              {o.byDistrict.map((d) => (
                <tr key={d.id}>
                  <td className="strong" style={{ color: 'var(--text)' }}>{d.id}</td><td>{d.records}</td><td>{d.sealed}</td>
                  <td style={{ minWidth: 160 }}><div className="row"><div className="grow"><Progress value={(d.sealed / d.records) * 100} /></div><span className="xs muted">{Math.round((d.sealed / d.records) * 100)}%</span></div></td>
                  <td>{d.acres}</td><td>{d.open_disputes ? <span style={{ color: 'var(--orange)', fontWeight: 600 }}>{d.open_disputes}</span> : '0'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-3 section">
        <Card title="Records over time"><AreaTrend data={o.monthly} height={200} series={[{ key: 'created', name: 'Recorded', color: '#2563eb' }, { key: 'sealed', name: 'Sealed', color: '#16a34a' }]} /></Card>
        <Card title="Tenure"><Donut data={tenure} height={150} inner={44} outer={64} sub="Records" /><div className="mt-2"><Legend data={tenure} /></div></Card>
        <Card title="Dispute categories"><Bars layout="vertical" height={220} data={o.disputeCategories.map((x) => ({ label: CATEGORIES[x.id], n: x.value }))} series={[{ key: 'n', name: 'Disputes', color: '#ea7c12' }]} /></Card>
      </div>

      <div className="grid g-2b section">
        <Card title="Insights snapshot">
          <div className="grid grid-4" style={{ gap: 10 }}>
            {[
              ['Records', t.records, 'created', '#2563eb'], ['Sealed', t.sealed, 'sealed', '#16a34a'],
              ['Consent rate', `${t.family_transfers ? Math.round((t.family_transfers_consented / t.family_transfers) * 100) : 100}%`, 'sealed', '#db2777'],
              ['Resolved', o.disputes.resolved, 'created', '#7c3aed'],
            ].map(([l, v, k, c]) => (
              <div key={l} className="panel-soft"><div className="xs muted">{l}</div><div className="strong" style={{ fontSize: '1.2rem', color: 'var(--text)' }}>{v}</div><Spark data={o.monthly} k={k} color={c} /></div>
            ))}
          </div>
        </Card>
        <Card title="Export formats" className="no-print">
          <div className="grid grid-2" style={{ gap: 10 }}>
            {[['records', 'Land records', FileSpreadsheet, 'green'], ['disputes', 'Disputes', Scale, 'orange'], ['ledger', 'Seal ledger', Blocks, 'blue'], ['verifications', 'Verifications', ShieldCheck, 'purple']].map(([k, l, I, c]) => (
              <button key={k} className="chip" onClick={() => exp(k)}><Tile icon={I} color={c} size="xs" /><div><div className="strong small">{l}</div><div className="xs muted">CSV</div></div></button>
            ))}
            <button className="chip" onClick={print}><Tile icon={FileText} color="red" size="xs" /><div><div className="strong small">Impact report</div><div className="xs muted">PDF</div></div></button>
          </div>
        </Card>
      </div>
    </>
  );
}
