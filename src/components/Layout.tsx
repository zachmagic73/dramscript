import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  AppBar, Toolbar, Typography, IconButton, Drawer, List, ListItemButton,
  ListItemIcon, ListItemText, Box, Divider, Avatar, useMediaQuery,
  useTheme, Tooltip,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import AddIcon from '@mui/icons-material/Add';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LocalBarIcon from '@mui/icons-material/LocalBar';
import LogoutIcon from '@mui/icons-material/Logout';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import { useAuth } from '../hooks/useAuth';

const DRAWER_WIDTH = 240;

const navItems = [
  { label: 'My Journal',  icon: <MenuBookIcon />,    path: '/'          },
  { label: 'Templates',   icon: <AutoStoriesIcon />, path: '/templates' },
  { label: 'Profile',     icon: <AccountCircleIcon />, path: '/profile' },
];

export default function Layout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Brand */}
      <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <LocalBarIcon sx={{ color: 'primary.main', fontSize: 28 }} />
        <Typography variant="h6" sx={{ fontFamily: '"Playfair Display", serif', color: 'primary.main' }}>
          Dramscript
        </Typography>
      </Box>
      <Divider />

      {/* Nav links */}
      <List sx={{ flex: 1, pt: 1 }}>
        {navItems.map((item) => (
          <ListItemButton
            key={item.path}
            component={NavLink}
            to={item.path}
            end={item.path === '/'}
            onClick={() => isMobile && setDrawerOpen(false)}
            sx={{
              mx: 1, borderRadius: 1, mb: 0.5,
              '&.active': {
                backgroundColor: 'rgba(212,175,55,0.12)',
                color: 'primary.main',
                '& .MuiListItemIcon-root': { color: 'primary.main' },
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>

      <Divider />

      {/* User footer */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar
          src={user?.avatar_url ?? undefined}
          alt={user?.display_name ?? undefined}
          sx={{ width: 36, height: 36, bgcolor: 'secondary.main' }}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
            {user?.display_name}
          </Typography>
          <Typography variant="caption" noWrap sx={{ color: 'text.secondary' }}>
            {user?.email}
          </Typography>
        </Box>
        <Tooltip title="Sign out">
          <IconButton size="small" onClick={logout} sx={{ color: 'text.secondary' }}>
            <LogoutIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Desktop sidebar */}
      {!isMobile && (
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
          }}
        >
          {drawer}
        </Drawer>
      )}

      {/* Mobile app bar + drawer */}
      {isMobile && (
        <>
          <AppBar position="fixed">
            <Toolbar>
              <IconButton edge="start" onClick={() => setDrawerOpen(true)} sx={{ mr: 1 }}>
                <MenuIcon />
              </IconButton>
              <LocalBarIcon sx={{ color: 'primary.main', mr: 1 }} />
              <Typography variant="h6" sx={{ fontFamily: '"Playfair Display", serif', color: 'primary.main', flex: 1 }}>
                Dramscript
              </Typography>
            </Toolbar>
          </AppBar>
          <Drawer
            variant="temporary"
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}
          >
            {drawer}
          </Drawer>
        </>
      )}

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flex: 1,
          p: { xs: 2, sm: 3 },
          mt: isMobile ? 8 : 0,
          maxWidth: '100%',
          overflow: 'hidden',
        }}
      >
        <Outlet />
      </Box>

      {/* FAB — new recipe */}
      <Tooltip title="New recipe" placement="left">
        <IconButton
          onClick={() => navigate('/recipes/new')}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            width: 56,
            height: 56,
            boxShadow: '0 4px 14px rgba(212,175,55,0.4)',
            '&:hover': { bgcolor: 'primary.dark' },
            zIndex: 1200,
          }}
        >
          <AddIcon />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
