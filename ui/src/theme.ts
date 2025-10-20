import { alpha, createTheme } from '@mui/material/styles';

const primaryMain = '#8C82FF';
const secondaryMain = '#2EE6C5';
const surface = alpha('#0B1533', 0.85);
const backdrop = alpha('#050912', 0.82);

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: primaryMain,
      contrastText: '#0A1020',
    },
    secondary: {
      main: secondaryMain,
    },
    background: {
      default: '#050912',
      paper: surface,
    },
    text: {
      primary: '#F5F7FF',
      secondary: alpha('#F5F7FF', 0.74),
    },
    divider: alpha('#8C82FF', 0.12),
  },
  shape: {
    borderRadius: 18,
  },
  typography: {
    fontFamily: `'Inter', 'Roboto', 'Helvetica', 'Arial', sans-serif`,
    h1: {
      fontWeight: 700,
      letterSpacing: '-0.02em',
    },
    h2: {
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
      letterSpacing: 0.2,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          minHeight: '100vh',
          background: 'radial-gradient(circle at top, #141C38 0%, #050912 55%)',
          backgroundAttachment: 'fixed',
        },
        '#root': {
          minHeight: '100vh',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: surface,
          backdropFilter: 'blur(16px)',
          border: `1px solid ${alpha(primaryMain, 0.08)}`,
          boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          paddingInline: 20,
          paddingBlock: 12,
        },
      },
      defaultProps: {
        disableElevation: true,
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'filled',
        color: 'primary',
      },
    },
  },
});

export type AppTheme = typeof theme;

export const menuPaperSx = {
  backgroundColor: backdrop,
  backdropFilter: 'blur(18px)',
  border: `1px solid ${alpha(primaryMain, 0.24)}`,
  boxShadow: '0 24px 64px rgba(4, 12, 32, 0.45)',
  overflow: 'hidden',
  '& .MuiMenuItem-root': {
    borderRadius: 10,
    marginInline: 4,
    marginBlock: 2,
  },
};
