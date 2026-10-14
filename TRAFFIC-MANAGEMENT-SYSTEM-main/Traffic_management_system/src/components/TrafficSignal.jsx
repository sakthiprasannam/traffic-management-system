import { useState, useEffect, useRef, useCallback } from 'react';
import { Siren, Flame, Shield, Building2, AlertTriangle, RotateCcw, Clock } from 'lucide-react';

// Signal phases: each side gets GREEN for PHASE_DURATION ms
const PHASE_DURATION = 15000; // 15 seconds per side
const YELLOW_DURATION = 3000;  // 3 seconds yellow before switch

const DIRECTIONS = ['North', 'East', 'South', 'West'];

const DIR_ICONS = {
  North: '↑',
  East:  '→',
  South: '↓',
  West:  '←',
};

const EMERGENCY_CONFIG = {
  AMBULANCE: { label: 'Ambulance', color: '#ef4444', bg: '#fee2e2', border: '#fca5a5', glow: 'rgba(239,68,68,0.4)', Icon: Siren },
  FIRE:      { label: 'Fire Engine', color: '#f97316', bg: '#ffedd5', border: '#fdba74', glow: 'rgba(249,115,22,0.4)', Icon: Flame },
  POLICE:    { label: 'Police', color: '#3b82f6', bg: '#eff6ff', border: '#93c5fd', glow: 'rgba(59,130,246,0.4)', Icon: Shield },
  GOV:       { label: 'Government', color: '#8b5cf6', bg: '#ede9fe', border: '#c4b5fd', glow: 'rgba(139,92,246,0.4)', Icon: Building2 },
};

const SignalLight = ({ state, size = 18 }) => {
  const isGreen  = state === 'green';
  const isYellow = state === 'yellow';
  const isRed    = state === 'red';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center',
      background: '#111827', borderRadius: 8, padding: '6px 5px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)' }}>
      {/* Red */}
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: isRed ? '#ef4444' : '#2d1a1a',
        boxShadow: isRed ? `0 0 12px 4px rgba(239,68,68,0.7)` : 'none',
        transition: 'background 0.3s, box-shadow 0.3s',
      }} />
      {/* Yellow */}
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: isYellow ? '#f59e0b' : '#2d2200',
        boxShadow: isYellow ? `0 0 12px 4px rgba(245,158,11,0.7)` : 'none',
        transition: 'background 0.3s, box-shadow 0.3s',
      }} />
      {/* Green */}
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: isGreen ? '#22c55e' : '#0f2d1a',
        boxShadow: isGreen ? `0 0 12px 4px rgba(34,197,94,0.7)` : 'none',
        transition: 'background 0.3s, box-shadow 0.3s',
      }} />
    </div>
  );
};

const IntersectionSVG = ({ signals, emergencyDir }) => {
  const roadColor = '#2b3442';
  const laneColor = '#3d4a5c';
  const markingColor = '#e2e8f0';
  const centerColor = '#0f172a';
  const size = 200;
  const road = 56;
  const center = size / 2;

  const dirSignal = (dir) => signals[dir] || 'red';
  const signalDot = (state) =>
    state === 'green' ? '#22c55e' : state === 'yellow' ? '#f59e0b' : '#ef4444';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ borderRadius: 12, overflow: 'hidden' }}>
      {/* Background */}
      <rect width={size} height={size} fill="#0f172a" />

      {/* Sidewalks */}
      <rect x={0} y={0} width={(size - road) / 2 - 2} height={(size - road) / 2 - 2} fill="#1e2430" />
      <rect x={(size + road) / 2 + 2} y={0} width={(size - road) / 2 - 2} height={(size - road) / 2 - 2} fill="#1e2430" />
      <rect x={0} y={(size + road) / 2 + 2} width={(size - road) / 2 - 2} height={(size - road) / 2 - 2} fill="#1e2430" />
      <rect x={(size + road) / 2 + 2} y={(size + road) / 2 + 2} width={(size - road) / 2 - 2} height={(size - road) / 2 - 2} fill="#1e2430" />

      {/* Roads */}
      <rect x={(size - road) / 2} y={0} width={road} height={size} fill={roadColor} />
      <rect x={0} y={(size - road) / 2} width={size} height={road} fill={roadColor} />

      {/* Lane markings - vertical */}
      {[center - 10, center + 6].map((x, i) => (
        [10, 30, 50, 70, 80, 100, 110, 130, 150, 170].map((y) => (
          y > (size - road) / 2 - 8 && y < (size + road) / 2 + 8 ? null :
          <rect key={`vl${i}${y}`} x={x} y={y} width={3} height={12} fill={markingColor} opacity={0.3} />
        ))
      ))}

      {/* Lane markings - horizontal */}
      {[center - 10, center + 6].map((y, i) => (
        [10, 30, 50, 70, 80, 100, 110, 130, 150, 170].map((x) => (
          x > (size - road) / 2 - 8 && x < (size + road) / 2 + 8 ? null :
          <rect key={`hl${i}${x}`} x={x} y={y} width={12} height={3} fill={markingColor} opacity={0.3} />
        ))
      ))}

      {/* Center box */}
      <rect x={(size - road) / 2} y={(size - road) / 2} width={road} height={road} fill={centerColor} />

      {/* Crosswalk stripes */}
      {/* North crosswalk */}
      {[0,6,12,18,24,30].map(i =>
        <rect key={`nc${i}`} x={(size - road) / 2} y={(size - road) / 2 - 14 - i} width={road / 6} height={4} fill="white" opacity={0.18} />
      )}

      {/* Emergency pulsing ring */}
      {emergencyDir && (
        <circle cx={center} cy={center} r={road * 0.8} fill="none"
          stroke={EMERGENCY_CONFIG[emergencyDir?.type]?.color || '#ef4444'}
          strokeWidth={3} opacity={0.7}
          style={{ animation: 'pulse 1s infinite' }}
        />
      )}

      {/* Signal indicators at each road end */}
      {/* North */}
      <circle cx={center} cy={10} r={7} fill={signalDot(dirSignal('North'))}
        style={{ filter: `drop-shadow(0 0 5px ${signalDot(dirSignal('North'))})` }} />
      {/* South */}
      <circle cx={center} cy={size - 10} r={7} fill={signalDot(dirSignal('South'))}
        style={{ filter: `drop-shadow(0 0 5px ${signalDot(dirSignal('South'))})` }} />
      {/* East */}
      <circle cx={size - 10} cy={center} r={7} fill={signalDot(dirSignal('East'))}
        style={{ filter: `drop-shadow(0 0 5px ${signalDot(dirSignal('East'))})` }} />
      {/* West */}
      <circle cx={10} cy={center} r={7} fill={signalDot(dirSignal('West'))}
        style={{ filter: `drop-shadow(0 0 5px ${signalDot(dirSignal('West'))})` }} />

      {/* Direction arrows in center */}
      <text x={center} y={center - 4} textAnchor="middle" fill="#64748b" fontSize={9} fontFamily="DM Sans, sans-serif">4-WAY</text>
      <text x={center} y={center + 8} textAnchor="middle" fill="#475569" fontSize={7} fontFamily="DM Sans, sans-serif">SIGNAL</text>
    </svg>
  );
};

const TrafficSignal = ({ emergencyOverride, onPhaseChange }) => {
  const [phase, setPhase] = useState(0); // index into DIRECTIONS
  const [subPhase, setSubPhase] = useState('green'); // 'green' | 'yellow'
  const [countdown, setCountdown] = useState(PHASE_DURATION / 1000);
  const [isOverridden, setIsOverridden] = useState(false);
  const [overrideInfo, setOverrideInfo] = useState(null); // { dirIndex, type, camera }
  const [history, setHistory] = useState([]);

  const timerRef = useRef(null);
  const countdownRef = useRef(null);
  const countRef = useRef(PHASE_DURATION / 1000);

  // Build signal state map from current phase
  const getSignals = useCallback((phaseIdx, sub) => {
    return DIRECTIONS.reduce((acc, dir, i) => {
      acc[dir] = i === phaseIdx ? sub : 'red';
      return acc;
    }, {});
  }, []);

  const [signals, setSignals] = useState(() => getSignals(0, 'green'));

  const advancePhase = useCallback(() => {
    setSubPhase('yellow');
    setSignals(prev => {
      const updated = { ...prev };
      const currentDir = DIRECTIONS[phase];
      updated[currentDir] = 'yellow';
      return updated;
    });

    setTimeout(() => {
      setPhase(prev => {
        const next = (prev + 1) % DIRECTIONS.length;
        const newSigs = getSignals(next, 'green');
        setSignals(newSigs);
        setSubPhase('green');
        countRef.current = PHASE_DURATION / 1000;
        setCountdown(PHASE_DURATION / 1000);
        if (onPhaseChange) onPhaseChange(DIRECTIONS[next]);
        setHistory(h => [
          { dir: DIRECTIONS[next], time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), type: 'normal' },
          ...h.slice(0, 7),
        ]);
        return next;
      });
    }, YELLOW_DURATION);
  }, [phase, getSignals, onPhaseChange]);

  // Normal cycle timer
  useEffect(() => {
    if (isOverridden) return;

    countdownRef.current = setInterval(() => {
      countRef.current -= 1;
      setCountdown(countRef.current);
      if (countRef.current <= 0) {
        countRef.current = PHASE_DURATION / 1000;
        advancePhase();
      }
    }, 1000);

    return () => clearInterval(countdownRef.current);
  }, [isOverridden, advancePhase]);

  // Handle emergency override
  useEffect(() => {
    if (!emergencyOverride) {
      if (isOverridden) {
        setIsOverridden(false);
        setOverrideInfo(null);
        countRef.current = PHASE_DURATION / 1000;
        setCountdown(PHASE_DURATION / 1000);
      }
      return;
    }

    const { dirIndex, type, camera } = emergencyOverride;
    if (dirIndex < 0 || dirIndex > 3) return;

    setIsOverridden(true);
    setOverrideInfo({ dirIndex, type, camera });
    clearInterval(countdownRef.current);
    clearTimeout(timerRef.current);

    // Immediately grant green to emergency direction
    setPhase(dirIndex);
    setSubPhase('green');
    setSignals(getSignals(dirIndex, 'green'));
    setCountdown('—');

    setHistory(h => [
      {
        dir: DIRECTIONS[dirIndex],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        type,
        camera,
      },
      ...h.slice(0, 7),
    ]);

    if (onPhaseChange) onPhaseChange(DIRECTIONS[dirIndex], type);
  }, [emergencyOverride, getSignals, isOverridden, onPhaseChange]);

  const currentDir = DIRECTIONS[phase];
  const currentEmergencyCfg = overrideInfo ? EMERGENCY_CONFIG[overrideInfo.type] : null;
  const EmergencyIcon = currentEmergencyCfg?.Icon;

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0f172a 0%, #1e2430 100%)',
      borderRadius: 16,
      border: isOverridden
        ? `2px solid ${currentEmergencyCfg?.color || '#ef4444'}`
        : '1px solid #1e2a3a',
      padding: '16px',
      boxShadow: isOverridden
        ? `0 0 24px ${currentEmergencyCfg?.glow || 'rgba(239,68,68,0.3)'}`
        : '0 4px 24px rgba(0,0,0,0.3)',
      transition: 'border 0.4s, box-shadow 0.4s',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
            4-Way Signal Controller
          </div>
          {isOverridden && currentEmergencyCfg && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5, marginTop: 4,
              fontSize: 11, fontWeight: 700, color: currentEmergencyCfg.color,
              animation: 'emergencyPulse 1s infinite',
            }}>
              <EmergencyIcon size={12} />
              EMERGENCY OVERRIDE — {currentEmergencyCfg.label.toUpperCase()}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!isOverridden && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 11, color: '#64748b',
            }}>
              <Clock size={11} />
              <span style={{ fontWeight: 700, color: '#22c55e', fontSize: 13 }}>{countdown}s</span>
            </div>
          )}
          <div style={{
            fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
            background: isOverridden ? currentEmergencyCfg?.bg || '#fee2e2' : '#dcfce7',
            color: isOverridden ? currentEmergencyCfg?.color || '#ef4444' : '#16a34a',
            border: `1px solid ${isOverridden ? currentEmergencyCfg?.border || '#fca5a5' : '#86efac'}`,
          }}>
            {isOverridden ? '⚡ OVERRIDE' : '● LIVE'}
          </div>
        </div>
      </div>

      {/* Main layout: Signal lights + SVG + Signal lights */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, alignItems: 'center', marginBottom: 14 }}>
        {/* Left side: West + North stacked */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
          {['North', 'West'].map(dir => (
            <div key={dir} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontSize: 10, fontWeight: 700,
                  color: signals[dir] === 'green' ? '#22c55e' : signals[dir] === 'yellow' ? '#f59e0b' : '#94a3b8',
                  transition: 'color 0.3s',
                }}>
                  {DIR_ICONS[dir]} {dir}
                </div>
                <div style={{ fontSize: 9, color: '#475569' }}>
                  {signals[dir] === 'green' ? 'OPEN' : signals[dir] === 'yellow' ? 'WAIT' : 'STOP'}
                </div>
              </div>
              <SignalLight state={signals[dir]} size={14} />
            </div>
          ))}
        </div>

        {/* Center SVG intersection */}
        <IntersectionSVG
          signals={signals}
          emergencyDir={overrideInfo}
        />

        {/* Right side: East + South stacked */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
          {['East', 'South'].map(dir => (
            <div key={dir} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SignalLight state={signals[dir]} size={14} />
              <div>
                <div style={{
                  fontSize: 10, fontWeight: 700,
                  color: signals[dir] === 'green' ? '#22c55e' : signals[dir] === 'yellow' ? '#f59e0b' : '#94a3b8',
                  transition: 'color 0.3s',
                }}>
                  {DIR_ICONS[dir]} {dir}
                </div>
                <div style={{ fontSize: 9, color: '#475569' }}>
                  {signals[dir] === 'green' ? 'OPEN' : signals[dir] === 'yellow' ? 'WAIT' : 'STOP'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Currently Open Banner */}
      <div style={{
        background: isOverridden
          ? `linear-gradient(90deg, ${currentEmergencyCfg?.bg || '#fee2e2'}, transparent)`
          : 'linear-gradient(90deg, #052e16, #0a3d20)',
        border: `1px solid ${isOverridden ? currentEmergencyCfg?.border || '#fca5a5' : '#14532d'}`,
        borderRadius: 9,
        padding: '8px 12px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#22c55e',
            boxShadow: '0 0 8px 3px rgba(34,197,94,0.5)',
          }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: isOverridden ? currentEmergencyCfg?.color : '#4ade80' }}>
            {DIR_ICONS[currentDir]} {currentDir} — {isOverridden ? `PRIORITY (${currentEmergencyCfg?.label})` : 'GREEN OPEN'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {DIRECTIONS.map((dir, i) => (
            <div
              key={dir}
              style={{
                width: 20, height: 20, borderRadius: 5,
                background: i === phase
                  ? (isOverridden ? currentEmergencyCfg?.color || '#22c55e' : '#22c55e')
                  : '#1e2a3a',
                border: i === phase ? 'none' : '1px solid #2d3748',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, color: i === phase ? 'white' : '#475569',
                fontWeight: 700,
                transition: 'background 0.4s',
              }}
            >
              {DIR_ICONS[dir]}
            </div>
          ))}
        </div>
      </div>

      {/* Phase History */}
      {history.length > 0 && (
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#475569', letterSpacing: '0.5px', marginBottom: 6, textTransform: 'uppercase' }}>
            Phase Log
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {history.slice(0, 4).map((h, i) => {
              const cfg = h.type && h.type !== 'normal' ? EMERGENCY_CONFIG[h.type] : null;
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 10, color: '#64748b',
                }}>
                  <span style={{ color: '#475569', fontVariantNumeric: 'tabular-nums', fontSize: 9 }}>{h.time}</span>
                  <span style={{
                    fontWeight: 700,
                    color: cfg ? cfg.color : '#4ade80',
                  }}>
                    {DIR_ICONS[h.dir]} {h.dir}
                  </span>
                  {cfg && (
                    <span style={{
                      fontSize: 8, fontWeight: 700,
                      background: cfg.bg, color: cfg.color,
                      border: `1px solid ${cfg.border}`,
                      padding: '1px 5px', borderRadius: 10,
                    }}>
                      {cfg.label} Override
                    </span>
                  )}
                  {h.camera && <span style={{ color: '#374151', fontSize: 9 }}>via {h.camera}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <style>{`
        @keyframes emergencyPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
};

export { EMERGENCY_CONFIG, DIRECTIONS };
export default TrafficSignal;
