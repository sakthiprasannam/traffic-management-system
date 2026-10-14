import { useState } from 'react';
import { Bell, Filter, CheckCheck, Trash2, AlertTriangle, Zap, Info, Search } from 'lucide-react';
import AlertBadge from '../components/AlertBadge';

const INITIAL_ALERTS = [
  { id: 1, severity: 'critical', message: 'Traffic congestion — vehicle count exceeded critical threshold', camera_name: 'CAM 03 — South Hwy', description: 'Vehicle count: 67 (Threshold: 60)', timestamp: new Date().toISOString(), read: false },
  { id: 2, severity: 'high', message: 'Stopped vehicle detected — possible incident', camera_name: 'CAM 03 — South Hwy', description: 'Vehicle stationary for >120 seconds', timestamp: new Date(Date.now() - 120000).toISOString(), read: false },
  { id: 3, severity: 'warning', message: 'Emergency vehicle approaching', camera_name: 'CAM 02 — East Corridor', description: 'Ambulance detected — traffic signal override recommended', timestamp: new Date(Date.now() - 240000).toISOString(), read: false },
  { id: 4, severity: 'warning', message: 'Traffic density elevated to HIGH', camera_name: 'CAM 01 — North Junction', description: 'Vehicle count: 42, Density: High', timestamp: new Date(Date.now() - 480000).toISOString(), read: true },
  { id: 5, severity: 'info', message: 'Camera reconnected successfully', camera_name: 'CAM 04 — West Bridge', timestamp: new Date(Date.now() - 600000).toISOString(), read: true },
  { id: 6, severity: 'info', message: 'Daily traffic report generated', camera_name: 'System', timestamp: new Date(Date.now() - 3600000).toISOString(), read: true },
  { id: 7, severity: 'high', message: 'Wrong-way vehicle detected', camera_name: 'CAM 01 — North Junction', description: 'Vehicle moving against traffic flow', timestamp: new Date(Date.now() - 7200000).toISOString(), read: true },
];

const SEV_OPTS = ['All', 'critical', 'high', 'warning', 'info'];

const Alerts = () => {
  const [alerts, setAlerts] = useState(INITIAL_ALERTS);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');

  const filtered = alerts.filter(a => {
    const matchFilter = filter === 'All' || a.severity === filter;
    const matchSearch = !search || a.message.toLowerCase().includes(search.toLowerCase()) || (a.camera_name || '').toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const markAllRead = () => setAlerts(prev => prev.map(a => ({ ...a, read: true })));
  const dismiss = (id) => setAlerts(prev => prev.filter(a => a.id !== id));
  const clearAll = () => setAlerts([]);

  const unreadCount = alerts.filter(a => !a.read).length;

  const COUNTS = {
    critical: alerts.filter(a => a.severity === 'critical').length,
    high: alerts.filter(a => a.severity === 'high').length,
    warning: alerts.filter(a => a.severity === 'warning').length,
    info: alerts.filter(a => a.severity === 'info').length,
  };

  return (
    <div className="page-body">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            Alerts & Notifications
            {unreadCount > 0 && (
              <span style={{
                background: '#dc2626', color: 'white',
                borderRadius: '20px', padding: '2px 10px', fontSize: '12px', fontWeight: 700,
              }}>
                {unreadCount} new
              </span>
            )}
          </h1>
          <p style={{ fontSize: '13px', color: '#9ca3af', marginTop: '3px' }}>
            Traffic incidents, density warnings, and system notifications
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-secondary" onClick={markAllRead}>
            <CheckCheck size={14} /> Mark all read
          </button>
          <button className="btn-danger" onClick={clearAll}>
            <Trash2 size={14} /> Clear all
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {[
          { key: 'critical', label: 'Critical', color: '#7c3aed', bg: '#ede9fe', icon: Zap },
          { key: 'high', label: 'High', color: '#dc2626', bg: '#fee2e2', icon: AlertTriangle },
          { key: 'warning', label: 'Warning', color: '#d97706', bg: '#fef3c7', icon: AlertTriangle },
          { key: 'info', label: 'Info', color: '#2563eb', bg: '#eff6ff', icon: Info },
        ].map(({ key, label, color, bg, icon: Icon }) => (
          <div key={key} className="glass-card" style={{ padding: '18px', cursor: 'pointer', outline: filter === key ? `2px solid ${color}` : 'none', outlineOffset: '2px' }}
            onClick={() => setFilter(filter === key ? 'All' : key)}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#111827', lineHeight: 1 }}>{COUNTS[key]}</div>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={17} color={color} />
              </div>
            </div>
            <div style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 500 }}>{label} alerts</div>
          </div>
        ))}
      </div>

      {/* Filter + Search */}
      <div className="glass-card" style={{ padding: '16px', marginBottom: '18px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} color="#9ca3af" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              className="input-dark"
              placeholder="Search alerts..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: '36px' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {SEV_OPTS.map(opt => (
              <button
                key={opt}
                onClick={() => setFilter(opt)}
                style={{
                  padding: '7px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                  cursor: 'pointer', textTransform: 'capitalize',
                  background: filter === opt ? '#111827' : 'white',
                  color: filter === opt ? 'white' : '#6b7280',
                  border: filter === opt ? '1px solid #111827' : '1px solid #e5e7eb',
                  fontFamily: 'DM Sans, sans-serif',
                  transition: 'all 0.15s',
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Alert List */}
      <div className="glass-card" style={{ padding: '18px' }}>
        <div style={{ marginBottom: '14px', fontSize: '12px', color: '#9ca3af', fontWeight: 500 }}>
          Showing {filtered.length} of {alerts.length} alerts
        </div>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
            <Bell size={36} color="#d1d5db" style={{ margin: '0 auto 12px' }} />
            <p style={{ fontSize: '14px', fontWeight: 500 }}>No alerts found</p>
            <p style={{ fontSize: '12px', marginTop: '4px' }}>Try adjusting your filters</p>
          </div>
        ) : (
          filtered.map(alert => (
            <AlertBadge key={alert.id} alert={alert} onDismiss={dismiss} />
          ))
        )}
      </div>
    </div>
  );
};

export default Alerts;
