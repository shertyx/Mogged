interface Props {
  size?: number;
  color?: string;
}

export function MoggedLogo({ size = 40, color = '#fff' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      {/* Chrome head — dome cranium */}
      <ellipse cx="50" cy="38" rx="28" ry="32" fill={color} opacity="0.95" />

      {/* Strong jaw — angular, wider than head */}
      <path
        d="M22 52 L16 78 Q18 90 30 96 L50 100 L70 96 Q82 90 84 78 L78 52 Z"
        fill={color}
        opacity="0.9"
      />

      {/* Neck — trapezoidal, wide */}
      <path
        d="M35 96 L30 112 L70 112 L65 96 Z"
        fill={color}
        opacity="0.8"
      />

      {/* Brow ridge — angular cutout */}
      <path
        d="M28 42 L36 38 L50 40 L64 38 L72 42 L72 44 L28 44 Z"
        fill="#000"
        opacity="0.25"
      />

      {/* Eye sockets — sleek horizontal */}
      <ellipse cx="37" cy="48" rx="7" ry="4" fill="#000" opacity="0.35" />
      <ellipse cx="63" cy="48" rx="7" ry="4" fill="#000" opacity="0.35" />

      {/* Chin cleft */}
      <path d="M47 95 Q50 98 53 95" stroke="#000" strokeWidth="1.5" opacity="0.3" fill="none" />

      {/* Cheekbones — chrome highlight lines */}
      <path d="M22 58 Q28 54 34 56" stroke={color} strokeWidth="1.5" opacity="0.5" fill="none" />
      <path d="M78 58 Q72 54 66 56" stroke={color} strokeWidth="1.5" opacity="0.5" fill="none" />

      {/* Center face highlight */}
      <ellipse cx="50" cy="32" rx="10" ry="14" fill="#fff" opacity="0.15" />
    </svg>
  );
}

export function MoggedLogoFull({ height = 36 }: { height?: number }) {
  const logoH = height;
  const textSize = height * 0.75;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <MoggedLogo size={logoH} color="#f97316" />
      <span style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: textSize,
        color: '#fff',
        letterSpacing: '4px',
        lineHeight: 1,
      }}>
        MOG<span style={{ color: '#f97316' }}>GED</span>
      </span>
    </div>
  );
}
