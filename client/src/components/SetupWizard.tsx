import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Stepper,
  Step,
  StepLabel,
  Alert,
  CircularProgress,
  Collapse,
  IconButton,
  Link,
  Divider,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

interface SetupWizardProps {
  onComplete: () => void;
}

const steps = ['Welcome', 'Instructions', 'Credentials', 'Complete'];

export const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const redirectUri = `${window.location.origin}/auth/google/callback`;

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);

    try {
      const text = await file.text();
      const json = JSON.parse(text);

      // Google's downloaded JSON has this structure:
      // { "web": { "client_id": "...", "client_secret": "..." } }
      const credentials = json.web || json.installed;

      if (!credentials || !credentials.client_id || !credentials.client_secret) {
        throw new Error('Invalid OAuth credentials file format');
      }

      setClientId(credentials.client_id);
      setClientSecret(credentials.client_secret);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse credentials file');
      setClientId('');
      setClientSecret('');
    }

    // Reset the file input
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleNext = () => {
    setActiveStep((prevStep) => prevStep + 1);
    setError(null);
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
    setError(null);
  };

  const handleCopyRedirectUri = () => {
    navigator.clipboard.writeText(redirectUri);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleSaveCredentials = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      setError('Please enter both Client ID and Client Secret');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/configure-oauth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save credentials');
      }

      // Move to success step
      handleNext();
      // Notify parent that config changed
      setTimeout(() => {
        onComplete();
      }, 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginWithGoogle = () => {
    window.location.href = '/auth/google';
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: '#f5f5f5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
      }}
    >
      <Paper sx={{ maxWidth: 800, width: '100%', p: 4 }}>
        <Typography variant="h4" gutterBottom align="center" fontWeight={600}>
          Welcome to Firewalla Time Manager
        </Typography>

        <Stepper activeStep={activeStep} sx={{ mt: 4, mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Step 0: Welcome */}
        {activeStep === 0 && (
          <Box>
            <Typography variant="h5" gutterBottom>
              Let's get started!
            </Typography>
            <Typography variant="body1" paragraph>
              To use this application, you'll need to create a Google OAuth application.
              This allows you to:
            </Typography>
            <Box component="ul" sx={{ pl: 3 }}>
              <Typography component="li" variant="body1">
                Securely log in as the administrator
              </Typography>
              <Typography component="li" variant="body1">
                Send email notifications when policies are paused
              </Typography>
              <Typography component="li" variant="body1">
                Track who made changes and when
              </Typography>
            </Box>
            <Typography variant="body1" paragraph sx={{ mt: 2 }}>
              Don't worry - we'll guide you through the entire process step by step.
            </Typography>

            <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="contained" onClick={handleNext} size="large">
                Next
              </Button>
            </Box>
          </Box>
        )}

        {/* Step 1: Instructions */}
        {activeStep === 1 && (
          <Box>
            <Typography variant="h5" gutterBottom>
              Create a Google Cloud Project
            </Typography>

            <Alert severity="info" sx={{ mb: 3 }}>
              This process takes about 5 minutes. You'll need a Google account.
            </Alert>

            <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
              Quick Steps:
            </Typography>

            <Box component="ol" sx={{ pl: 3 }}>
              <Typography component="li" variant="body1" paragraph>
                Go to{' '}
                <Link
                  href="https://console.cloud.google.com"
                  target="_blank"
                  rel="noopener"
                  sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
                >
                  Google Cloud Console
                  <OpenInNewIcon fontSize="small" />
                </Link>
              </Typography>

              <Typography component="li" variant="body1" paragraph>
                Create a new project (or select an existing one)
              </Typography>

              <Typography component="li" variant="body1" paragraph>
                Enable the <strong>Gmail API</strong> for your project
              </Typography>

              <Typography component="li" variant="body1" paragraph>
                Go to <strong>APIs & Services → Credentials</strong>
              </Typography>

              <Typography component="li" variant="body1" paragraph>
                Click <strong>Create Credentials → OAuth 2.0 Client ID</strong>
              </Typography>

              <Typography component="li" variant="body1" paragraph>
                Choose <strong>Web application</strong> as the application type
              </Typography>

              <Typography component="li" variant="body1" paragraph>
                Add this Authorized redirect URI:
                <Box
                  sx={{
                    mt: 1,
                    p: 2,
                    bgcolor: '#f5f5f5',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  <Typography
                    component="code"
                    sx={{ flex: 1, fontFamily: 'monospace', fontSize: '0.9rem' }}
                  >
                    {redirectUri}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={handleCopyRedirectUri}
                    color={copySuccess ? 'success' : 'default'}
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Box>
                {copySuccess && (
                  <Typography variant="caption" color="success.main" sx={{ mt: 0.5 }}>
                    Copied to clipboard!
                  </Typography>
                )}
              </Typography>

              <Typography component="li" variant="body1" paragraph>
                Click <strong>Create</strong>
              </Typography>

              <Typography component="li" variant="body1">
                Copy the <strong>Client ID</strong> and <strong>Client Secret</strong> - you'll
                need them in the next step
              </Typography>
            </Box>

            <Divider sx={{ my: 3 }} />

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Button
                variant="text"
                onClick={() => setShowDetails(!showDetails)}
                endIcon={showDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              >
                {showDetails ? 'Hide' : 'Show'} Detailed Instructions
              </Button>
            </Box>

            <Collapse in={showDetails}>
              <Box sx={{ mt: 2, p: 2, bgcolor: '#f9f9f9', borderRadius: 1 }}>
                <Typography variant="body2" paragraph>
                  <strong>Step-by-step with screenshots:</strong>
                </Typography>
                <Typography variant="body2" paragraph>
                  1. <strong>Create Project:</strong> In Google Cloud Console, click the project
                  dropdown at the top, then "New Project". Give it a name like "Firewalla Time
                  Manager".
                </Typography>
                <Typography variant="body2" paragraph>
                  2. <strong>Enable Gmail API:</strong> Use the search bar to find "Gmail API",
                  click it, then click "Enable".
                </Typography>
                <Typography variant="body2" paragraph>
                  3. <strong>Configure OAuth Consent Screen:</strong> Go to "APIs & Services →
                  OAuth consent screen". Choose "External" user type. Fill in app name and your
                  email. You can skip most optional fields.
                </Typography>
                <Typography variant="body2" paragraph>
                  4. <strong>Create Credentials:</strong> Go to "Credentials" tab, click "Create
                  Credentials", choose "OAuth 2.0 Client ID". If prompted, configure the consent
                  screen first.
                </Typography>
                <Typography variant="body2">
                  5. <strong>Get Credentials:</strong> After creating, a dialog will show your
                  Client ID and Client Secret. Copy both values.
                </Typography>
              </Box>
            </Collapse>

            <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between' }}>
              <Button onClick={handleBack}>Back</Button>
              <Button variant="contained" onClick={handleNext}>
                I've Created the OAuth App
              </Button>
            </Box>
          </Box>
        )}

        {/* Step 2: Enter Credentials */}
        {activeStep === 2 && (
          <Box>
            <Typography variant="h5" gutterBottom>
              Enter Your OAuth Credentials
            </Typography>
            <Typography variant="body1" paragraph color="text.secondary">
              Upload the credentials JSON file or paste them manually.
            </Typography>

            <input
              type="file"
              accept=".json,application/json"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />

            <Button
              variant="outlined"
              startIcon={<CloudUploadIcon />}
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              fullWidth
              sx={{ mb: 3 }}
            >
              Upload OAuth JSON File
            </Button>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, my: 2 }}>
              <Divider sx={{ flex: 1 }} />
              <Typography variant="body2" color="text.secondary">
                OR
              </Typography>
              <Divider sx={{ flex: 1 }} />
            </Box>

            <TextField
              fullWidth
              label="Client ID"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="123456789-abc123def456.apps.googleusercontent.com"
              sx={{ mb: 3 }}
              disabled={loading}
            />

            <TextField
              fullWidth
              label="Client Secret"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="GOCSPX-..."
              type="password"
              sx={{ mb: 3 }}
              disabled={loading}
            />

            <Alert severity="info">
              These credentials will be saved to your .env file and the server will reload
              automatically. No restart required!
            </Alert>

            <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between' }}>
              <Button onClick={handleBack} disabled={loading}>
                Back
              </Button>
              <Button
                variant="contained"
                onClick={handleSaveCredentials}
                disabled={loading || !clientId.trim() || !clientSecret.trim()}
              >
                {loading ? <CircularProgress size={24} /> : 'Save & Continue'}
              </Button>
            </Box>
          </Box>
        )}

        {/* Step 3: Success */}
        {activeStep === 3 && (
          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ fontSize: '4rem', mb: 2 }}>✅</Box>
            <Typography variant="h5" gutterBottom>
              OAuth Configured Successfully!
            </Typography>
            <Typography variant="body1" paragraph color="text.secondary">
              You're all set! Now log in with your Google account to become the administrator.
            </Typography>

            <Alert severity="success" sx={{ mt: 3, mb: 3, textAlign: 'left' }}>
              After logging in, you'll be able to:
              <Box component="ul" sx={{ mt: 1, mb: 0 }}>
                <li>Manage Firewalla internet access policies</li>
                <li>Pause and resume blocking schedules</li>
                <li>View pause history</li>
                <li>Configure email notifications</li>
              </Box>
            </Alert>

            <Button
              variant="contained"
              size="large"
              onClick={handleLoginWithGoogle}
              sx={{ mt: 2 }}
            >
              Login with Google
            </Button>
          </Box>
        )}
      </Paper>
    </Box>
  );
};
