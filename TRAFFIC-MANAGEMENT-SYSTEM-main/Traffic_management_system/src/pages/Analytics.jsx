import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Clock, Car, Bike, Bus, Truck } from 'lucide-react';
import { VehicleLineChart, VehicleTypePieChart, HourlyFlowChart, DensityBarChart } from '../components/TrafficChart';

const generateHourly = () =>
  Array.from({ length: 24 }, (_, h) => ({
    hour: `${String(h).padStart(2, '0')}:00`,
    count: Math.floor(
      h < 6 ? Math.random() * 20 + 5
        : h < 9 ? Math.random() * 80 + 80
        : h < 12 ? Math.random() * 60 + 60
        : h < 14 ? Math.random() * 80 + 100
        : h < 17 ? Math.random() * 50 + 50
        : h < 20 ? Math.random() * 90 + 100
        : Math.random() * 30 + 10
    ),
  }));

const generateTimeline = () => {
  const data = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const t = new Date(now - i * 60000);
    data.push({
      time: t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      cars: Math.floor(Math.random() * 50 + 30),
      bikes: Math.floor(Math.random() * 25 + 10),
      buses: Math.floor(Math.random() * 12 + 3),
      trucks: Math.floor(Math.random() * 8 + 2),
    });
  }
  return data;
};

const PIE_DATA = [
  { name: 'Cars', value: 58 },
  { name: 'Bikes', value: 22 },
  { name: 'Buses', value: 12 },
  { name: 'Trucks', value: 8 },
];

const DENSITY_DATA = [
  { camera: 'CAM 01', vehicles: 42, density: 'High' },
  { camera: 'CAM 02', vehicles: 28, density: 'Medium' },
  { camera: 'CAM 03', vehicles: 67, density: 'Critical' },
  { camera: 'CAM 04', vehicles: 12, density: 'Low' },
];

const StatBox = ({ icon: Icon, label, value, unit, color }) => (
  <div className="glass-card" style={{ padding: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
    <div style={{
      width: '40px', height: '40px', borderRadius: '9px',
      background: `${color}1a`, border: `1px solid ${color}33`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <Icon size={18} color={color} />
    </div>
    <div>
      <div style={{ fontSize: '10px', color: '#9ca3af' }}>{label}</div>
      <div style={{ fontSize: '20px', fontWeight: 700, color }}>
        {value} <span style={{ fontSize: '12px', fontWeight: 400, color: '#6b7280' }}>{unit}</span>
      </div>
    </div>
  </div>
);

const Analytics = () => {
  const [hourlyData] = useState(generateHourly);
  const [timeline] = useState(generateTimeline);
  const [dateRange, setDateRange] = useState('today');

  return (
    <div className="page-body">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700 }}>Traffic Analytics</h1>
          <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
            Detailed traffic flow analysis and statistics
          </p>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {['today', 'week', 'month'].map(r => (
            <button
              key={r}
              onClick={() => setDateRange(r)}
              style={{
                padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 500,
                cursor: 'pointer', textTransform: 'capitalize',
                background: dateRange === r ? 'rgba(59,130,246,0.15)' : 'white',
                color: dateRange === r ? '#3b82f6' : '#9ca3af',
                border: dateRange === r ? '1px solid rgba(59,130,246,0.3)' : '1px solid #e5e7eb',
                transition: 'all 0.15s',
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '20px' }}>
        <StatBox icon={Car} label="Cars Detected" value="2,847" color="#3b82f6" />
        <StatBox icon={Bike} label="Bikes Detected" value="1,083" color="#10b981" />
        <StatBox icon={Bus} label="Buses Detected" value="392" color="#f59e0b" />
        <StatBox icon={Truck} label="Trucks Detected" value="261" color="#8b5cf6" />
      </div>

      {/* Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        {/* Hourly Flow */}
        <div className="glass-card" style={{ padding: '16px' }}>
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={15} color="#2563eb" /> Hourly Traffic Flow
            </div>
            <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>Vehicles per hour — 24 hr view</div>
          </div>
          <div style={{ height: '220px' }}>
            <HourlyFlowChart data={hourlyData} />
          </div>
        </div>

        {/* Vehicle Type Pie */}
        <div className="glass-card" style={{ padding: '16px' }}>
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart3 size={15} color="#2563eb" /> Vehicle Type Distribution
            </div>
            <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>Breakdown by vehicle category</div>
          </div>
          <div style={{ height: '220px' }}>
            <VehicleTypePieChart data={PIE_DATA} />
          </div>
        </div>
      </div>

      {/* Timeline + Density */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
        {/* Timeline */}
        <div className="glass-card" style={{ padding: '16px' }}>
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={15} color="#2563eb" /> 30-Minute Flow History
            </div>
            <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>Vehicle type trends over time</div>
          </div>
          <div style={{ height: '200px' }}>
            <VehicleLineChart data={timeline} />
          </div>
        </div>

        {/* Density by camera */}
        <div className="glass-card" style={{ padding: '16px' }}>
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>Lane Density</div>
            <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>Current camera status</div>
          </div>
          {DENSITY_DATA.map(d => {
            const pct = Math.min((d.vehicles / 80) * 100, 100);
            const color = d.density === 'Critical' ? '#8b5cf6' : d.density === 'High' ? '#ef4444' : d.density === 'Medium' ? '#f59e0b' : '#10b981';
            return (
              <div key={d.camera} style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>{d.camera}</span>
                  <span style={{ fontSize: '11px', color, fontWeight: 600 }}>{d.vehicles} vehicles</span>
                </div>
                <div style={{ height: '6px', background: '#e5e7eb', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '3px', transition: 'width 0.5s' }} />
                </div>
                <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '3px' }}>{d.density} Density</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Analytics;
