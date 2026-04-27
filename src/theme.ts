import { createTheme } from '@mui/material/styles';

const speakeasy = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#121212',
      paper:   '#1C1410',
    },
    primary: {
      main:         '#D4AF37',
      dark:         '#A8891A',
      light:        '#E8CE6A',
      contrastText: '#121212',
    },
    secondary: {
      main:         '#4B2C20',
      light:        '#6B3E2C',
      contrastText: '#F5E6CC',
    },
    error: {
      main:         '#C0392B',
      light:        '#E57373',
      contrastText: '#F5E6CC',
    },
    warning: {
      main:         '#D4622A',
      light:        '#E8925A',
      contrastText: '#121212',
    },
    info: {
      main:         '#3A6B8A',
      light:        '#64A8CC',
      contrastText: '#F5E6CC',
    },
    success: {
      main:         '#4A7C59',
      light:        '#6AAF80',
      contrastText: '#F5E6CC',
    },
    text: {
      primary:   '#F5E6CC',
      secondary: '#B8A48A',
      disabled:  '#6B5E52',
    },
    divider: '#3D2B1F',
  },

  typography: {
    fontFamily: '"Inter", system-ui, sans-serif',
    h1: { fontFamily: '"Playfair Display", serif', fontWeight: 700 },
    h2: { fontFamily: '"Playfair Display", serif', fontWeight: 700 },
    h3: { fontFamily: '"Playfair Display", serif', fontWeight: 600 },
    h4: { fontFamily: '"Playfair Display", serif', fontWeight: 600 },
    h5: { fontFamily: '"Inter", sans-serif', fontWeight: 600 },
    h6: { fontFamily: '"Inter", sans-serif', fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600, letterSpacing: '0.02em' },
  },

  shape: { borderRadius: 8 },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: '#121212', scrollbarColor: '#3D2B1F #121212' },
        '.amount': { fontFamily: '"JetBrains Mono", monospace', fontSize: '0.875rem' },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#1C1410',
          border: '1px solid #3D2B1F',
          backgroundImage: 'none',
          transition: 'border-color 0.2s, box-shadow 0.2s',
          '&:hover': {
            borderColor: '#D4AF37',
            boxShadow: '0 0 0 1px #D4AF37',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        containedPrimary: {
          '&:hover': { backgroundColor: '#A8891A' },
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: { backgroundColor: '#2A1A12' },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        notchedOutline: { borderColor: '#3D2B1F' },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 6 },
        colorPrimary: {
          backgroundColor: 'rgba(212,175,55,0.15)',
          color: '#E8CE6A',
          border: '1px solid rgba(212,175,55,0.3)',
        },
      },
    },
    MuiDivider: {
      styleOverrides: { root: { borderColor: '#3D2B1F' } },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#1C1410',
          borderBottom: '1px solid #3D2B1F',
          backgroundImage: 'none',
          boxShadow: 'none',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: { backgroundColor: '#1C1410', borderRight: '1px solid #3D2B1F' },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#2A1A12',
          border: '1px solid #3D2B1F',
          color: '#F5E6CC',
        },
      },
    },
    MuiAlert: {
      styleOverrides: { root: { borderRadius: 8 } },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { backgroundColor: '#1C1410', backgroundImage: 'none' },
      },
    },
  },
});

export default speakeasy;
