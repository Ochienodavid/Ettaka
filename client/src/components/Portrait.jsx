// Illustrated portrait avatars for people without an uploaded photo.
// Deterministic per name, so the same person always looks the same.
const SKIN = ['#8d5524', '#6b3e26', '#a0663f', '#5c3a21', '#7b4a2e', '#c68642', '#4a2c1a', '#9a5b34'];
const HAIR = ['#1b1210', '#231815', '#2e1f18', '#120c0a'];
const BG = ['#dbe7ff', '#e7f6ec', '#fdeaf3', '#fff2e3', '#f1ebff', '#e3f6f4', '#fbf4df', '#e8edf6'];
const SHIRT = ['#2251b8', '#16a34a', '#b8922a', '#7c3aed', '#0d9488', '#db2777', '#ea7c12', '#1f3864', '#dc2626'];
const WRAP = ['#e11d48', '#f59e0b', '#7c3aed', '#0d9488', '#2563eb', '#b8922a'];

const FEMALE = new Set(['sarah', 'grace', 'harriet', 'annet', 'florence', 'agnes', 'ruth', 'esther', 'juliet', 'prossy', 'doreen', 'betty', 'joan', 'mary',
  'nakato', 'namusoke', 'nansubuga', 'akello', 'atim', 'achieng', 'kyomuhendo', 'nabirye', 'auma', 'apio', 'kemigisha', 'nalwoga', 'babirye', 'namubiru',
  'ayebare', 'adong', 'nyakato', 'aciro', 'daughter', 'jessica', 'mother', 'widow']);

function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

export function guessGender(name = '') {
  const words = name.toLowerCase().replace(/[()]/g, ' ').split(/\s+/);
  return words.some((w) => FEMALE.has(w)) ? 'female' : 'male';
}

export default function Portrait({ name = '', gender, size = 36 }) {
  const h = hash(name || '?');
  const g = gender === 'female' || gender === 'male' ? gender : guessGender(name);
  const skin = SKIN[h % SKIN.length];
  const hair = HAIR[(h >> 3) % HAIR.length];
  const bg = BG[(h >> 5) % BG.length];
  const shirt = SHIRT[(h >> 7) % SHIRT.length];
  const wrap = WRAP[(h >> 9) % WRAP.length];
  const style = (h >> 11) % 4;
  const smile = (h >> 13) % 2;

  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" style={{ display: 'block' }}>
      <rect width="64" height="64" fill={bg} />
      {/* hair behind the head */}
      {g === 'female' && style === 0 && <circle cx="32" cy="27" r="19" fill={hair} />}
      {g === 'female' && style === 1 && <path d="M15 30 Q14 12 32 11 Q50 12 49 30 L50 48 Q44 44 44 36 L20 36 Q20 44 14 48 Z" fill={hair} />}
      {/* shoulders */}
      <path d="M8 64 Q10 46 32 45 Q54 46 56 64 Z" fill={shirt} />
      <path d="M26 46 L32 53 L38 46 Z" fill="#fff" opacity="0.25" />
      <rect x="28" y="38" width="8" height="9" rx="3" fill={skin} />
      {/* head */}
      <ellipse cx="32" cy="29" rx="12" ry="13.5" fill={skin} />
      <ellipse cx="20.5" cy="30" rx="2.2" ry="3" fill={skin} />
      <ellipse cx="43.5" cy="30" rx="2.2" ry="3" fill={skin} />
      {/* hair on top */}
      {g === 'male' && style !== 2 && <path d="M20 26 Q20 14 32 14 Q44 14 44 26 Q42 19 32 19 Q22 19 20 26 Z" fill={hair} />}
      {g === 'male' && style === 3 && <path d="M21 33 Q22 44 32 44 Q42 44 43 33 Q41 40 32 40.5 Q23 40 21 33 Z" fill={hair} opacity="0.92" />}
      {g === 'female' && style === 0 && <path d="M20 24 Q22 13 32 13 Q42 13 44 24 Q38 18 32 18 Q26 18 20 24 Z" fill={hair} />}
      {g === 'female' && style === 1 && <path d="M20 26 Q20 14 32 14 Q44 14 44 26 Q40 18 32 19 Q24 18 20 26 Z" fill={hair} />}
      {g === 'female' && style === 2 && (
        <g>
          <path d="M18 24 Q18 9 32 9 Q47 9 46 24 Q40 19 32 19 Q24 19 18 24 Z" fill={wrap} />
          <path d="M40 11 Q50 6 48 17 Q45 12 40 11 Z" fill={wrap} opacity="0.85" />
          <path d="M20 21 Q32 15 44 21" stroke="#fff" strokeOpacity="0.35" strokeWidth="1.5" fill="none" />
        </g>
      )}
      {g === 'female' && style === 3 && (
        <g>
          <circle cx="32" cy="12" r="6" fill={hair} />
          <path d="M20 25 Q21 15 32 15 Q43 15 44 25 Q39 19 32 19.5 Q25 19 20 25 Z" fill={hair} />
        </g>
      )}
      {g === 'female' && <><circle cx="20.5" cy="34" r="1.3" fill="#e3c877" /><circle cx="43.5" cy="34" r="1.3" fill="#e3c877" /></>}
      {/* face */}
      <path d="M25 26 Q27.5 24.6 30 26" stroke="#1b1210" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      <path d="M34 26 Q36.5 24.6 39 26" stroke="#1b1210" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      <circle cx="27.5" cy="29" r="1.5" fill="#1b1210" />
      <circle cx="36.5" cy="29" r="1.5" fill="#1b1210" />
      <circle cx="28" cy="28.5" r="0.45" fill="#fff" />
      <circle cx="37" cy="28.5" r="0.45" fill="#fff" />
      <path d="M31 31 Q32 33.5 33 31" stroke="#000" strokeOpacity="0.25" strokeWidth="1" fill="none" />
      {smile ? <path d="M27.5 35 Q32 39 36.5 35" stroke="#5a1f14" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        : <path d="M28.5 35.6 Q32 37.6 35.5 35.6" stroke="#5a1f14" strokeWidth="1.3" fill="none" strokeLinecap="round" />}
    </svg>
  );
}
