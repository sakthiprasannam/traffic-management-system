import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Camera, BarChart3, Bell, FileText,
  Settings, LogOut, Menu, X, Wifi, WifiOff,
  Car, Shield, ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import operatorIcon from '../assets/7425445.png';
import adminIcon from '../assets/admin-icon.webp';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/cameras', icon: Camera, label: 'Cameras' },
  { path: '/analytics', icon: BarChart3, label: 'Analytics' },
  { path: '/alerts', icon: Bell, label: 'Alerts', badge: true },
  { path: '/reports', icon: FileText, label: 'Reports' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

const Sidebar = ({ connected, alertCount = 0 }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div
      style={{
        width: collapsed ? '64px' : '240px',
        background: 'white',
        borderRight: '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.25s ease',
        flexShrink: 0,
        overflow: 'hidden',
        zIndex: 10,
        boxShadow: '1px 0 0 #e5e7eb',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '0 16px',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        height: '64px',
        flexShrink: 0,
      }}>
        <div style={{
          width: '36px', height: '36px', flexShrink: 0,
          borderRadius: '9px',
          overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
        }}>
          <img
            src="/traffic-control-icon-vector.jpg"
            alt="TrafficAI Logo"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
        {!collapsed && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827', whiteSpace: 'nowrap' }}>
              TrafficAI
            </div>
            <div style={{ fontSize: '10px', color: '#9ca3af', whiteSpace: 'nowrap' }}>
              Smart City System
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#9ca3af', flexShrink: 0, padding: '4px',
            borderRadius: '6px',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          {collapsed ? <Menu size={16} /> : <X size={16} />}
        </button>
      </div>

      {/* Connection status */}
      {!collapsed && (
        <div style={{
          padding: '10px 16px',
          display: 'flex', alignItems: 'center', gap: '8px',
          borderBottom: '1px solid #e5e7eb',
          fontSize: '11px',
        }}>
          {connected ? (
            <>
              <div className="pulse-dot" style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
              <span style={{ color: '#059669', fontWeight: 500 }}>Live Connected</span>
            </>
          ) : (
            <>
              <WifiOff size={12} color="#dc2626" />
              <span style={{ color: '#dc2626', fontWeight: 500 }}>Reconnecting...</span>
            </>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '10px 8px', overflow: 'hidden' }}>
        {navItems.map(({ path, icon: Icon, label, badge }) => {
          const isActive = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center',
                gap: '10px', padding: collapsed ? '11px 0' : '10px 12px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                background: isActive ? '#eff6ff' : 'none',
                border: 'none',
                borderRadius: '9px',
                cursor: 'pointer',
                color: isActive ? '#2563eb' : '#6b7280',
                fontSize: '13px', fontWeight: isActive ? 600 : 500,
                transition: 'all 0.15s ease',
                position: 'relative',
                marginBottom: '2px',
                fontFamily: 'DM Sans, sans-serif',
              }}
              onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.color = '#374151'; } }}
              onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#6b7280'; } }}
            >
              <Icon size={17} style={{ flexShrink: 0 }} />
              {!collapsed && <span>{label}</span>}
              {badge && alertCount > 0 && !collapsed && (
                <span style={{
                  marginLeft: 'auto',
                  background: '#dc2626',
                  color: 'white',
                  borderRadius: '10px',
                  padding: '1px 7px',
                  fontSize: '10px',
                  fontWeight: 700,
                }}>
                  {alertCount}
                </span>
              )}
              {badge && alertCount > 0 && collapsed && (
                <span style={{
                  position: 'absolute', top: '8px', right: '6px',
                  width: '7px', height: '7px', borderRadius: '50%',
                  background: '#dc2626',
                }} />
              )}
            </button>
          );
        })}
      </nav>

      {/* User footer */}
      <div style={{
        borderTop: '1px solid #e5e7eb',
        padding: '12px 8px',
      }}>
        {!collapsed && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '8px 10px',
            background: '#f9fafb',
            borderRadius: '9px',
            marginBottom: '8px',
          }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
              background: '#111827',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '13px', fontWeight: 700, color: 'white',
              overflow: 'hidden',
            }}>
              {user?.role === 'operator' || user?.username === 'operator' ? (
                <img src={operatorIcon} alt="Operator" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <img src={adminIcon} alt="Admin" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.username || 'Admin'}
              </div>
              <div style={{ fontSize: '10px', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {user?.role === 'operator' || user?.username === 'operator' ? (
                  <img src={operatorIcon} alt="Operator" style={{ width: '10px', height: '10px', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <img src={adminIcon} alt="Admin" style={{ width: '10px', height: '10px', borderRadius: '50%', objectFit: 'cover' }} />
                )}
                {user?.role || 'admin'}
              </div>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="btn-danger"
          style={{
            width: '100%', justifyContent: collapsed ? 'center' : 'flex-start',
            fontSize: '12px', padding: '8px 12px',
          }}
        >
          <LogOut size={14} />
          {!collapsed && 'Logout'}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
