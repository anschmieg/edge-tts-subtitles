export const demoHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Edge TTS Subtitles Demo</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; line-height: 1.6; }
        h1 { color: #333; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; font-weight: 500; }
        input, textarea, select, button { width: 100%; padding: 10px; font-size: 14px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
        textarea { min-height: 100px; resize: vertical; }
        button { background-color: #0070f3; color: white; border: none; cursor: pointer; font-weight: 500; margin-top: 10px; }
        button:hover { background-color: #0051cc; }
        button:disabled { background-color: #ccc; cursor: not-allowed; }
        .result { margin-top: 30px; padding: 20px; background-color: #f5f5f5; border-radius: 4px; display: none; }
        .result.show { display: block; }
        pre { background-color: #fff; padding: 10px; border-radius: 4px; overflow-x: auto; }
        audio { width: 100%; margin: 10px 0; }
        .error { color: #d32f2f; background-color: #ffebee; padding: 10px; border-radius: 4px; margin-top: 10px; }
        .toggle-section { background-color: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 4px; padding: 15px; margin-bottom: 15px; }
        .toggle-header { display: flex; align-items: center; cursor: pointer; user-select: none; }
        .toggle-header input[type="checkbox"] { width: auto; margin-right: 10px; cursor: pointer; }
        .toggle-content { margin-top: 10px; display: none; }
        .toggle-content.active { display: block; }
        .info-text { font-size: 12px; color: #666; margin-top: 5px; }
    </style>
</head>
<body>
    <h1>🎤 Edge TTS Subtitles Demo</h1>
    <p>Generate speech audio with synchronized subtitles using Microsoft Edge TTS.</p>

    <form id="ttsForm">
        <div class="form-group">
            <label for="text">Text to speak:</label>
            <textarea id="text" placeholder="Enter the text you want to convert to speech..." required>Hello, world! This is a demonstration of the Edge TTS API with subtitle generation.</textarea>
        </div>

        <div class="form-group">
            <label for="voice">Voice:</label>
            <select id="voice">
                <option value="en-US-EmmaMultilingualNeural">Emma (US English, Female)</option>
                <option value="en-US-AndrewMultilingualNeural">Andrew (US English, Male)</option>
                <option value="en-GB-SoniaNeural">Sonia (UK English, Female)</option>
                <option value="en-GB-RyanNeural">Ryan (UK English, Male)</option>
                <option value="es-ES-ElviraNeural">Elvira (Spanish, Female)</option>
                <option value="fr-FR-DeniseNeural">Denise (French, Female)</option>
                <option value="de-DE-KatjaNeural">Katja (German, Female)</option>
                <option value="ja-JP-NanamiNeural">Nanami (Japanese, Female)</option>
                <option value="zh-CN-XiaoxiaoNeural">Xiaoxiao (Chinese, Female)</option>
            </select>
        </div>

        <div class="form-group">
            <label for="rate">Rate (speed):</label>
            <input id="rate" placeholder="e.g. 1.0 or fast" />
        </div>

        <div class="form-group">
            <label for="pitch">Pitch:</label>
            <input id="pitch" placeholder="e.g. +2st or low" />
        </div>

        <div class="form-group">
            <label for="volume">Volume:</label>
            <input id="volume" placeholder="e.g. loud or x-soft" />
        </div>

        <div class="form-group">
            <label for="format">Subtitle Format:</label>
            <select id="format">
                <option value="srt">SRT (SubRip)</option>
                <option value="vtt">VTT (WebVTT)</option>
            </select>
        </div>

        <!-- LLM Preprocessing Section -->
        <div class="toggle-section">
            <div class="toggle-header" onclick="toggleLLMSettings()">
                <input type="checkbox" id="enableLLM" onclick="event.stopPropagation();">
                <label for="enableLLM" style="cursor: pointer; margin: 0;">🤖 Enable LLM Preprocessing</label>
            </div>
            <div id="llmContent" class="toggle-content">
                <div class="form-group">
                    <label for="llmEndpoint">LLM Endpoint URL:</label>
                    <input type="text" id="llmEndpoint" placeholder="https://api.openai.com/v1/chat/completions">
                    <div class="info-text">OpenAI-compatible endpoint (stored in LocalStorage)</div>
                </div>
                <div class="form-group">
                    <label for="llmApiKey">LLM API Key:</label>
                    <input type="password" id="llmApiKey" placeholder="sk-...">
                    <div class="info-text">Your API key (stored in LocalStorage)</div>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="optimizeForTTS" style="width: auto; display: inline;">
                        Optimize text for TTS
                    </label>
                    <div class="info-text">Replace uncommon characters, simplify lists, etc.</div>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="addSSMLMarkup" style="width: auto; display: inline;">
                        Add SSML markup
                    </label>
                    <div class="info-text">Automatically add SSML tags for natural pronunciation</div>
                </div>
            </div>
        </div>

        <button type="submit" id="generateBtn">Generate Speech & Subtitles</button>
    </form>

    <div id="result" class="result">
        <h2>Result</h2>
        <div id="audioContainer"></div>
        <div id="subtitlesContainer"></div>
    </div>

    <div id="error" class="error" style="display: none;"></div>

    <script>
        const form = document.getElementById('ttsForm');
        const resultDiv = document.getElementById('result');
        const audioContainer = document.getElementById('audioContainer');
        const subtitlesContainer = document.getElementById('subtitlesContainer');
        const errorDiv = document.getElementById('error');
        const generateBtn = document.getElementById('generateBtn');

        /**
         * Call OpenAI-compatible LLM endpoint to optimize text for TTS (client-side)
         */
        async function optimizeTextForTTS(text, apiKey, endpoint) {
            const systemPrompt = \`You are a text optimization specialist for Text-to-Speech (TTS) systems. Your task is to transform input text into speech-friendly format while preserving meaning and naturalness.

OPTIMIZATION RULES:
1. Character & Symbol Replacement:
   - Replace @ with "at", & with "and", # with "number"
   - Convert % to "percent", $ to "dollars"
   - Replace / with "slash" or "or" depending on context
   - Convert common emojis to their spoken equivalents
   - Spell out unusual Unicode characters

2. Abbreviations & Acronyms:
   - Expand common abbreviations: "Dr." → "Doctor", "St." → "Street"
   - For known acronyms (NASA, FBI), keep uppercase if commonly spoken as word
   - For unknown acronyms, add spaces: "TBD" → "T B D"
   - Context-aware: "re:" → "regarding", "w/" → "with", "vs" → "versus"

3. Lists & Formatting:
   - Convert bullet points to natural prose with "first, second, third" or "including"
   - Transform numbered lists into flowing sentences
   - Replace markdown/formatting with plain text equivalents
   - Keep the logical structure but make it conversational

4. Numbers & Dates:
   - Keep numbers as digits (TTS handles these well)
   - Format phone numbers with spaces: "555-1234" → "555 1234"
   - Years stay numeric: "2024" not "two thousand twenty-four"

5. Punctuation & Flow:
   - Add commas for natural breathing pauses
   - Convert multiple exclamation marks to single
   - Replace ellipsis (...) with period or comma
   - Remove excessive capitalization (unless proper nouns)

6. Preserve:
   - Original meaning and intent
   - Proper nouns and brand names
   - Technical terms when appropriate
   - Sentence boundaries and paragraphs

OUTPUT: Return ONLY the optimized text, no explanations or comments.\`;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': \`Bearer \${apiKey}\`,
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: text }
                    ],
                    temperature: 0.3,
                    max_tokens: 2000,
                }),
            });

            if (!response.ok) {
                throw new Error(\`LLM API request failed: \${response.status} \${response.statusText}\`);
            }

            const data = await response.json();
            const optimizedText = data.choices?.[0]?.message?.content?.trim();
            
            if (!optimizedText) {
                throw new Error('LLM API returned invalid response: no content');
            }

            return optimizedText;
        }

        /**
         * Call OpenAI-compatible LLM endpoint to add SSML markup (client-side)
         */
        async function addSSMLMarkup(text, apiKey, endpoint) {
            const systemPrompt = \`You are an SSML (Speech Synthesis Markup Language) expert. Add appropriate SSML markup to enhance natural speech synthesis.

SSML GUIDELINES:

1. BREAK Tags (Pauses):
   - After sentences: <break time="500ms"/> or <break strength="medium"/>
   - After commas in lists: <break time="200ms"/>
   - Before important information: <break strength="strong"/>
   - Between paragraphs: <break time="800ms"/>
   - Use strength="weak|medium|strong|x-strong" OR time="[duration]ms"

2. EMPHASIS Tags:
   - Strong emphasis for crucial words: <emphasis level="strong">critical</emphasis>
   - Moderate for important points: <emphasis level="moderate">important</emphasis>
   - Reduced for parentheticals: <emphasis level="reduced">aside</emphasis>
   - Don't overuse - max 2-3 per sentence

3. SAY-AS Tags (Critical for accuracy):
   - Dates: <say-as interpret-as="date" format="mdy">01/15/2024</say-as>
   - Times: <say-as interpret-as="time" format="hms12">2:30pm</say-as>
   - Numbers: <say-as interpret-as="cardinal">123</say-as>
   - Ordinals: <say-as interpret-as="ordinal">1st</say-as>
   - Phone: <say-as interpret-as="telephone">555-1234</say-as>
   - Currency: <say-as interpret-as="currency">$50.00</say-as>
   - Spell-out: <say-as interpret-as="characters">FBI</say-as>

4. PROSODY Tags (Use sparingly):
   - Slow down for complex info: <prosody rate="slow">technical term</prosody>
   - Speed up for parentheticals: <prosody rate="fast">aside</prosody>
   - Lower pitch for seriousness: <prosody pitch="-10%">warning</prosody>
   - Raise pitch for excitement: <prosody pitch="+15%">great news</prosody>
   - Adjust volume: <prosody volume="soft|medium|loud">text</prosody>

5. SELF-CLOSING Tags:
   - ALWAYS use self-closing format: <break time="300ms"/>
   - NEVER use: <break time="300ms"></break>
   - This applies to: <break/> tags only

6. TAG NESTING Rules:
   - CORRECT: <emphasis><prosody rate="slow">text</prosody></emphasis>
   - WRONG: <emphasis><prosody>text</emphasis></prosody>
   - All tags must be properly nested and closed

7. Best Practices:
   - Less is more - don't over-annotate
   - Focus on places where TTS typically struggles
   - Prioritize natural flow over perfect markup
   - Keep the original text intact
   - Test mental reading - if it sounds natural, you're done

HEURISTICS TO APPLY:
- Questions: Add slight upward pitch at end
- Exclamations: Add emphasis + medium break after
- Commas in sentences: Add short breaks (200ms)
- Colons/semicolons: Add medium breaks (400ms)
- Periods: Add medium-strong breaks (500ms)
- Multi-digit numbers: Use say-as cardinal/ordinal
- Dates/times: Always use say-as tags
- Acronyms (2-4 caps): Use say-as characters
- Lists: Add breaks between items

OUTPUT FORMAT:
- Must start with <speak> and end with </speak>
- Must be valid, well-formed SSML
- NO explanations, comments, or extra text
- Preserve all original text content

EXAMPLE:
Input: "Meeting on 1/15 at 2pm. This is VERY important!"
Output: <speak>Meeting on <say-as interpret-as="date" format="md">1/15</say-as> at <say-as interpret-as="time">2pm</say-as>.<break time="500ms"/> This is <emphasis level="strong">very important</emphasis>!</speak>\`;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': \`Bearer \${apiKey}\`,
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: text }
                    ],
                    temperature: 0.2,
                    max_tokens: 3000,
                }),
            });

            if (!response.ok) {
                throw new Error(\`LLM API request failed: \${response.status} \${response.statusText}\`);
            }

            const data = await response.json();
            let ssmlText = data.choices?.[0]?.message?.content?.trim();
            
            if (!ssmlText) {
                throw new Error('LLM API returned invalid response: no content');
            }

            // Validate SSML structure
            if (!ssmlText.startsWith('<speak>') || !ssmlText.endsWith('</speak>')) {
                throw new Error('LLM API returned invalid SSML: must be wrapped in <speak> tags');
            }

            // Basic validation: check for unbalanced tags (excluding self-closing tags)
            const selfClosingTags = (ssmlText.match(/<[a-z]+[^>]*\\/>/gi) || []).length;
            const openTags = (ssmlText.match(/<([a-z]+)(\\s|>)/gi) || []).length - selfClosingTags;
            const closeTags = (ssmlText.match(/<\\/[a-z]+>/gi) || []).length;
            if (openTags !== closeTags) {
                throw new Error('LLM API returned invalid SSML: unbalanced tags detected');
            }

            return ssmlText;
        }

        // Load LLM settings from LocalStorage on page load
        document.addEventListener('DOMContentLoaded', () => {
            const llmEndpoint = localStorage.getItem('llm_endpoint');
            const llmApiKey = localStorage.getItem('llm_api_key');
            const enableLLM = localStorage.getItem('enable_llm') === 'true';
            const optimizeForTTS = localStorage.getItem('optimize_for_tts') === 'true';
            const addSSMLMarkup = localStorage.getItem('add_ssml_markup') === 'true';

            if (llmEndpoint) document.getElementById('llmEndpoint').value = llmEndpoint;
            if (llmApiKey) document.getElementById('llmApiKey').value = llmApiKey;
            document.getElementById('enableLLM').checked = enableLLM;
            document.getElementById('optimizeForTTS').checked = optimizeForTTS;
            document.getElementById('addSSMLMarkup').checked = addSSMLMarkup;

            if (enableLLM) {
                document.getElementById('llmContent').classList.add('active');
            }
        });

        // Toggle LLM settings visibility
        function toggleLLMSettings() {
            const checkbox = document.getElementById('enableLLM');
            const content = document.getElementById('llmContent');
            content.classList.toggle('active');
            if (!content.classList.contains('active')) {
                checkbox.checked = false;
            } else {
                checkbox.checked = true;
            }
        }

        // Save LLM settings to LocalStorage when values change
        document.getElementById('llmEndpoint').addEventListener('change', (e) => {
            localStorage.setItem('llm_endpoint', e.target.value);
        });

        document.getElementById('llmApiKey').addEventListener('change', (e) => {
            localStorage.setItem('llm_api_key', e.target.value);
        });

        document.getElementById('enableLLM').addEventListener('change', (e) => {
            localStorage.setItem('enable_llm', e.target.checked);
            const content = document.getElementById('llmContent');
            if (e.target.checked) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });

        document.getElementById('optimizeForTTS').addEventListener('change', (e) => {
            localStorage.setItem('optimize_for_tts', e.target.checked);
        });

        document.getElementById('addSSMLMarkup').addEventListener('change', (e) => {
            localStorage.setItem('add_ssml_markup', e.target.checked);
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Hide previous results and errors
            resultDiv.classList.remove('show');
            errorDiv.style.display = 'none';
            
            // Disable button and show loading state
            generateBtn.disabled = true;
            generateBtn.textContent = 'Generating...';
            
            let text = document.getElementById('text').value;
            const voice = document.getElementById('voice').value;
            const format = document.getElementById('format').value;
            const rate = document.getElementById('rate').value;
            const pitch = document.getElementById('pitch').value;
            const volume = document.getElementById('volume').value;
            
            try {
                // Client-side LLM preprocessing if enabled
                const enableLLM = document.getElementById('enableLLM').checked;
                if (enableLLM) {
                    const llmEndpoint = document.getElementById('llmEndpoint').value;
                    const llmApiKey = document.getElementById('llmApiKey').value;
                    const optimizeForTTS = document.getElementById('optimizeForTTS').checked;
                    const addSSMLMarkup = document.getElementById('addSSMLMarkup').checked;

                    if (!llmEndpoint || !llmApiKey) {
                        errorDiv.textContent = 'Error: LLM endpoint and API key are required when LLM preprocessing is enabled';
                        errorDiv.style.display = 'block';
                        generateBtn.disabled = false;
                        generateBtn.textContent = 'Generate Speech & Subtitles';
                        return;
                    }

                    // Step 1: Optimize text for TTS if requested (client-side)
                    if (optimizeForTTS) {
                        generateBtn.textContent = 'Optimizing text...';
                        text = await optimizeTextForTTS(text, llmApiKey, llmEndpoint);
                    }

                    // Step 2: Add SSML markup if requested (client-side)
                    if (addSSMLMarkup) {
                        generateBtn.textContent = 'Adding SSML markup...';
                        const ssmlText = await addSSMLMarkup(text, llmApiKey, llmEndpoint);
                        // Use raw_ssml to send the SSML directly to the TTS API
                        // Build request body with raw_ssml
                        const requestBody = {
                            input: text,
                            voice: voice,
                            subtitle_format: format,
                            raw_ssml: ssmlText
                        };

                        generateBtn.textContent = 'Generating speech...';
                        const response = await fetch('/v1/audio/speech_subtitles', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(requestBody)
                        });
                        
                        if (!response.ok) {
                            const error = await response.json();
                            throw new Error(error.message || 'Request failed');
                        }
                        
                        const data = await response.json();
                        
                        // Display results
                        displayResults(data);
                        return;
                    }
                }

                // Build request body (without LLM parameters)
                const requestBody = {
                    input: text,
                    voice: voice,
                    subtitle_format: format,
                    rate: rate || undefined,
                    pitch: pitch || undefined,
                    volume: volume || undefined
                };
            
                generateBtn.textContent = 'Generating speech...';
                const response = await fetch('/v1/audio/speech_subtitles', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody)
                });
                
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Request failed');
                }
                
                const data = await response.json();
                
                // Display results
                displayResults(data);
                
            } catch (error) {
                errorDiv.textContent = 'Error: ' + (error && error.message ? error.message : String(error));
                errorDiv.style.display = 'block';
            } finally {
                generateBtn.disabled = false;
                generateBtn.textContent = 'Generate Speech & Subtitles';
            }
        });

        function displayResults(data) {
            // Convert base64 to blob for audio playback
            const audioBlob = base64ToBlob(data.audio_content_base64, 'audio/mpeg');
            const audioUrl = URL.createObjectURL(audioBlob);
            
            // Display audio player
            audioContainer.innerHTML = '<h3>🔊 Audio</h3>' +
                '<audio controls src="' + audioUrl + '"></audio>' +
                '<p><a href="' + audioUrl + '" download="speech.mp3">Download MP3</a></p>';
            
            // Display subtitles
            subtitlesContainer.innerHTML = '<h3>📝 Subtitles (' + data.subtitle_format.toUpperCase() + ')</h3>' +
                '<pre>' + escapeHtml(data.subtitle_content) + '</pre>';
            
            resultDiv.classList.add('show');
        }
        
        function base64ToBlob(base64, contentType) {
            const byteCharacters = atob(base64);
            const byteArrays = [];
            
            for (let i = 0; i < byteCharacters.length; i++) {
                byteArrays.push(byteCharacters.charCodeAt(i));
            }
            
            const byteArray = new Uint8Array(byteArrays);
            return new Blob([byteArray], { type: contentType });
        }
        
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    </script>
</body>
</html>`;
