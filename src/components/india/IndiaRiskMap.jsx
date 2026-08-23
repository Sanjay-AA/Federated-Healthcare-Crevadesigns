import React, { useState } from 'react';
import { calculateStateRiskScore } from '../../lib/nationalAggregation';

export default function IndiaRiskMap({ phcs = [], medicines = [], diseaseReports = [], onSelectState }) {
  const [hoveredState, setHoveredState] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // List of states to render on our stylized map
  const statesConfig = [
    { id: 'JK', name: 'Jammu & Kashmir', cx: 200, cy: 90, r: 24, label: 'J&K' },
    { id: 'HP', name: 'Himachal Pradesh', cx: 215, cy: 135, r: 16, label: 'HP' },
    { id: 'PB', name: 'Punjab', cx: 180, cy: 155, r: 18, label: 'PB' },
    { id: 'HR', name: 'Haryana', cx: 200, cy: 185, r: 18, label: 'HR' },
    { id: 'DL', name: 'Delhi', cx: 210, cy: 200, r: 10, label: 'DL' },
    { id: 'RJ', name: 'Rajasthan', cx: 130, cy: 220, r: 38, label: 'RJ' },
    { id: 'UP', name: 'Uttar Pradesh', cx: 265, cy: 215, r: 35, label: 'UP' },
    { id: 'GJ', name: 'Gujarat', cx: 90, cy: 310, r: 32, label: 'GJ' },
    { id: 'MP', name: 'Madhya Pradesh', cx: 210, cy: 300, r: 40, label: 'MP' },
    { id: 'BR', name: 'Bihar', cx: 340, cy: 220, r: 28, label: 'BR' },
    { id: 'WB', name: 'West Bengal', cx: 375, cy: 280, r: 24, label: 'WB' },
    { id: 'NE', name: 'North East', cx: 450, cy: 190, r: 28, label: 'NE' },
    { id: 'OR', name: 'Odisha', cx: 310, cy: 360, r: 30, label: 'OR' },
    { id: 'MH', name: 'Maharashtra', cx: 170, cy: 390, r: 38, label: 'MH', isActive: true },
    { id: 'TL', name: 'Telangana', cx: 230, cy: 430, r: 22, label: 'TS' },
    { id: 'AP', name: 'Andhra Pradesh', cx: 245, cy: 480, r: 26, label: 'AP' },
    { id: 'KA', name: 'Karnataka', cx: 180, cy: 490, r: 30, label: 'KA' },
    { id: 'KL', name: 'Kerala', cx: 185, cy: 560, r: 20, label: 'KL', isActive: true },
    { id: 'TN', name: 'Tamil Nadu', cx: 235, cy: 550, r: 26, label: 'TN', isActive: true }
  ];

  const getRiskColor = (score) => {
    if (score >= 80) return '#D64545'; // RED - Critical
    if (score >= 60) return '#E8A33D'; // ORANGE - High
    if (score >= 40) return '#F1C40F'; // YELLOW - Moderate
    return '#0F6B66'; // GREEN - Low
  };

  const getRiskBgClass = (score) => {
    if (score >= 80) return 'bg-[#D64545]/10 border-[#D64545]/20 text-[#D64545]';
    if (score >= 60) return 'bg-[#E8A33D]/10 border-[#E8A33D]/20 text-[#E8A33D]';
    if (score >= 40) return 'bg-yellow-50 border-yellow-250 text-yellow-600';
    return 'bg-[#0F6B66]/10 border-[#0F6B66]/20 text-[#0F6B66]';
  };

  const handleMouseMove = (e) => {
    // Get local bounds to position tooltip correctly
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({
      x: e.clientX - rect.left + 15,
      y: e.clientY - rect.top + 15
    });
  };

  return (
    <div className="relative border border-[#E2E8F0] bg-white rounded-[10px] p-4 flex flex-col justify-between shadow-xs select-none">
      
      {/* Title section */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
        <div>
          <h3 className="text-xs font-bold text-[#0f172a] uppercase tracking-wider">India Health Resource Map</h3>
          <p className="text-[10px] text-[#64748B] mt-0.5">Interactive state-wide aggregated risk matrix</p>
        </div>
        
        {/* Color Legend */}
        <div className="flex items-center gap-3 text-[10px] font-bold">
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[#0F6B66]"></span>
            <span>LOW</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[#F1C40F]"></span>
            <span>MOD</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[#E8A33D]"></span>
            <span>HIGH</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[#D64545]"></span>
            <span>CRIT</span>
          </div>
        </div>
      </div>

      {/* SVG Canvas */}
      <div 
        className="w-full overflow-hidden relative flex justify-center items-center h-[520px]"
        onMouseMove={handleMouseMove}
      >
        <svg 
          viewBox="30 50 460 550" 
          className="w-full h-full max-h-[500px]"
        >
          {/* Outline connections representing the cooperative health grid */}
          <line x1="200" y1="90" x2="215" y2="135" stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="3,3" />
          <line x1="215" y1="135" x2="180" y2="155" stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="3,3" />
          <line x1="180" y1="155" x2="200" y2="185" stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="3,3" />
          <line x1="200" y1="185" x2="210" y2="200" stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="3,3" />
          <line x1="210" y1="200" x2="130" y2="220" stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="3,3" />
          <line x1="210" y1="200" x2="265" y2="215" stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="3,3" />
          <line x1="130" y1="220" x2="90" y2="310" stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="3,3" />
          <line x1="265" y1="215" x2="340" y2="220" stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="3,3" />
          <line x1="340" y1="220" x2="375" y2="280" stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="3,3" />
          <line x1="340" y1="220" x2="450" y2="190" stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="3,3" />
          <line x1="265" y1="215" x2="210" y2="300" stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="3,3" />
          <line x1="90" y1="310" x2="210" y2="300" stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="3,3" />
          <line x1="210" y1="300" x2="310" y2="360" stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="3,3" />
          <line x1="90" y1="310" x2="170" y2="390" stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="3,3" />
          <line x1="210" y1="300" x2="170" y2="390" stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="3,3" />
          <line x1="170" y1="390" x2="230" y2="430" stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="3,3" />
          <line x1="230" y1="430" x2="310" y2="360" stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="3,3" />
          <line x1="230" y1="430" x2="245" y2="480" stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="3,3" />
          <line x1="170" y1="390" x2="180" y2="490" stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="3,3" />
          <line x1="180" y1="490" x2="245" y2="480" stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="3,3" />
          <line x1="180" y1="490" x2="185" y2="560" stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="3,3" />
          <line x1="245" y1="480" x2="235" y2="550" stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="3,3" />
          <line x1="185" y1="560" x2="235" y2="550" stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="3,3" />

          {/* Render India state nodes */}
          {statesConfig.map((st) => {
            const riskInfo = calculateStateRiskScore(st.name, phcs, medicines, diseaseReports);
            const fillColor = getRiskColor(riskInfo.score);
            const isHovered = hoveredState?.id === st.id;

            return (
              <g 
                key={st.id}
                onMouseEnter={() => setHoveredState({ ...st, riskInfo })}
                onMouseLeave={() => setHoveredState(null)}
                onClick={() => onSelectState(st.name)}
                className="cursor-pointer transition-all duration-150"
              >
                {/* Node circle outline shadow */}
                <circle 
                  cx={st.cx} 
                  cy={st.cy} 
                  r={st.r + (isHovered ? 4 : 0)} 
                  fill={fillColor} 
                  fillOpacity={isHovered ? 0.9 : 0.75}
                  stroke={isHovered ? '#1E293B' : '#FFFFFF'} 
                  strokeWidth={isHovered ? 2.5 : 1.5}
                  className="transition-all duration-150"
                />

                {/* State Label */}
                <text 
                  x={st.cx} 
                  y={st.cy + 4} 
                  textAnchor="middle" 
                  fill="#FFFFFF" 
                  className="text-[9px] font-sans font-bold select-none pointer-events-none"
                >
                  {st.label}
                </text>

                {/* Pulsing indicator for active monitoring states */}
                {st.isActive && (
                  <circle 
                    cx={st.cx} 
                    cy={st.cy} 
                    r={st.r + 8} 
                    fill="none" 
                    stroke={fillColor} 
                    strokeWidth="1.5" 
                    className="animate-pulse opacity-45 pointer-events-none"
                  />
                )}
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Card */}
        {hoveredState && (
          <div 
            className="absolute z-50 bg-white border border-[#E2E8F0] shadow-md rounded-[6px] p-3 text-xs w-48 font-sans space-y-1.5 transition-all pointer-events-none select-none"
            style={{ 
              left: `${tooltipPos.x}px`, 
              top: `${tooltipPos.y}px` 
            }}
          >
            <div className="flex justify-between items-center pb-1 border-b border-slate-100">
              <span className="font-bold text-[#0F172A]">{hoveredState.name}</span>
              <span className="text-[9px] font-mono font-bold uppercase tracking-wider">
                {hoveredState.id}
              </span>
            </div>
            
            <div className="space-y-1 text-[#64748B] text-[11px] leading-relaxed">
              <div className="flex justify-between font-medium">
                <span>Aggregated Risk:</span>
                <span className={`font-bold ${
                  hoveredState.riskInfo.severity === 'CRITICAL' ? 'text-[#D64545]' : hoveredState.riskInfo.severity === 'HIGH' ? 'text-[#E8A33D]' : 'text-[#0f172a]'
                }`}>
                  {hoveredState.riskInfo.score}% {hoveredState.riskInfo.severity}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Beds Occupancy:</span>
                <span className="font-mono text-slate-800 font-semibold">{hoveredState.riskInfo.bedOccupancyPct}%</span>
              </div>
              <div className="flex justify-between">
                <span>Staff Present:</span>
                <span className="font-mono text-slate-800 font-semibold">{hoveredState.riskInfo.workforceAttendancePct}%</span>
              </div>
              <div className="flex justify-between border-t border-slate-50 pt-1 mt-1 font-semibold text-[10px]">
                <span>Critical Outposts:</span>
                <span className={hoveredState.riskInfo.criticalPhcsCount > 0 ? 'text-[#D64545]' : 'text-slate-700'}>
                  {hoveredState.riskInfo.criticalPhcsCount} PHC(s)
                </span>
              </div>
            </div>
            <div className="text-[9px] text-blue-600 font-bold uppercase tracking-wider pt-1 flex items-center justify-between">
              <span>Status:</span>
              <span>{hoveredState.riskInfo.totalPhcs > 0 ? 'Active Network' : 'No monitoring nodes'}</span>
            </div>
          </div>
        )}
      </div>

      <div className="text-[10px] text-slate-400 text-center italic mt-2">
        * Stylized node map represent state aggregator channels. Click a state to drill down into its local Command Center.
      </div>
    </div>
  );
}
