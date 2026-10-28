import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, BarChart3, Bell, Blocks, ChevronDown, FilePlus2, FileText, LayoutDashboard, LogOut, Map, Menu, MessageCircleQuestion,
  Moon, ScanText, Scale, Search, Settings, ShieldCheck, Sun, CheckCheck, AlertTriangle, Info, CheckCircle2, ShieldAlert, Lock,
} from 'lucide-react';
import { api, isOfficial, timeAgo, USER_ROLES } from '../api';
import { useAuth } from '../auth.jsx';
import { useTheme, usePageMeta } from '../theme.jsx';
import Brand from './Brand.jsx';
import CommandPalette from './CommandPalette.jsx';
import { Avatar, useClickOutside } from './ui.jsx';

const NAV = [
  { group: 'Overview', items: [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, hint: 'Overview and key metrics' },
    { to: '/map', label: 'Land Map', icon: Map, hint: 'All plots and boundary conflicts' },
  ] },
  { group: 'Land records', items: [
    { to: '/records', label: 'Land Records', icon: FileText, hint: 'Search and manage records', end: true },
    { to: '/records/new', label: 'New Record', icon: FilePlus2, hint: 'Record a plot of land' },
    { to: '/digitise', label: 'Old Papers', icon: ScanText, hint: 'Digitise an old agreement' },
  ] },
  { group: 'Justice', items: [
    { to: '/disputes', label: 'Disputes & Mediation', icon: Scale, hint: 'Mediation pipeline', badge: 'disputes' },
    { to: '/verification', label: 'Verification', icon: ShieldCheck, hint: 'Verify records and see checks' },
    { to: '/rights', label: 'Know My Rights', icon: MessageCircleQuestion, hint: 'Ask about land law' },
  ] },
  { group: 'Integrity', items: [
    { to: '/ledger', label: 'Ledger Explorer', icon: Blocks, hint: 'Hash-chained seal ledger' },
    { to: '/reports', label: 'Reports & Impact', icon: BarChart3, hint: 'SDG impact and exports', official: true },
    { to: '/activity', label: 'Audit Trail', icon: Activity, hint: 'Every action, logged' },
  ] },
  { group: 'System', items: [
    { to: '/settings', label: 'Settings', icon: Settings, hint: 'Organisation, roles and security' },
  ] },
];

const N_ICON = { success: [CheckCircle2, 'green'], warning: [AlertTriangle, 'orange'], danger: [ShieldAlert, 'red'], info: [Info, 'blue'] };

function Notifications() {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ notifications: [], unread: 0 });
  const load = useCallback(() => api('/notifications').then(setData).catch(() => {}), []);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);
  const ref = useClickOutside(useCallback(() => setOpen(false), []));
  const readAll = async () => { await api('/notifications/read-all', { method: 'POST' }); load(); };
  const openOne = async (n) => {
    setOpen(false);
    if (!n.read_at) api(`/notifications/${n.id}/read`, { method: 'POST' }).then(load);
    if (n.link) nav(n.link);
  };
  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button className="icon-btn" onClick={() => { setOpen(!open); if (!open) load(); }} aria-label={`Notifications${data.unread ? `, ${data.unread} unread` : ''}`}>
        <Bell size={18} />{data.unread > 0 && <span className="dot">{data.unread}</span>}
      </button>
      {open && (
        <div className="popover" style={{ width: 380 }}>
          <div className="row-between" style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <strong>Notifications</strong>
            {data.unread > 0 && <button className="link small" onClick={readAll}><CheckCheck size={14} style={{ verticalAlign: -2 }} /> Mark all read</button>}
          </div>
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {data.notifications.length === 0 && <div className="empty small">You are all caught up.</div>}
            {data.notifications.map((n) => {
              const [I, c] = N_ICON[n.kind] || N_ICON.info;
              return (
                <div key={n.id} className={`notif ${n.read_at ? '' : 'unread'}`} onClick={() => openOne(n)}>
                  <div className={`tile tile-xs t-${c}`}><I size={15} /></div>
                  <div className="grow"><div className="title">{n.title}</div>{n.body && <div className="sub">{n.body}</div>}<div className="time">{timeAgo(n.created_at)}</div></div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(useCallback(() => setOpen(false), []));
  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button className="user-btn" onClick={() => setOpen(!open)} aria-label="Account menu">
        <Avatar name={user.full_name} src={user.photo_url} />
        <div className="who"><div className="name">{user.full_name}</div><div className="role">{USER_ROLES[user.role]}</div></div>
        <ChevronDown size={16} className="who" color="var(--muted)" />
      </button>
      {open && (
        <div className="popover">
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <div className="strong">{user.full_name}</div>
            <div className="small muted">{user.title || USER_ROLES[user.role]} · {user.phone}</div>
          </div>
          <Link className="menu-item" to="/settings" onClick={() => setOpen(false)}><Settings size={16} /> Settings</Link>
          <Link className="menu-item" to="/activity" onClick={() => setOpen(false)}><Activity size={16} /> My activity</Link>
          <button className="menu-item" onClick={() => { logout(); nav('/'); }}><LogOut size={16} /> Sign out</button>
        </div>
      )}
    </div>
  );
}

export default function Layout({ children }) {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const { title, sub } = usePageMeta();
  const loc = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openDisputes, setOpenDisputes] = useState(0);

  useEffect(() => { setNavOpen(false); }, [loc.pathname]);
  useEffect(() => {
    const k = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((p) => !p); } };
    const s = () => setScrolled(window.scrollY > 4);
    window.addEventListener('keydown', k); window.addEventListener('scroll', s);
    return () => { window.removeEventListener('keydown', k); window.removeEventListener('scroll', s); };
  }, []);
  useEffect(() => {
    api('/disputes').then((d) => setOpenDisputes(d.disputes.filter((x) => !['resolved'].includes(x.stage)).length)).catch(() => {});
  }, [loc.pathname]);

  const groups = NAV.map((g) => ({ ...g, items: g.items.filter((i) => !i.official || isOfficial(user)) })).filter((g) => g.items.length);
  const pages = groups.flatMap((g) => g.items);

  return (
    <div className={`app ${navOpen ? 'nav-open' : ''}`}>
      <div className="scrim" onClick={() => setNavOpen(false)} />
      <aside className="sidebar">
        <Brand to="/dashboard" />
        <nav className="nav" aria-label="Main">
          {groups.map((g) => (
            <div key={g.group}>
              <div className="nav-group">{g.group}</div>
              {g.items.map((i) => (
                <NavLink key={i.to} to={i.to} end={i.end}>
                  <i.icon size={18} />{i.label}
                  {i.badge === 'disputes' && openDisputes > 0 && <span className="nav-count">{openDisputes}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-card">
          <Lock size={18} color="var(--primary)" style={{ flex: 'none' }} />
          <div><strong>Evidence you can trust</strong><span>Every sealed record is SHA-256 fingerprinted and hash-chained.</span></div>
        </div>
      </aside>

      <div className="main">
        <header className={`topbar ${scrolled ? 'scrolled' : ''}`}>
          <div className="topbar-inner">
            <button className="icon-btn menu-toggle" onClick={() => setNavOpen(true)} aria-label="Open menu"><Menu size={18} /></button>
            <div className="page-title grow">
              <h1 className="truncate">{title}</h1>
              {sub && <p className="truncate">{sub}</p>}
            </div>
            <button className="search-trigger" onClick={() => setPalette(true)} aria-label="Search">
              <Search size={16} /><span className="label">Search records, people, codes…</span><span className="kbd">⌘K</span>
            </button>
            <button className="icon-btn" onClick={toggle} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <Notifications />
            <UserMenu />
          </div>
        </header>
        <div className="content">{children}</div>
      </div>
      <CommandPalette open={palette} onClose={() => setPalette(false)} pages={pages} />
    </div>
  );
}
