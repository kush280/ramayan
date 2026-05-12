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
        const CANVAS_W = 1080;
        const CANVAS_H = 1920;

        const canvas = document.createElement('canvas');
        canvas.width = CANVAS_W;
        canvas.height = CANVAS_H;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(false); return; }

        // ── Compute "contain" fit so the full card is always visible ──
        // 5% horizontal padding, 10% vertical padding so card never touches edges
        const PAD_X = CANVAS_W * 0.05;
        const PAD_Y = CANVAS_H * 0.10;
        const maxW = CANVAS_W - PAD_X * 2;
        const maxH = CANVAS_H - PAD_Y * 2;
        const containScale = Math.min(maxW / img.width, maxH / img.height);
        const baseW = img.width * containScale;
        const baseH = img.height * containScale;
        const baseX = (CANVAS_W - baseW) / 2;
        const baseY = (CANVAS_H - baseH) / 2;

        // ── Canvas stream ──────────────────────────────────────
        const canvasStream = canvas.captureStream(30);

        // ── Audio: reuse existing source node if already created ─
        if (audioElement) {
          try {
            if (!_audioCtx || _audioCtx.state === 'closed') {
              _audioCtx = new AudioContext();
            }
            if (!_audioSourceNode) {
              _audioSourceNode = _audioCtx.createMediaElementSource(audioElement);
              _audioSourceNode.connect(_audioCtx.destination);
            }
            const dest = _audioCtx.createMediaStreamDestination();
            _audioSourceNode.connect(dest);
            dest.stream.getAudioTracks().forEach(t => canvasStream.addTrack(t));
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

        let safetyCalled = false;
        const safetyResolve = () => {
          if (!safetyCalled) { safetyCalled = true; resolve(false); }
        };

        mediaRecorder.start(200);

        // ── Animation loop ──────────────────────────────────────
        const DURATION = 16000;
        const startTime = performance.now();
        let animFrame: number;
        let stopped = false;

        const particles = Array.from({ length: 55 }, () => ({
          x: Math.random() * CANVAS_W,
          y: Math.random() * CANVAS_H - CANVAS_H,
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
            mediaRecorder.requestData();
            setTimeout(() => {
              try { mediaRecorder.stop(); } catch (_) { }
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

          // ── Decorative background: warm saffron-maroon gradient ──
          const bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
          bgGrad.addColorStop(0, '#2a0a00');
          bgGrad.addColorStop(0.4, '#5a1a00');
          bgGrad.addColorStop(0.7, '#3d0e00');
          bgGrad.addColorStop(1, '#1a0505');
          ctx.fillStyle = bgGrad;
          ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

          // Radial glow behind card
          const glow = ctx.createRadialGradient(CANVAS_W / 2, CANVAS_H / 2, 100, CANVAS_W / 2, CANVAS_H / 2, 700);
          glow.addColorStop(0, 'rgba(255,160,0,0.18)');
          glow.addColorStop(0.5, 'rgba(180,60,0,0.10)');
          glow.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = glow;
          ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

          // ── Ken Burns: gentle 6% zoom, fully contained — nothing cropped ──
          const zoom = 1 + progress * 0.06;
          const w = baseW * zoom;
          const h = baseH * zoom;
          const x = baseX + (baseW - w) / 2;
          const y = baseY + (baseH - h) / 2;

          // Drop shadow behind card
          ctx.save();
          ctx.shadowColor = 'rgba(0,0,0,0.65)';
          ctx.shadowBlur = 60;
          ctx.drawImage(img, x, y, w, h);
          ctx.restore();

          // ── Vignette ──
          const vig = ctx.createRadialGradient(CANVAS_W / 2, CANVAS_H / 2, 300, CANVAS_W / 2, CANVAS_H / 2, 950);
          vig.addColorStop(0, 'rgba(0,0,0,0)');
          vig.addColorStop(1, 'rgba(0,0,0,0.55)');
          ctx.fillStyle = vig;
          ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

          // ── Falling petals ──
          particles.forEach(p => {
            p.y += p.speed;
            p.rotation += p.rotSpeed;
            if (p.y > CANVAS_H + 60) { p.y = -60; p.x = Math.random() * CANVAS_W; }
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

          // ── Fade in ──
          if (progress < 0.07) {
            ctx.fillStyle = `rgba(0,0,0,${1 - progress / 0.07})`;
            ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
          }
          // ── Fade out ──
          if (progress > 0.9) {
            ctx.fillStyle = `rgba(0,0,0,${(progress - 0.9) / 0.1})`;
            ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
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