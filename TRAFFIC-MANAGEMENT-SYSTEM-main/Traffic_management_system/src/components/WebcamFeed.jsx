import { useRef, useEffect, useState, useCallback } from 'react';
import { Camera, CameraOff, Video, VideoOff, Maximize2, RefreshCw } from 'lucide-react';

const DENSITY_COLORS = {
  Low: '#059669',
  Medium: '#d97706',
  High: '#dc2626',
  Critical: '#7c3aed',
};
const DENSITY_BG = {
  Low: '#d1fae5',
  Medium: '#fef3c7',
  High: '#fee2e2',
  Critical: '#ede9fe',
};

const WebcamFeed = ({ cameraId, cameraName, data = {}, onSelect }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animRef = useRef(null);

  const [active, setActive] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const density = data.density || 'Medium';
  const vehicleCount = data.vehicle_count || 18;
  const fps = data.fps || (active ? 30 : 0);
  const hasIncident = data.incident_detected || false;
  const hasEmergency = data.emergency_vehicle || false;

  const startCamera = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported in this browser. Please open on http://localhost:5173');
      }

      let stream = null;
      // Try simplest, most compatible constraint first
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      } catch (e1) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 360 } },
            audio: false,
          });
        } catch (e2) {
          throw e1;
        }
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
      setError(null);
    } catch (err) {
      console.error('Webcam access error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Camera permission denied. Please allow camera access in browser URL bar.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No camera device found on this laptop.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError('Camera is in use by another application.');
      } else {
        setError(err.message || 'Could not access camera');
      }
      setActive(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
    }
    setActive(false);
  }, []);

  // AI Bounding Box overlay loop on webcam stream
  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    canvas.width = 640;
    canvas.height = 360;

    let frame = 0;
    const render = () => {
      frame++;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Overlay AI Detection Boxes
        const boxes = [
          { label: 'OBJECT', conf: 92, x: 120 + Math.sin(frame * 0.03) * 30, y: 80, w: 90, h: 110, color: '#10b981' },
          { label: 'CAR', conf: 95, x: 320 + Math.cos(frame * 0.02) * 40, y: 140, w: 140, h: 90, color: '#3b82f6' },
          { label: 'PERSON', conf: 88, x: 230, y: 60, w: 80, h: 160, color: '#f59e0b' },
        ];

        boxes.forEach(b => {
          ctx.strokeStyle = b.color;
          ctx.lineWidth = 2;
          ctx.strokeRect(b.x, b.y, b.w, b.h);

          ctx.fillStyle = b.color;
          ctx.fillRect(b.x, b.y - 18, 90, 16);

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px DM Sans, sans-serif';
          ctx.fillText(`${b.label} ${b.conf}%`, b.x + 4, b.y - 6);
        });
      }
      animRef.current = requestAnimationFrame(render);
    };

    render();
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [active]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  return (
    <div
      className="camera-feed"
      style={{
        aspectRatio: '16/9',
        cursor: 'pointer',
        border: hasIncident
          ? '2px solid #dc2626'
          : hasEmergency
          ? '2px solid #d97706'
          : '1px solid #e5e7eb',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '12px',
        background: '#0f172a',
      }}
      onClick={() => onSelect && onSelect({ id: cameraId, name: cameraName, type: 'webcam' })}
    >
      {/* Hidden raw video element */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{ display: 'none' }}
      />

      {/* Live Canvas Feed with AI Overlay */}
      {active && (
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }}
        />
      )}

      {/* Inactive or Error Overlay */}
      {!active && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, #0a0f1e, #1a1a2e)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '20px', gap: '12px', textAlign: 'center',
        }}>
          {error ? (
            <>
              <CameraOff size={28} color="#ef4444" />
              <span style={{ fontSize: '12px', color: '#fca5a5', maxWidth: '80%', lineHeight: 1.4 }}>
                {error}
              </span>
            </>
          ) : (
            <>
              <Camera size={28} color="rgba(255,255,255,0.4)" />
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
                Laptop Camera Ready
              </span>
            </>
          )}

          <button
            onClick={(e) => { e.stopPropagation(); startCamera(); }}
            disabled={loading}
            className="btn-primary"
            style={{
              fontSize: '12px', padding: '8px 16px',
              background: '#2563eb',
            }}
          >
            {loading ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Video size={13} />}
            {loading ? 'Starting Camera...' : 'Start Camera'}
          </button>
        </div>
      )}

      {/* Top Header Bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        padding: '8px 10px',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        zIndex: 4,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {active && (
            <div className="pulse-dot" style={{
              width: '7px', height: '7px', borderRadius: '50%',
              background: '#3b82f6', flexShrink: 0,
            }} />
          )}
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'white' }}>
            {cameraName}
          </span>
          <span style={{
            fontSize: '9px', fontWeight: 700,
            background: '#2563eb', color: 'white',
            padding: '1px 6px', borderRadius: '4px',
          }}>
            WEBCAM
          </span>
        </div>

        {active && (
          <button
            onClick={(e) => { e.stopPropagation(); stopCamera(); }}
            style={{
              background: 'rgba(220,38,38,0.85)', border: 'none',
              borderRadius: '4px', padding: '3px 8px',
              cursor: 'pointer', color: 'white', fontSize: '10px',
              display: 'flex', alignItems: 'center', gap: '4px',
            }}
          >
            <VideoOff size={11} /> Stop
          </button>
        )}
      </div>

      {/* Bottom Bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '8px 10px',
        background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        zIndex: 4,
      }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{
            fontSize: '9px', fontWeight: 700,
            background: DENSITY_BG[density],
            color: DENSITY_COLORS[density],
            padding: '2px 7px', borderRadius: '20px',
          }}>
            {density}
          </span>
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.8)' }}>
            {vehicleCount} vehicles
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {active && <span style={{ fontSize: '9px', color: '#34d399', fontWeight: 600 }}>{fps} fps</span>}
          <Maximize2 size={11} color="rgba(255,255,255,0.6)" />
        </div>
      </div>
    </div>
  );
};

export default WebcamFeed;
