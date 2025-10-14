import { useState } from 'react';
import { VoiceSelector } from './components/VoiceSelector';
import { ProsodyControls } from './components/ProsodyControls';
import { LLMPreprocessing } from './components/LLMPreprocessing';
import { ResultPanel } from './components/ResultPanel';
import { generateSpeechWithSubtitles, type TTSRequest } from './lib/workerClient';
import { optimizeTextForTTS, addSSMLMarkup } from './lib/llmClient';
import { EXAMPLE_VOICES } from './constants';

function App() {
  // Form state
  const [text, setText] = useState('Hello, world! This is a test of the Edge TTS Subtitles service.');
  const [voice, setVoice] = useState(EXAMPLE_VOICES[0].id);
  const [subtitleFormat, setSubtitleFormat] = useState<'srt' | 'vtt'>('srt');
  const [rate, setRate] = useState('1.0');
  const [pitch, setPitch] = useState('0st');
  const [volume, setVolume] = useState('medium');
  
  // LLM preprocessing state
  const [llmEnabled, setLLMEnabled] = useState(false);
  const [llmEndpoint, setLLMEndpoint] = useState('https://api.openai.com/v1/chat/completions');
  const [llmApiKey, setLLMApiKey] = useState('');
  const [optimizeForTTS, setOptimizeForTTS] = useState(false);
  const [addSSML, setAddSSML] = useState(false);
  
  // Mock mode
  const [mockMode, setMockMode] = useState(false);
  
  // Result state
  const [result, setResult] = useState<{
    audioBase64: string;
    subtitleContent: string;
    subtitleFormat: 'srt' | 'vtt';
    voice: string;
  } | null>(null);
  
  // Loading/error state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      let processedText = text;
      let useRawSSML = false;

      // LLM preprocessing if enabled
      if (llmEnabled) {
        if (!llmEndpoint || !llmApiKey) {
          throw new Error('LLM endpoint and API key are required when LLM preprocessing is enabled');
        }

        const config = {
          endpoint: llmEndpoint,
          apiKey: llmApiKey,
        };

        // Step 1: Optimize text for TTS if requested
        if (optimizeForTTS) {
          processedText = await optimizeTextForTTS(config, processedText);
        }

        // Step 2: Add SSML markup if requested
        if (addSSML) {
          processedText = await addSSMLMarkup(config, processedText);
          useRawSSML = true;
        }
      }

      // Build request
      const request: TTSRequest = {
        input: processedText,
        voice,
        subtitle_format: subtitleFormat,
      };

      if (useRawSSML) {
        // SSML result → POST with raw_ssml
        request.raw_ssml = processedText;
        // input is still required by the API
        request.input = text;
      } else {
        // Optimized plain text or original text → POST with input + prosody controls
        request.input = processedText;
        if (rate) request.rate = rate;
        if (pitch) request.pitch = pitch;
        if (volume) request.volume = volume;
      }

      // Call worker API
      const response = await generateSpeechWithSubtitles(request, mockMode);

      setResult({
        audioBase64: response.audio_content_base64,
        subtitleContent: response.subtitle_content,
        subtitleFormat: response.subtitle_format,
        voice,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Edge TTS Subtitles</h1>
          <a
            href="https://github.com/anschmieg/edge-tts-subtitles/tree/main/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-accent hover:underline"
          >
            Docs
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Form */}
          <div className="space-y-6">
            <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-6 space-y-6">
              {/* Text Input */}
              <div>
                <label className="label">Text to speak</label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={5}
                  placeholder="Enter text to convert to speech..."
                  className="input-text resize-y"
                  required
                />
              </div>

              {/* Voice Selector */}
              <VoiceSelector selectedVoice={voice} onVoiceChange={setVoice} />

              {/* Subtitle Format */}
              <div>
                <label className="label">Subtitle Format</label>
                <div className="flex gap-4">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      value="srt"
                      checked={subtitleFormat === 'srt'}
                      onChange={(e) => setSubtitleFormat(e.target.value as 'srt')}
                      className="w-4 h-4 text-accent border-gray-300 focus:ring-accent"
                    />
                    <span className="text-sm text-gray-700">SRT</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      value="vtt"
                      checked={subtitleFormat === 'vtt'}
                      onChange={(e) => setSubtitleFormat(e.target.value as 'vtt')}
                      className="w-4 h-4 text-accent border-gray-300 focus:ring-accent"
                    />
                    <span className="text-sm text-gray-700">VTT</span>
                  </label>
                </div>
              </div>

              {/* Prosody Controls */}
              <ProsodyControls
                rate={rate}
                pitch={pitch}
                volume={volume}
                onRateChange={setRate}
                onPitchChange={setPitch}
                onVolumeChange={setVolume}
              />

              {/* LLM Preprocessing */}
              <LLMPreprocessing
                enabled={llmEnabled}
                onEnabledChange={setLLMEnabled}
                llmEndpoint={llmEndpoint}
                onLLMEndpointChange={setLLMEndpoint}
                llmApiKey={llmApiKey}
                onLLMApiKeyChange={setLLMApiKey}
                optimizeForTTS={optimizeForTTS}
                onOptimizeForTTSChange={setOptimizeForTTS}
                addSSML={addSSML}
                onAddSSMLChange={setAddSSML}
              />

              {/* Mock Mode (Development) */}
              <div className="flex items-center space-x-2 bg-yellow-50 border border-yellow-200 rounded p-3">
                <input
                  type="checkbox"
                  id="mockMode"
                  checked={mockMode}
                  onChange={(e) => setMockMode(e.target.checked)}
                  className="w-4 h-4 text-accent border-gray-300 rounded focus:ring-accent cursor-pointer"
                />
                <label htmlFor="mockMode" className="text-sm text-yellow-800 cursor-pointer">
                  Mock mode (use canned demo data, no worker required)
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full"
              >
                {loading ? 'Generating...' : 'Generate Speech & Subtitles'}
              </button>

              {/* Error Display */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded p-4">
                  <p className="text-sm font-medium text-red-800">Error</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              )}
            </form>
          </div>

          {/* Right Column: Results */}
          <div>
            {result ? (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <ResultPanel
                  audioBase64={result.audioBase64}
                  subtitleContent={result.subtitleContent}
                  subtitleFormat={result.subtitleFormat}
                  voice={result.voice}
                />
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-500">
                <p className="mb-2">👈 Fill in the form and generate speech to see results here</p>
                <p className="text-sm">
                  Audio player, subtitles, and download options will appear after generation.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
