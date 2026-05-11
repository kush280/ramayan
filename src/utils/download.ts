import { toPng } from 'html-to-image';

export const downloadImage = async (elementId: string, filename: string): Promise<boolean> => {
  const node = document.getElementById(elementId);
  if (!node) return false;
  try {
    const dataUrl = await toPng(node, { quality: 1.0, pixelRatio: 2, style: { transform: 'scale(1)' } });
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
    return true;
  } catch (err) {
    console.error('Failed to generate image', err);
    return false;
  }
};

// Store the audio source node globally so we only create it once
let _audioSourceNode: MediaElementAudioSourceNode | null = null;
let _audioCtx: AudioContext | null = null;

export const downloadVideo = async (
  elementId: string,
  filename: string,
  onProgress: (progress: number) => void,
  audioElement?: HTMLAudioElement
): Promise<boolean> => {
  const node = document.getElementById(elementId);
  if (!node) return false;

  try {
    const dataUrl = await toPng(node, { quality: 1.0, pixelRatio: 2 });

    return new Promise((resolve) => {
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = 1920;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(false); return; }

        // ── Canvas stream ──────────────────────────────────────
        const canvasStream = canvas.captureStream(30);

        // ── Audio: reuse existing source node if already created ─
        if (audioElement) {
          try {
            // Create AudioContext only once
            if (!_audioCtx || _audioCtx.state === 'closed') {
              _audioCtx = new AudioContext();
            }
            // Create source node only once per audio element
            if (!_audioSourceNode) {
              _audioSourceNode = _audioCtx.createMediaElementSource(audioElement);
              _audioSourceNode.connect(_audioCtx.destination); // keep playing to speakers
            }
            const dest = _audioCtx.createMediaStreamDestination();
            _audioSourceNode.connect(dest);
            dest.stream.getAudioTracks().forEach(t => canvasStream.addTrack(t));

            // Disconnect from recording dest after recording stops
            canvasStream.addEventListener('inactive', () => {
              try { _audioSourceNode?.disconnect(dest); } catch (_) { }
            });
          } catch (e) {
            console.warn('Audio capture skipped:', e);
          }
        }

        // ── MediaRecorder ──────────────────────────────────────
        const mimeTypes = [
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp8,opus',
          'video/webm',
        ];
        const mimeType = mimeTypes.find(m => MediaRecorder.isTypeSupported(m)) ?? 'video/webm';
        const mediaRecorder = new MediaRecorder(canvasStream, { mimeType });
        const chunks: BlobPart[] = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = `${filename}.webm`;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            URL.revokeObjectURL(url);
            document.body.removeChild(a);
          }, 1000);
          resolve(true);
        };

        // Safety net: if onstop never fires within 5s after duration ends, force resolve
        let safetyCalled = false;
        const safetyResolve = () => {
          if (!safetyCalled) {
            safetyCalled = true;
            resolve(false);
          }
        };

        mediaRecorder.start(200); // emit data every 200ms

        // ── Animation loop ──────────────────────────────────────
        const DURATION = 8000;
        const startTime = performance.now();
        let animFrame: number;
        let stopped = false;

        const particles = Array.from({ length: 55 }, () => ({
          x: Math.random() * 1080,
          y: Math.random() * 1920 - 1920,
          size: Math.random() * 18 + 8,
          speed: Math.random() * 3 + 1.5,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.08,
          color: ['#FF8C00', '#FFA500', '#FFD700', '#FF6347'][Math.floor(Math.random() * 4)],
        }));

        const stopRecording = () => {
          if (stopped) return;
          stopped = true;
          cancelAnimationFrame(animFrame);
          if (mediaRecorder.state !== 'inactive') {
            mediaRecorder.requestData(); // flush remaining data
            setTimeout(() => {
              try { mediaRecorder.stop(); } catch (_) { }
              // If onstop hasn't fired in 4 more seconds, give up
              setTimeout(safetyResolve, 4000);
            }, 300);
          } else {
            safetyResolve();
          }
        };

        const drawFrame = (now: number) => {
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / DURATION, 1);
          onProgress(Math.round(progress * 100));

          // Background
          ctx.fillStyle = '#1a0505';
          ctx.fillRect(0, 0, 1080, 1920);

          // Ken Burns zoom
          const baseScale = Math.max(1080 / img.width, 1920 / img.height);
          const zoom = 1 + progress * 0.12;
          const w = img.width * baseScale * zoom;
          const h = img.height * baseScale * zoom;
          ctx.drawImage(img, (1080 - w) / 2, (1920 - h) / 2, w, h);

          // Vignette
          const vig = ctx.createRadialGradient(540, 960, 270, 540, 960, 900);
          vig.addColorStop(0, 'rgba(0,0,0,0)');
          vig.addColorStop(1, 'rgba(0,0,0,0.5)');
          ctx.fillStyle = vig;
          ctx.fillRect(0, 0, 1080, 1920);

          // Petals
          particles.forEach(p => {
            p.y += p.speed;
            p.rotation += p.rotSpeed;
            if (p.y > 1980) { p.y = -60; p.x = Math.random() * 1080; }
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.globalAlpha = 0.75;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#8B0000';
            ctx.beginPath();
            ctx.arc(0, 0, p.size * 0.22, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.restore();
          });

          // Fade in
          if (progress < 0.07) {
            ctx.fillStyle = `rgba(0,0,0,${1 - progress / 0.07})`;
            ctx.fillRect(0, 0, 1080, 1920);
          }
          // Fade out
          if (progress > 0.9) {
            ctx.fillStyle = `rgba(0,0,0,${(progress - 0.9) / 0.1})`;
            ctx.fillRect(0, 0, 1080, 1920);
          }

          if (progress < 1) {
            animFrame = requestAnimationFrame(drawFrame);
          } else {
            stopRecording();
          }
        };

        animFrame = requestAnimationFrame(drawFrame);
      };

      img.onerror = () => resolve(false);
      img.src = dataUrl;
    });
  } catch (err) {
    console.error('Failed to generate video', err);
    return false;
  }
};