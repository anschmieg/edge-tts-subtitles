# Edge TTS Subtitles - Web UI

A production-quality, static-hostable single-page web application for the Edge TTS Subtitles service. This UI provides a beautiful, accessible interface for generating speech with synchronized subtitles, with optional client-side LLM preprocessing.

## Features

- 🎨 **Modern, Responsive UI** - Built with React + Material UI, mobile-first design
- 🎤 **Voice Selection** - Prefilled with example voices and demo playback
- 🎛️ **Prosody Controls** - Rate, pitch, and volume controls with presets
- 🤖 **Client-Side LLM Preprocessing** - Optional text optimization and SSML generation (your API keys stay in your browser)
- 📝 **Interactive Transcript** - Real-time word-level highlighting with click-to-seek functionality
- 🎵 **Audio Player** - Native HTML5 player with keyboard shortcuts
- 💾 **Download Options** - Download audio, subtitles, or both as ZIP
- 🧪 **Mock Mode** - Test the UI offline without the worker
- ♿ **Accessible** - ARIA attributes, keyboard navigation, and focus management

## Quick Start

### Development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the development server:

   ```bash
   npm run dev
   ```

3. Open <http://localhost:5173> in your browser

### Production Build

1. Build for production:

   ```bash
   npm run build
   ```

2. Preview the production build:

   ```bash
   npm run preview
   ```

3. Deploy the `dist/` folder to any static hosting service (Cloudflare Pages, Netlify, Vercel, etc.)

## Configuration

### Worker Base URL

The worker base URL can be configured via environment variable:

```bash
# .env.local
VITE_WORKER_BASE_URL=http://edge-tts-subtitles.s-x.workers.dev
```

Default: `http://localhost:8787` (for local development)

### Mock Mode

Enable mock mode in the UI to test without the worker. This uses canned demo data and allows you to test all UI features offline.

## Testing with the Worker

### Local Development

1. Start the worker in a separate terminal:

   ```bash
   cd ..
   wrangler dev
   ```

2. Start the UI dev server:

   ```bash
   npm run dev
   ```

3. The UI will connect to the worker at `http://localhost:8787`

### End-to-End Testing

1. Test speech generation without LLM preprocessing
2. Enable mock mode to test UI features offline
3. Test LLM preprocessing with a real API key (optional)
4. Test all download options (MP3, SRT/VTT, ZIP)
5. Test keyboard shortcuts (Space = play/pause, ← → = seek ±5s)
6. Test on mobile devices for responsive layout

## Client-Side LLM Preprocessing

**IMPORTANT SECURITY NOTE**: The UI performs all LLM calls directly from the browser. Your LLM API keys and endpoints are NEVER sent to the worker. This is enforced by the architecture.

### How It Works

1. User enables "Client-side LLM preprocessing" in the UI
2. User provides their LLM endpoint (must be HTTPS) and API key
3. User selects preprocessing options:
   - **Optimize for TTS**: Converts text to speech-friendly format
   - **Add SSML markup**: Adds SSML tags for natural pronunciation
4. When generating speech:
   - The browser calls the LLM API directly with the system prompts below
   - The LLM response is validated (plain text or SSML)
   - The processed text is sent to the worker (without API keys)

### System Prompts

#### Optimize-for-TTS

```text
You are a text optimization assistant for Text-to-Speech (TTS). Convert the user input into a speech-friendly, natural-sounding form while preserving meaning and proper nouns.

Rules:
- Replace common symbols with spoken equivalents (e.g. '@' -> 'at', '&' -> 'and', '%' -> 'percent', '$' -> 'dollars').
- Expand common abbreviations (e.g. 'Dr.' -> 'Doctor', 'St.' -> 'Street').
- Convert lists and bullets into natural prose, adding commas or connectors as needed.
- Normalize phone numbers and dates to readable forms where appropriate.
- Preserve meaning and proper nouns. Do not invent facts.
Return ONLY the optimized text — no explanation or metadata.
```

#### Add-SSML-Markup

```text
You are an SSML author. Given plain text, add minimal, well-formed SSML to make speech sound natural. Output MUST start with <speak> and end with </speak> and contain only valid SSML tags.

Guidelines:
- Use <break time="...ms"/> or <break strength="..."/> for natural pauses (200ms for commas, 400ms for semicolons, 500ms for sentences).
- Use <emphasis level="moderate|strong"> sparingly for important words.
- Use <say-as interpret-as="date|time|cardinal|ordinal|telephone|currency|characters"> for dates/times/numbers/acronyms.
- Self-close empty tags and ensure correct nesting.
Return ONLY the SSML document — no explanation or metadata.
```

### CORS Considerations

When calling LLM APIs from the browser, you may encounter CORS issues. Most LLM providers support CORS for browser-based applications. If you encounter CORS errors:

1. Check if your LLM provider supports CORS
2. Consider using a CORS proxy for development (NOT for production)
3. Use mock mode to test UI features without LLM calls

### Security

- LLM endpoint validation requires `https://` (no HTTP allowed)
- API keys are stored only in component state (never persisted)
- API keys are NEVER sent to the worker
- All LLM calls include a 15-second timeout via AbortController
- SSML responses are validated for well-formed tags

## Architecture

### Project Structure

```text
ui/
├── src/
│   ├── components/
│   │   ├── VoiceSelector.tsx       # Voice selection with demo playback
│   │   ├── ProsodyControls.tsx     # Rate/pitch/volume controls
│   │   ├── LLMPreprocessing.tsx    # LLM preprocessing panel
│   │   ├── ResultPanel.tsx         # Audio player + subtitle viewer
│   │   └── TranscriptPlayer.tsx    # Interactive transcript with word highlighting
│   ├── lib/
│   │   ├── workerClient.ts         # Worker API client
│   │   ├── llmClient.ts            # LLM API client with validation
│   │   ├── subtitle.ts             # Subtitle parser and renderer
│   │   └── zip.ts                  # ZIP download utility
│   ├── constants.ts                # Configuration and system prompts
│   ├── theme.ts                    # Material UI theme configuration
│   ├── App.tsx                     # Main application component
│   ├── main.tsx                    # React entry point
│   └── index.css                   # Global styles
├── index.html                      # HTML entry point
├── package.json                    # Dependencies and scripts
├── tsconfig.json                   # TypeScript configuration
├── vite.config.ts                  # Vite configuration
└── README.md                       # This file
```

### Key Libraries

- **React 18** - UI framework
- **Material UI (MUI)** - React component library with dark theme
- **Emotion** - CSS-in-JS styling solution (MUI dependency)
- **Vite** - Build tool and dev server
- **srt-parser-2** - SRT subtitle parsing
- **JSZip** - ZIP file generation

### Networking Flow

1. **Normal Flow**:
   - User submits form
   - Optional: Browser calls LLM API for preprocessing
   - Browser POSTs to `/v1/audio/speech_subtitles` on worker
   - Worker returns JSON with `audio_content_base64` and `subtitle_content`
   - UI decodes base64 → Blob → Object URL for playback

2. **Mock Flow**:
   - User enables mock mode
   - UI uses canned payload (see `src/constants.ts`)
   - All UI features work without worker or LLM

## Interactive Transcript

### Features

The `TranscriptPlayer` component provides a sophisticated transcript viewing experience:

- **Real-time word highlighting** - The currently spoken word is visually highlighted as audio plays
- **Click-to-seek** - Click any word to jump to that moment in the audio
- **Smooth auto-scrolling** - Active words automatically scroll into view
- **Responsive design** - Optimized for both mobile and desktop
- **Dark theme integration** - Seamlessly matches the app's dark theme

### Implementation Details

The transcript player uses the existing subtitle parsing infrastructure:

1. **Subtitle Parsing**: Parses SRT/VTT files into cues using `srt-parser-2`
2. **Word Timing Approximation**: Uses `approximateWordTimings()` to split each cue into individual words with estimated timestamps
3. **Real-time Tracking**: Listens to the audio `timeupdate` event to track current playback position
4. **Visual Highlighting**: Applies MUI theme colors to highlight the active word
5. **Interactive Seeking**: Handles click events on words to update audio `currentTime`

### Word-Level Timestamps

**Current**: The component uses an approximation algorithm that divides each subtitle cue's duration evenly among its words. This provides a reasonable approximation for real-time highlighting.

**Future Enhancement**: When the worker provides actual word-level timestamps, update the `parseSubtitles()` function in `subtitle.ts` to use the precise timings instead of approximations. The UI component is already designed to handle this data format with no changes needed.

### Component API

```tsx
<TranscriptPlayer
  audioRef={audioRef}        // Ref to the HTML audio element
  cues={cues}                // Parsed subtitle cues
  currentTime={currentTime}  // Current playback time in seconds
/>
```

## Accessibility

- Semantic HTML with proper heading hierarchy
- ARIA attributes for interactive elements
- Keyboard navigation (Tab, Space, Arrow keys)
- Focus styles on all interactive elements
- High-contrast color scheme
- Responsive text sizing
- Screen reader friendly

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- ES2020+ JavaScript features
- Native audio playback
- Fetch API with AbortController
- Base64 decoding

## Deployment

### Cloudflare Pages

1. Build the project: `npm run build`
2. Deploy `dist/` folder to Cloudflare Pages
3. Set environment variable `VITE_WORKER_BASE_URL` to your worker URL

### Netlify

1. Build command: `npm run build`
2. Publish directory: `dist`
3. Set environment variable `VITE_WORKER_BASE_URL` to your worker URL

### Vercel

1. Build command: `npm run build`
2. Output directory: `dist`
3. Set environment variable `VITE_WORKER_BASE_URL` to your worker URL

## Troubleshooting

### Worker Connection Issues

- Ensure the worker is running (`wrangler dev` or deployed)
- Check the worker base URL in the console
- Enable mock mode to test UI without worker

### LLM Preprocessing Issues

- Verify endpoint starts with `https://`
- Check API key is correct
- Watch browser console for CORS errors
- Use "Test LLM" button to validate configuration
- Enable mock mode to bypass LLM calls

### Audio Playback Issues

- Check browser console for decoding errors
- Verify base64 audio data is valid
- Try a different browser
- Check audio format support (MP3)

## Development Notes

- TypeScript strict mode enabled
- ESLint and Prettier recommended
- Hot module replacement (HMR) in dev mode
- Source maps enabled in development
- Production build uses tree-shaking and minification

## Contributing

1. Follow existing code style and structure
2. Add TypeScript types for all new code
3. Test on multiple browsers and devices
4. Update README for new features
5. Keep dependencies minimal

## License

This project is open source and available under the MIT License.
