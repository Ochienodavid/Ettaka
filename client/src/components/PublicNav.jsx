import { Link } from 'react-router-dom';
import { ArrowRight, Moon, Sun } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { useTheme } from '../theme.jsx';
import Brand from './Brand.jsx';

export default function PublicNav() {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  return (
    <header className="pub-nav">
      <div className="pub-nav-inner">
        <Brand sub="Land Rights Evidence Platform" />
        <nav className="pub-links">
          <a href="/#features">Features</a>
          <a href="/#how">How it works</a>
          <a href="/#impact">Impact</a>
          <Link to="/verify">Verify a record</Link>
          <Link to="/rights">Know your rights</Link>
        </nav>
        <div className="row" style={{ marginLeft: 'auto' }}>
          <button className="icon-btn" onClick={toggle} aria-label="Toggle dark mode">{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
          {user ? <Link to="/dashboard" className="btn btn-primary">Open dashboard <ArrowRight size={16} /></Link> : (
            <>
              <Link to="/login" className="btn btn-outline">Sign in</Link>
              <Link to="/login?new=1" className="btn btn-primary">Get started</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
