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
  onPause: (pid: string, minutes: number, reason: string) => Promise<void>;
  onEnable: (pid: string) => Promise<void>;
}

export const PolicyCard: React.FC<PolicyCardProps> = ({ policy, onPause, onEnable }) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMinutes, setSelectedMinutes] = useState(0);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const user = policy.users.length > 0 ? policy.users[0].name : 'Unknown';
  const schedule = formatSchedule(policy.cronTime, policy.duration);

  const expirationInfo =
    policy.disabled && policy.activatedTime && policy.expire
      ? calculateExpirationInfo(policy.activatedTime, policy.expire)
      : null;

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
            <Chip
              label={policy.disabled ? 'PAUSED' : 'BLOCKING'}
              size="small"
              color={policy.disabled ? 'success' : 'error'}
              sx={{ fontWeight: 500 }}
            />
          </Box>

          <Typography variant="body2" color="text.secondary" mb={1}>
            {schedule}
          </Typography>

          {expirationInfo && (
            <Box sx={{ my: 1, p: 1, bgcolor: 'success.50', borderRadius: 1, border: '1px solid', borderColor: 'success.200' }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                Re-enables in {expirationInfo.minutesLeft} min
              </Typography>
              <Typography variant="body2" color="success.main" fontWeight={500}>
                Resumes at {expirationInfo.expiresTimeStr}
              </Typography>
            </Box>
          )}

          <Box mt={2}>
            {policy.disabled ? (
              <Button
                fullWidth
                variant="outlined"
                color="success"
                onClick={handleEnable}
                disabled={loading}
              >
                Resume Now
              </Button>
            ) : (
              <ButtonGroup fullWidth size="small" variant="outlined">
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
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Pause Policy for {selectedMinutes} minutes</DialogTitle>
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
};
