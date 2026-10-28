// Hand-drawn SVG scene: mapped plots on a hillside, a phone showing a sealed
// record, and the Ettaka shield. Used on the sign-in page.
export default function Illustration() {
  return (
    <svg viewBox="0 0 560 400" width="100%" role="img" aria-label="Mapped land plots protected by a sealed digital record">
      <defs>
        <linearGradient id="il-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#dfe8ff" /><stop offset="1" stopColor="#f4efe0" /></linearGradient>
        <linearGradient id="il-hill1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9fd18b" /><stop offset="1" stopColor="#6fae63" /></linearGradient>
        <linearGradient id="il-hill2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b9dc96" /><stop offset="1" stopColor="#8cc276" /></linearGradient>
        <linearGradient id="il-shield" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2b59c3" /><stop offset="1" stopColor="#1f3864" /></linearGradient>
        <filter id="il-sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#1f3864" floodOpacity="0.18" /></filter>
      </defs>
      <rect x="20" y="20" width="520" height="360" rx="28" fill="url(#il-sky)" />
      <circle cx="460" cy="86" r="30" fill="#f6d77d" opacity="0.9" />
      <path d="M20 270 C120 200 210 230 300 205 C390 180 450 210 540 190 L540 352 Q540 380 512 380 L48 380 Q20 380 20 352 Z" fill="url(#il-hill2)" />
      <path d="M20 310 C140 260 240 300 340 270 C420 248 480 262 540 250 L540 352 Q540 380 512 380 L48 380 Q20 380 20 352 Z" fill="url(#il-hill1)" />
      {/* plots */}
      <g stroke="#b8922a" strokeWidth="2.5" strokeLinejoin="round">
        <path d="M70 318 L150 296 L176 336 L92 356 Z" fill="#e3c877" fillOpacity="0.45" />
        <path d="M156 294 L240 276 L262 316 L180 334 Z" fill="#e3c877" fillOpacity="0.25" />
        <path d="M246 274 L326 262 L346 300 L266 314 Z" fill="#e3c877" fillOpacity="0.45" strokeDasharray="6 5" />
      </g>
      {[[70, 318], [150, 296], [176, 336], [92, 356]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="5" fill="#1f3864" stroke="#fff" strokeWidth="2" />)}
      {/* trees and house */}
      <g>
        <rect x="110" y="300" width="22" height="18" fill="#fff" stroke="#1f3864" strokeWidth="2" />
        <path d="M106 302 L121 289 L136 302 Z" fill="#c2410c" />
        <circle cx="210" cy="292" r="12" fill="#3f8f4f" /><rect x="208" y="300" width="4" height="10" fill="#6b4f2a" />
        <circle cx="298" cy="280" r="10" fill="#3f8f4f" /><rect x="296" y="287" width="4" height="9" fill="#6b4f2a" />
        <circle cx="60" cy="300" r="9" fill="#3f8f4f" />
      </g>
      {/* phone */}
      <g filter="url(#il-sh)" transform="translate(372 120)">
        <rect width="128" height="226" rx="20" fill="#0f172a" />
        <rect x="8" y="10" width="112" height="206" rx="14" fill="#fff" />
        <rect x="18" y="24" width="60" height="7" rx="3.5" fill="#1f3864" />
        <rect x="18" y="37" width="40" height="5" rx="2.5" fill="#cbd5e1" />
        <rect x="18" y="52" width="92" height="56" rx="8" fill="#e7f6ec" />
        <circle cx="38" cy="80" r="11" fill="#16a34a" />
        <path d="M33 80 l4 4 l8 -9" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="56" y="72" width="46" height="6" rx="3" fill="#16a34a" opacity="0.8" />
        <rect x="56" y="83" width="32" height="5" rx="2.5" fill="#16a34a" opacity="0.45" />
        <g transform="translate(34 120)">
          <rect width="60" height="60" rx="6" fill="#fff" stroke="#e2e8f0" />
          {[...Array(36)].map((_, i) => ((i * 7 + (i % 5)) % 3 === 0 ? <rect key={i} x={6 + (i % 6) * 8} y={6 + Math.floor(i / 6) * 8} width="7" height="7" fill="#1f3864" /> : null))}
          <rect x="6" y="6" width="15" height="15" fill="none" stroke="#1f3864" strokeWidth="3" />
          <rect x="39" y="6" width="15" height="15" fill="none" stroke="#1f3864" strokeWidth="3" />
          <rect x="6" y="39" width="15" height="15" fill="none" stroke="#1f3864" strokeWidth="3" />
        </g>
        <rect x="18" y="192" width="92" height="12" rx="6" fill="#2251b8" />
      </g>
      {/* shield */}
      <g filter="url(#il-sh)" transform="translate(212 74)">
        <path d="M68 0 L132 22 V78 C132 124 104 152 68 168 C32 152 4 124 4 78 V22 Z" fill="url(#il-shield)" />
        <path d="M68 16 L118 33 V79 C118 114 98 136 68 150 C38 136 18 114 18 79 V33 Z" fill="none" stroke="#e3c877" strokeWidth="3" opacity="0.8" />
        <path d="M44 84 L62 102 L96 64" stroke="#e3c877" strokeWidth="11" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g stroke="#b8922a" strokeWidth="2" strokeDasharray="3 6" fill="none" opacity="0.7">
        <path d="M280 246 C300 270 330 300 372 280" />
        <path d="M200 160 C150 180 120 230 130 290" />
      </g>
    </svg>
  );
}
