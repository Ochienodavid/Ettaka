import { Link } from 'react-router-dom';

export const Mark = ({ size = 40 }) => (
  <div className="brand-mark" style={{ width: size, height: size }}>
    <svg viewBox="0 0 64 64" width={size * 0.62} height={size * 0.62} aria-hidden="true">
      <path d="M12 44 L32 16 L52 44 Z" fill="none" stroke="#E3C877" strokeWidth="5.5" strokeLinejoin="round" />
      <path d="M24 44 L32 32 L40 44" fill="#E3C877" opacity="0.55" />
      <path d="M8 51 H56" stroke="#E3C877" strokeWidth="5.5" strokeLinecap="round" />
    </svg>
  </div>
);

export default function Brand({ to = '/', sub = 'Land Rights Evidence Platform' }) {
  return (
    <Link to={to} className="brand" aria-label="Ettaka home">
      <Mark />
      <div>
        <div className="brand-name">Ettaka</div>
        {sub && <div className="brand-sub">{sub}</div>}
      </div>
    </Link>
  );
}
