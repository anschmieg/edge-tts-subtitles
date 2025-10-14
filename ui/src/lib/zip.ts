import JSZip from 'jszip';
import { base64ToBlob } from './workerClient';

/**
 * Download audio and subtitle as a ZIP file
 */
export async function downloadZip(
  audioBase64: string,
  subtitleContent: string,
  subtitleFormat: 'srt' | 'vtt',
  zipFilename = 'speech-subtitles.zip'
): Promise<void> {
  const zip = new JSZip();
  
  // Add audio file
  const audioBlob = base64ToBlob(audioBase64);
  zip.file('speech.mp3', audioBlob);
  
  // Add subtitle file
  zip.file(`subtitles.${subtitleFormat}`, subtitleContent);
  
  // Generate ZIP and download
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = zipFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
