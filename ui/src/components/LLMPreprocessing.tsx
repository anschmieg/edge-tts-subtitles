import { useMemo, useState } from 'react';
import { Alert, Button, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded';
import ScienceRoundedIcon from '@mui/icons-material/ScienceRounded';
import { validateLLMEndpoint } from '../lib/llmClient';

interface LLMPreprocessingProps {
  llmEndpoint: string;
  onLLMEndpointChange: (endpoint: string) => void;
  llmApiKey: string;
  onLLMApiKeyChange: (key: string) => void;
  requireCredentials?: boolean;
}

export function LLMPreprocessing({
  llmEndpoint,
  onLLMEndpointChange,
  llmApiKey,
  onLLMApiKeyChange,
  requireCredentials = false,
}: LLMPreprocessingProps) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string>('');
  const [testError, setTestError] = useState<string>('');

  const modelsUrl = useMemo(() => buildModelsUrl(llmEndpoint), [llmEndpoint]);

  const handleTestLLM = async () => {
    setTesting(true);
    setTestResult('');
    setTestError('');

    const validation = validateLLMEndpoint(llmEndpoint);
    if (!validation.valid) {
      setTestError(validation.error || 'Invalid endpoint');
      setTesting(false);
      return;
    }

    if (!llmApiKey) {
      setTestError('API key is required for the quick check.');
      setTesting(false);
      return;
    }

    if (!modelsUrl) {
      setTestError('Unable to derive a models endpoint from the provided URL.');
      setTesting(false);
      return;
    }

    try {
      const response = await fetch(modelsUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${llmApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`${response.status} ${response.statusText}: ${text || 'No response body'}`);
      }

      const data = await response.json();
      const modelCount = Array.isArray(data?.data) ? data.data.length : undefined;
      setTestResult(
        `Connection succeeded. ${typeof modelCount === 'number' ? `${modelCount} models reported.` : 'The endpoint responded without errors.'}`
      );
    } catch (error) {
      setTestError(error instanceof Error ? error.message : 'Test failed');
    } finally {
      setTesting(false);
    }
  };

  return (
    <Stack spacing={2.25}>
      <Typography variant="subtitle2" color="text.secondary">
        Base settings
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Required when any enhancement is enabled. The key never leaves your browser—it's only used
        for client-side preprocessing before audio generation.
      </Typography>

      <TextField
        label="LLM endpoint"
        value={llmEndpoint}
        onChange={(event) => onLLMEndpointChange(event.target.value)}
        placeholder="https://api.openai.com/v1/chat/completions"
        helperText="HTTPS only. For Azure OpenAI, include the deployment URL and api-version parameter."
      />

      <TextField
        label="API key"
        type="password"
        value={llmApiKey}
        onChange={(event) => onLLMApiKeyChange(event.target.value)}
        placeholder="sk-..."
      />

      {requireCredentials && (
        <Alert severity="warning" sx={{ borderRadius: 2 }}>
          Enter both endpoint and API key to use these enhancements.
        </Alert>
      )}

      <Button
        variant="outlined"
        onClick={handleTestLLM}
        startIcon={testing ? <CircularProgress size={16} color="inherit" /> : <ScienceRoundedIcon />}
        disabled={testing || !llmEndpoint || !llmApiKey}
        sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' } }}
      >
        {testing ? 'Checking…' : 'Run quick test'}
      </Button>

      {modelsUrl && (
        <Typography variant="caption" color="text.secondary">
          Checking connectivity by calling <code>{modelsUrl}</code>
        </Typography>
      )}

      {testResult && (
        <Alert
          severity="success"
          icon={<AutoFixHighRoundedIcon fontSize="small" />}
          sx={{ whiteSpace: 'pre-wrap' }}
          onClose={() => setTestResult('')}
        >
          {testResult}
        </Alert>
      )}

      {testError && (
        <Alert severity="error" onClose={() => setTestError('')}>
          {testError}
        </Alert>
      )}
    </Stack>
  );
}

function buildModelsUrl(endpoint: string): string | null {
  try {
    const url = new URL(endpoint);
    const apiVersion = url.searchParams.get('api-version');
    const pathSegments = url.pathname.split('/').filter(Boolean);

    if (pathSegments.includes('openai') && pathSegments.includes('deployments')) {
      // Likely Azure OpenAI endpoint
      url.pathname = '/openai/models';
      if (apiVersion) {
        url.search = `api-version=${apiVersion}`;
      } else {
        url.search = '';
      }
    } else {
      url.pathname = '/v1/models';
      url.search = '';
    }

    return url.toString();
  } catch {
    return null;
  }
}
