import { useEffect, useRef, useCallback } from 'react';

// Jawline — 8 points clés uniquement
const JAWLINE = [234, 172, 150, 152, 379, 397, 454];
// Yeux — 4 coins seulement
const LEFT_EYE  = [33, 159, 133, 145];
const RIGHT_EYE = [362, 386, 263, 374];
// Sourcils — 3 pts
const LEFT_BROW  = [70, 105, 107];
const RIGHT_BROW = [336, 334, 300];

type FaceMeshGlobal = {
  FaceMesh: new (opts: object) => {
    setOptions(opts: object): void;
    onResults(cb: (results: { multiFaceLandmarks?: { x: number; y: number; z: number }[][] }) => void): void;
    send(input: { image: HTMLVideoElement }): Promise<void>;
    close(): void;
  };
};

declare global {
  interface Window extends FaceMeshGlobal {}
}

function connectLine(
  ctx: CanvasRenderingContext2D,
  landmarks: { x: number; y: number }[],
  indices: number[],
  color: string,
  vw: number,
  vh: number,
  closed = false,
) {
  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;
  const scale = Math.max(cw / vw, ch / vh);
  const ox = (cw - vw * scale) / 2;
  const oy = (ch - vh * scale) / 2;

  ctx.strokeStyle = color;
  ctx.lineWidth = 0.8;
  ctx.globalAlpha = 0.5;
  ctx.shadowColor = color;
  ctx.shadowBlur = 3;
  const pts = indices
    .map((idx) => landmarks[idx])
    .filter(Boolean)
    .map((lm) => ({
      x: cw - (lm.x * vw * scale + ox),
      y: lm.y * vh * scale + oy,
    }));
  if (pts.length < 2) return;

  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last.x, last.y);
  if (closed) ctx.closePath();
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

function drawDots(
  ctx: CanvasRenderingContext2D,
  landmarks: { x: number; y: number }[],
  indices: number[],
  color: string,
  radius: number,
  vw: number,
  vh: number,
) {
  // object-fit: cover transform: scale video to fill canvas, centered
  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;
  const scale = Math.max(cw / vw, ch / vh);
  const ox = (cw - vw * scale) / 2;
  const oy = (ch - vh * scale) / 2;

  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  for (const idx of indices) {
    const lm = landmarks[idx];
    if (!lm) continue;
    // landmark coords normalized [0,1] → video pixels → display pixels
    const rawX = lm.x * vw * scale + ox;
    const y = lm.y * vh * scale + oy;
    // mirror to match CSS scaleX(-1) on the video
    const x = cw - rawX;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}


async function loadFaceMesh(): Promise<InstanceType<FaceMeshGlobal['FaceMesh']>> {
  if (!window.FaceMesh) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js';
      script.crossOrigin = 'anonymous';
      script.onload = () => resolve();
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  const faceMesh = new window.FaceMesh({
    locateFile: (file: string) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
  });
  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  return faceMesh;
}

export function useFaceMesh(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  active: boolean,
) {
  const faceMeshRef = useRef<Awaited<ReturnType<typeof loadFaceMesh>> | null>(null);
  const rafRef = useRef<number>(0);
  const runningRef = useRef(false);

  const drawFrame = useCallback(
    async (faceMesh: Awaited<ReturnType<typeof loadFaceMesh>>) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;
      // canvas resolution = displayed container size (not native camera res)
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      await faceMesh.send({ image: video });
    },
    [videoRef, canvasRef],
  );

  useEffect(() => {
    if (!active) {
      runningRef.current = false;
      cancelAnimationFrame(rafRef.current);
      return;
    }

    let cancelled = false;

    (async () => {
      const faceMesh = await loadFaceMesh();
      if (cancelled) { faceMesh.close(); return; }
      faceMeshRef.current = faceMesh;

      faceMesh.onResults((results) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const faces = results.multiFaceLandmarks;
        if (!faces || faces.length === 0) return;

        const lm = faces[0];
        const video = videoRef.current;
        if (!video) return;
        const vw = video.videoWidth || video.clientWidth;
        const vh = video.videoHeight || video.clientHeight;

        connectLine(ctx, lm, JAWLINE, '#ff2222', vw, vh, false);
        connectLine(ctx, lm, LEFT_EYE, '#ff3333', vw, vh, true);
        connectLine(ctx, lm, RIGHT_EYE, '#ff3333', vw, vh, true);
        connectLine(ctx, lm, LEFT_BROW, '#ff4444', vw, vh, false);
        connectLine(ctx, lm, RIGHT_BROW, '#ff4444', vw, vh, false);
        drawDots(ctx, lm, JAWLINE, '#ff2222', 3, vw, vh);
        drawDots(ctx, lm, LEFT_EYE, '#ff3333', 2, vw, vh);
        drawDots(ctx, lm, RIGHT_EYE, '#ff3333', 2, vw, vh);
      });

      runningRef.current = true;

      const loop = async () => {
        if (!runningRef.current || cancelled) return;
        await drawFrame(faceMesh);
        rafRef.current = requestAnimationFrame(loop);
      };

      // Wait for video to be ready
      const startLoop = () => {
        if (cancelled) return;
        rafRef.current = requestAnimationFrame(loop);
      };

      const video = videoRef.current;
      if (video && video.readyState >= 2) {
        startLoop();
      } else if (video) {
        video.addEventListener('loadeddata', startLoop, { once: true });
      }
    })();

    return () => {
      cancelled = true;
      runningRef.current = false;
      cancelAnimationFrame(rafRef.current);
      faceMeshRef.current?.close();
      faceMeshRef.current = null;
    };
  }, [active, drawFrame, videoRef, canvasRef]);
}
