import React from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { Policy } from '../types';
import { PolicyCard } from './PolicyCard';

interface PoliciesTabProps {
  policies: Policy[];
  loading: boolean;
  onPause: (pid: string, minutes: number, reason: string) => Promise<void>;
  onEnable: (pid: string) => Promise<void>;
}

export const PoliciesTab: React.FC<PoliciesTabProps> = ({
  policies,
  loading,
  onPause,
  onEnable,
}) => {
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (policies.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <Typography color="text.secondary">No time-based policies found</Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, 1fr)',
          md: 'repeat(3, 1fr)',
        },
        gap: 2,
      }}
    >
      {policies.map((policy) => (
        <PolicyCard key={policy.pid} policy={policy} onPause={onPause} onEnable={onEnable} />
      ))}
    </Box>
  );
};
