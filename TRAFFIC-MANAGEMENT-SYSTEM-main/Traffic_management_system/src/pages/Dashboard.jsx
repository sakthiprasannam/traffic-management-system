import { useState, useEffect, useRef, useCallback } from 'react';
import { Car, Camera, AlertTriangle, Activity, ChevronRight, RefreshCw, TrendingUp, CheckCircle, Wifi, Laptop, Upload, Play, Shield, X, Eye, Siren, Flame, Building2, Zap } from 'lucide-react';
import CameraFeed from '../components/CameraFeed';
import AlertBadge from '../components/AlertBadge';
import TrafficSignal, { EMERGENCY_CONFIG, DIRECTIONS } from '../components/TrafficSignal';
import { VehicleLineChart, DensityBarChart } from '../components/TrafficChart';
import { useTrafficWebSocket } from '../hooks/useWebSocket';

const generateTimeData = () => {
  const data = [];
  const now = new Date();
  for (let i = 19; i >= 0; i--) {
    const t = new Date(now - i * 30000);
    data.push({
      time: t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      cars: Math.floor(Math.random() * 40 + 20),
      bikes: Math.floor(Math.random() * 20 + 5),
      buses: Math.floor(Math.random() * 10 + 2),
      trucks: Math.floor(Math.random() * 8 + 1),
    });
  }
  return data;
};

const StatCard = ({ icon: Icon, label, value, subValue, color, iconBg }) => (
  <div className="glass-card fade-in" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
    <div style={{
      width: '48px', height: '48px', borderRadius: '12px', flexShrink: 0,
      background: iconBg || '#f3f4f6',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon size={22} color={color} strokeWidth={1.8} />
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: '26px', fontWeight: 700, color: '#111827', lineHeight: 1, letterSpacing: '-0.5px' }}>
        {value}
      </div>
      {subValue && (
        <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>{subValue}</div>
      )}
    </div>
  </div>
);

const DEFAULT_CAMERAS = [
  { id: '1', camera_id: 'CAM01', name: 'CAM 01 — North Junction', location: 'North Gate',    dir: 'North' },
  { id: '2', camera_id: 'CAM02', name: 'CAM 02 — East Corridor',  location: 'East Ave',      dir: 'East'  },
  { id: '3', camera_id: 'CAM03', name: 'CAM 03 — South Highway',  location: 'Highway S4',    dir: 'South' },
  { id: '4', camera_id: 'CAM04', name: 'CAM 04 — West Bridge',    location: 'Bridge W2',     dir: 'West'  },
];

const EMERGENCY_ALERT_TEMPLATES = {
  AMBULANCE: (cam) => ({ severity: 'ambulance', message: '🚑 Ambulance Detected', camera_name: cam, description: 'Emergency vehicle detected — Signal override active. All other lanes halted.', timestamp: new Date().toISOString() }),
  FIRE:      (cam) => ({ severity: 'fire',      message: '🚒 Fire Engine Detected', camera_name: cam, description: 'Fire engine approaching — Signal override active. Clear the intersection.', timestamp: new Date().toISOString() }),
  POLICE:    (cam) => ({ severity: 'police',    message: '🚔 Police Vehicle Detected', camera_name: cam, description: 'Police vehicle detected — Priority clearance granted.', timestamp: new Date().toISOString() }),
  GOV:       (cam) => ({ severity: 'gov',       message: '🏛️ Government Vehicle Detected', camera_name: cam, description: 'Official government vehicle — Priority signal override.', timestamp: new Date().toISOString() }),
};

const Dashboard = () => {
  const [chartData, setChartData] = useState(generateTimeData);
  const [selectedCam, setSelectedCam] = useState(null);
  const [globalCamMode, setGlobalCamMode] = useState('sim'); // 'sim' | 'webcam'
  const [dismissedAlerts, setDismissedAlerts] = useState([]);
  const [emergencyOverride, setEmergencyOverride] = useState(null); // { dirIndex, type, camera }
  const [emergencyAlerts, setEmergencyAlerts] = useState([]);
  const [currentSignalDir, setCurrentSignalDir] = useState('North');
  const chartTimer = useRef(null);
  const emergencyAlertIdRef = useRef(1000);

  const { trafficData, connected } = useTrafficWebSocket();

  // Update chart over time
  useEffect(() => {
    chartTimer.current = setInterval(() => {
      setChartData(prev => {
        const now = new Date();
        const liveTotal = trafficData?.stats?.total_vehicles;
        const newPoint = {
          time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          cars:   Math.floor(liveTotal ? liveTotal * 0.55 : Math.random() * 40 + 20),
          bikes:  Math.floor(liveTotal ? liveTotal * 0.20 : Math.random() * 20 + 5),
          buses:  Math.floor(liveTotal ? liveTotal * 0.12 : Math.random() * 10 + 2),
          trucks: Math.floor(liveTotal ? liveTotal * 0.13 : Math.random() * 8 + 1),
        };
        return [...prev.slice(-19), newPoint];
      });
    }, 3000);
    return () => clearInterval(chartTimer.current);
  }, [trafficData]);

  // Handle emergency detected from any camera
  const handleEmergencyDetected = useCallback((emergencyInfo) => {
    if (!emergencyInfo) {
      // Clear override
      setEmergencyOverride(null);
      return;
    }
    const { type, cameraId, cameraName, dirIndex } = emergencyInfo;
    setEmergencyOverride({ dirIndex, type, camera: cameraName });

    // Add emergency alert to panel
    const template = EMERGENCY_ALERT_TEMPLATES[type];
    if (template) {
      const newAlert = { ...template(cameraName), id: ++emergencyAlertIdRef.current };
      setEmergencyAlerts(prev => [newAlert, ...prev.slice(0, 4)]);
    }
  }, []);

  // Merge live alerts with emergency alerts
  const baseAlerts = trafficData?.alerts?.length
    ? trafficData.alerts
    : [
        { id: 1, severity: 'critical',  message: 'Traffic congestion detected', camera_name: 'CAM 03', description: 'Vehicle count exceeded critical threshold (>60)', timestamp: new Date().toISOString() },
        { id: 2, severity: 'high',      message: 'Stopped vehicle detected',    camera_name: 'CAM 03', description: 'Possible incident on South Highway', timestamp: new Date(Date.now() - 120000).toISOString() },
        { id: 3, severity: 'warning',   message: 'High density detected',       camera_name: 'CAM 02', description: 'Vehicle count high on East Corridor', timestamp: new Date(Date.now() - 240000).toISOString() },
        { id: 4, severity: 'info',      message: 'Camera back online',          camera_name: 'CAM 01', timestamp: new Date(Date.now() - 360000).toISOString() },
      ];

  const rawAlerts = [...emergencyAlerts, ...baseAlerts];
  const activeAlerts = rawAlerts.filter(a => !dismissedAlerts.includes(a.id || a.message));
  const dismissAlert = (id) => setDismissedAlerts(prev => [...prev, id]);

  // Density bar data
  const densityBarData = DEFAULT_CAMERAS.map(cam => {
    const liveCam = trafficData?.cameras?.[cam.camera_id] || trafficData?.cameras?.[cam.id];
    return {
      camera: cam.name.split('—')[0].trim(),
      vehicles: liveCam?.vehicle_count || (cam.id === '1' ? 42 : cam.id === '2' ? 28 : cam.id === '3' ? 67 : 12),
      density: liveCam?.density || (cam.id === '3' ? 'Critical' : cam.id === '1' ? 'High' : cam.id === '2' ? 'Medium' : 'Low'),
    };
  });

  const totalVehicles  = trafficData?.stats?.total_vehicles  || densityBarData.reduce((s, d) => s + d.vehicles, 0);
  const activeCamsCount = trafficData?.stats?.active_cameras || 4;
  const peakDensity    = trafficData?.stats?.avg_density     || 'Critical';

  // Emergency vehicle count stat
  const activeEmergencyCount = emergencyAlerts.filter(a => !dismissedAlerts.includes(a.id)).length;

  return (
    <div className="page-body">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', letterSpacing: '-0.3px' }}>
            Traffic Dashboard
          </h1>
          <p style={{ fontSize: '13px', color: '#9ca3af', marginTop: '3px' }}>
            Real-time AI-powered traffic monitoring · Emergency priority & 4-way signal control
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {emergencyOverride && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              fontSize: '12px', color: '#ef4444',
              background: '#fee2e2', border: '1px solid #fca5a5',
              borderRadius: '20px', padding: '5px 12px', fontWeight: 700,
              animation: 'emergencyPulse 1s infinite',
            }}>
              <Siren size={13} />
              ⚡ EMERGENCY OVERRIDE — {emergencyOverride.type}
            </div>
          )}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            fontSize: '12px',
            color: connected ? '#059669' : '#d97706',
            background: connected ? '#d1fae5' : '#fef3c7',
            border: `1px solid ${connected ? '#a7f3d0' : '#fde68a'}`,
            borderRadius: '20px', padding: '5px 12px', fontWeight: 600,
          }}>
            <div className={connected ? 'pulse-dot' : ''} style={{ width: '7px', height: '7px', borderRadius: '50%', background: connected ? '#059669' : '#d97706' }} />
            {connected ? 'Live API Connected' : 'Demo Active'}
          </div>
          <button className="btn-secondary" style={{ fontSize: '12px' }}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <StatCard icon={Car}           label="Total Vehicles"    value={totalVehicles}         subValue="Live detection count"  color="#2563eb" iconBg="#eff6ff" />
        <StatCard icon={Camera}        label="Active Cameras"    value={`${activeCamsCount}/4`} subValue="All streams online"   color="#059669" iconBg="#d1fae5" />
        <StatCard icon={Siren}         label="Emergency Vehicles" value={activeEmergencyCount || 0} subValue="Priority signal active" color="#ef4444" iconBg="#fee2e2" />
        <StatCard icon={Activity}      label="Peak Density"      value={peakDensity}           subValue="CAM 03 — South Hwy"   color="#dc2626" iconBg="#fee2e2" />
      </div>

      {/* Main Grid: Cameras + Signal + Alerts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '18px', marginBottom: '18px' }}>

        {/* Left: Camera Grid */}
        <div className="glass-card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <div className="section-header" style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <Camera size={15} color="#2563eb" strokeWidth={2} />
                Live Camera Feeds & AI Detection
              </div>
              <div className="section-subheader">Hover over any camera to switch to Laptop Webcam or upload video</div>
            </div>

            {/* Global Mode Switcher */}
            <div style={{ display: 'flex', gap: '6px', background: '#f3f4f6', padding: '3px', borderRadius: '9px' }}>
              <button
                onClick={() => setGlobalCamMode('sim')}
                style={{
                  padding: '5px 10px', borderRadius: '7px', fontSize: '11px', fontWeight: 600,
                  cursor: 'pointer', border: 'none',
                  background: globalCamMode === 'sim' ? 'white' : 'transparent',
                  color: globalCamMode === 'sim' ? '#111827' : '#6b7280',
                  boxShadow: globalCamMode === 'sim' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  display: 'flex', alignItems: 'center', gap: '4px',
                }}
              >
                <Play size={11} /> AI Simulation
              </button>
              <button
                onClick={() => setGlobalCamMode('webcam')}
                style={{
                  padding: '5px 10px', borderRadius: '7px', fontSize: '11px', fontWeight: 600,
                  cursor: 'pointer', border: 'none',
                  background: globalCamMode === 'webcam' ? '#2563eb' : 'transparent',
                  color: globalCamMode === 'webcam' ? 'white' : '#6b7280',
                  boxShadow: globalCamMode === 'webcam' ? '0 1px 3px rgba(37,99,235,0.3)' : 'none',
                  display: 'flex', alignItems: 'center', gap: '4px',
                }}
              >
                <Laptop size={11} /> Use My Laptop Camera
              </button>
            </div>
          </div>

          {/* 2×2 Camera Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {DEFAULT_CAMERAS.map((cam, i) => {
              const liveData = trafficData?.cameras?.[cam.camera_id] || trafficData?.cameras?.[cam.id] || {
                active: true,
                density: i === 2 ? 'Critical' : i === 0 ? 'High' : i === 1 ? 'Medium' : 'Low',
                vehicle_count: i === 2 ? 67 : i === 0 ? 42 : i === 1 ? 28 : 12,
                fps: 24,
              };

              return (
                <CameraFeed
                  key={cam.id}
                  camera={cam}
                  data={liveData}
                  index={i}
                  initialMode={globalCamMode === 'webcam' && i === 0 ? 'webcam' : 'sim'}
                  onSelect={setSelectedCam}
                  onEmergencyDetected={handleEmergencyDetected}
                />
              );
            })}
          </div>

          {/* Webcam hint */}
          {globalCamMode === 'webcam' && (
            <div style={{
              marginTop: 12, padding: '8px 12px', borderRadius: 8,
              background: '#eff6ff', border: '1px solid #bfdbfe',
              fontSize: 11, color: '#2563eb', fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Laptop size={12} />
              CAM 01 is using your laptop camera. Hover any camera → click <strong>Webcam</strong> to switch individual feeds.
            </div>
          )}
        </div>

        {/* Right: Signal + Alerts stacked */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* 4-Way Traffic Signal */}
          <TrafficSignal
            emergencyOverride={emergencyOverride}
            onPhaseChange={(dir, emergencyType) => setCurrentSignalDir(dir)}
          />

          {/* Live Alerts Panel */}
          <div className="glass-card" style={{ padding: '18px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div className="section-header" style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <AlertTriangle size={15} color="#d97706" strokeWidth={2} />
                Live Alerts
              </div>
              <span style={{
                background: activeEmergencyCount > 0 ? '#fee2e2' : '#f3f4f6',
                color: activeEmergencyCount > 0 ? '#dc2626' : '#6b7280',
                border: `1px solid ${activeEmergencyCount > 0 ? '#fca5a5' : '#e5e7eb'}`,
                borderRadius: '20px', padding: '2px 9px',
                fontSize: '11px', fontWeight: 700,
              }}>
                {activeAlerts.length}
              </span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: '260px' }}>
              {activeAlerts.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '12px', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle size={28} color="#059669" strokeWidth={1.5} />
                  <span>No active alerts</span>
                </div>
              ) : (
                activeAlerts.map((alert, idx) => (
                  <AlertBadge key={alert.id || idx} alert={alert} onDismiss={dismissAlert} />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Emergency Vehicle Legend */}
      <div className="glass-card" style={{ padding: '14px 18px', marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#374151', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Zap size={13} color="#f59e0b" /> Emergency Vehicle Priority System
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {[
              { icon: Siren, label: 'Ambulance', color: '#ef4444', bg: '#fee2e2' },
              { icon: Flame, label: 'Fire Engine', color: '#f97316', bg: '#fff7ed' },
              { icon: Shield, label: 'Police', color: '#3b82f6', bg: '#eff6ff' },
              { icon: Building2, label: 'Government', color: '#8b5cf6', bg: '#f5f3ff' },
            ].map(({ icon: Icon, label, color, bg }) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                background: bg, border: `1px solid ${color}44`,
                borderRadius: '20px', padding: '4px 10px',
                fontSize: '11px', fontWeight: 600, color,
              }}>
                <Icon size={11} /> {label}
              </div>
            ))}
            <div style={{ fontSize: '11px', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '4px' }}>
              → Auto-detected → Signal override → All other lanes pause
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
        <div className="glass-card" style={{ padding: '18px' }}>
          <div style={{ marginBottom: '14px' }}>
            <div className="section-header" style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <TrendingUp size={15} color="#2563eb" strokeWidth={2} />
              Vehicle Flow — Real-time
            </div>
            <div className="section-subheader">Vehicle types over last 10 minutes</div>
          </div>
          <div style={{ height: '200px' }}>
            <VehicleLineChart data={chartData} />
          </div>
        </div>

        <div className="glass-card" style={{ padding: '18px' }}>
          <div style={{ marginBottom: '14px' }}>
            <div className="section-header" style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <Activity size={15} color="#7c3aed" strokeWidth={2} />
              Lane Density by Camera
            </div>
            <div className="section-subheader">Current vehicle counts per lane · {currentSignalDir} side is OPEN</div>
          </div>
          <div style={{ height: '200px' }}>
            <DensityBarChart data={densityBarData} />
          </div>
        </div>
      </div>

      {/* Camera Inspection Modal */}
      {selectedCam && (
        <div className="modal-overlay" onClick={() => setSelectedCam(null)}>
          <div className="modal-content" style={{ width: '700px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#111827' }}>
                  {selectedCam.name} — Live Inspection
                </h3>
                <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
                  Real-time YOLOv8 vehicle detection · Emergency vehicle priority tracking
                </p>
              </div>
              <button
                onClick={() => setSelectedCam(null)}
                style={{ background: '#f3f4f6', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', color: '#6b7280' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
              <CameraFeed
                camera={selectedCam}
                data={trafficData?.cameras?.[selectedCam.camera_id] || {}}
                index={Number(selectedCam.id || 1) - 1}
                onStatsUpdate={(stats) => setSelectedCam(prev => ({ ...prev, ...stats }))}
                onEmergencyDetected={handleEmergencyDetected}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
              {[
                { label: 'Cars',           count: String(selectedCam.vehicleCounts?.cars  || 0), color: '#2563eb', bg: '#eff6ff' },
                { label: 'Bikes / Scooters',count: String(selectedCam.vehicleCounts?.bikes || 0), color: '#059669', bg: '#d1fae5' },
                { label: 'Auto Rickshaws', count: String(selectedCam.vehicleCounts?.autos  || 0), color: '#d97706', bg: '#fef3c7' },
                { label: 'Buses / Trucks', count: String((selectedCam.vehicleCounts?.buses || 0) + (selectedCam.vehicleCounts?.trucks || 0)), color: '#7c3aed', bg: '#ede9fe' },
              ].map(item => (
                <div key={item.label} style={{ background: item.bg, padding: '12px', borderRadius: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: item.color, fontWeight: 600 }}>{item.label}</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#111827', marginTop: '2px' }}>{item.count}</div>
                </div>
              ))}
            </div>

            {selectedCam.activeEmergency && (
              <div style={{
                marginTop: 12, padding: '10px 14px', borderRadius: 10,
                background: '#fee2e2', border: '2px solid #fca5a5',
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 12, fontWeight: 700, color: '#dc2626',
              }}>
                <Siren size={14} />
                ⚡ {selectedCam.activeEmergency.label} detected on this camera — Signal priority granted!
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes emergencyPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.85; transform: scale(1.02); }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
