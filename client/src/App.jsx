import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, Link } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import PublicNav from './components/PublicNav.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';

const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Records = lazy(() => import('./pages/Records.jsx'));
const RecordEditor = lazy(() => import('./pages/RecordEditor.jsx'));
const RecordView = lazy(() => import('./pages/RecordView.jsx'));
const LandMap = lazy(() => import('./pages/LandMap.jsx'));
const Disputes = lazy(() => import('./pages/Disputes.jsx'));
const Verification = lazy(() => import('./pages/Verification.jsx'));
const Verify = lazy(() => import('./pages/Verify.jsx'));
const Rights = lazy(() => import('./pages/Rights.jsx'));
const Digitise = lazy(() => import('./pages/Digitise.jsx'));
const Ledger = lazy(() => import('./pages/Ledger.jsx'));
const Reports = lazy(() => import('./pages/Reports.jsx'));
const Activity = lazy(() => import('./pages/Activity.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));

const Loading = () => <div className="empty"><div className="skeleton" style={{ height: 120, maxWidth: 900, margin: '0 auto' }} /></div>;

function Private({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout><Suspense fallback={<Loading />}>{children}</Suspense></Layout>;
}

// Pages that work signed in (inside the app) or signed out (public layout).
function Either({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <Loading />;
  if (user) return <Layout><Suspense fallback={<Loading />}>{children}</Suspense></Layout>;
  return (
    <div className="public">
      <PublicNav />
      <div className="pub-wrap" style={{ paddingTop: 28, paddingBottom: 48 }}><Suspense fallback={<Loading />}>{children}</Suspense></div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/verify" element={<Either><Verify /></Either>} />
      <Route path="/verify/:code" element={<Either><Verify /></Either>} />
      <Route path="/rights" element={<Either><Rights /></Either>} />
      <Route path="/dashboard" element={<Private><Dashboard /></Private>} />
      <Route path="/map" element={<Private><LandMap /></Private>} />
      <Route path="/records" element={<Private><Records /></Private>} />
      <Route path="/records/new" element={<Private><RecordEditor /></Private>} />
      <Route path="/records/:id/edit" element={<Private><RecordEditor /></Private>} />
      <Route path="/records/:id" element={<Private><RecordView /></Private>} />
      <Route path="/digitise" element={<Private><Digitise /></Private>} />
      <Route path="/disputes" element={<Private><Disputes /></Private>} />
      <Route path="/verification" element={<Private><Verification /></Private>} />
      <Route path="/ledger" element={<Private><Ledger /></Private>} />
      <Route path="/reports" element={<Private><Reports /></Private>} />
      <Route path="/activity" element={<Private><Activity /></Private>} />
      <Route path="/settings" element={<Private><Settings /></Private>} />
      <Route path="*" element={<Either><div className="empty"><h2>Page not found</h2><p className="mt-1"><Link to="/">Go to the home page</Link></p></div></Either>} />
    </Routes>
  );
}
