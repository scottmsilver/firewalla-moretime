import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  ButtonGroup,
  Chip,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import { Policy } from '../types';
import { formatSchedule, calculateExpirationInfo } from '../utils/formatters';

interface PolicyCardProps {
  policy: Policy;
  timezone: string;
  onPause: (pid: string, minutes: number, reason: string) => Promise<void>;
  onEnable: (pid: string) => Promise<void>;
}

// Helper to check if policy is in its active blocking window
// cronTime is in Firewalla's local timezone (e.g., "30 23 * * *" = 11:30 PM local)
// We need to check if current time (in Firewalla TZ) is within the blocking window
const isInActiveWindow = (cronTime: string, duration: number, timezone: string): boolean => {
  const parts = cronTime.split(' ');
  if (parts.length < 2) return false;

  const scheduleMinute = parseInt(parts[0]);
  const scheduleHour = parseInt(parts[1]);

  // Get current time in Firewalla's timezone
  const now = new Date();
  const timeStr = now.toLocaleString('en-US', {
    timeZone: timezone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const [currentHour, currentMinute, currentSecond] = timeStr.split(':').map(Number);
  const currentMinutesOfDay = currentHour * 60 + currentMinute;
  const scheduleMinutesOfDay = scheduleHour * 60 + scheduleMinute;
  const durationMinutes = Math.floor(duration / 60);

  // Handle window that crosses midnight
  const endMinutesOfDay = scheduleMinutesOfDay + durationMinutes;

  if (endMinutesOfDay > 1440) {
    // Window crosses midnight (e.g., 11:30 PM for 7.5 hours ends at 7:00 AM next day)
    // We're in the window if: current >= schedule OR current < (schedule + duration - 1440)
    const nextDayEnd = endMinutesOfDay - 1440;
    return currentMinutesOfDay >= scheduleMinutesOfDay || currentMinutesOfDay < nextDayEnd;
  } else {
    // Normal window within same day
    return currentMinutesOfDay >= scheduleMinutesOfDay && currentMinutesOfDay < endMinutesOfDay;
  }
};

export const PolicyCard: React.FC<PolicyCardProps> = React.memo(({ policy, timezone, onPause, onEnable }) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMinutes, setSelectedMinutes] = useState(0);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [debugMode, setDebugMode] = useState(localStorage.getItem('debugMode') === 'true');

  const user = policy.users.length > 0 ? policy.users[0].name : 'Unknown';
  const schedule = formatSchedule(policy.cronTime, policy.duration);

  // Check if currently in active blocking window
  const isBlocking = !policy.disabled && isInActiveWindow(policy.cronTime, policy.duration, timezone);

  // Update countdown every second only if policy is paused
  React.useEffect(() => {
    if (policy.disabled && policy.idleTs) {
      const timer = setInterval(() => {
        setCurrentTime(Date.now());
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [policy.disabled, policy.idleTs]);

  // Listen for debug mode changes
  React.useEffect(() => {
    const handleDebugModeChange = () => {
      setDebugMode(localStorage.getItem('debugMode') === 'true');
    };
    window.addEventListener('debugModeChanged', handleDebugModeChange);
    return () => window.removeEventListener('debugModeChanged', handleDebugModeChange);
  }, []);

  // Force recalculation when currentTime changes
  const expirationInfo = React.useMemo(() => {
    if (policy.disabled && policy.idleTs) {
      // Trigger recalculation based on currentTime
      return calculateExpirationInfo(policy.idleTs, timezone);
    }
    return null;
  }, [policy.disabled, policy.idleTs, currentTime, timezone]);

  const handlePauseClick = (minutes: number) => {
    setSelectedMinutes(minutes);
    setDialogOpen(true);
  };

  const handleConfirmPause = async () => {
    if (!reason.trim()) return;

    setLoading(true);
    try {
      await onPause(policy.pid, selectedMinutes, reason);
      setDialogOpen(false);
      setReason('');
    } catch (error) {
      console.error('Failed to pause:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnable = async () => {
    setLoading(true);
    try {
      await onEnable(policy.pid);
    } catch (error) {
      console.error('Failed to enable:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card variant="outlined" sx={{ height: '100%' }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="h6" component="div">
              {user}
            </Typography>
            <Box display="flex" gap={0.5} alignItems="center">
              {policy.disabled ? (
                <Chip
                  label={isBlocking ? 'PAUSED (would block)' : 'PAUSED'}
                  size="small"
                  color="warning"
                  sx={{ fontWeight: 500 }}
                />
              ) : (
                <Chip
                  label={isBlocking ? 'BLOCKING NOW' : 'SCHEDULED'}
                  size="small"
                  color="success"
                  sx={{ fontWeight: 500 }}
                />
              )}
            </Box>
          </Box>

          <Typography variant="body2" color="text.secondary" mb={1}>
            {schedule}
          </Typography>

          <Box mt={2}>
            {policy.disabled ? (
              <Box
                sx={{
                  p: 1.5,
                  bgcolor: 'warning.50',
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'warning.200',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                }}
              >
                <Typography variant="body2" color="warning.dark" fontWeight={500} textAlign="center">
                  {expirationInfo
                    ? `Resumes at ${expirationInfo.expiresTimeStr} (${expirationInfo.minutesLeft} min)`
                    : 'Re-enabling...'}
                </Typography>
                <Button
                  fullWidth
                  size="small"
                  variant="contained"
                  color="success"
                  onClick={handleEnable}
                  disabled={loading || !expirationInfo}
                >
                  Resume Now
                </Button>
              </Box>
            ) : (
              <ButtonGroup fullWidth size="small" variant="outlined">
                <Button onClick={() => handlePauseClick(1)} disabled={loading}>
                  1 min
                </Button>
                <Button onClick={() => handlePauseClick(15)} disabled={loading}>
                  15 min
                </Button>
                <Button onClick={() => handlePauseClick(30)} disabled={loading}>
                  30 min
                </Button>
                <Button onClick={() => handlePauseClick(60)} disabled={loading}>
                  1 hour
                </Button>
              </ButtonGroup>
            )}
          </Box>

          {debugMode && (
            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1, fontSize: '0.7rem' }}>
              ID: {policy.pid}
            </Typography>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Pause for {selectedMinutes} {selectedMinutes === 1 ? 'minute' : 'minutes'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Reason"
            fullWidth
            multiline
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Please enter the reason for this pause"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleConfirmPause}
            variant="contained"
            disabled={!reason.trim() || loading}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function - only re-render if policy data actually changed
  return (
    prevProps.policy.pid === nextProps.policy.pid &&
    prevProps.policy.disabled === nextProps.policy.disabled &&
    prevProps.policy.idleTs === nextProps.policy.idleTs &&
    prevProps.policy.hitCount === nextProps.policy.hitCount &&
    prevProps.policy.activatedTime === nextProps.policy.activatedTime &&
    prevProps.timezone === nextProps.timezone
  );
});
