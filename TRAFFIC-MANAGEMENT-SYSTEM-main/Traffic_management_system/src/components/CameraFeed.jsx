import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, WifiOff, Maximize2, Video, VideoOff, AlertTriangle, Activity, Upload, Laptop, RefreshCw, X, Shield, Eye, Play, Pause, Siren, Flame, Building2 } from 'lucide-react';
import axios from 'axios';

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

const SCENE_PRESETS = [
  { type: 'junction', title: '4-Way Junction', lanes: 4, speed: 1.2 },
  { type: 'corridor', title: 'City Corridor', lanes: 3, speed: 1.8 },
  { type: 'highway', title: 'Highway Expressway', lanes: 4, speed: 2.5 },
  { type: 'bridge', title: 'Harbor Bridge', lanes: 2, speed: 1.5 },
];

// Emergency vehicle visual config
const EMERGENCY_TYPES = {
  AMBULANCE: { label: 'AMBULANCE', color: '#ef4444', glow: 'rgba(239,68,68,0.6)', siren: true },
  FIRE:      { label: 'FIRE ENGINE', color: '#f97316', glow: 'rgba(249,115,22,0.6)', siren: true },
  POLICE:    { label: 'POLICE', color: '#3b82f6', glow: 'rgba(59,130,246,0.6)', siren: true },
  GOV:       { label: 'GOV VEHICLE', color: '#8b5cf6', glow: 'rgba(139,92,246,0.6)', siren: false },
};

// Vehicle type color for bounding boxes
const vehicleColor = (className) => {
  if (className === 'ambulance') return '#ef4444';
  if (className === 'fire_truck' || className === 'fire') return '#f97316';
  if (className === 'police') return '#3b82f6';
  if (className === 'government' || className === 'gov') return '#8b5cf6';
  if (className === 'auto_rickshaw' || className === 'auto') return '#f59e0b';
  if (className === 'truck') return '#8b5cf6';
  if (className === 'bus') return '#f59e0b';
  if (className === 'car') return '#3b82f6';
  return '#10b981';
};

const emergencyTypeFromClass = (className) => {
  if (className === 'ambulance') return 'AMBULANCE';
  if (className === 'fire_truck' || className === 'fire') return 'FIRE';
  if (className === 'police') return 'POLICE';
  if (className === 'government' || className === 'gov') return 'GOV';
  return null;
};

const CameraFeed = ({
  camera,
  data = {},
  index = 0,
  onSelect,
  onStatsUpdate,
  onEmergencyDetected,
  initialMode = 'sim',
}) => {
  const [mode, setMode] = useState(camera?.mode === 'webcam' ? 'webcam' : (camera?.uploadedVideoUrl ? 'video' : initialMode));
  const [webcamActive, setWebcamActive] = useState(false);
  const [webcamError, setWebcamError] = useState(null);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState(camera?.uploadedVideoUrl || null);
  const [showControls, setShowControls] = useState(false);
  const [showAiBoxes, setShowAiBoxes] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);

  // Emergency state
  const [activeEmergency, setActiveEmergency] = useState(null); // { type, label } or null
  const [emergencyFlash, setEmergencyFlash] = useState(false);
  const emergencyTimerRef = useRef(null);

  // Live detection state
  const [liveCount, setLiveCount] = useState(mode === 'sim' ? (data.vehicle_count || 4) : 2);
  const [vehicleCounts, setVehicleCounts] = useState({ cars: 0, bikes: 1, autos: 1, buses: 0, trucks: 0 });

  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const webcamVideoRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);
  const fileInputRef = useRef(null);
  const lastDetectTimeRef = useRef(0);
  const isDetectingRef = useRef(false);
  const detectionsRef = useRef([
    { id: 1, class_name: 'motorcycle', confidence: 0.94, bbox: [260, 160, 360, 310] },
    { id: 2, class_name: 'auto_rickshaw', confidence: 0.91, bbox: [390, 180, 480, 260] },
  ]);

  const density = liveCount > 15 ? 'Critical' : liveCount > 7 ? 'High' : liveCount > 2 ? 'Medium' : 'Low';
  const fps = data.fps || (webcamActive ? 30 : 25.3);
  const isActive = data.active ?? true;
  const hasIncident = density === 'Critical' || data.incident_detected || false;
  const scenePreset = SCENE_PRESETS[index % SCENE_PRESETS.length];

  // Trigger emergency and notify parent
  const triggerEmergency = useCallback((type, cameraName) => {
    const cfg = EMERGENCY_TYPES[type];
    if (!cfg) return;
    setActiveEmergency({ type, ...cfg });
    if (onEmergencyDetected) {
      onEmergencyDetected({ type, cameraId: camera?.id, cameraName: cameraName || camera?.name, dirIndex: index });
    }
    // Auto-clear after 12 seconds
    clearTimeout(emergencyTimerRef.current);
    emergencyTimerRef.current = setTimeout(() => {
      setActiveEmergency(null);
      if (onEmergencyDetected) onEmergencyDetected(null);
    }, 12000);
  }, [camera, index, onEmergencyDetected]);

  // Flash effect for emergency
  useEffect(() => {
    if (!activeEmergency) return;
    const flashInterval = setInterval(() => setEmergencyFlash(f => !f), 600);
    return () => clearInterval(flashInterval);
  }, [activeEmergency]);

  // ── Laptop Webcam Access ─────────────────────────────────────
  const startWebcam = useCallback(async () => {
    setWebcamError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Webcam not supported in this browser context.');
      }
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' }, audio: false });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      streamRef.current = stream;
      if (webcamVideoRef.current) {
        webcamVideoRef.current.srcObject = stream;
        await webcamVideoRef.current.play();
      }
      setWebcamActive(true);
      setMode('webcam');
    } catch (err) {
      console.warn('Webcam error:', err);
      setWebcamError(
        err.name === 'NotAllowedError'
          ? 'Camera access blocked. Please allow permissions in browser URL bar.'
          : err.name === 'NotFoundError'
          ? 'No camera found on this device.'
          : err.message || 'Could not start camera'
      );
      setWebcamActive(false);
    }
  }, []);

  const stopWebcam = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (webcamVideoRef.current) {
      webcamVideoRef.current.srcObject = null;
    }
    setWebcamActive(false);
  }, []);

  const handleModeChange = (newMode) => {
    if (newMode === 'webcam') {
      startWebcam();
    } else {
      if (webcamActive) stopWebcam();
      setMode(newMode);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setUploadedVideoUrl(url);
      setMode('video');
      setIsPlaying(true);
      detectionsRef.current = [
        { id: 1, class_name: 'motorcycle', confidence: 0.94, bbox: [260, 160, 360, 310] },
        { id: 2, class_name: 'auto_rickshaw', confidence: 0.91, bbox: [390, 180, 480, 260] },
      ];
    }
  };

  // ── Real YOLO Inference ────────────────────────────────────
  const runYoloInference = useCallback(async (sourceVideoElement) => {
    const now = Date.now();
    if (now - lastDetectTimeRef.current < 450 || isDetectingRef.current) return;
    lastDetectTimeRef.current = now;
    isDetectingRef.current = true;

    try {
      const offCanvas = document.createElement('canvas');
      offCanvas.width = 640; offCanvas.height = 360;
      const offCtx = offCanvas.getContext('2d');
      offCtx.drawImage(sourceVideoElement, 0, 0, 640, 360);
      const dataUrl = offCanvas.toDataURL('image/jpeg', 0.65);

      const res = await axios.post('/api/cameras/detect-frame', { image: dataUrl });
      if (res.data && Array.isArray(res.data.detections)) {
        const detections = res.data.detections;
        if (detections.length > 0) {
          detectionsRef.current = detections;
          setLiveCount(detections.length);
          if (res.data.counts) {
            setVehicleCounts(res.data.counts);
            if (onStatsUpdate) onStatsUpdate({ liveCount: detections.length, vehicleCounts: res.data.counts, density });
          }
          // Check for emergency vehicles in detections
          for (const det of detections) {
            const eType = emergencyTypeFromClass(det.class_name);
            if (eType) { triggerEmergency(eType, camera?.name); break; }
          }
        }
      }
    } catch (err) {
      // Silent fail — backend may not be running
    } finally {
      isDetectingRef.current = false;
    }
  }, [density, onStatsUpdate, triggerEmergency, camera]);

  // Video mode: play on URL change
  useEffect(() => {
    if (mode === 'video' && videoRef.current && uploadedVideoUrl) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }, [mode, uploadedVideoUrl]);

  // ── Canvas Render Loop ─────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = (canvas.width = 640);
    const height = (canvas.height = 360);

    // Simulation emergency spawn state (per-render)
    let simEmergencySpawnTimer = 0;
    let currentSimEmergency = null;
    let simEmergencyVehicle = null;

    // Emergency types for simulation
    const emergencyVehicleTypes = ['AMBULANCE', 'FIRE', 'POLICE', 'GOV'];
    const emergencyVehicleColors = {
      AMBULANCE: '#ef4444',
      FIRE: '#f97316',
      POLICE: '#3b82f6',
      GOV: '#8b5cf6',
    };

    const simVehicles = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      x: (i * 140) % (width + 100) - 50,
      lane: i % scenePreset.lanes,
      speed: (1.2 + (i % 3) * 0.5) * scenePreset.speed,
      type: i % 4 === 0 ? 'BUS' : i % 3 === 0 ? 'BIKE' : i % 2 === 0 ? 'TRUCK' : 'CAR',
      conf: Math.round(88 + (i * 5) % 10),
      color: ['#3b82f6', '#10b981', '#f59e0b', '#dc2626', '#8b5cf6'][i % 5],
      dir: i % 2 === 0 ? 1 : -1,
      emergencyType: null,
    }));

    // Spawn one emergency vehicle randomly for this camera (10% chance per 300 frames)
    let frameCount = 0;
    let emergencyVehicle = null;
    let emergencySpawnTimer = Math.floor(Math.random() * 400) + 200; // first spawn between 200-600 frames

    const drawBoundingBoxes = (boxes) => {
      if (!showAiBoxes || !boxes.length) return;
      boxes.forEach(det => {
        const [x1, y1, x2, y2] = det.bbox || [];
        if (x1 === undefined) return;
        const bw = x2 - x1, bh = y2 - y1;
        const eType = emergencyTypeFromClass(det.class_name);
        const color = vehicleColor(det.class_name);

        ctx.strokeStyle = color;
        ctx.lineWidth = eType ? 3 : 2.5;
        ctx.strokeRect(x1, y1, bw, bh);

        // Corner brackets
        const clen = 8;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(x1, y1 + clen); ctx.lineTo(x1, y1); ctx.lineTo(x1 + clen, y1);
        ctx.moveTo(x1 + bw - clen, y1); ctx.lineTo(x1 + bw, y1); ctx.lineTo(x1 + bw, y1 + clen);
        ctx.moveTo(x1, y1 + bh - clen); ctx.lineTo(x1, y1 + bh); ctx.lineTo(x1 + clen, y1 + bh);
        ctx.moveTo(x1 + bw - clen, y1 + bh); ctx.lineTo(x1 + bw, y1 + bh); ctx.lineTo(x1 + bw, y1 + bh - clen);
        ctx.stroke();

        // Label
        const isAuto = det.class_name === 'auto_rickshaw' || det.class_name === 'auto';
        const label = eType
          ? `${EMERGENCY_TYPES[eType]?.label} ${Math.round((det.confidence || 0.92) * 100)}%`
          : `${isAuto ? 'AUTO' : det.class_name?.toUpperCase()} ${Math.round((det.confidence || 0.9) * 100)}%`;
        ctx.font = 'bold 10px DM Sans, sans-serif';
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = color;
        ctx.fillRect(x1, Math.max(y1 - 18, 0), tw + 10, 16);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, x1 + 5, Math.max(y1 - 6, 12));

        // Emergency siren flash effect on box
        if (eType && EMERGENCY_TYPES[eType]?.siren) {
          const t = Date.now() / 300;
          const alpha = (Math.sin(t) + 1) / 2;
          ctx.strokeStyle = color;
          ctx.lineWidth = 3;
          ctx.globalAlpha = alpha * 0.7;
          ctx.strokeRect(x1 - 3, y1 - 3, bw + 6, bh + 6);
          ctx.globalAlpha = 1;
        }
      });
    };

    const render = () => {
      frameCount++;
      ctx.clearRect(0, 0, width, height);

      if (mode === 'webcam' && webcamActive && webcamVideoRef.current) {
        if (webcamVideoRef.current.readyState >= 2) runYoloInference(webcamVideoRef.current);
        drawBoundingBoxes(detectionsRef.current);

      } else if (mode === 'video' && videoRef.current) {
        if (videoRef.current.readyState >= 2 && !videoRef.current.paused) runYoloInference(videoRef.current);
        drawBoundingBoxes(detectionsRef.current);

      } else if (mode === 'sim') {
        // ── Road background ──
        ctx.fillStyle = '#1e2430';
        ctx.fillRect(0, 0, width, height);

        const roadTop = height * 0.22;
        const roadBottom = height * 0.88;
        ctx.fillStyle = '#2b3442';
        ctx.fillRect(0, roadTop, width, roadBottom - roadTop);

        ctx.fillStyle = '#64748b';
        ctx.fillRect(0, roadTop - 4, width, 4);
        ctx.fillRect(0, roadBottom, width, 4);

        const laneHeight = (roadBottom - roadTop) / scenePreset.lanes;
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 2;
        ctx.setLineDash([20, 20]);
        for (let l = 1; l < scenePreset.lanes; l++) {
          const ly = roadTop + l * laneHeight;
          ctx.beginPath();
          ctx.moveTo(0, ly);
          ctx.lineTo(width, ly);
          ctx.stroke();
        }
        ctx.setLineDash([]);

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, width, roadTop - 4);
        ctx.fillRect(0, roadBottom + 4, width, height - roadBottom - 4);

        // ── Spawn emergency vehicle periodically ──
        if (frameCount >= emergencySpawnTimer && !emergencyVehicle) {
          const eType = emergencyVehicleTypes[index % emergencyVehicleTypes.length];
          emergencyVehicle = {
            x: -100,
            lane: 0,
            speed: scenePreset.speed * 2.5,
            emergencyType: eType,
            color: emergencyVehicleColors[eType],
            conf: 97,
            dir: 1,
          };
          triggerEmergency(eType, camera?.name);
        }

        // Clear emergency vehicle once it exits screen
        if (emergencyVehicle && emergencyVehicle.x > width + 150) {
          emergencyVehicle = null;
          emergencySpawnTimer = frameCount + Math.floor(Math.random() * 500) + 300;
          setActiveEmergency(null);
        }

        // ── Draw regular vehicles ──
        simVehicles.forEach(v => {
          if (v.dir === 1) { v.x += v.speed; if (v.x > width + 60) v.x = -80; }
          else { v.x -= v.speed; if (v.x < -80) v.x = width + 60; }

          const laneY = roadTop + v.lane * laneHeight + laneHeight * 0.2;
          const vWidth = v.type === 'BUS' ? 60 : v.type === 'TRUCK' ? 54 : v.type === 'BIKE' ? 24 : 42;
          const vHeight = v.type === 'BIKE' ? 14 : 22;

          ctx.fillStyle = v.color;
          ctx.beginPath();
          ctx.roundRect(v.x, laneY, vWidth, vHeight, 4);
          ctx.fill();

          // Window
          ctx.fillStyle = '#1e293b';
          const wx = v.dir === 1 ? v.x + vWidth - 14 : v.x + 4;
          ctx.fillRect(wx, laneY + 3, 10, vHeight - 6);

          // Headlight
          ctx.fillStyle = '#fef08a';
          const hx = v.dir === 1 ? v.x + vWidth : v.x;
          ctx.fillRect(hx - 2, laneY + 2, 3, 4);
          ctx.fillRect(hx - 2, laneY + vHeight - 6, 3, 4);

          if (showAiBoxes) {
            ctx.strokeStyle = v.color;
            ctx.lineWidth = 2;
            ctx.strokeRect(v.x - 2, laneY - 2, vWidth + 4, vHeight + 4);
            ctx.fillStyle = v.color;
            ctx.fillRect(v.x - 2, laneY - 17, 70, 14);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 9px DM Sans, sans-serif';
            ctx.fillText(`${v.type} ${v.conf}%`, v.x + 3, laneY - 7);
          }
        });

        // ── Draw emergency vehicle (on top lane, fast) ──
        if (emergencyVehicle) {
          emergencyVehicle.x += emergencyVehicle.speed;
          const ev = emergencyVehicle;
          const laneY = roadTop + 0 * laneHeight + laneHeight * 0.05;
          const evW = 66, evH = 26;

          // Siren glow
          const t = Date.now() / 250;
          const glowAlpha = (Math.sin(t) + 1) / 2;
          ctx.save();
          ctx.shadowColor = ev.color;
          ctx.shadowBlur = 20 * glowAlpha;
          ctx.fillStyle = ev.color;
          ctx.beginPath();
          ctx.roundRect(ev.x, laneY, evW, evH, 5);
          ctx.fill();
          ctx.restore();

          // Siren lights (alternating red/blue for ambulance & police)
          const sirenLeft = ev.emergencyType === 'POLICE' || ev.emergencyType === 'AMBULANCE';
          if (sirenLeft) {
            ctx.fillStyle = glowAlpha > 0.5 ? '#ef4444' : '#3b82f6';
            ctx.fillRect(ev.x + 8, laneY + 2, 10, 6);
            ctx.fillStyle = glowAlpha > 0.5 ? '#3b82f6' : '#ef4444';
            ctx.fillRect(ev.x + evW - 18, laneY + 2, 10, 6);
          } else {
            // Fire: orange/red alternating
            ctx.fillStyle = glowAlpha > 0.5 ? '#f97316' : '#ef4444';
            ctx.fillRect(ev.x + 8, laneY + 2, 12, 6);
            ctx.fillRect(ev.x + evW - 20, laneY + 2, 12, 6);
          }

          // Window
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(ev.x + evW - 16, laneY + 6, 12, evH - 12);

          // Headlight
          ctx.fillStyle = '#fef9c3';
          ctx.fillRect(ev.x + evW, laneY + 4, 4, 5);
          ctx.fillRect(ev.x + evW, laneY + evH - 9, 4, 5);

          // Label
          if (showAiBoxes) {
            const label = `${ev.emergencyType} 97%`;
            ctx.font = 'bold 10px DM Sans, sans-serif';
            const lw = ctx.measureText(label).width;
            ctx.strokeStyle = ev.color;
            ctx.lineWidth = 2.5;
            ctx.strokeRect(ev.x - 3, laneY - 3, evW + 6, evH + 6);

            // Pulsing outer ring
            ctx.globalAlpha = glowAlpha * 0.5;
            ctx.strokeStyle = ev.color;
            ctx.lineWidth = 2;
            ctx.strokeRect(ev.x - 8, laneY - 8, evW + 16, evH + 16);
            ctx.globalAlpha = 1;

            ctx.fillStyle = ev.color;
            ctx.fillRect(ev.x - 3, laneY - 19, lw + 12, 16);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(label, ev.x + 3, laneY - 7);
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [mode, webcamActive, showAiBoxes, scenePreset, runYoloInference, index, camera, triggerEmergency]);

  useEffect(() => { return () => stopWebcam(); }, [stopWebcam]);
  useEffect(() => { return () => clearTimeout(emergencyTimerRef.current); }, []);

  const togglePlay = (e) => {
    e.stopPropagation();
    if (videoRef.current) {
      if (videoRef.current.paused) { videoRef.current.play(); setIsPlaying(true); }
      else { videoRef.current.pause(); setIsPlaying(false); }
    }
  };

  // Border color: emergency > incident > normal
  const borderColor = activeEmergency
    ? (emergencyFlash ? activeEmergency.color : '#1e2430')
    : hasIncident
    ? '#dc2626'
    : '1px solid #e5e7eb';

  const borderWidth = activeEmergency ? '2.5px' : hasIncident ? '2px' : '1px';

  return (
    <div
      className="camera-feed"
      style={{
        aspectRatio: '16/9',
        cursor: 'pointer',
        border: `${borderWidth} solid ${activeEmergency ? (emergencyFlash ? activeEmergency.color : '#374151') : hasIncident ? '#dc2626' : '#e5e7eb'}`,
        boxShadow: activeEmergency
          ? `0 0 20px ${emergencyFlash ? activeEmergency.glow : 'transparent'}`
          : '0 2px 8px rgba(0,0,0,0.06)',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '12px',
        background: '#0f172a',
        transition: 'border 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
      onClick={() => onSelect && onSelect({ ...camera, liveCount, vehicleCounts, density, mode, uploadedVideoUrl, activeEmergency })}
    >
      {/* 1. Webcam Video */}
      {mode === 'webcam' && (
        <video
          ref={webcamVideoRef}
          autoPlay muted playsInline
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
            display: webcamActive ? 'block' : 'none',
          }}
        />
      )}

      {/* 2. Uploaded Video */}
      {mode === 'video' && uploadedVideoUrl && (
        <video
          ref={videoRef}
          src={uploadedVideoUrl}
          autoPlay loop muted playsInline
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}

      {/* 3. AI Canvas Overlay */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />

      {/* Webcam Error */}
      {mode === 'webcam' && webcamError && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(15,23,42,0.95)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '16px', gap: '10px', zIndex: 5,
        }}>
          <VideoOff size={28} color="#ef4444" />
          <div style={{ fontSize: '12px', color: '#fca5a5', textAlign: 'center', lineHeight: 1.5, maxWidth: '200px' }}>
            {webcamError}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); startWebcam(); }}
            style={{
              background: '#2563eb', color: 'white', border: 'none',
              borderRadius: '8px', padding: '7px 16px', fontSize: '12px',
              cursor: 'pointer', fontWeight: 600,
            }}
          >
            Retry Camera
          </button>
        </div>
      )}

      {/* Webcam Loading */}
      {mode === 'webcam' && !webcamActive && !webcamError && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(15,23,42,0.9)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: '10px', zIndex: 5,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            border: '3px solid #2563eb', borderTopColor: 'transparent',
            animation: 'spin 0.8s linear infinite',
          }} />
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>Starting camera…</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Emergency Banner */}
      {activeEmergency && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
          background: emergencyFlash
            ? `linear-gradient(90deg, ${activeEmergency.color}cc, ${activeEmergency.color}44)`
            : 'rgba(0,0,0,0.7)',
          padding: '5px 10px',
          display: 'flex', alignItems: 'center', gap: 6,
          transition: 'background 0.2s',
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: emergencyFlash ? 'white' : activeEmergency.color,
            boxShadow: `0 0 8px ${activeEmergency.color}`,
          }} />
          <span style={{ fontSize: 10, fontWeight: 800, color: 'white', letterSpacing: '0.5px' }}>
            ⚡ {activeEmergency.label} DETECTED — SIGNAL PRIORITY
          </span>
        </div>
      )}

      {/* Top Bar (below emergency banner if active) */}
      <div style={{
        position: 'absolute',
        top: activeEmergency ? 28 : 0,
        left: 0, right: 0,
        padding: '8px 10px',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.75), transparent)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        zIndex: 4,
        transition: 'top 0.2s',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div className="pulse-dot" style={{
            width: '7px', height: '7px', borderRadius: '50%',
            background: mode === 'webcam' ? '#3b82f6' : '#10b981', flexShrink: 0,
          }} />
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'white', letterSpacing: '0.3px' }}>
            {camera?.name || `CAM ${String(index + 1).padStart(2, '0')}`}
          </span>
          <span style={{
            fontSize: '9px', fontWeight: 700,
            background: mode === 'webcam' ? '#2563eb' : mode === 'video' ? '#d97706' : '#059669',
            color: 'white', padding: '1px 6px', borderRadius: '4px', textTransform: 'uppercase',
          }}>
            {mode === 'webcam' ? 'Laptop Cam' : mode === 'video' ? 'Video File' : 'AI Simulation'}
          </span>
        </div>

        {/* Hover Controls */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {showControls && (
            <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.6)', padding: '2px 4px', borderRadius: '6px' }}>
              {mode === 'video' && (
                <button
                  onClick={togglePlay}
                  style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '4px', padding: '3px 6px', color: 'white', cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px' }}
                >
                  {isPlaying ? <Pause size={11} /> : <Play size={11} />}
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); handleModeChange(mode === 'webcam' ? 'sim' : 'webcam'); }}
                title={mode === 'webcam' ? 'Back to Simulation' : 'Use Laptop Webcam'}
                style={{ background: mode === 'webcam' ? '#2563eb' : 'transparent', border: 'none', borderRadius: '4px', padding: '3px 6px', color: 'white', cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px' }}
              >
                <Laptop size={11} /> {mode === 'webcam' ? 'Live' : 'Webcam'}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                title="Upload Video File"
                style={{ background: mode === 'video' ? '#d97706' : 'transparent', border: 'none', borderRadius: '4px', padding: '3px 6px', color: 'white', cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px' }}
              >
                <Upload size={11} /> Video
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setShowAiBoxes(!showAiBoxes); }}
                title="Toggle AI Boxes"
                style={{ background: showAiBoxes ? '#059669' : 'transparent', border: 'none', borderRadius: '4px', padding: '3px 6px', color: 'white', cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px' }}
              >
                <Eye size={11} /> AI
              </button>
            </div>
          )}

          <input type="file" accept="video/*" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} />

          {hasIncident && !activeEmergency && (
            <span style={{ fontSize: '9px', fontWeight: 700, background: '#dc2626', color: 'white', padding: '2px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <AlertTriangle size={9} /> INCIDENT
            </span>
          )}
        </div>
      </div>

      {/* Bottom Status Bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '8px 10px',
        background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        zIndex: 4,
      }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{
            fontSize: '10px', fontWeight: 700,
            background: activeEmergency ? '#111827' : DENSITY_BG[density],
            color: activeEmergency ? activeEmergency.color : DENSITY_COLORS[density],
            padding: '2px 8px', borderRadius: '20px',
            border: activeEmergency ? `1px solid ${activeEmergency.color}` : 'none',
          }}>
            {activeEmergency ? `⚡ ${activeEmergency.label}` : `${density} Density`}
          </span>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
            {liveCount} {liveCount === 1 ? 'vehicle' : 'vehicles'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '10px', color: '#34d399', fontWeight: 600 }}>{fps} fps</span>
          <Maximize2 size={12} color="rgba(255,255,255,0.6)" />
        </div>
      </div>
    </div>
  );
};

export default CameraFeed;
