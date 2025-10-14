export const demoHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Edge TTS Subtitles Demo</title>
    <style>
        :root {
            color-scheme: light dark;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            max-width: 760px;
            margin: 40px auto;
            padding: 0 20px 60px;
            line-height: 1.6;
            color: #1f2933;
            background-color: #f9fafb;
        }
        h1 {
            margin-bottom: 0.2em;
        }
        a {
            color: #2563eb;
        }
        .lead {
            margin-bottom: 1.2rem;
            color: #4b5563;
        }
        .demo-callout {
            background: #e0f2fe;
            border-left: 4px solid #0284c7;
            padding: 12px 16px;
            border-radius: 6px;
            margin-bottom: 1rem;
            font-size: 0.95rem;
        }
        .endpoint {
            background: #fff;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            padding: 8px 12px;
            font-size: 0.9rem;
            margin-bottom: 1.5rem;
            color: #1f2933;
        }
        form {
            background: #fff;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
            padding: 20px;
            box-shadow: 0 12px 32px -12px rgba(15, 23, 42, 0.25);
        }
        .form-group {
            margin-bottom: 18px;
        }
        label {
            display: block;
            margin-bottom: 6px;
            font-weight: 600;
        }
        input, textarea, select, button {
            width: 100%;
            padding: 10px;
            font-size: 15px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            box-sizing: border-box;
        }
        textarea {
            min-height: 120px;
            resize: vertical;
        }
        button {
            background-color: #2563eb;
            color: white;
            border: none;
            cursor: pointer;
            font-weight: 600;
            transition: background-color 0.15s ease;
        }
        button:hover:not(:disabled) {
            background-color: #1d4ed8;
        }
        button:disabled {
            background-color: #93c5fd;
            cursor: wait;
        }
        .error {
            margin-top: 20px;
            display: none;
            background: #fee2e2;
            color: #991b1b;
            border: 1px solid #fecaca;
            border-radius: 6px;
            padding: 12px 16px;
        }
        .result {
            margin-top: 30px;
            padding: 20px;
            background-color: #fff;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
            box-shadow: 0 12px 32px -12px rgba(15, 23, 42, 0.25);
            display: none;
        }
        .result.show {
            display: block;
        }
        audio {
            width: 100%;
            margin: 12px 0;
        }
        pre {
            background-color: #0f172a;
            color: #e2e8f0;
            padding: 12px;
            border-radius: 6px;
            overflow-x: auto;
            font-size: 0.9rem;
        }
        .info {
            font-size: 0.85rem;
            color: #6b7280;
            margin-top: 4px;
        }
    </style>
</head>
<body>
    <header>
        <h1>🎤 Edge TTS Subtitles Demo</h1>
        <p class="lead">This page is a lightweight demonstration of the Cloudflare worker. It only uses live worker responses—no mock data or client-side extras.</p>
        <div class="demo-callout">
            Looking for presets, downloads, and client-side LLM preprocessing? Use the full React UI in <code>ui/</code>. This page focuses on the core API.
        </div>
        <div class="endpoint" id="endpointNotice">Detecting available worker&hellip;</div>
    </header>

    <form id="ttsForm">
        <div class="form-group">
            <label for="text">Text to speak</label>
            <textarea id="text" required spellcheck="true">Hello, world! This is a live demo of the Edge TTS Subtitles worker.</textarea>
            <p class="info">The worker will add subtitles automatically. Keep the text concise while testing.</p>
        </div>

        <div class="form-group">
            <label for="voice">Voice</label>
            <select id="voice">
                <option value="en-US-EmmaMultilingualNeural">Emma (US English)</option>
                <option value="en-US-AndrewMultilingualNeural">Andrew (US English)</option>
                <option value="en-GB-SoniaNeural">Sonia (British English)</option>
                <option value="es-ES-ElviraNeural">Elvira (Spanish)</option>
                <option value="fr-FR-DeniseNeural">Denise (French)</option>
            </select>
        </div>

        <div class="form-group">
            <label for="rate">Rate (optional)</label>
            <input id="rate" placeholder="e.g. 1.1, fast, 120%" autocomplete="off">
        </div>

        <div class="form-group">
            <label for="pitch">Pitch (optional)</label>
            <input id="pitch" placeholder="e.g. +2st, low" autocomplete="off">
        </div>

        <div class="form-group">
            <label for="volume">Volume (optional)</label>
            <input id="volume" placeholder="e.g. loud, -3dB" autocomplete="off">
        </div>

        <div class="form-group">
            <label for="format">Subtitle format</label>
            <select id="format">
                <option value="srt">SRT (SubRip)</option>
                <option value="vtt">VTT (WebVTT)</option>
            </select>
        </div>

        <button type="submit" id="generateBtn">Generate speech & subtitles</button>
    </form>

    <div id="error" class="error" role="alert" aria-live="assertive"></div>

    <section id="result" class="result" aria-live="polite">
        <h2>Result</h2>
        <div id="audioContainer"></div>
        <div id="subtitlesContainer"></div>
    </section>

    <script>
        (function () {
            const DEFAULT_HOSTED_URL = window.location.origin;
            const LOCAL_CANDIDATES = ['http://127.0.0.1:8787', 'http://localhost:8787'];

            const endpointNotice = document.getElementById('endpointNotice');
            const form = document.getElementById('ttsForm');
            const audioContainer = document.getElementById('audioContainer');
            const subtitlesContainer = document.getElementById('subtitlesContainer');
            const resultSection = document.getElementById('result');
            const errorBox = document.getElementById('error');
            const generateButton = document.getElementById('generateBtn');

            let resolvedEndpointText = false;

            const workerBaseUrlPromise = (async () => {
                for (const candidate of LOCAL_CANDIDATES) {
                    if (candidate === DEFAULT_HOSTED_URL) {
                        continue;
                    }
                    try {
                        await fetch(candidate + '/', { method: 'GET', mode: 'no-cors' });
                        endpointNotice.textContent = 'Using local Wrangler dev server at ' + candidate;
                        resolvedEndpointText = true;
                        return candidate;
                    } catch (_) {
                        // Ignore connection errors and try the next candidate
                    }
                }
                endpointNotice.textContent = 'Using deployed worker at ' + DEFAULT_HOSTED_URL;
                resolvedEndpointText = true;
                return DEFAULT_HOSTED_URL;
            })().catch(() => {
                endpointNotice.textContent = 'Could not contact the worker. Requests will be attempted against ' + DEFAULT_HOSTED_URL;
                resolvedEndpointText = true;
                return DEFAULT_HOSTED_URL;
            });

            setTimeout(() => {
                if (!resolvedEndpointText) {
                    endpointNotice.textContent = 'Still checking for a local dev worker...';
                }
            }, 1000);

            form.addEventListener('submit', async (event) => {
                event.preventDefault();

                errorBox.style.display = 'none';
                errorBox.textContent = '';
                resultSection.classList.remove('show');

                const text = document.getElementById('text').value.trim();
                const voice = document.getElementById('voice').value;
                const subtitleFormat = document.getElementById('format').value;
                const rate = document.getElementById('rate').value.trim();
                const pitch = document.getElementById('pitch').value.trim();
                const volume = document.getElementById('volume').value.trim();

                if (!text) {
                    errorBox.textContent = 'Please provide text to convert to speech.';
                    errorBox.style.display = 'block';
                    return;
                }

                generateButton.disabled = true;
                generateButton.textContent = 'Generating...';

                try {
                    const workerBaseUrl = await workerBaseUrlPromise;
                    const response = await fetch(workerBaseUrl.replace(/\\/$/, '') + '/v1/audio/speech_subtitles', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            input: text,
                            voice,
                            subtitle_format: subtitleFormat,
                            rate: rate || undefined,
                            pitch: pitch || undefined,
                            volume: volume || undefined,
                        }),
                    });

                    if (!response.ok) {
                        let message = 'Request failed.';
                        try {
                            const errorPayload = await response.json();
                            message = errorPayload.message || errorPayload.error || message;
                        } catch (_) {
                            message = response.status + ' ' + response.statusText;
                        }
                        throw new Error(message);
                    }

                    const data = await response.json();
                    displayResults(data);
                } catch (error) {
                    const message = error && error.message ? error.message : String(error);
                    errorBox.textContent = 'Error: ' + message;
                    errorBox.style.display = 'block';
                } finally {
                    generateButton.disabled = false;
                    generateButton.textContent = 'Generate speech & subtitles';
                }
            });

            function displayResults(data) {
                const audioBlob = base64ToBlob(data.audio_content_base64, 'audio/mpeg');
                const objectUrl = URL.createObjectURL(audioBlob);

                audioContainer.innerHTML = '<h3>🔊 Audio</h3>' +
                    '<audio controls src="' + objectUrl + '"></audio>' +
                    '<p><a href="' + objectUrl + '" download="speech.mp3">Download MP3</a></p>';

                subtitlesContainer.innerHTML = '<h3>📝 Subtitles (' + data.subtitle_format.toUpperCase() + ')</h3>' +
                    '<pre>' + escapeHtml(data.subtitle_content) + '</pre>';

                resultSection.classList.add('show');
            }

            function base64ToBlob(base64, contentType) {
                const binary = atob(base64);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) {
                    bytes[i] = binary.charCodeAt(i);
                }
                return new Blob([bytes], { type: contentType });
            }

            function escapeHtml(text) {
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            }
        })();
    </script>
</body>
</html>`;
