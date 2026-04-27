import { Box, Button, Typography, Paper } from '@mui/material';
import LocalBarIcon from '@mui/icons-material/LocalBar';

export default function Login() {
  const handleLogin = () => {
    window.location.href = '/auth/google';
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(212,175,55,0.08) 0%, #121212 70%)',
        p: 2,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: { xs: 4, sm: 6 },
          maxWidth: 400,
          width: '100%',
          textAlign: 'center',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        {/* Logo / brand */}
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1.5 }}>
          <LocalBarIcon sx={{ color: 'primary.main', fontSize: 40 }} />
          <Typography
            variant="h4"
            sx={{ fontFamily: '"Playfair Display", serif', color: 'primary.main' }}
          >
            Dramscript
          </Typography>
        </Box>

        <Typography variant="body1" sx={{ color: 'text.secondary', mb: 1 }}>
          Your personal digital cocktail journal.
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.disabled', mb: 4 }}>
          Log in to create and manage your recipes.
        </Typography>

        <Button
          variant="contained"
          fullWidth
          size="large"
          onClick={handleLogin}
          startIcon={
            <Box
              component="img"
              src="https://www.google.com/favicon.ico"
              alt=""
              sx={{ width: 18, height: 18 }}
            />
          }
          sx={{ py: 1.5 }}
        >
          Continue with Google
        </Button>

        {new URLSearchParams(window.location.search).has('auth_error') && (
          <Typography variant="caption" color="error" sx={{ mt: 2, display: 'block' }}>
            Authentication failed. Please try again.
          </Typography>
        )}
      </Paper>
    </Box>
  );
}
