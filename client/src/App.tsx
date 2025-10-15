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
} from '@mui/material';
import { PoliciesTab } from './components/PoliciesTab';
import { HistoryTab } from './components/HistoryTab';
import { Policy, HistoryEntry } from './types';
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
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({ open: false, message: '', severity: 'info' });

  const fetchPolicies = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getPolicies();
      setPolicies(data.policies);
      setLastUpdated(new Date(data.serverTime));
    } catch (error) {
      setSnackbar({
        open: true,
        message: `Failed to load policies: ${error}`,
        severity: 'error',
      });
    } finally {
      setLoading(false);
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
    fetchPolicies();
    fetchHistory();

    const interval = setInterval(() => {
      if (currentTab === 0) {
        fetchPolicies();
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [currentTab, fetchPolicies, fetchHistory]);

  const handlePause = async (pid: string, minutes: number, reason: string) => {
    try {
      const result = await api.pausePolicy(pid, minutes, reason);
      setSnackbar({
        open: true,
        message: `Policy paused for ${minutes} minutes! Will re-enable at ${formatTime(
          new Date(result.expiresAt)
        )}`,
        severity: 'success',
      });
      await fetchPolicies();
      await fetchHistory();
    } catch (error) {
      setSnackbar({
        open: true,
        message: `Error: ${error}`,
        severity: 'error',
      });
    }
  };

  const handleEnable = async (pid: string) => {
    try {
      await api.enablePolicy(pid);
      setSnackbar({
        open: true,
        message: 'Policy re-enabled! Blocking is now active.',
        severity: 'success',
      });
      await fetchPolicies();
    } catch (error) {
      setSnackbar({
        open: true,
        message: `Error: ${error}`,
        severity: 'error',
      });
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
    if (newValue === 1) {
      fetchHistory();
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ bgcolor: '#f8f9fa', minHeight: '100vh', py: 3 }}>
        <Container maxWidth="lg">
          <Paper sx={{ p: 2, mb: 1 }}>
            <Box display="flex" justifyContent="space-between" alignItems="baseline">
              <Typography variant="h5" component="h1" fontWeight={600}>
                Time Manager
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Internet access policies
              </Typography>
            </Box>
            {lastUpdated && (
              <Typography variant="caption" color="text.secondary" mt={0.5}>
                Last updated: {formatTime(lastUpdated)} • {policies.length}{' '}
                {policies.length === 1 ? 'policy' : 'policies'}
              </Typography>
            )}
          </Paper>

          <Box sx={{ mb: 2 }}>
            <Tabs value={currentTab} onChange={handleTabChange}>
              <Tab label="Policies" />
              <Tab label="History" />
            </Tabs>
          </Box>

          {currentTab === 0 && (
            <PoliciesTab
              policies={policies}
              loading={loading}
              onPause={handlePause}
              onEnable={handleEnable}
            />
          )}

          {currentTab === 1 && <HistoryTab history={history} loading={loading} />}

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
    </ThemeProvider>
  );
}

export default App;
