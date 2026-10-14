import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'white', border: '1px solid #e5e7eb',
      borderRadius: '10px', padding: '10px 14px', fontSize: '12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    }}>
      <div style={{ color: '#9ca3af', marginBottom: '6px', fontWeight: 500 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
          <span style={{ color: '#6b7280' }}>{p.name}:</span>
          <span style={{ fontWeight: 700, color: p.color }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export const VehicleLineChart = ({ data = [] }) => (
  <ResponsiveContainer width="100%" height="100%">
    <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
      <defs>
        <linearGradient id="gradCar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
        </linearGradient>
        <linearGradient id="gradBike" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
        </linearGradient>
        <linearGradient id="gradBus" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
        </linearGradient>
        <linearGradient id="gradTruck" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
      <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
      <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
      <Tooltip content={<CustomTooltip />} />
      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', color: 'var(--text-secondary)' }} />
      <Area type="monotone" dataKey="cars" stroke="#3b82f6" fill="url(#gradCar)" strokeWidth={2} dot={false} name="Cars" />
      <Area type="monotone" dataKey="bikes" stroke="#10b981" fill="url(#gradBike)" strokeWidth={2} dot={false} name="Bikes" />
      <Area type="monotone" dataKey="buses" stroke="#f59e0b" fill="url(#gradBus)" strokeWidth={2} dot={false} name="Buses" />
      <Area type="monotone" dataKey="trucks" stroke="#8b5cf6" fill="url(#gradTruck)" strokeWidth={2} dot={false} name="Trucks" />
    </AreaChart>
  </ResponsiveContainer>
);

export const DensityBarChart = ({ data = [] }) => (
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
      <XAxis dataKey="camera" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
      <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
      <Tooltip content={<CustomTooltip />} />
      <Bar dataKey="vehicles" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Vehicles">
        {data.map((entry, index) => (
          <Cell key={index} fill={
            entry.density === 'Critical' ? '#8b5cf6' :
            entry.density === 'High' ? '#ef4444' :
            entry.density === 'Medium' ? '#f59e0b' : '#10b981'
          } />
        ))}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
);

export const VehicleTypePieChart = ({ data = [] }) => {
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius="50%" outerRadius="75%"
          dataKey="value" nameKey="name" paddingAngle={3}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', color: 'var(--text-secondary)' }} />
      </PieChart>
    </ResponsiveContainer>
  );
};

export const HourlyFlowChart = ({ data = [] }) => (
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
      <XAxis dataKey="hour" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
      <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
      <Tooltip content={<CustomTooltip />} />
      <Bar dataKey="count" name="Vehicles" radius={[4, 4, 0, 0]}>
        {data.map((entry, index) => (
          <Cell key={index} fill={
            entry.count > 150 ? '#ef4444' :
            entry.count > 100 ? '#f59e0b' :
            entry.count > 50 ? '#3b82f6' : '#10b981'
          } />
        ))}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
);
