import React from 'react';

export default function VoxaLogo({ size = 32, className = '' }) {
  return (
    <div
      className={`voxa-logo-wrap ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="voxaMonoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="50%" stopColor="#d4d4d8" />
            <stop offset="100%" stopColor="#71717a" />
          </linearGradient>
          <linearGradient id="voxaAccentGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#27272a" />
            <stop offset="100%" stopColor="#ffffff" />
          </linearGradient>
        </defs>
        {/* Modern luxury geometric dual-prism 'V' monogram */}
        <polygon
          points="20,18 42,18 50,42 28,42"
          fill="url(#voxaMonoGrad)"
        />
        <polygon
          points="58,18 80,18 72,42 50,42"
          fill="#52525b"
        />
        <polygon
          points="28,42 50,42 50,84 38,84"
          fill="#ffffff"
        />
        <polygon
          points="50,42 72,42 62,84 50,84"
          fill="url(#voxaAccentGrad)"
        />
        {/* Subtle center precision pulse dot */}
        <circle cx="50" cy="42" r="3.5" fill="#000000" />
      </svg>
    </div>
  );
}
