import { useState } from 'react';
import { FileText, Download, Calendar, Filter, RefreshCw, FileSpreadsheet, File } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const SAMPLE_HISTORY = [
  { id: 1, date: '2026-08-21', camera: 'CAM 03', events: 142, peak_density: 'Critical', alerts: 3, vehicles: 847 },
  { id: 2, date: '2026-08-21', camera: 'CAM 01', events: 89, peak_density: 'High', alerts: 1, vehicles: 623 },
  { id: 3, date: '2026-08-21', camera: 'CAM 02', events: 67, peak_density: 'Medium', alerts: 0, vehicles: 412 },
  { id: 4, date: '2026-08-21', camera: 'CAM 04', events: 23, peak_density: 'Low', alerts: 0, vehicles: 198 },
  { id: 5, date: '2026-08-20', camera: 'ALL', events: 312, peak_density: 'Critical', alerts: 7, vehicles: 2891 },
  { id: 6, date: '2026-08-19', camera: 'ALL', events: 287, peak_density: 'High', alerts: 4, vehicles: 2654 },
  { id: 7, date: '2026-08-18', camera: 'ALL', events: 265, peak_density: 'High', alerts: 3, vehicles: 2401 },
];

const DENSITY_BADGE = {
  Critical: { bg: 'rgba(139,92,246,0.15)', color: '#8b5cf6', border: 'rgba(139,92,246,0.3)' },
  High: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'rgba(239,68,68,0.3)' },
  Medium: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
  Low: { bg: 'rgba(16,185,129,0.15)', color: '#10b981', border: 'rgba(16,185,129,0.3)' },
};

const Reports = () => {
  const [startDate, setStartDate] = useState('2026-08-21');
  const [endDate, setEndDate] = useState('2026-08-21');
  const [cameraFilter, setCameraFilter] = useState('ALL');
  const [loading, setLoading] = useState({ csv: false, pdf: false });

  const downloadCSV = async () => {
    setLoading(l => ({ ...l, csv: true }));
    try {
      const res = await axios.get('/api/reports/csv', {
        params: { start: startDate, end: endDate, camera: cameraFilter },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `traffic_report_${startDate}_${endDate}.csv`;
      link.click();
      toast.success('CSV downloaded');
    } catch {
      // Fallback: generate client-side CSV
      const rows = [
        ['Date', 'Camera', 'Total Vehicles', 'Peak Density', 'Alerts', 'Events'],
        ...SAMPLE_HISTORY.map(r => [r.date, r.camera, r.vehicles, r.peak_density, r.alerts, r.events])
      ];
      const csv = rows.map(r => r.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `traffic_report_${startDate}.csv`;
      link.click();
      toast.success('CSV exported');
    } finally {
      setLoading(l => ({ ...l, csv: false }));
    }
  };

  const downloadPDF = async () => {
    setLoading(l => ({ ...l, pdf: true }));
    try {
      const res = await axios.get('/api/reports/pdf', {
        params: { start: startDate, end: endDate, camera: cameraFilter },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `traffic_report_${startDate}_${endDate}.pdf`;
      link.click();
      toast.success('PDF downloaded');
    } catch {
      toast.error('PDF requires backend connection');
    } finally {
      setLoading(l => ({ ...l, pdf: false }));
    }
  };

  return (
    <div className="page-body">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700 }}>Reports</h1>
          <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
            Generate and download historical traffic reports
          </p>
        </div>
      </div>

      {/* Export Card */}
      <div className="glass-card" style={{ padding: '20px', marginBottom: '16px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={16} color="#2563eb" /> Generate Report
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '16px' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: '6px' }}>
              From Date
            </label>
            <input type="date" className="input-dark" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: '6px' }}>
              To Date
            </label>
            <input type="date" className="input-dark" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: '6px' }}>
              Camera
            </label>
            <select className="input-dark" value={cameraFilter} onChange={e => setCameraFilter(e.target.value)} style={{ cursor: 'pointer' }}>
              <option value="ALL">All Cameras</option>
              {['CAM 01', 'CAM 02', 'CAM 03', 'CAM 04'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn-primary"
            onClick={downloadCSV}
            disabled={loading.csv}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <FileSpreadsheet size={16} />
            {loading.csv ? 'Generating...' : 'Export CSV'}
          </button>
          <button
            onClick={downloadPDF}
            disabled={loading.pdf}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '8px 16px', borderRadius: '8px', cursor: 'pointer',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              color: '#ef4444', fontSize: '14px', fontWeight: 500,
            }}
          >
            <File size={16} />
            {loading.pdf ? 'Generating...' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* Historical Data Table */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={16} color="#2563eb" />
          <span style={{ fontSize: '13px', fontWeight: 600 }}>Historical Traffic Data</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
              {['Date', 'Camera', 'Total Vehicles', 'Peak Density', 'Events', 'Alerts'].map(h => (
                <th key={h} style={{
                  padding: '10px 16px', textAlign: 'left',
                  fontSize: '11px', fontWeight: 600,
                  color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SAMPLE_HISTORY.map((row, i) => {
              const badge = DENSITY_BADGE[row.peak_density];
              return (
                <tr key={row.id} style={{
                  borderBottom: i < SAMPLE_HISTORY.length - 1 ? '1px solid #e5e7eb' : 'none',
                  transition: 'background 0.15s',
                }}>
                  <td style={{ padding: '12px 16px', fontSize: '12px', color: '#6b7280' }}>{row.date}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 500, color: '#111827' }}>{row.camera}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: '#3b82f6' }}>{row.vehicles.toLocaleString()}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      fontSize: '10px', fontWeight: 700,
                      background: badge.bg, color: badge.color,
                      border: `1px solid ${badge.border}`,
                      padding: '2px 8px', borderRadius: '4px',
                    }}>
                      {row.peak_density}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '12px', color: '#6b7280' }}>{row.events}</td>
                  <td style={{ padding: '12px 16px' }}>
                    {row.alerts > 0 ? (
                      <span style={{
                        fontSize: '12px', fontWeight: 600, color: '#ef4444',
                        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                        borderRadius: '4px', padding: '2px 8px',
                      }}>
                        {row.alerts}
                      </span>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#9ca3af' }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Reports;
