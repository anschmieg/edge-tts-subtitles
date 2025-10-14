import { useState } from 'react';
import { optimizeTextForTTS, addSSMLMarkup, validateLLMEndpoint } from '../lib/llmClient';

interface LLMPreprocessingProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  llmEndpoint: string;
  onLLMEndpointChange: (endpoint: string) => void;
  llmApiKey: string;
  onLLMApiKeyChange: (key: string) => void;
  optimizeForTTS: boolean;
  onOptimizeForTTSChange: (optimize: boolean) => void;
  addSSML: boolean;
  onAddSSMLChange: (addSSML: boolean) => void;
}

export function LLMPreprocessing({
  enabled,
  onEnabledChange,
  llmEndpoint,
  onLLMEndpointChange,
  llmApiKey,
  onLLMApiKeyChange,
  optimizeForTTS,
  onOptimizeForTTSChange,
  addSSML,
  onAddSSMLChange,
}: LLMPreprocessingProps) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string>('');
  const [testError, setTestError] = useState<string>('');

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
      setTestError('API key is required');
      setTesting(false);
      return;
    }

    const testText = 'Hello world! Dr. Smith @ 123 Main St. will meet you at 3:30 PM.';
    
    try {
      const config = {
        endpoint: llmEndpoint,
        apiKey: llmApiKey,
      };

      let result = testText;

      if (optimizeForTTS) {
        result = await optimizeTextForTTS(config, testText);
      }

      if (addSSML) {
        result = await addSSMLMarkup(config, addSSML && optimizeForTTS ? result : testText);
      }

      setTestResult(result);
    } catch (error) {
      setTestError(error instanceof Error ? error.message : 'Test failed');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="enableLLM"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
          className="w-4 h-4 text-accent border-gray-300 rounded focus:ring-accent cursor-pointer"
        />
        <label htmlFor="enableLLM" className="text-sm font-medium text-gray-700 cursor-pointer">
          Enable client-side LLM preprocessing (advanced)
        </label>
      </div>

      {enabled && (
        <div className="space-y-3 mt-3 pl-6">
          <div>
            <label className="label">LLM Endpoint</label>
            <input
              type="text"
              value={llmEndpoint}
              onChange={(e) => onLLMEndpointChange(e.target.value)}
              placeholder="https://api.openai.com/v1/chat/completions"
              className="input-text"
            />
            <p className="text-xs text-gray-500 mt-1">
              Must be an HTTPS endpoint. Your API key stays in your browser.
            </p>
          </div>

          <div>
            <label className="label">LLM API Key</label>
            <input
              type="password"
              value={llmApiKey}
              onChange={(e) => onLLMApiKeyChange(e.target.value)}
              placeholder="sk-..."
              className="input-text"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="optimizeForTTS"
                checked={optimizeForTTS}
                onChange={(e) => onOptimizeForTTSChange(e.target.checked)}
                className="w-4 h-4 text-accent border-gray-300 rounded focus:ring-accent cursor-pointer"
              />
              <label htmlFor="optimizeForTTS" className="text-sm text-gray-700 cursor-pointer">
                Optimize text for TTS
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="addSSML"
                checked={addSSML}
                onChange={(e) => onAddSSMLChange(e.target.checked)}
                className="w-4 h-4 text-accent border-gray-300 rounded focus:ring-accent cursor-pointer"
              />
              <label htmlFor="addSSML" className="text-sm text-gray-700 cursor-pointer">
                Add SSML markup
              </label>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTestLLM}
            disabled={testing || !llmEndpoint || !llmApiKey}
            className="btn-secondary w-full"
          >
            {testing ? 'Testing...' : 'Test LLM'}
          </button>

          {testResult && (
            <div className="bg-green-50 border border-green-200 rounded p-3">
              <p className="text-xs font-medium text-green-800 mb-1">Test Result:</p>
              <pre className="text-xs text-green-700 whitespace-pre-wrap">{testResult}</pre>
            </div>
          )}

          {testError && (
            <div className="bg-red-50 border border-red-200 rounded p-3">
              <p className="text-xs font-medium text-red-800">Error: {testError}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
