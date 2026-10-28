import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CircleMarker, MapContainer, Polygon, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { AlertTriangle, Fingerprint, Layers, Map as MapIcon, MapPin, Scale, ShieldAlert } from 'lucide-react';
import { api, acres, TYPE_LABELS } from '../api';
import { usePage, useTheme } from '../theme.jsx';
import { Badge, Card, Empty, Seg, Skeleton, Stat, Tile } from '../components/ui.jsx';

const STYLE = {
  sealed: { color: '#16a34a', fillColor: '#22c55e' },
  draft: { color: '#64748b', fillColor: '#94a3b8' },
  dispute: { color: '#ea7c12', fillColor: '#f59e0b' },
  overlap: { color: '#dc2626', fillColor: '#ef4444' },
};
const styleOf = (p) => (p.overlap ? 'overlap' : p.open_disputes ? 'dispute' : p.status);

// Plots are tiny at national zoom, so show a dot per plot until zoomed in.
function Dots({ plots, onPick }) {
  const [zoom, setZoom] = useState(7);
  const map = useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  useEffect(() => setZoom(map.getZoom()), [map]);
  if (zoom >= 15) return null;
  return plots.map((p) => {
    const ys = p.boundary.map((b) => b[0]), xs = p.boundary.map((b) => b[1]);
    const c = [(Math.min(...ys) + Math.max(...ys)) / 2, (Math.min(...xs) + Math.max(...xs)) / 2];
    const s = STYLE[styleOf(p)];
    return <CircleMarker key={`d${p.id}`} center={c} radius={p.overlap ? 9 : 7} pathOptions={{ color: '#fff', weight: 2, fillColor: s.color, fillOpacity: 0.95 }} eventHandlers={{ click: () => onPick(p) }} />;
  });
}

function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => { if (target) map.flyToBounds(target, { padding: [40, 40], maxZoom: 17, duration: 0.8 }); }, [target, map]);
  return null;
}

export default function LandMap() {
  usePage('Land Map', 'Every recorded plot, with automatic boundary-conflict detection');
  const nav = useNavigate();
  const { theme } = useTheme();
  const [d, setD] = useState(null);
  const [district, setDistrict] = useState('');
  const [layer, setLayer] = useState('satellite');
  const [target, setTarget] = useState(null);

  useEffect(() => { api('/analytics/map').then(setD).catch(() => setD({ plots: [], overlaps: [] })); }, []);
  const districts = useMemo(() => (d ? [...new Set(d.plots.map((p) => p.district))].sort() : []), [d]);
  const shown = useMemo(() => (d ? d.plots.filter((p) => !district || p.district === district) : []), [d, district]);

  useEffect(() => {
    if (!shown.length) return;
    setTarget(shown.flatMap((p) => p.boundary));
  }, [shown]);

  if (!d) return <Skeleton h={600} />;
  const totalAcres = shown.reduce((s, p) => s + Number(p.area_m2 || 0), 0) / 4046.86;
  const focus = (p) => setTarget(p.boundary);

  return (
    <>
      <div className="grid grid-4 section">
        <Stat icon={MapPin} color="blue" label="Plots mapped" value={shown.length} foot={<span className="trend flat"><span>{district || `${districts.length} districts`}</span></span>} />
        <Stat icon={MapIcon} color="teal" label="Area mapped" value={totalAcres.toFixed(1)} unit="acres" foot={<span className="trend flat"><span>GPS boundaries</span></span>} />
        <Stat icon={ShieldAlert} color="red" label="Boundary conflicts" value={d.overlaps.length} foot={<span className="trend down"><span>overlapping plots</span></span>} />
        <Stat icon={Scale} color="orange" label="Plots in dispute" value={shown.filter((p) => p.open_disputes).length} foot={<span className="trend warn"><span>open cases</span></span>} />
      </div>

      <div className="split">
        <Card flush>
          <div className="toolbar">
            <select className="select-sm" value={district} onChange={(e) => setDistrict(e.target.value)} aria-label="District">
              <option value="">All districts</option>{districts.map((x) => <option key={x}>{x}</option>)}
            </select>
            <Seg value={layer} onChange={setLayer} options={[{ id: 'satellite', label: 'Satellite' }, { id: 'streets', label: 'Streets' }]} />
            <span className="small muted" style={{ marginLeft: 'auto' }}><Layers size={14} style={{ verticalAlign: -2 }} /> Click a plot for details</span>
          </div>
          <div style={{ position: 'relative' }}>
            <MapContainer center={[1.37, 32.29]} zoom={7} style={{ height: 620, borderRadius: 0, border: 0 }} className={`map ${theme === 'dark' && layer === 'streets' ? 'dark-tiles' : ''}`}>
              {layer === 'satellite'
                ? <TileLayer attribution="Tiles &copy; Esri" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={19} />
                : <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />}
              <FlyTo target={target} />
              <Dots plots={shown} onPick={(p) => setTarget(p.boundary)} />
              {shown.map((p) => {
                const s = STYLE[styleOf(p)];
                return (
                  <Polygon key={p.id} positions={p.boundary} pathOptions={{ ...s, weight: p.overlap ? 3 : 2, fillOpacity: 0.35, dashArray: p.status === 'draft' ? '6 5' : null }}>
                    <Popup>
                      <div style={{ minWidth: 220 }}>
                        <div className="mono xs muted">{p.code}</div>
                        <div className="strong" style={{ margin: '2px 0 4px' }}>{p.title}</div>
                        <div className="small muted">{TYPE_LABELS[p.record_type]} · {p.village}, {p.district} · {acres(p.area_m2)}</div>
                        <div className="small" style={{ margin: '6px 0' }}>{p.party_names}</div>
                        <div className="row wrap" style={{ gap: 4 }}>
                          <Badge color={p.status === 'sealed' ? 'green' : 'gray'}>{p.status}</Badge>
                          {p.overlap && <Badge color="red">Overlap</Badge>}
                          {p.open_disputes > 0 && <Badge color="orange">Dispute</Badge>}
                        </div>
                        <button className="btn btn-primary btn-xs mt-1" onClick={() => nav(`/records/${p.id}`)}>Open record</button>
                      </div>
                    </Popup>
                  </Polygon>
                );
              })}
            </MapContainer>
            <div className="map-legend">
              {[['sealed', 'Sealed'], ['draft', 'Draft'], ['dispute', 'In dispute'], ['overlap', 'Boundary conflict']].map(([k, l]) => (
                <span key={k}><i style={{ background: STYLE[k].fillColor + '66', borderColor: STYLE[k].color }} />{l}</span>
              ))}
            </div>
          </div>
        </Card>

        <div className="stack">
          <Card title="Boundary conflicts" icon={AlertTriangle} sub="Detected automatically by comparing every boundary">
            {d.overlaps.length === 0 ? <Empty icon={Fingerprint} title="No overlapping plots" /> : (
              <div className="list">
                {d.overlaps.map((o, i) => (
                  <div key={i} className="list-item" style={{ alignItems: 'flex-start' }}>
                    <Tile icon={ShieldAlert} color="red" size="sm" />
                    <div className="grow">
                      <div className="title">{o.a.code} ↔ {o.b.code}</div>
                      <div className="sub">{o.a.title}<br />{o.b.title}</div>
                      <div className="row mt-1"><Badge color="red">{o.pct_of_smaller}% overlap</Badge><span className="xs muted">{o.area_m2.toLocaleString()} m²</span></div>
                      <div className="row mt-1">
                        <button className="btn btn-outline btn-xs" onClick={() => focus(d.plots.find((p) => p.id === o.a.id).boundary)}>Show on map</button>
                        <Link className="btn btn-soft btn-xs" to={`/records/${o.a.id}`}>Open record</Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card title="Plots" sub={`${shown.length} in view`}>
            <div className="list" style={{ maxHeight: 330, overflowY: 'auto' }}>
              {shown.slice().sort((a, b) => Number(b.overlap) - Number(a.overlap) || b.open_disputes - a.open_disputes).map((p) => (
                <div key={p.id} className="list-item" style={{ cursor: 'pointer' }} onClick={() => focus(p.boundary)}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: STYLE[styleOf(p)].fillColor, flex: 'none' }} />
                  <div className="grow"><div className="title truncate">{p.title}</div><div className="sub">{p.code} · {p.village}, {p.district}</div></div>
                  <span className="xs muted nowrap">{acres(p.area_m2, 1)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
