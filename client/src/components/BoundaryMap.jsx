import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Polygon, Polyline, Marker, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

const KAMPALA = [0.3476, 32.5825];
const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// Area in m² for a [lat, lng] polygon (matches the server calculation).
export function polygonAreaM2(points) {
  if (!points || points.length < 3) return 0;
  const R = 6378137, rad = (d) => (d * Math.PI) / 180;
  let t = 0;
  for (let i = 0; i < points.length; i++) {
    const [a1, o1] = points[i], [a2, o2] = points[(i + 1) % points.length];
    t += rad(o2 - o1) * (2 + Math.sin(rad(a1)) + Math.sin(rad(a2)));
  }
  return Math.abs((t * R * R) / 2);
}
const distM = ([a1, o1], [a2, o2]) => {
  const R = 6371000, rad = (d) => (d * Math.PI) / 180;
  const x = rad(o2 - o1) * Math.cos(rad((a1 + a2) / 2)), y = rad(a2 - a1);
  return Math.sqrt(x * x + y * y) * R;
};
const round = (n) => Math.round(n * 1e6) / 1e6;

const vertexIcon = (i) => L.divIcon({ className: 'vertex', html: `<span>${i + 1}</span>`, iconSize: [24, 24], iconAnchor: [12, 12] });

function ClickToAdd({ onAdd }) {
  useMapEvents({ click: (e) => onAdd([round(e.latlng.lat), round(e.latlng.lng)]) });
  return null;
}
function FitTo({ points, me }) {
  const map = useMap();
  // Only auto-fit when the map opens with an existing boundary; while drawing, keep the user's view.
  const done = useRef(points.length === 0);
  useEffect(() => {
    if (points.length >= 2 && !done.current) { map.fitBounds(points, { padding: [30, 30], maxZoom: 19 }); done.current = true; }
    else if (points.length === 1 && !done.current) { map.setView(points[0], 18); done.current = true; }
  }, [points, map]);
  useEffect(() => { if (me) map.setView(me, Math.max(map.getZoom(), 18)); }, [me, map]);
  return null;
}

function LeafletMap({ points, editable, onChange, height, me, satellite, others = [], start }) {
  const center = points[0] || start || KAMPALA;
  return (
    <MapContainer center={center} zoom={points.length || start ? 17 : 13} style={{ height }} scrollWheelZoom={editable} className={`map ${document.documentElement.dataset.theme === 'dark' && !satellite ? 'dark-tiles' : ''}`}>
      {satellite ? (
        <TileLayer attribution="Tiles &copy; Esri" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={19} />
      ) : (
        <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
      )}
      <FitTo points={points} me={me} />
      {others.map((o) => (
        <Polygon key={o.id} positions={o.boundary} pathOptions={{ color: o.conflict ? '#dc2626' : '#94a3b8', weight: 2, dashArray: '5 5', fillOpacity: o.conflict ? 0.25 : 0.12, fillColor: o.conflict ? '#dc2626' : '#94a3b8' }}>
          <Tooltip sticky>{o.code} · {o.title}</Tooltip>
        </Polygon>
      ))}
      {points.length >= 3 && <Polygon positions={points} pathOptions={{ color: '#B8922A', weight: 3, fillColor: '#E3C877', fillOpacity: 0.35 }} />}
      {points.length === 2 && <Polyline positions={points} pathOptions={{ color: '#B8922A', weight: 3, dashArray: '6 6' }} />}
      {editable && <ClickToAdd onAdd={(p) => onChange([...points, p])} />}
      {editable && points.map((p, i) => (
        <Marker key={i} position={p} icon={vertexIcon(i)} draggable
          eventHandlers={{ dragend: (e) => { const ll = e.target.getLatLng(); onChange(points.map((q, j) => (j === i ? [round(ll.lat), round(ll.lng)] : q))); } }} />
      ))}
      {me && <Marker position={me} icon={L.divIcon({ className: 'me-dot', iconSize: [16, 16], iconAnchor: [8, 8] })} />}
    </MapContainer>
  );
}

// Google Maps Platform implementation, used when VITE_GOOGLE_MAPS_API_KEY is set.
let googleLoader;
function loadGoogle() {
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  googleLoader ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_KEY}&v=weekly`;
    s.async = true;
    s.onload = () => resolve(window.google.maps);
    s.onerror = () => reject(new Error('Google Maps failed to load'));
    document.head.appendChild(s);
  });
  return googleLoader;
}
function GoogleMap({ points, editable, onChange, height, me, satellite, others = [] }) {
  const el = useRef(null);
  const st = useRef({});
  const pointsRef = useRef(points);
  pointsRef.current = points;
  const [err, setErr] = useState(null);

  useEffect(() => {
    let cancelled = false;
    loadGoogle().then((maps) => {
      if (cancelled) return;
      const map = new maps.Map(el.current, {
        center: points[0] ? { lat: points[0][0], lng: points[0][1] } : { lat: KAMPALA[0], lng: KAMPALA[1] },
        zoom: points.length ? 18 : 13, mapTypeId: satellite ? 'hybrid' : 'roadmap', streetViewControl: false, fullscreenControl: false,
      });
      const poly = new maps.Polygon({ map, strokeColor: '#B8922A', strokeWeight: 3, fillColor: '#E3C877', fillOpacity: 0.3, editable: Boolean(editable) });
      st.current = { maps, map, poly, otherPolys: [], fitted: false };
      if (editable) {
        map.addListener('click', (e) => onChange([...pointsRef.current, [round(e.latLng.lat()), round(e.latLng.lng())]]));
        const sync = () => onChange(poly.getPath().getArray().map((ll) => [round(ll.lat()), round(ll.lng())]));
        st.current.sync = sync;
      }
      draw();
      drawOthers();
    }).catch((e) => setErr(e.message));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function drawOthers() {
    const { maps, map } = st.current;
    if (!maps || !map) return;
    st.current.otherPolys?.forEach((polygon) => polygon.setMap(null));
    st.current.otherPolys = others
      .filter((other) => Array.isArray(other.boundary) && other.boundary.length >= 3)
      .map((other) => new maps.Polygon({
        map,
        paths: other.boundary.map(([lat, lng]) => ({ lat, lng })),
        strokeColor: other.conflict ? '#dc2626' : '#94a3b8',
        strokeOpacity: 1,
        strokeWeight: 2,
        fillColor: other.conflict ? '#dc2626' : '#94a3b8',
        fillOpacity: other.conflict ? 0.25 : 0.12,
        clickable: true,
      }));
  }

  function draw() {
    const { maps, map, poly, sync } = st.current;
    if (!maps) return;
    const path = new maps.MVCArray(pointsRef.current.map(([lat, lng]) => new maps.LatLng(lat, lng)));
    poly.setPath(path);
    if (sync) ['set_at', 'insert_at', 'remove_at'].forEach((ev) => path.addListener(ev, sync));
    if (!st.current.fitted && pointsRef.current.length >= 2) {
      const b = new maps.LatLngBounds();
      pointsRef.current.forEach(([lat, lng]) => b.extend({ lat, lng }));
      map.fitBounds(b, 30);
      st.current.fitted = true;
    }
  }
  useEffect(draw, [points]);
  useEffect(drawOthers, [others]);
  useEffect(() => { if (me && st.current.map) { st.current.map.setCenter({ lat: me[0], lng: me[1] }); st.current.map.setZoom(19); } }, [me]);
  useEffect(() => { st.current.map?.setMapTypeId(satellite ? 'hybrid' : 'roadmap'); }, [satellite]);

  if (err) return <div className="map map-error" style={{ height }}>{err}</div>;
  return <div ref={el} className="map" style={{ height }} />;
}

export default function BoundaryMap({ value = [], onChange, height = 360, others = [], start }) {
  const editable = Boolean(onChange);
  const points = useMemo(() => (Array.isArray(value) ? value : []), [value]);
  const [walking, setWalking] = useState(false);
  const [me, setMe] = useState(null);
  const [gpsMsg, setGpsMsg] = useState('');
  const [satellite, setSatellite] = useState(true);
  const watchId = useRef(null);
  const latest = useRef(points);
  latest.current = points;

  useEffect(() => () => { if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current); }, []);

  const startWalk = () => {
    if (!navigator.geolocation) { setGpsMsg('This device does not provide GPS location.'); return; }
    setWalking(true); setGpsMsg('Walking: a point is added every few metres. Walk the boundary, then press Stop.');
    watchId.current = navigator.geolocation.watchPosition((pos) => {
      const p = [round(pos.coords.latitude), round(pos.coords.longitude)];
      setMe(p);
      const last = latest.current[latest.current.length - 1];
      if (pos.coords.accuracy > 25) { setGpsMsg(`Waiting for a better GPS signal (±${Math.round(pos.coords.accuracy)} m)…`); return; }
      if (!last || distM(last, p) >= 4) onChange([...latest.current, p]);
      setGpsMsg(`Walking · GPS accuracy ±${Math.round(pos.coords.accuracy)} m`);
    }, (e) => { setGpsMsg(`GPS error: ${e.message}`); setWalking(false); }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
  };
  const stopWalk = () => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null; setWalking(false); setGpsMsg('');
  };
  const addHere = () => {
    if (!navigator.geolocation) return setGpsMsg('This device does not provide GPS location.');
    setGpsMsg('Getting your position…');
    navigator.geolocation.getCurrentPosition((pos) => {
      const p = [round(pos.coords.latitude), round(pos.coords.longitude)];
      setMe(p); onChange([...latest.current, p]); setGpsMsg(`Point added (±${Math.round(pos.coords.accuracy)} m)`);
    }, (e) => setGpsMsg(`GPS error: ${e.message}`), { enableHighAccuracy: true, timeout: 20000 });
  };

  const area = polygonAreaM2(points);
  const MapImpl = GOOGLE_KEY ? GoogleMap : LeafletMap;

  return (
    <div className="boundary">
      {editable && (
        <div className="map-toolbar">
          {!walking ? <button type="button" className="btn btn-gold" onClick={startWalk}>Walk the boundary</button>
            : <button type="button" className="btn btn-danger" onClick={stopWalk}>Stop walking</button>}
          <button type="button" className="btn btn-outline" onClick={addHere} disabled={walking}>Add my position</button>
          <button type="button" className="btn btn-outline" onClick={() => onChange(points.slice(0, -1))} disabled={!points.length}>Undo</button>
          <button type="button" className="btn btn-outline" onClick={() => onChange([])} disabled={!points.length}>Clear</button>
          <label className="toggle"><input type="checkbox" checked={satellite} onChange={(e) => setSatellite(e.target.checked)} /> Satellite</label>
        </div>
      )}
      {editable && <p className="hint">{gpsMsg || 'Tap the map to place boundary points, drag a numbered point to adjust it, or walk the boundary with your phone.'}</p>}
      <MapImpl points={points} editable={editable} onChange={onChange} height={height} me={me} satellite={satellite} others={others} start={start} />
      <div className="map-stats">
        <span><strong>{points.length}</strong> points</span>
        <span><strong>{area ? `${Math.round(area).toLocaleString()} m²` : '—'}</strong></span>
        <span><strong>{area ? (area / 4046.86).toFixed(2) : '—'}</strong> acres</span>
        {others.length > 0 && <span>{others.length} nearby recorded plot{others.length === 1 ? '' : 's'} shown</span>}
        <span style={{ marginLeft: 'auto' }}>{GOOGLE_KEY ? 'Google Maps Platform' : 'OpenStreetMap · Esri imagery'}</span>
      </div>
    </div>
  );
}
