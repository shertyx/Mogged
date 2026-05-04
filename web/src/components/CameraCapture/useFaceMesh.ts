import { useEffect, useRef, useCallback } from 'react';

// MediaPipe Face Mesh landmark indices
const JAWLINE = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
const LEFT_EYE = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const RIGHT_EYE = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];

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

function drawDots(
  ctx: CanvasRenderingContext2D,
  landmarks: { x: number; y: number }[],
  indices: number[],
  color: string,
  radius: number,
  mirrored: boolean,
  w: number,
) {
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  for (const idx of indices) {
    const lm = landmarks[idx];
    if (!lm) continue;
    const x = mirrored ? w - lm.x * w : lm.x * w;
    const y = lm.y * ctx.canvas.height;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

function connectDots(
  ctx: CanvasRenderingContext2D,
  landmarks: { x: number; y: number }[],
  indices: number[],
  color: string,
  mirrored: boolean,
  w: number,
  closed = false,
) {
  const pts = indices.map((idx) => {
    const lm = landmarks[idx];
    const x = mirrored ? w - lm.x * w : lm.x * w;
    const y = lm.y * ctx.canvas.height;
    return { x, y };
  });
  if (pts.length < 2) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;
  ctx.globalAlpha = 0.55;
  ctx.shadowColor = color;
  ctx.shadowBlur = 4;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  if (closed) ctx.closePath();
  ctx.stroke();
  ctx.globalAlpha = 1;
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
      canvas.width = video.videoWidth || video.clientWidth;
      canvas.height = video.videoHeight || video.clientHeight;
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
        const w = canvas.width;

        // Video is mirrored via CSS scaleX(-1), so we flip x coords to match display
        connectDots(ctx, lm, JAWLINE, 'rgba(249,115,22,0.9)', true, w, false);
        drawDots(ctx, lm, JAWLINE, 'rgba(249,115,22,1)', 1.8, true, w);

        connectDots(ctx, lm, LEFT_EYE, 'rgba(96,165,250,0.9)', true, w, true);
        drawDots(ctx, lm, LEFT_EYE, 'rgba(96,165,250,1)', 1.5, true, w);

        connectDots(ctx, lm, RIGHT_EYE, 'rgba(96,165,250,0.9)', true, w, true);
        drawDots(ctx, lm, RIGHT_EYE, 'rgba(96,165,250,1)', 1.5, true, w);
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
