import { AlertTriangle, Info, Zap, X, Bell, Siren, Flame, Shield, Building2 } from 'lucide-react';

const SEVERITY_CONFIG = {
  critical:  { icon: Zap,           color: '#7c3aed', bg: '#ede9fe', border: '#c4b5fd', label: 'CRITICAL',   textColor: '#6d28d9', flash: false },
  high:      { icon: AlertTriangle, color: '#dc2626', bg: '#fee2e2', border: '#fca5a5', label: 'HIGH',       textColor: '#b91c1c', flash: false },
  warning:   { icon: Bell,          color: '#d97706', bg: '#fef3c7', border: '#fde68a', label: 'WARNING',    textColor: '#b45309', flash: false },
  info:      { icon: Info,          color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', label: 'INFO',       textColor: '#1d4ed8', flash: false },
  ambulance: { icon: Siren,         color: '#ef4444', bg: '#fff0f0', border: '#fca5a5', label: 'AMBULANCE',  textColor: '#dc2626', flash: true  },
  fire:      { icon: Flame,         color: '#f97316', bg: '#fff7ed', border: '#fdba74', label: 'FIRE ENGINE',textColor: '#ea580c', flash: true  },
  police:    { icon: Shield,        color: '#3b82f6', bg: '#eff6ff', border: '#93c5fd', label: 'POLICE',     textColor: '#2563eb', flash: true  },
  gov:       { icon: Building2,     color: '#8b5cf6', bg: '#f5f3ff', border: '#c4b5fd', label: 'GOVERNMENT', textColor: '#7c3aed', flash: false },
};

const AlertBadge = ({ alert, onDismiss }) => {
  const cfg = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.info;
  const Icon = cfg.icon;
  const isEmergency = cfg.flash;
  const time = alert.timestamp
    ? new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div style={{
      background: cfg.bg,
      border: `${isEmergency ? '2px' : '1px'} solid ${cfg.border}`,
      borderRadius: '10px',
      padding: '10px 12px',
      display: 'flex', alignItems: 'flex-start', gap: '10px',
      marginBottom: '8px',
      transition: 'box-shadow 0.2s',
      boxShadow: isEmergency ? `0 0 12px ${cfg.color}33` : 'none',
      animation: isEmergency ? 'emergencyAlertPulse 1.5s infinite' : 'none',
    }}>
      {/* Icon */}
      <div style={{
        width: '30px', height: '30px', borderRadius: '8px',
        background: isEmergency ? cfg.color : 'white',
        border: `1px solid ${cfg.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        boxShadow: isEmergency ? `0 0 8px ${cfg.color}66` : 'none',
      }}>
        <Icon size={14} color={isEmergency ? 'white' : cfg.color} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px', flexWrap: 'wrap' }}>
          {/* Severity badge */}
          <span style={{
            fontSize: '9px', fontWeight: 800,
            color: isEmergency ? 'white' : cfg.textColor,
            letterSpacing: '0.5px',
            background: isEmergency ? cfg.color : 'rgba(255,255,255,0.7)',
            padding: '2px 7px', borderRadius: '20px',
            border: `1px solid ${cfg.border}`,
          }}>
            {cfg.label}
          </span>

          {/* Signal override badge for emergency */}
          {isEmergency && (
            <span style={{
              fontSize: '9px', fontWeight: 800,
              color: 'white',
              background: '#111827',
              padding: '2px 7px', borderRadius: '20px',
              letterSpacing: '0.3px',
            }}>
              ⚡ SIGNAL OVERRIDE
            </span>
          )}

          {alert.camera_name && (
            <span style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 500 }}>
              {alert.camera_name}
            </span>
          )}
          <span style={{ fontSize: '10px', color: '#9ca3af', marginLeft: 'auto' }}>
            {time}
          </span>
        </div>

        <div style={{ fontSize: '12px', color: isEmergency ? cfg.textColor : '#111827', fontWeight: 700 }}>
          {alert.message}
        </div>

        {alert.description && (
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px', lineHeight: 1.4 }}>
            {alert.description}
          </div>
        )}
      </div>

      {onDismiss && (
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(alert.id); }}
          style={{
            background: 'rgba(255,255,255,0.8)', border: `1px solid ${cfg.border}`,
            borderRadius: '5px', cursor: 'pointer',
            color: '#9ca3af', flexShrink: 0, padding: '3px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <X size={11} />
        </button>
      )}

      <style>{`
        @keyframes emergencyAlertPulse {
          0%, 100% { box-shadow: 0 0 12px ${cfg.color}33; }
          50%       { box-shadow: 0 0 20px ${cfg.color}66; }
        }
      `}</style>
    </div>
  );
};

export default AlertBadge;
