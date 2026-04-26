interface Props { size?: number }

export function BeauTentacule({ size = 60 }: Props) {
  const s = size;
  return (
    <svg width={s} height={Math.round(s * 1.5)} viewBox="0 0 80 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Crâne long et bulbeux */}
      <ellipse cx="40" cy="28" rx="22" ry="26" fill="#6dbfb0" stroke="#2a6b5f" strokeWidth="2"/>
      <ellipse cx="33" cy="17" rx="7" ry="9" fill="#8dd4c4" opacity="0.5"/>

      {/* Joues larges + mâchoire CARRÉE — la jawline sigma */}
      <path d="M18 42 L16 72 L16 82 Q16 92 26 94 L40 96 L54 94 Q64 92 64 82 L64 72 L62 42 Z"
        fill="#7ec8b8" stroke="#2a6b5f" strokeWidth="2"/>
      {/* Coins de mâchoire nets et anguleux */}
      <path d="M16 78 L16 88 Q16 96 26 96 L40 97" stroke="#2a6b5f" strokeWidth="2" fill="none"/>
      <path d="M64 78 L64 88 Q64 96 54 96 L40 97" stroke="#2a6b5f" strokeWidth="2" fill="none"/>

      {/* Sourcils froncés */}
      <path d="M22 37 Q29 31 36 35" stroke="#2a6b5f" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
      <path d="M44 35 Q51 31 58 37" stroke="#2a6b5f" strokeWidth="2.5" strokeLinecap="round" fill="none"/>

      {/* Yeux tombants */}
      <ellipse cx="29" cy="43" rx="8" ry="6" fill="#d4e870" stroke="#2a6b5f" strokeWidth="1.5"/>
      <ellipse cx="51" cy="43" rx="8" ry="6" fill="#d4e870" stroke="#2a6b5f" strokeWidth="1.5"/>
      <path d="M21 41 Q29 37 37 41" stroke="#2a6b5f" strokeWidth="2" fill="#6dbfb0" strokeLinecap="round"/>
      <path d="M43 41 Q51 37 59 41" stroke="#2a6b5f" strokeWidth="2" fill="#6dbfb0" strokeLinecap="round"/>
      <circle cx="29" cy="44" r="3.5" fill="#1a1a1a"/>
      <circle cx="51" cy="44" r="3.5" fill="#1a1a1a"/>
      <circle cx="30" cy="43" r="1" fill="#fff"/>
      <circle cx="52" cy="43" r="1" fill="#fff"/>

      {/* Grand nez bulbeux */}
      <ellipse cx="40" cy="59" rx="9" ry="7" fill="#5aab9c" stroke="#2a6b5f" strokeWidth="1.5"/>
      <ellipse cx="37" cy="56" rx="3" ry="2" fill="#6dbfb0" opacity="0.6"/>

      {/* Bouche pincée */}
      <path d="M30 71 Q35 68 40 69 Q45 68 50 71" stroke="#2a6b5f" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <path d="M30 71 Q32 75 40 74 Q48 75 50 71" fill="#c07060" stroke="#2a6b5f" strokeWidth="1.5"/>

      {/* Cou large (jaw energy) */}
      <rect x="30" y="94" width="20" height="14" rx="2" fill="#6dbfb0" stroke="#2a6b5f" strokeWidth="1.5"/>
      <path d="M24 98 Q16 104 18 114" stroke="#5aab9c" strokeWidth="3" strokeLinecap="round" fill="none"/>
      <path d="M56 98 Q64 104 62 114" stroke="#5aab9c" strokeWidth="3" strokeLinecap="round" fill="none"/>
    </svg>
  );
}
