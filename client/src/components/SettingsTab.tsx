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
  FormControlLabel,
  Switch,
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
    notificationEmail?: string;
    firewallInfo?: {
      gid: string;
      model: string;
      deviceName: string;
      ipAddress: string;
    };
  } | null;
  onSetupComplete: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ setupConfig, onSetupComplete }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectionSuccess, setConnectionSuccess] = useState<string | null>(null);
  const [firewallIP, setFirewallIP] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [qrData, setQrData] = useState<string | null>(null);
  const [qrInfo, setQrInfo] = useState<{gid?: string; model?: string; deviceName?: string} | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [bridgeStatus, setBridgeStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [notificationEmail, setNotificationEmail] = useState(setupConfig?.notificationEmail || '');
  const [emailSaving, setEmailSaving] = useState(false);
  const [testEmailSending, setTestEmailSending] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{type: 'success' | 'error', message: string} | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Check bridge server health on mount
  React.useEffect(() => {
    const checkBridgeHealth = async () => {
      if (!setupConfig?.firewallConfigured) {
        setBridgeStatus('disconnected');
        return;
      }

      try {
        const response = await fetch('/health');
        if (response.ok) {
          const data = await response.json();
          const newStatus = data.status === 'connected' ? 'connected' : 'disconnected';
          setBridgeStatus(newStatus);
        } else {
          setBridgeStatus('disconnected');
        }
      } catch (err) {
        console.error('Health check error:', err);
        setBridgeStatus('disconnected');
      }
    };

    checkBridgeHealth();
    // Check every 30 seconds
    const interval = setInterval(checkBridgeHealth, 30000);
    return () => clearInterval(interval);
  }, [setupConfig?.firewallConfigured]);

  // Update notification email state when setup config changes
  React.useEffect(() => {
    setNotificationEmail(setupConfig?.notificationEmail || '');
  }, [setupConfig?.notificationEmail]);

  const handleDisconnect = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    setDisconnectDialogOpen(false);

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

      // Parse QR data to extract device info
      try {
        const qrJson = JSON.parse(data.qrData);
        setQrInfo({
          gid: qrJson.gid,
          model: qrJson.model,
          deviceName: qrJson.deviceName
        });
        // Auto-fill IP if available
        if (qrJson.ipaddress && !firewallIP) {
          setFirewallIP(qrJson.ipaddress);
        }
      } catch (e) {
        // Ignore parse errors
      }

      setSuccess('QR code parsed successfully! Device information detected.');
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
      console.error('Camera access error:', err);
      const errorMessage = err instanceof Error && err.name === 'NotAllowedError'
        ? 'Camera access denied. Please allow camera access in your browser settings.'
        : err instanceof Error && err.name === 'NotFoundError'
        ? 'No camera found on this device.'
        : 'Failed to access camera. Try uploading a QR code image instead.';
      setError(errorMessage);
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

      // Parse QR data to extract device info
      try {
        const qrJson = JSON.parse(data.qrData);
        setQrInfo({
          gid: qrJson.gid,
          model: qrJson.model,
          deviceName: qrJson.deviceName
        });
        // Auto-fill IP if available
        if (qrJson.ipaddress && !firewallIP) {
          setFirewallIP(qrJson.ipaddress);
        }
      } catch (e) {
        // Ignore parse errors
      }

      setSuccess('QR code captured successfully! Device information detected.');
      stopCamera();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!qrData) {
      setConnectionError('Please upload or capture a QR code first');
      return;
    }

    if (!firewallIP.trim()) {
      setConnectionError('Please enter the Firewalla IP address');
      return;
    }

    setLoading(true);
    setConnectionError(null);
    setConnectionSuccess(null);

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
        let errorMessage = 'Failed to connect to Firewalla';
        try {
          const data = await response.json();
          errorMessage = data.error || data.details || errorMessage;
        } catch (parseError) {
          // If we can't parse JSON, use status text
          errorMessage = `Failed to connect: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      setConnectionSuccess(`Connected to Firewalla successfully! ${result.firewallInfo?.deviceName || 'Device'} (${result.firewallInfo?.model || 'unknown model'})`);

      // Refresh setup config immediately to show disconnect button
      onSetupComplete();

      // Show restart message if needed
      if (result.requiresRestart) {
        setTimeout(() => {
          setConnectionSuccess('Connection saved! Please restart the bridge server: node firewalla_bridge.js');
        }, 2000);
      }
    } catch (err) {
      console.error('Connection error:', err);
      setConnectionError(err instanceof Error ? err.message : 'Unknown error connecting to Firewalla');
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

  const handleSaveNotificationEmail = async () => {
    setEmailSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/settings/notification-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: notificationEmail }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save notification email');
      }

      setSuccess('Notification email saved successfully!');
      onSetupComplete(); // Refresh setup config
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save notification email');
    } finally {
      setEmailSaving(false);
    }
  };

  const handleSendTestEmail = async () => {
    setTestEmailSending(true);
    setTestEmailResult(null);

    try {
      const response = await fetch('/api/test-email', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send test email');
      }

      const data = await response.json();
      setTestEmailResult({
        type: 'success',
        message: data.message || 'Test email sent successfully!'
      });
    } catch (err) {
      setTestEmailResult({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to send test email'
      });
    } finally {
      setTestEmailSending(false);
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
            {bridgeStatus === 'connected' && (
              <Alert severity="success" sx={{ mb: 2 }}>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  ✅ Connected to Firewalla
                </Typography>
                {setupConfig?.firewallInfo && (
                  <Box sx={{ mt: 1 }}>
                    {setupConfig.firewallInfo.deviceName && setupConfig.firewallInfo.deviceName !== 'Firewalla (configured via CLI)' && (
                      <Typography variant="body2">
                        <strong>Device:</strong> {setupConfig.firewallInfo.deviceName}
                      </Typography>
                    )}
                    {setupConfig.firewallInfo.model && setupConfig.firewallInfo.model !== 'unknown' && (
                      <Typography variant="body2">
                        <strong>Model:</strong> {setupConfig.firewallInfo.model}
                      </Typography>
                    )}
                    {setupConfig.firewallInfo.ipAddress && (
                      <Typography variant="body2">
                        <strong>IP Address:</strong> {setupConfig.firewallInfo.ipAddress}
                      </Typography>
                    )}
                    {setupConfig.firewallInfo.gid && setupConfig.firewallInfo.gid !== 'unknown' && (
                      <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.7 }}>
                        Group ID: {setupConfig.firewallInfo.gid.substring(0, 8)}...
                      </Typography>
                    )}
                  </Box>
                )}
                <Typography variant="body2" sx={{ mt: 1, opacity: 0.8 }}>
                  Bridge server is running and connected.
                </Typography>
              </Alert>
            )}

            {bridgeStatus === 'disconnected' && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  ⚠️ Bridge Server Not Running
                </Typography>
                {setupConfig?.firewallInfo && (
                  <Box sx={{ mt: 1, mb: 1 }}>
                    {setupConfig.firewallInfo.deviceName && setupConfig.firewallInfo.deviceName !== 'Firewalla (configured via CLI)' && (
                      <Typography variant="body2">
                        <strong>Device:</strong> {setupConfig.firewallInfo.deviceName}
                      </Typography>
                    )}
                    {setupConfig.firewallInfo.model && setupConfig.firewallInfo.model !== 'unknown' && (
                      <Typography variant="body2">
                        <strong>Model:</strong> {setupConfig.firewallInfo.model}
                      </Typography>
                    )}
                    {setupConfig.firewallInfo.ipAddress && (
                      <Typography variant="body2">
                        <strong>IP Address:</strong> {setupConfig.firewallInfo.ipAddress}
                      </Typography>
                    )}
                  </Box>
                )}
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Configuration is saved, but the bridge server is not running. Start it with:
                </Typography>
                <Box
                  component="code"
                  sx={{
                    display: 'block',
                    mt: 1,
                    p: 1,
                    bgcolor: 'rgba(0, 0, 0, 0.1)',
                    borderRadius: 1,
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                  }}
                >
                  node firewalla_bridge.js
                </Box>
              </Alert>
            )}

            {bridgeStatus === 'checking' && (
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  Checking bridge server status...
                </Typography>
              </Alert>
            )}
            <Button
              variant="outlined"
              color="error"
              startIcon={<LinkOffIcon />}
              onClick={() => setDisconnectDialogOpen(true)}
              disabled={loading}
            >
              Disconnect
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
              1. Open the <strong>Firewalla app</strong> on your phone
              <br />
              2. Go to <strong>Settings → Additional Pairing</strong>
              <br />
              3. Take a screenshot of the QR code or upload it below
              <br />
              4. The IP address will be auto-filled from the QR code
            </Typography>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Upload QR Code
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Recommended: Upload a screenshot of the QR code from your phone
              </Typography>
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
              <Button
                variant="contained"
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

            {qrData && qrInfo && (
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="subtitle2" fontWeight={600}>
                  Firewalla Device Detected
                </Typography>
                {qrInfo.deviceName && (
                  <Typography variant="body2">
                    <strong>Name:</strong> {qrInfo.deviceName}
                  </Typography>
                )}
                {qrInfo.model && (
                  <Typography variant="body2">
                    <strong>Model:</strong> {qrInfo.model}
                  </Typography>
                )}
                {qrInfo.gid && (
                  <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.7 }}>
                    Group ID: {qrInfo.gid.substring(0, 8)}...
                  </Typography>
                )}
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Please verify the IP address below and click Connect.
                </Typography>
              </Alert>
            )}

            {qrData && !qrInfo && (
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

            {connectionError && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setConnectionError(null)}>
                {connectionError}
              </Alert>
            )}

            {connectionSuccess && (
              <Alert severity="success" sx={{ mb: 2 }} onClose={() => setConnectionSuccess(null)}>
                {connectionSuccess}
              </Alert>
            )}

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
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Email notifications: {setupConfig?.emailConfigured ? 'Enabled' : 'Not configured'}
        </Typography>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" gutterBottom>
          Notification Email
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          Receive email notifications when schedules are paused
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
          <TextField
            label="Email Address"
            type="email"
            value={notificationEmail}
            onChange={(e) => setNotificationEmail(e.target.value)}
            placeholder="email@example.com"
            size="small"
            sx={{ flex: 1 }}
            disabled={emailSaving}
          />
          <Button
            variant="contained"
            onClick={handleSaveNotificationEmail}
            disabled={emailSaving || !notificationEmail.trim()}
            sx={{ position: 'relative', minWidth: 80 }}
          >
            Save
            {emailSaving && (
              <CircularProgress
                size={24}
                color="inherit"
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  marginTop: '-12px',
                  marginLeft: '-12px',
                }}
              />
            )}
          </Button>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" gutterBottom>
          Test Email
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          Send a test email to verify your email configuration is working
        </Typography>
        <Button
          variant="outlined"
          onClick={handleSendTestEmail}
          disabled={testEmailSending || !setupConfig?.emailConfigured}
          sx={{ position: 'relative', minWidth: 120 }}
        >
          {testEmailSending ? 'Sending...' : 'Send Test Email'}
          {testEmailSending && (
            <CircularProgress
              size={24}
              color="inherit"
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                marginTop: '-12px',
                marginLeft: '-12px',
              }}
            />
          )}
        </Button>
        {testEmailResult && (
          <Alert
            severity={testEmailResult.type}
            sx={{ mt: 2 }}
            onClose={() => setTestEmailResult(null)}
          >
            {testEmailResult.message}
          </Alert>
        )}
      </Paper>

      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Developer Settings
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={localStorage.getItem('debugMode') === 'true'}
              onChange={(e) => {
                localStorage.setItem('debugMode', e.target.checked.toString());
                window.dispatchEvent(new Event('debugModeChanged'));
              }}
            />
          }
          label="Show IDs (Debug Mode)"
        />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Enable this to see schedule IDs for debugging purposes.
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

      {/* Disconnect Dialog */}
      <Dialog
        open={disconnectDialogOpen}
        onClose={() => setDisconnectDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Disconnect from Firewalla?</DialogTitle>
        <DialogContent>
          <Typography paragraph>
            Are you sure you want to disconnect from Firewalla? This will:
          </Typography>
          <Box component="ul" sx={{ pl: 3, mb: 2 }}>
            <Typography component="li" variant="body2">
              Remove the ETP connection keys
            </Typography>
            <Typography component="li" variant="body2">
              Clear the device information
            </Typography>
            <Typography component="li" variant="body2">
              Require reconnecting with a QR code to use the app again
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDisconnectDialogOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDisconnect}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Disconnect'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reset Dialog */}
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
