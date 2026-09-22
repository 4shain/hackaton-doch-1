import { createTheme } from '@mui/material/styles'

// "Tactical Blue Command" design tokens (see design/stitch_1/tactical_blue_command/DESIGN.md).
export const tokens = {
  primary: '#0052ff',
  primaryDark: '#0038b6',
  primarySoft: '#dde1ff',
  surface: '#f5f7ff',
  surfaceLow: '#f2f5ff',
  surfaceContainer: '#e8edff',
  outline: '#737688',
  outlineVariant: '#c3c5d9',
  onSurface: '#131b2e',
  onSurfaceVariant: '#434656',
  success: '#059669',
  successSoft: '#ecfdf5',
  warning: '#d97706',
  warningSoft: '#fffbeb',
  danger: '#dc2626',
  dangerSoft: '#fef2f2',
  info: '#0038b6',
  infoSoft: '#eef2ff',
  headerGradient: 'linear-gradient(270deg, #0038b6 0%, #0052ff 55%, #1a66ff 100%)',
  heroGradient: 'linear-gradient(135deg, #0052ff 0%, #003ecc 100%)',
  cardShadow: '0 2px 8px rgba(0, 82, 255, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)',
  liftShadow: '0 12px 28px rgba(0, 82, 255, 0.12), 0 4px 10px rgba(15, 23, 42, 0.05)',
}

export const theme = createTheme({
  direction: 'rtl',
  palette: {
    primary: { main: tokens.primary, dark: tokens.primaryDark, contrastText: '#fff' },
    secondary: { main: '#00677d' },
    success: { main: tokens.success },
    warning: { main: tokens.warning },
    error: { main: '#ba1a1a' },
    background: { default: tokens.surface, paper: '#ffffff' },
    text: { primary: tokens.onSurface, secondary: tokens.onSurfaceVariant },
    divider: '#e2e8f0',
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: 'Rubik, "Segoe UI", Arial, sans-serif',
    h1: { fontSize: 32, fontWeight: 700, lineHeight: '40px' },
    h2: { fontSize: 26, fontWeight: 700, lineHeight: '34px' },
    h3: { fontSize: 20, fontWeight: 600, lineHeight: '28px' },
    h4: { fontSize: 17, fontWeight: 600, lineHeight: '24px' },
    h5: { fontSize: 16, fontWeight: 600 },
    h6: { fontSize: 14, fontWeight: 600 },
    body1: { fontSize: 15, lineHeight: '22px' },
    body2: { fontSize: 13, lineHeight: '19px' },
    button: { fontWeight: 600, textTransform: 'none' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { fontVariantNumeric: 'tabular-nums' },
        '.ltr': { direction: 'ltr', unicodeBidi: 'isolate', display: 'inline-block' },
        '.visually-hidden': { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 8, minHeight: 44 },
        sizeLarge: { minHeight: 52, fontSize: 16 },
        sizeSmall: { minHeight: 32 },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: { borderRadius: 16 },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: tokens.cardShadow },
      },
    },
    MuiChip: {
      styleOverrides: { root: { fontWeight: 600 } },
    },
    MuiDialog: {
      styleOverrides: { paper: { borderRadius: 20 } },
    },
    MuiTextField: { defaultProps: { fullWidth: true } },
  },
})
