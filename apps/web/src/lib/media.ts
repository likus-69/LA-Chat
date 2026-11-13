import { apiFetch } from './api';
import type { MediaAssetDto, MediaCategory } from '@la-chat/shared-types';

export async function uploadFile(
  file: File,
  category: MediaCategory,
  onProgress?: (percent: number) => void,
): Promise<{ asset: MediaAssetDto }> {
  const init = await apiFetch<{ asset: MediaAssetDto; uploadUrl: string }>('/media/init', {
    method: 'POST',
    body: JSON.stringify({
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      category,
      sizeBytes: file.size,
    }),
  });

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', init.uploadUrl, true);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      });
    }
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed: HTTP ${xhr.status}`));
    });
    xhr.addEventListener('error', () => reject(new Error('Upload network error')));
    xhr.send(file);
  });

  const confirmed = await apiFetch<MediaAssetDto>(`/media/${init.asset.id}/confirm`, { method: 'POST' });
  return { asset: confirmed };
}

export async function getDownloadUrl(assetId: string): Promise<string> {
  const asset = await apiFetch<MediaAssetDto>(`/media/${assetId}`);
  return asset.signedUrl ?? '';
}

export class VoiceRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.chunks = [];
    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType: this.getSupportedMimeType() });
    this.mediaRecorder.addEventListener('dataavailable', (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    });
    this.mediaRecorder.start();
  }

  stop(): Promise<{ blob: Blob; durationSec: number }> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) { reject(new Error('Recorder not started')); return; }
      const startTime = Date.now();
      this.mediaRecorder.addEventListener('stop', () => {
        const blob = new Blob(this.chunks, { type: this.mediaRecorder!.mimeType });
        const durationSec = Math.round((Date.now() - startTime) / 1000);
        this.cleanup();
        resolve({ blob, durationSec });
      });
      this.mediaRecorder.stop();
    });
  }

  cancel(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') this.mediaRecorder.stop();
    this.cleanup();
  }

  private cleanup(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.mediaRecorder = null;
    this.chunks = [];
  }

  private getSupportedMimeType(): string {
    const types = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg'];
    for (const t of types) { if (MediaRecorder.isTypeSupported(t)) return t; }
    return '';
  }
}

export function categoryForFile(file: File): MediaCategory {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'document';
}
