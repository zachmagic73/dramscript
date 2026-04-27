import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, CssBaseline } from '@mui/material';
import speakeasy from './theme';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={speakeasy}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>,
);
