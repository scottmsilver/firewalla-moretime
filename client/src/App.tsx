import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  Alert,
  Snackbar,
  CssBaseline,
  ThemeProvider,
  createTheme,
  CircularProgress,
  IconButton,
  Tooltip,
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon,
  Divider,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import LogoutIcon from '@mui/icons-material/Logout';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import { PoliciesTab } from './components/PoliciesTab';
import { HistoryTab } from './components/HistoryTab';
import { SettingsTab } from './components/SettingsTab';
import { Login } from './components/Login';
import { SetupWizard } from './components/SetupWizard';
import { Policy, HistoryEntry, AuthStatus } from './types';
import { api } from './services/api';
import { formatTime } from './utils/formatters';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2c3e50',
    },
    success: {
      main: '#27ae60',
    },
    error: {
      main: '#c0392b',
    },
  },
});

function App() {
  const [currentTab, setCurrentTab] = useState(0);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false); // Background refresh indicator
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null); // null = checking
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timezone, setTimezone] = useState<string | null>(null); // Firewalla timezone (null until loaded)
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({ open: false, message: '', severity: 'info' });
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  // Check authentication status and load setup config
  const checkAuth = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/status');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: AuthStatus = await response.json();
      setAuthStatus(data);
    } catch (error) {
      console.error('Auth check failed:', error);
      setAuthStatus({
        authenticated: false,
        user: null,
        setup: {
          setupComplete: false,
          adminEmail: '',
          firewallConfigured: false,
          emailConfigured: false,
        },
        oauthConfigured: false,
      });
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Callback to refresh setup config after changes
  const refreshSetup = useCallback(async () => {
    await checkAuth();
  }, [checkAuth]);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const fetchPolicies = useCallback(async (isInitialLoad = false) => {
    try {
      if (isInitialLoad) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      const data = await api.getPolicies();
      setPolicies(data.policies);
      setLastUpdated(new Date(data.serverTime));
      setTimezone(data.timezone);
    } catch (error) {
      setSnackbar({
        open: true,
        message: `Failed to load policies: ${error}`,
        severity: 'error',
      });
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const data = await api.getHistory();
      setHistory(data);
    } catch (error) {
      setSnackbar({
        open: true,
        message: `Failed to load history: ${error}`,
        severity: 'error',
      });
    }
  }, []);

  useEffect(() => {
    fetchPolicies(true); // Initial load
    fetchHistory();

    const interval = setInterval(() => {
      if (currentTab === 0) {
        fetchPolicies(false); // Background refresh
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [currentTab, fetchPolicies, fetchHistory]);

  const handlePause = useCallback(async (pid: string, minutes: number, reason: string) => {
    try {
      const result = await api.pausePolicy(pid, minutes, reason);
      setSnackbar({
        open: true,
        message: `Policy paused for ${minutes} minutes! Will re-enable at ${formatTime(
          new Date(result.expiresAt),
          timezone
        )}`,
        severity: 'success',
      });
      // Small delay to ensure Firewalla has fully processed the update
      await new Promise(resolve => setTimeout(resolve, 200));
      await fetchPolicies(false); // Background refresh
      await fetchHistory();
    } catch (error) {
      setSnackbar({
        open: true,
        message: `Error: ${error}`,
        severity: 'error',
      });
    }
  }, [fetchPolicies, fetchHistory]);

  const handleEnable = useCallback(async (pid: string) => {
    try {
      await api.enablePolicy(pid);
      setSnackbar({
        open: true,
        message: 'Policy re-enabled! Blocking is now active.',
        severity: 'success',
      });
      await fetchPolicies(false); // Background refresh
    } catch (error) {
      setSnackbar({
        open: true,
        message: `Error: ${error}`,
        severity: 'error',
      });
    }
  }, [fetchPolicies]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
    if (newValue === 1) {
      fetchHistory();
    }
  };

  const handleManualRefresh = useCallback(() => {
    fetchPolicies(false);
    if (currentTab === 1) {
      fetchHistory();
    }
  }, [fetchPolicies, fetchHistory, currentTab]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (response.ok) {
        window.location.href = '/';
      } else {
        setSnackbar({
          open: true,
          message: 'Logout failed',
          severity: 'error',
        });
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: `Logout error: ${error}`,
        severity: 'error',
      });
    }
    handleMenuClose();
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {/* Show loading spinner while checking auth */}
      {authStatus === null && (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
          <CircularProgress />
        </Box>
      )}

      {/* Show setup wizard if OAuth not configured */}
      {authStatus && !authStatus.oauthConfigured && (
        <SetupWizard onComplete={refreshSetup} />
      )}

      {/* Show login if OAuth configured but not authenticated */}
      {authStatus && authStatus.oauthConfigured && !authStatus.authenticated && <Login />}

      {/* Show main app if authenticated */}
      {authStatus && authStatus.oauthConfigured && authStatus.authenticated && (
        <Box sx={{ bgcolor: '#f8f9fa', minHeight: '100vh', py: 3 }}>
          <Container maxWidth="lg">
            <Paper sx={{ p: 2, mb: 1 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="h5" component="h1" fontWeight={600}>
                    Time Manager
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Internet access policies
                  </Typography>
                  {timezone && (
                    <Typography variant="caption" color="text.secondary">
                      Firewalla time: {formatTime(currentTime, timezone)}
                    </Typography>
                  )}
                </Box>
                <Box display="flex" alignItems="center" gap={1}>
                  <Tooltip title="Account">
                    <IconButton onClick={handleMenuOpen} size="small">
                      {authStatus.user?.picture ? (
                        <Avatar
                          src={authStatus.user.picture}
                          alt={authStatus.user.name || authStatus.user.email}
                          sx={{ width: 32, height: 32 }}
                        />
                      ) : (
                        <Avatar sx={{ width: 32, height: 32 }}>
                          <AccountCircleIcon />
                        </Avatar>
                      )}
                    </IconButton>
                  </Tooltip>
                  <Menu
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={handleMenuClose}
                    anchorOrigin={{
                      vertical: 'bottom',
                      horizontal: 'right',
                    }}
                    transformOrigin={{
                      vertical: 'top',
                      horizontal: 'right',
                    }}
                  >
                    <Box sx={{ px: 2, py: 1, minWidth: 200 }}>
                      <Typography variant="subtitle2" fontWeight={600}>
                        {authStatus.user?.name || 'User'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {authStatus.user?.email || ''}
                      </Typography>
                    </Box>
                    <Divider />
                    <MenuItem onClick={handleLogout}>
                      <ListItemIcon>
                        <LogoutIcon fontSize="small" />
                      </ListItemIcon>
                      Logout
                    </MenuItem>
                  </Menu>
                </Box>
              </Box>
              {lastUpdated && timezone && (
                <Box display="flex" alignItems="center" gap={0.5} mt={0.5}>
                  <Typography variant="caption" color="text.secondary">
                    Last updated: {formatTime(lastUpdated, timezone)} • {policies.length}{' '}
                    {policies.length === 1 ? 'policy' : 'policies'}
                  </Typography>
                  <Tooltip title={refreshing ? "Refreshing..." : "Refresh now"}>
                    <IconButton
                      size="small"
                      onClick={handleManualRefresh}
                      disabled={refreshing}
                      sx={{
                        padding: 0.5,
                        ml: 0.5,
                        '&:hover': {
                          bgcolor: 'action.hover'
                        }
                      }}
                    >
                      <RefreshIcon
                        sx={{
                          fontSize: 14,
                          color: 'text.secondary',
                          animation: refreshing ? 'spin 1s linear infinite' : 'none',
                          '@keyframes spin': {
                            '0%': { transform: 'rotate(0deg)' },
                            '100%': { transform: 'rotate(360deg)' }
                          }
                        }}
                      />
                    </IconButton>
                  </Tooltip>
                </Box>
              )}
            </Paper>

            <Box sx={{ mb: 2 }}>
              <Tabs value={currentTab} onChange={handleTabChange}>
                <Tab label="Policies" />
                <Tab label="History" />
                <Tab label="Settings" />
              </Tabs>
            </Box>

            {currentTab === 0 && timezone && (
              <PoliciesTab
                policies={policies}
                loading={loading}
                timezone={timezone}
                onPause={handlePause}
                onEnable={handleEnable}
              />
            )}
            {currentTab === 0 && !timezone && (
              <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                <CircularProgress />
              </Box>
            )}

            {currentTab === 1 && <HistoryTab history={history} loading={loading} />}

            {currentTab === 2 && (
              <SettingsTab setupConfig={authStatus.setup} onSetupComplete={refreshSetup} />
            )}

            <Snackbar
              open={snackbar.open}
              autoHideDuration={5000}
              onClose={() => setSnackbar({ ...snackbar, open: false })}
              anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
              <Alert
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                severity={snackbar.severity}
                sx={{ width: '100%' }}
              >
                {snackbar.message}
              </Alert>
            </Snackbar>
          </Container>
        </Box>
      )}
    </ThemeProvider>
  );
}

export default App;
