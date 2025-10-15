import React from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Card,
  CardContent,
  Divider,
} from '@mui/material';
import { HistoryEntry } from '../types';
import { formatDateTime } from '../utils/formatters';

interface HistoryTabProps {
  history: HistoryEntry[];
  loading: boolean;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({ history, loading }) => {
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (history.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <Typography color="text.secondary">No history yet</Typography>
      </Box>
    );
  }

  return (
    <Card variant="outlined">
      <CardContent>
        {history.map((entry, index) => (
          <React.Fragment key={`${entry.timestamp}-${index}`}>
            <Box py={2}>
              <Box display="flex" justifyContent="space-between" mb={1}>
                <Typography variant="body2" color="text.secondary">
                  {formatDateTime(new Date(entry.timestamp))}
                </Typography>
              </Box>
              <Typography variant="body1" fontWeight={600}>
                Policy {entry.policy_id} ({entry.tags.join(', ')})
              </Typography>
              <Typography variant="body2">
                Paused for <strong>{entry.duration_minutes} minutes</strong>
              </Typography>
              {entry.reason && (
                <Typography variant="body2" color="primary" fontStyle="italic" mt={0.5}>
                  Reason: {entry.reason}
                </Typography>
              )}
            </Box>
            {index < history.length - 1 && <Divider />}
          </React.Fragment>
        ))}
      </CardContent>
    </Card>
  );
};
