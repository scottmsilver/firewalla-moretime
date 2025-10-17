import React, { useState, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import WarningIcon from '@mui/icons-material/Warning';

interface SettingsTabProps {
  setupConfig: {
    setupComplete: boolean;
    adminEmail: string;
    firewallConfigured: boolean;
    emailConfigured: boolean;
  } | null;
  onSetupComplete: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ setupConfig, onSetupComplete }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [firewallIP, setFirewallIP] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [qrData, setQrData] = useState<string | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect from Firewalla? You will need to reconnect using a QR code.')) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/firewalla/disconnect', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to disconnect');
      }

      setSuccess('Disconnected from Firewalla successfully');
      setTimeout(() => {
        onSetupComplete();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Read the QR code from the uploaded image
      const formData = new FormData();
      formData.append('qrImage', file);

      const response = await fetch('/api/firewalla/qr-upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to parse QR code');
      }

      const data = await response.json();
      setQrData(data.qrData);
      setSuccess('QR code parsed successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const startCamera = async () => {
    setError(null);
    setShowCamera(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      setError('Failed to access camera. Please check permissions.');
      setShowCamera(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setShowCamera(false);
  };

  const captureQRCode = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    setLoading(true);
    setError(null);

    try {
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/png');
      });

      if (!blob) {
        throw new Error('Failed to capture image');
      }

      const formData = new FormData();
      formData.append('qrImage', blob, 'qr-capture.png');

      const response = await fetch('/api/firewalla/qr-upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to parse QR code');
      }

      const data = await response.json();
      setQrData(data.qrData);
      setSuccess('QR code captured successfully');
      stopCamera();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!qrData) {
      setError('Please upload or capture a QR code first');
      return;
    }

    if (!firewallIP.trim()) {
      setError('Please enter the Firewalla IP address');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/firewalla/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          qrData,
          firewallIP: firewallIP.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to connect to Firewalla');
      }

      setSuccess('Connected to Firewalla successfully!');
      setTimeout(() => {
        onSetupComplete();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/reset', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reset settings');
      }

      // Redirect to root - will show setup wizard
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset settings');
      setResetDialogOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const isConnected = setupConfig?.firewallConfigured ?? false;

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Firewalla Connection
        </Typography>

        {isConnected ? (
          <Box>
            <Alert severity="success" sx={{ mb: 2 }}>
              Connected to Firewalla
            </Alert>
            <Button
              variant="outlined"
              color="error"
              startIcon={<LinkOffIcon />}
              onClick={handleDisconnect}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Disconnect'}
            </Button>
          </Box>
        ) : (
          <Box>
            <Alert severity="warning" sx={{ mb: 2 }}>
              Not connected to Firewalla. Please connect using a QR code.
            </Alert>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              To connect to your Firewalla device:
              <br />
              1. Open the Firewalla app on your phone
              <br />
              2. Go to Settings → Advanced → API
              <br />
              3. Scan or upload the QR code shown there
              <br />
              4. Enter your Firewalla's local IP address
            </Typography>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Upload QR Code
              </Typography>
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
              <Button
                variant="outlined"
                startIcon={<CloudUploadIcon />}
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || showCamera}
                sx={{ mr: 2 }}
              >
                Upload QR Image
              </Button>

              <Button
                variant="outlined"
                startIcon={<CameraAltIcon />}
                onClick={showCamera ? stopCamera : startCamera}
                disabled={loading}
              >
                {showCamera ? 'Stop Camera' : 'Use Camera'}
              </Button>
            </Box>

            {showCamera && (
              <Box sx={{ mb: 2 }}>
                <video
                  ref={videoRef}
                  style={{
                    width: '100%',
                    maxWidth: '400px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                  }}
                />
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                <Box sx={{ mt: 1 }}>
                  <Button
                    variant="contained"
                    onClick={captureQRCode}
                    disabled={loading}
                  >
                    {loading ? <CircularProgress size={24} /> : 'Capture QR Code'}
                  </Button>
                </Box>
              </Box>
            )}

            {qrData && (
              <Alert severity="info" sx={{ mb: 2 }}>
                QR code data received. Please enter your Firewalla IP address below.
              </Alert>
            )}

            <Box sx={{ mb: 2 }}>
              <TextField
                label="Firewalla IP Address"
                placeholder="e.g. 192.168.1.129"
                value={firewallIP}
                onChange={(e) => setFirewallIP(e.target.value)}
                fullWidth
                disabled={loading || !qrData}
                helperText="Enter the local IP address of your Firewalla device"
              />
            </Box>

            <Button
              variant="contained"
              onClick={handleConnect}
              disabled={loading || !qrData || !firewallIP.trim()}
            >
              {loading ? <CircularProgress size={24} /> : 'Connect to Firewalla'}
            </Button>
          </Box>
        )}
      </Paper>

      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Account Settings
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Admin: {setupConfig?.adminEmail || 'Not configured'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Email notifications: {setupConfig?.emailConfigured ? 'Enabled' : 'Not configured'}
        </Typography>
      </Paper>

      <Paper
        sx={{
          p: 3,
          borderColor: 'error.main',
          borderWidth: 2,
          borderStyle: 'solid',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <WarningIcon color="error" />
          <Typography variant="h6" color="error">
            Danger Zone
          </Typography>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Resetting will:
        </Typography>
        <Box component="ul" sx={{ pl: 3, mb: 2 }}>
          <Typography component="li" variant="body2" color="text.secondary">
            Remove admin account
          </Typography>
          <Typography component="li" variant="body2" color="text.secondary">
            Clear Google OAuth configuration
          </Typography>
          <Typography component="li" variant="body2" color="text.secondary">
            Disconnect from Firewalla
          </Typography>
          <Typography component="li" variant="body2" color="text.secondary">
            Clear email notification settings
          </Typography>
          <Typography component="li" variant="body2" color="text.secondary">
            Delete setup.json
          </Typography>
          <Typography component="li" variant="body2" color="text.secondary">
            Require you to go through setup again
          </Typography>
        </Box>

        <Button
          variant="outlined"
          color="error"
          onClick={() => setResetDialogOpen(true)}
          disabled={loading}
        >
          Remove Admin & Reset All Settings
        </Button>
      </Paper>

      <Dialog
        open={resetDialogOpen}
        onClose={() => {
          setResetDialogOpen(false);
          setConfirmText('');
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Are you absolutely sure?</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This action cannot be undone!
          </Alert>
          <Typography paragraph>
            This will completely reset the application to initial setup state. You will be logged
            out and all configuration will be cleared.
          </Typography>
          <Typography sx={{ mt: 2, fontWeight: 'bold' }}>Type "RESET" to confirm:</Typography>
          <TextField
            fullWidth
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Type RESET here"
            sx={{ mt: 1 }}
            disabled={loading}
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setResetDialogOpen(false);
              setConfirmText('');
            }}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={confirmText !== 'RESET' || loading}
            onClick={handleReset}
          >
            {loading ? <CircularProgress size={24} /> : 'Reset Everything'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
