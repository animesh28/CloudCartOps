import React, { useContext } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Badge,
  Container,
  Chip,
} from '@mui/material';
import {
  ShoppingCart,
  Login as LoginIcon,
  Logout as LogoutIcon,
  AdminPanelSettings,
  LocalMall,
  Receipt,
} from '@mui/icons-material';
import { AuthContext } from '../context/AuthContext';
import { CartContext } from '../context/CartContext';

function Header() {
  const { user, logout } = useContext(AuthContext);
  const { getItemCount } = useContext(CartContext);
  const navigate = useNavigate();

  // Check if user is admin
  const isAdmin = user?.is_admin === true;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <AppBar position="sticky" elevation={2}>
      <Container maxWidth="xl">
        <Toolbar disableGutters sx={{ gap: 2 }}>
          <LocalMall sx={{ mr: 1, fontSize: 32 }} />
          <Typography
            variant="h5"
            component={RouterLink}
            to="/"
            sx={{
              flexGrow: 1,
              fontWeight: 700,
              color: 'inherit',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              letterSpacing: '.1rem',
            }}
          >
            CloudCart Ops
          </Typography>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Button
              color="inherit"
              component={RouterLink}
              to="/"
              startIcon={<LocalMall />}
            >
              Products
            </Button>

            <IconButton
              color="inherit"
              component={RouterLink}
              to="/cart"
              size="large"
            >
              <Badge badgeContent={getItemCount()} color="error">
                <ShoppingCart />
              </Badge>
            </IconButton>

            {user && (
              <Button
                color="inherit"
                component={RouterLink}
                to="/orders"
                startIcon={<Receipt />}
              >
                Orders
              </Button>
            )}

            {isAdmin && (
              <Button
                component={RouterLink}
                to="/admin"
                startIcon={<AdminPanelSettings />}
                sx={{
                  color: 'warning.main',
                  fontWeight: 'bold',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 152, 0, 0.1)',
                  },
                }}
              >
                Admin
              </Button>
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', ml: 2 }}>
            {user ? (
              <>
                <Chip
                  label={`${user.username}${isAdmin ? ' 👑' : ''}`}
                  color="secondary"
                  size="medium"
                  sx={{ fontWeight: 600 }}
                />
                <Button
                  color="inherit"
                  onClick={handleLogout}
                  startIcon={<LogoutIcon />}
                  variant="outlined"
                  sx={{ borderColor: 'rgba(255,255,255,0.5)' }}
                >
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Button
                  color="inherit"
                  component={RouterLink}
                  to="/login"
                  startIcon={<LoginIcon />}
                  variant="outlined"
                  sx={{ borderColor: 'rgba(255,255,255,0.5)' }}
                >
                  Login
                </Button>
                <Button
                  component={RouterLink}
                  to="/register"
                  variant="contained"
                  color="secondary"
                  sx={{
                    color: 'white',
                    fontWeight: 600,
                  }}
                >
                  Register
                </Button>
              </>
            )}
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
}

export default Header;
