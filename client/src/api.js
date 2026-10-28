const TOKEN_KEY = 'ettaka.token';

const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
};
export const getToken = () => store.get(TOKEN_KEY);
export const setToken = (t) => store.set(TOKEN_KEY, t || null);
export { store };

export class ApiError extends Error {
  constructor(message, status, body) { super(message); this.status = status; this.body = body; }
}

export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(`/api${path}`, { method, headers, body: payload });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status})`, res.status, data);
  return data;
}

// Authenticated file download (CSV exports).
export async function download(path, filename) {
  const res = await fetch(`/api${path}`, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) throw new Error('Export failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const qs = (o) => {
  const s = new URLSearchParams(Object.entries(o).filter(([, v]) => v !== '' && v !== null && v !== undefined)).toString();
  return s ? `?${s}` : '';
};

export const ROLE_LABELS = {
  seller: 'Seller', buyer: 'Buyer', owner: 'Owner', co_owner: 'Co-owner', spouse: 'Spouse',
  heir: 'Heir', donor: 'Giver', recipient: 'Recipient',
};
export const TYPE_LABELS = {
  sale: 'Land sale', gift: 'Gift of land', inheritance: 'Inheritance plan', customary_claim: 'Customary claim',
};
export const TYPE_COLORS = { sale: 'blue', gift: 'purple', inheritance: 'orange', customary_claim: 'teal' };
export const TENURE_LABELS = {
  customary: 'Customary', kibanja: 'Kibanja', mailo: 'Mailo', freehold: 'Freehold', leasehold: 'Leasehold', unknown: 'Not sure',
};
export const USER_ROLES = { citizen: 'Citizen', lc_official: 'LC Official', mediator: 'Mediator', admin: 'Administrator' };
export const STAGES = [
  { id: 'reported', label: 'Reported', color: '#64748b' },
  { id: 'lc_review', label: 'LC review', color: '#2563eb' },
  { id: 'mediation', label: 'Mediation', color: '#7c3aed' },
  { id: 'resolved', label: 'Resolved', color: '#16a34a' },
  { id: 'escalated', label: 'Escalated to court', color: '#dc2626' },
];
export const STAGE_BADGE = { reported: 'gray', lc_review: 'blue', mediation: 'purple', resolved: 'green', escalated: 'red' };
export const CATEGORIES = {
  boundary: 'Boundary', ownership: 'Ownership', inheritance: 'Inheritance', eviction: 'Eviction',
  double_sale: 'Double sale', payment: 'Payment', other: 'Other',
};
export const VERIFIER_LABELS = { public: 'Public', buyer: 'Buyer', lender: 'Lender', mediator: 'Mediator', court: 'Court', official: 'Official' };

export const isOfficial = (u) => ['lc_official', 'mediator', 'admin'].includes(u?.role);

export const ugx = (n) => (n === null || n === undefined || n === '' ? '—' : `UGX ${Number(n).toLocaleString('en-UG')}`);
export const ugxShort = (n) => {
  if (!n) return '—';
  const v = Number(n);
  return v >= 1e9 ? `UGX ${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `UGX ${(v / 1e6).toFixed(1)}M` : `UGX ${v.toLocaleString()}`;
};
export const acres = (m2, d = 2) => (m2 ? `${(Number(m2) / 4046.86).toFixed(d)} ac` : '—');
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
export const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—');

export function timeAgo(d) {
  if (!d) return '—';
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  const fut = s < 0;
  const a = Math.abs(s);
  const f = (n, u) => `${Math.round(n)} ${u}${Math.round(n) === 1 ? '' : 's'}`;
  const t = a < 60 ? 'just now' : a < 3600 ? f(a / 60, 'min') : a < 86400 ? f(a / 3600, 'hour') : a < 86400 * 30 ? f(a / 86400, 'day') : null;
  if (!t) return fmtDate(d);
  if (t === 'just now') return t;
  return fut ? `in ${t}` : `${t} ago`;
}

export const initials = (name = '') => name.replace(/\(.*?\)/g, '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const AV = ['#2563eb', '#7c3aed', '#db2777', '#ea7c12', '#0d9488', '#16a34a', '#b8922a', '#1f3864', '#dc2626', '#0891b2'];
export const avatarColor = (name = '') => AV[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % AV.length];

export const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
