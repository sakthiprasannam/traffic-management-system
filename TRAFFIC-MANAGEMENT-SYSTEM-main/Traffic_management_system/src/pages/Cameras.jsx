import { useState, useRef } from 'react';
import { Camera, Plus, Edit2, Trash2, Wifi, WifiOff, Upload, X, Video, Settings, Laptop, CheckCircle, Circle } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import WebcamFeed from '../components/WebcamFeed';
import CameraFeed from '../components/CameraFeed';

const INITIAL_CAMERAS = [
  { id: '1', camera_id: 'CAM01', name: 'CAM 01 — North Junction', location: 'North Gate', ip: '192.168.1.101', status: 'online', mode: 'demo', fps: 24, demo_video: '/uploads/cam01_junction.mp4' },
  { id: '2', camera_id: 'CAM02', name: 'CAM 02 — East Corridor', location: 'East Ave', ip: '192.168.1.102', status: 'online', mode: 'demo', fps: 24, demo_video: '/uploads/cam02_corridor.mp4' },
  { id: '3', camera_id: 'CAM03', name: 'CAM 03 — South Highway', location: 'Highway S4', ip: '192.168.1.103', status: 'online', mode: 'demo', fps: 22, demo_video: '/uploads/cam03_highway.mp4' },
  { id: '4', camera_id: 'CAM04', name: 'CAM 04 — West Bridge', location: 'Bridge W2', ip: '192.168.1.104', status: 'offline', mode: 'live', fps: 0, demo_video: null },
];

const DEMO_DATA = {
  '1': { active: true, density: 'High', vehicle_count: 42, fps: 24 },
  '2': { active: true, density: 'Medium', vehicle_count: 28, fps: 24 },
  '3': { active: true, density: 'Critical', vehicle_count: 67, fps: 22 },
  '4': { active: false, density: 'Low', vehicle_count: 0, fps: 0 },
};

// ── Camera Modal ────────────────────────────────────────────────────
const CameraModal = ({ camera, onClose, onSave }) => {
  const [form, setForm] = useState(camera || {
    name: '', location: '', ip: '', mode: 'demo', fps: 24, status: 'offline', demo_video: null
  });
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const fileRef = useRef(null);

  const handleChange = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) setUploadFile(file);
  };

  const handleUpload = async () => {
    if (!uploadFile || !form.camera_id) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      const res = await axios.post(`/api/cameras/${form.camera_id}/upload-demo`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      handleChange('demo_video', res.data.path);
      toast.success('Video uploaded successfully');
    } catch {
      toast.error('Upload failed — make sure camera is saved first');
    }
    setUploading(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...form, id: form.id || String(Date.now()), camera_id: form.camera_id || `CAM${Date.now().toString().slice(-4)}` });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>
              {camera ? 'Edit Camera' : 'Add Camera'}
            </h3>
            <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
              {camera ? 'Update camera configuration' : 'Configure a new monitoring camera'}
            </p>
          </div>
          <button onClick={onClose} style={{ background: '#f3f4f6', border: 'none', cursor: 'pointer', color: '#6b7280', borderRadius: '7px', padding: '6px', display: 'flex' }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {[
            { key: 'name', label: 'Camera Name', placeholder: 'e.g. CAM 01 — North Junction' },
            { key: 'location', label: 'Location', placeholder: 'e.g. North Gate Intersection' },
            { key: 'ip', label: 'IP Address / RTSP URL', placeholder: 'e.g. 192.168.1.101 or rtsp://...' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>
                {label}
              </label>
              <input
                className="input-dark"
                value={form[key] || ''}
                onChange={e => handleChange(key, e.target.value)}
                placeholder={placeholder}
              />
            </div>
          ))}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>
                Mode
              </label>
              <select
                className="input-dark"
                value={form.mode}
                onChange={e => handleChange('mode', e.target.value)}
                style={{ cursor: 'pointer' }}
              >
                <option value="live">Live Camera</option>
                <option value="demo">Demo Video</option>
                <option value="webcam">Laptop Webcam</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>
                Target FPS
              </label>
              <input
                className="input-dark"
                type="number"
                min={1} max={60}
                value={form.fps}
                onChange={e => handleChange('fps', Number(e.target.value))}
              />
            </div>
          </div>

          {/* Demo video upload */}
          {form.mode === 'demo' && (
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '8px' }}>
                Demo Video File
              </label>
              {form.demo_video ? (
                <div style={{
                  background: '#f0fdf4', border: '1px solid #bbf7d0',
                  borderRadius: '9px', padding: '12px 14px',
                  display: 'flex', alignItems: 'center', gap: '10px',
                }}>
                  <CheckCircle size={16} color="#059669" />
                  <span style={{ fontSize: '12px', color: '#065f46', fontWeight: 500, flex: 1 }}>
                    Video loaded
                  </span>
                  <button
                    type="button"
                    onClick={() => { setUploadFile(null); handleChange('demo_video', null); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div style={{
                  border: '2px dashed #e5e7eb', borderRadius: '10px',
                  padding: '20px 16px', textAlign: 'center',
                  background: '#f9fafb',
                }}>
                  <Video size={22} color="#9ca3af" style={{ margin: '0 auto 8px' }} />
                  <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '10px' }}>
                    {uploadFile ? uploadFile.name : 'Upload MP4, AVI, or MOV file'}
                  </p>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    <input
                      type="file"
                      accept="video/*"
                      ref={fileRef}
                      onChange={handleFileChange}
                      style={{ display: 'none' }}
                      id="vidUpload"
                    />
                    <label htmlFor="vidUpload" className="btn-secondary" style={{ cursor: 'pointer', fontSize: '12px' }}>
                      <Upload size={13} /> Choose File
                    </label>
                    {uploadFile && camera?.camera_id && (
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={handleUpload}
                        disabled={uploading}
                        style={{ fontSize: '12px' }}
                      >
                        {uploading ? 'Uploading...' : 'Upload'}
                      </button>
                    )}
                  </div>
                  {uploadFile && !camera?.camera_id && (
                    <p style={{ fontSize: '10px', color: '#9ca3af', marginTop: '8px' }}>
                      Save the camera first, then upload video
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {form.mode === 'webcam' && (
            <div style={{
              background: '#eff6ff', border: '1px solid #bfdbfe',
              borderRadius: '10px', padding: '12px 14px',
              display: 'flex', alignItems: 'center', gap: '10px',
            }}>
              <Laptop size={16} color="#2563eb" />
              <span style={{ fontSize: '12px', color: '#1d4ed8', fontWeight: 500 }}>
                Your laptop camera will be used as the feed source
              </span>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button type="button" className="btn-secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
            <button type="submit" className="btn-primary" style={{ flex: 1 }}>
              {camera ? 'Save Changes' : 'Add Camera'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main Page ───────────────────────────────────────────────────────
const Cameras = () => {
  const [cameras, setCameras] = useState(INITIAL_CAMERAS);
  const [modal, setModal] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'grid'

  const handleSave = (cam) => {
    setCameras(prev => {
      const idx = prev.findIndex(c => c.id === cam.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = cam;
        return updated;
      }
      return [...prev, cam];
    });
    toast.success(cam.id ? 'Camera updated' : 'Camera added');
  };

  const handleDelete = (id) => {
    setCameras(prev => prev.filter(c => c.id !== id));
    toast.success('Camera removed');
  };

  const toggleStatus = (id) => {
    setCameras(prev => prev.map(c =>
      c.id === id ? { ...c, status: c.status === 'online' ? 'offline' : 'online' } : c
    ));
  };

  const handleAddWebcam = () => {
    const newCam = {
      id: String(Date.now()),
      camera_id: `WEB${Date.now().toString().slice(-4)}`,
      name: `Webcam — Laptop Camera`,
      location: 'Local Device',
      ip: 'localhost',
      status: 'online',
      mode: 'webcam',
      fps: 30,
      demo_video: null,
    };
    setCameras(prev => [...prev, newCam]);
    toast.success('Laptop webcam added');
  };

  const online = cameras.filter(c => c.status === 'online').length;
  const offline = cameras.filter(c => c.status === 'offline').length;
  const demoMode = cameras.filter(c => c.mode === 'demo').length;
  const webcams = cameras.filter(c => c.mode === 'webcam').length;

  return (
    <div className="page-body">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', letterSpacing: '-0.3px' }}>
            Camera Management
          </h1>
          <p style={{ fontSize: '13px', color: '#9ca3af', marginTop: '3px' }}>
            Configure and manage traffic monitoring cameras
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn-secondary"
            onClick={handleAddWebcam}
            style={{ fontSize: '13px' }}
          >
            <Laptop size={15} /> Use Laptop Camera
          </button>
          <button className="btn-primary" onClick={() => setModal('add')}>
            <Plus size={15} /> Add Camera
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Total Cameras', value: cameras.length, color: '#2563eb', bg: '#eff6ff', icon: Camera },
          { label: 'Online', value: online, color: '#059669', bg: '#d1fae5', icon: Wifi },
          { label: 'Offline', value: offline, color: '#dc2626', bg: '#fee2e2', icon: WifiOff },
          { label: 'Webcams', value: webcams, color: '#7c3aed', bg: '#ede9fe', icon: Laptop },
        ].map(({ label, value, color, bg, icon: Icon }) => (
          <div key={label} className="glass-card" style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '11px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={20} color={color} strokeWidth={1.8} />
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827', lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '3px' }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Webcam Live Feeds */}
      {cameras.filter(c => c.mode === 'webcam').length > 0 && (
        <div className="glass-card" style={{ padding: '18px', marginBottom: '18px' }}>
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: '7px' }}>
              <Laptop size={15} color="#7c3aed" /> Laptop Webcam Feeds
            </div>
            <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>Live feed from your device camera</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            {cameras.filter(c => c.mode === 'webcam').map(cam => (
              <WebcamFeed
                key={cam.id}
                cameraId={cam.camera_id}
                cameraName={cam.name}
                data={DEMO_DATA[cam.id] || { active: true, density: 'Low', vehicle_count: 0, fps: 0 }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Camera Table */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Camera size={15} color="#2563eb" strokeWidth={2} />
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>Camera List</span>
          </div>
          <span style={{ fontSize: '12px', color: '#9ca3af' }}>{cameras.length} cameras</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              {['Camera', 'Location', 'IP / URL', 'Mode', 'FPS', 'Status', 'Actions'].map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cameras.map((cam) => (
              <tr key={cam.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '34px', height: '34px', borderRadius: '9px',
                      background: cam.status === 'online' ? '#d1fae5' : '#fee2e2',
                      border: `1px solid ${cam.status === 'online' ? '#a7f3d0' : '#fca5a5'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {cam.mode === 'webcam'
                        ? <Laptop size={15} color={cam.status === 'online' ? '#059669' : '#dc2626'} />
                        : <Camera size={15} color={cam.status === 'online' ? '#059669' : '#dc2626'} />
                      }
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>{cam.name}</div>
                      <div style={{ fontSize: '11px', color: '#9ca3af' }}>{cam.camera_id}</div>
                    </div>
                  </div>
                </td>
                <td style={{ color: '#6b7280' }}>{cam.location}</td>
                <td style={{ fontFamily: 'monospace', fontSize: '12px', color: '#9ca3af' }}>{cam.ip || '—'}</td>
                <td>
                  <span className={cam.mode === 'webcam' ? 'status-demo' : cam.mode === 'demo' ? 'status-demo' : 'status-online'} style={{ textTransform: 'uppercase', fontSize: '10px' }}>
                    {cam.mode === 'webcam' ? <Laptop size={10} /> : cam.mode === 'demo' ? <Video size={10} /> : <Camera size={10} />}
                    {cam.mode}
                  </span>
                </td>
                <td style={{ color: '#6b7280', fontWeight: 500 }}>{cam.fps}</td>
                <td>
                  <button
                    onClick={() => toggleStatus(cam.id)}
                    className={cam.status === 'online' ? 'status-online' : 'status-offline'}
                    style={{ border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                  >
                    {cam.status === 'online' ? <Wifi size={10} /> : <WifiOff size={10} />}
                    {cam.status}
                  </button>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      className="btn-secondary"
                      style={{ padding: '5px 10px', fontSize: '12px' }}
                      onClick={() => setModal(cam)}
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      className="btn-danger"
                      style={{ padding: '5px 10px', fontSize: '12px' }}
                      onClick={() => handleDelete(cam.id)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <CameraModal
          camera={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
};

export default Cameras;
