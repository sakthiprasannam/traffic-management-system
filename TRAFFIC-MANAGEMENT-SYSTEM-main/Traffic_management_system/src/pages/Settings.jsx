import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, Bell, Shield, Database, Monitor, CheckCircle2, Cpu, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

const MODEL_OPTIONS = [
  {
    id: 'yolov8x',
    name: 'YOLOv8x',
    badge: 'Flagship (Best)',
    badgeColor: '#7c3aed',
    badgeBg: '#ede9fe',
    desc: 'Extra Large — 68.2M params. Maximum accuracy for small, distant & occluded vehicles.',
  },
  {
    id: 'yolov8m',
    name: 'YOLOv8m',
    badge: 'High Accuracy',
    badgeColor: '#2563eb',
    badgeBg: '#eff6ff',
    desc: 'Medium — 25.9M params. Strong detection accuracy for complex road traffic.',
  },
  {
    id: 'yolov8s',
    name: 'YOLOv8s',
    badge: 'Balanced',
    badgeColor: '#059669',
    badgeBg: '#d1fae5',
    desc: 'Small — 11.2M params. Fast real-time detection on standard CPU / GPU.',
  },
  {
    id: 'yolov8n',
    name: 'YOLOv8n',
    badge: 'Fastest',
    badgeColor: '#d97706',
    badgeBg: '#fef3c7',
    desc: 'Nano — 3.2M params. Ultra-lightweight for low-power hardware.',
  },
];

const DEFAULT_SETTINGS = {
  ai_confidence: 0.40,
  detection_interval: 1,
  density_low: 5,
  density_medium: 15,
  density_high: 30,
  density_critical: 50,
  alert_congestion: true,
  alert_incident: true,
  alert_emergency: true,
  alert_email: false,
  email: '',
  max_history_days: 30,
  yolo_model: 'yolov8x',
  frame_skip: 2,
};

const Settings = () => {
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('traffic_ai_settings');
    if (saved) {
      try { return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) }; } catch (e) {}
    }
    return DEFAULT_SETTINGS;
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Fetch current runtime settings from backend
    axios.get('/api/settings')
      .then(res => {
        if (res.data) {
          setSettings(s => {
            const merged = { ...s, ...res.data };
            localStorage.setItem('traffic_ai_settings', JSON.stringify(merged));
            return merged;
          });
        }
      })
      .catch(() => {});
  }, []);

  const update = (k, v) => setSettings(s => ({ ...s, [k]: v }));

  const selectModel = async (modelId) => {
    update('yolo_model', modelId);
    try {
      const updated = { ...settings, yolo_model: modelId };
      localStorage.setItem('traffic_ai_settings', JSON.stringify(updated));
      await axios.post('/api/settings', updated);
      toast.success(`Active Model changed to ${modelId.toUpperCase()}`);
    } catch (e) {
      toast.success(`Model selected: ${modelId.toUpperCase()}`);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      localStorage.setItem('traffic_ai_settings', JSON.stringify(settings));
      await axios.post('/api/settings', settings);
      toast.success(`Settings saved! Active Model: ${settings.yolo_model.toUpperCase()}`);
    } catch (err) {
      localStorage.setItem('traffic_ai_settings', JSON.stringify(settings));
      toast.success(`Settings saved (Model: ${settings.yolo_model.toUpperCase()})`);
    } finally {
      setSaving(false);
    }
  };

  const Section = ({ icon: Icon, title, children }) => (
    <div className="glass-card" style={{ padding: '20px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
        <Icon size={16} color="#2563eb" />
        <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{title}</span>
      </div>
      {children}
    </div>
  );

  const Row = ({ label, desc, children }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
      <div>
        <div style={{ fontSize: '13px', fontWeight: 500, color: '#111827' }}>{label}</div>
        {desc && <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{desc}</div>}
      </div>
      {children}
    </div>
  );

  const Toggle = ({ value, onChange }) => (
    <div
      onClick={() => onChange(!value)}
      style={{
        width: '40px', height: '22px', borderRadius: '11px',
        background: value ? '#3b82f6' : '#e5e7eb',
        cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute', top: '3px',
        left: value ? '21px' : '3px',
        width: '16px', height: '16px', borderRadius: '50%',
        background: 'white', transition: 'left 0.2s',
      }} />
    </div>
  );

  return (
    <div className="page-body">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700 }}>Settings</h1>
          <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
            Configure AI detection model, alerts, and system telemetry
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={save}
          disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#2563eb' }}
        >
          <Save size={14} /> {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* 1. YOLO Model Selection Cards */}
      <Section icon={Sparkles} title="YOLO Detection Model Selection">
        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '14px' }}>
          Select the active YOLO neural network model. Click any card below to activate:
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', marginBottom: '18px' }}>
          {MODEL_OPTIONS.map(opt => {
            const isSelected = settings.yolo_model === opt.id;
            return (
              <div
                key={opt.id}
                onClick={() => selectModel(opt.id)}
                style={{
                  border: isSelected ? '2px solid #2563eb' : '1px solid #e5e7eb',
                  background: isSelected ? '#eff6ff' : '#ffffff',
                  borderRadius: '10px',
                  padding: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  boxShadow: isSelected ? '0 4px 12px rgba(37,99,235,0.12)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>
                    {opt.name}
                  </span>
                  <span style={{
                    fontSize: '10px', fontWeight: 700,
                    color: opt.badgeColor, background: opt.badgeBg,
                    padding: '2px 8px', borderRadius: '12px',
                  }}>
                    {opt.badge}
                  </span>
                </div>
                <p style={{ fontSize: '11px', color: '#6b7280', lineHeight: 1.4, margin: '6px 0 0' }}>
                  {opt.desc}
                </p>
                {isSelected && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '10px', color: '#2563eb', fontSize: '11px', fontWeight: 700 }}>
                    <CheckCircle2 size={13} /> Active Model
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <Row label="Detection Confidence Threshold" desc={`Minimum confidence: ${Math.round(settings.ai_confidence * 100)}%`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="range" min={0.1} max={0.9} step={0.05}
              value={settings.ai_confidence}
              onChange={e => update('ai_confidence', Number(e.target.value))}
              style={{ width: '140px', accentColor: '#3b82f6' }}
            />
            <span style={{ fontSize: '12px', color: '#3b82f6', fontWeight: 600, width: '36px' }}>
              {Math.round(settings.ai_confidence * 100)}%
            </span>
          </div>
        </Row>

        <Row label="Frame Skip Rate" desc="Process every Nth frame (higher = faster processing)">
          <input
            type="number" className="input-dark"
            style={{ width: '80px' }} min={1} max={10}
            value={settings.frame_skip}
            onChange={e => update('frame_skip', Number(e.target.value))}
          />
        </Row>
      </Section>

      {/* 2. Density Thresholds */}
      <Section icon={Cpu} title="Traffic Density Thresholds">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
          {[
            { key: 'density_low', label: 'Low → Medium', color: '#10b981' },
            { key: 'density_medium', label: 'Medium → High', color: '#f59e0b' },
            { key: 'density_high', label: 'High → Critical', color: '#ef4444' },
            { key: 'density_critical', label: 'Critical threshold', color: '#8b5cf6' },
          ].map(({ key, label, color }) => (
            <div key={key}>
              <div style={{ fontSize: '11px', color, fontWeight: 600, marginBottom: '6px' }}>{label}</div>
              <input
                type="number" className="input-dark"
                value={settings[key]}
                onChange={e => update(key, Number(e.target.value))}
                min={1} max={200}
              />
              <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '4px' }}>vehicles</div>
            </div>
          ))}
        </div>
      </Section>

      {/* 3. Alerts */}
      <Section icon={Bell} title="Alert Notifications">
        <Row label="Congestion Alerts" desc="Alert when density reaches Critical">
          <Toggle value={settings.alert_congestion} onChange={v => update('alert_congestion', v)} />
        </Row>
        <Row label="Incident Detection" desc="Alert for stopped vehicles / possible accidents">
          <Toggle value={settings.alert_incident} onChange={v => update('alert_incident', v)} />
        </Row>
        <Row label="Emergency Vehicle" desc="Alert when emergency vehicle detected">
          <Toggle value={settings.alert_emergency} onChange={v => update('alert_emergency', v)} />
        </Row>
        <Row label="Email Notifications" desc="Send alerts to email">
          <Toggle value={settings.alert_email} onChange={v => update('alert_email', v)} />
        </Row>
        {settings.alert_email && (
          <div style={{ marginTop: '8px' }}>
            <input
              className="input-dark"
              type="email"
              placeholder="admin@smartcity.gov"
              value={settings.email}
              onChange={e => update('email', e.target.value)}
            />
          </div>
        )}
      </Section>

      {/* 4. Data Retention */}
      <Section icon={Database} title="Data & Storage">
        <Row label="History Retention" desc="How many days to keep traffic records">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="number" className="input-dark"
              style={{ width: '80px' }} min={1} max={365}
              value={settings.max_history_days}
              onChange={e => update('max_history_days', Number(e.target.value))}
            />
            <span style={{ fontSize: '12px', color: '#9ca3af' }}>days</span>
          </div>
        </Row>
      </Section>
    </div>
  );
};

export default Settings;
