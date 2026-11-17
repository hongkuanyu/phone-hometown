export const palette = {
  background: '#111210',
  ink: '#E9E1D0',
  mother: '#A84432',
  audience: '#F2F2EA',
  muted: '#8C877D',
  line: '#393631',
} as const

export const themeStyle = {
  '--color-bg': palette.background,
  '--color-ink': palette.ink,
  '--color-mother': palette.mother,
  '--color-audience': palette.audience,
  '--color-muted': palette.muted,
  '--color-line': palette.line,
} as React.CSSProperties