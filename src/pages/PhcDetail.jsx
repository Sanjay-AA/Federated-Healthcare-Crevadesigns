import React from 'react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ReferenceArea 
} from 'recharts';
import { mockMedicines } from '../data/mockMedicines';
import { predictDaysToStockOut } from '../lib/forecast';

export default function PhcDetail({ phc, medicines = [], loading = false, onBack }) {
  const activeMedsSource = medicines && medicines.length > 0 ? medicines : mockMedicines;
  const phcMedicines = activeMedsSource.filter(med => med.phc_id === phc?.id);

  if (!phc) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16 text-[#64748B] text-xs font-semibold space-x-3 animate-fadeIn">
        <svg className="w-5 h-5 animate-spin text-[#1D4E89]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
        <span>LOADING PHC DETAIL READOUT...</span>
      </div>
    );
  }

  const totalBeds = phc.total_beds || 1;
  const totalStaff = phc.total_staff || 1;
  const occupancyRate = Math.round(((phc.occupied_beds || 0) / totalBeds) * 100);
  const staffRate = Math.round(((phc.staff_present_today || 0) / totalStaff) * 100);

  const getStockStatus = (stock, minRequired) => {
    if (stock <= 0) {
      return { label: 'STOCKOUT', color: 'text-[#D64545] bg-[#D64545]/10 border-[#D64545]/20' };
    }
    if (stock <= minRequired * 0.15) {
      return { label: 'CRITICAL RISK', color: 'text-[#D64545] bg-[#D64545]/10 border-[#D64545]/20 animate-pulse' };
    }
    if (stock < minRequired) {
      return { label: 'LOW STOCK', color: 'text-[#E8A33D] bg-[#E8A33D]/10 border-[#E8A33D]/20' };
    }
    return { label: 'OPTIMAL', color: 'text-[#0F6B66] bg-[#0F6B66]/10 border-[#0F6B66]/20' };
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Back Navigation Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0]">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#1E293B] hover:text-[#1D4E89] bg-white border border-[#E2E8F0] hover:border-[#1D4E89]/40 rounded transition-colors cursor-pointer select-none"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          BACK TO COMMAND CENTER
        </button>
        <span className="text-xs text-[#64748B] font-mono">PHC NODE: {phc.id.toUpperCase()}</span>
      </div>

      {/* Main Info Blocks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Core Profile */}
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-6 flex flex-col justify-between space-y-4">
          <div>
            <span className="text-[10px] font-semibold text-[#1D4E89] tracking-wider uppercase">Facility Profile</span>
            <h2 className="text-xl font-heading font-bold text-[#1E293B] tracking-tight mt-1">{phc.name}</h2>
            <p className="text-xs text-[#64748B] mt-0.5">{phc.district} District · State of Tamil Nadu</p>
          </div>

          <div className="space-y-2 pt-3 border-t border-[#E2E8F0] text-xs">
            <div className="flex justify-between">
              <span className="text-[#64748B] font-medium uppercase tracking-wider text-[10px]">GPS Coordinates</span>
              <span className="font-mono text-[#1E293B] font-medium">{phc.lat ? phc.lat.toFixed(4) : 'N/A'}, {phc.lng ? phc.lng.toFixed(4) : 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748B] font-medium uppercase tracking-wider text-[10px]">Regional Outpost</span>
              <span className="text-[#1E293B] font-medium">Zone 3 (West)</span>
            </div>
          </div>

          {phc.district === 'Namakkal' && phc.id === 'phc-nmk-1' && (
            <div className="bg-[#D64545]/10 border border-[#D64545]/20 rounded p-4 space-y-1.5">
              <div className="flex items-center gap-2 text-[#D64545] font-bold text-xs uppercase tracking-wide">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Active Epidemic Outbreak
              </div>
              <p className="text-[11px] text-[#D64545]/85 leading-normal">
                High regional waterlogging has triggered acute dengue/malaria surges. Hospital bed occupancy and key medicine stocks are under critical stress.
              </p>
            </div>
          )}
        </div>

        {/* Capacity Overview */}
        <div className="lg:col-span-2 bg-white border border-[#E2E8F0] rounded-lg p-6 space-y-4">
          <h3 className="text-xs font-semibold text-[#1D4E89] uppercase tracking-wider">Capacity & Operations Readout</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Bed Occupancy Card */}
            <div className="bg-[#F7F9FB] border border-[#E2E8F0] rounded p-4 space-y-2.5">
              <div className="flex justify-between items-center text-[10px] text-[#64748B] font-semibold uppercase tracking-wider">
                <span>Bed Occupancy</span>
                <span className={occupancyRate >= 85 ? 'text-[#D64545]' : 'text-[#64748B]'}>{occupancyRate}%</span>
              </div>
              <div className="text-xl font-bold text-[#1E293B]">
                <span className="font-mono text-2xl">{phc.occupied_beds}</span>
                <span className="text-xs font-normal text-[#64748B]"> / {phc.total_beds} occupied beds</span>
              </div>
              <div className="h-1.5 w-full bg-[#E2E8F0] rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    occupancyRate >= 85 ? 'bg-[#D64545]' : occupancyRate >= 60 ? 'bg-[#E8A33D]' : 'bg-[#0F6B66]'
                  }`} 
                  style={{ width: `${occupancyRate}%` }}
                ></div>
              </div>
              <p className="text-[11px] text-[#64748B]">
                {phc.total_beds - phc.occupied_beds} operational beds remaining.
              </p>
            </div>

            {/* Staff Attendance Card */}
            <div className="bg-[#F7F9FB] border border-[#E2E8F0] rounded p-4 space-y-2.5">
              <div className="flex justify-between items-center text-[10px] text-[#64748B] font-semibold uppercase tracking-wider">
                <span>Staff Attendance</span>
                <span className="text-[#0F6B66]">{staffRate}%</span>
              </div>
              <div className="text-xl font-bold text-[#1E293B]">
                <span className="font-mono text-2xl">{phc.staff_present_today}</span>
                <span className="text-xs font-normal text-[#64748B]"> / {phc.total_staff} active staff</span>
              </div>
              <div className="h-1.5 w-full bg-[#E2E8F0] rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full bg-[#0F6B66] transition-all duration-500" 
                  style={{ width: `${staffRate}%` }}
                ></div>
              </div>
              <p className="text-[11px] text-[#64748B]">
                {phc.total_staff - phc.staff_present_today} staff offline today.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Outbreak Medicine Inventories */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-bold text-[#1D4E89] uppercase tracking-wider">Epidemic Resource Analytics</h3>
          <p className="text-xs text-[#64748B]">
            Current stock versus 14-day local consumption history. Spike detection highlights uncharacteristic resource drain.
          </p>
        </div>

        {phcMedicines.length === 0 ? (
          <div className="bg-white border border-[#E2E8F0] rounded-lg p-8 text-center text-xs text-[#64748B]">
            No medicine inventory records found for this Primary Health Centre.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {phcMedicines.map((med) => {
              const minRequired = med.minimum_stock || (med.name === 'Paracetamol' ? 300 : med.name === 'IV Fluids' ? 200 : 150);
              const status = getStockStatus(med.current_stock, minRequired);
              
              const history = med.consumption_history || [];
              const baselineDays = 7;
              const baselineSum = history.slice(0, baselineDays).reduce((sum, d) => sum + (d.quantity_used || 0), 0);
              const baselineAvg = baselineSum / Math.min(baselineDays, Math.max(1, history.length)) || 1;
              const latestValue = history[history.length - 1]?.quantity_used || 0;
              const spikeRatio = latestValue / baselineAvg;
              const hasSpike = spikeRatio >= 2.0;
              const percentIncrease = Math.round((spikeRatio - 1) * 100);

              let spikeStartDate = null;
              if (hasSpike) {
                const spikePoint = history.find((d, idx) => idx >= 4 && d.quantity_used >= baselineAvg * 1.5);
                if (spikePoint) {
                  spikeStartDate = spikePoint.date;
                }
              }

              // Predict days until stock-out
              const daysToStockOut = predictDaysToStockOut(history, med.current_stock);

              return (
                <div 
                  key={med.id} 
                  className="bg-white border border-[#E2E8F0] rounded-lg p-5 flex flex-col justify-between space-y-4"
                >
                  {/* Title Row */}
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-heading font-bold text-[#1E293B] text-base">{med.name}</h4>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded border shrink-0 ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="text-[10px] font-medium text-[#64748B] bg-[#F7F9FB] px-2 py-0.5 rounded border border-[#E2E8F0]">
                        STOCK: <span className="font-mono text-[#1E293B] font-semibold">{med.current_stock}</span> {med.unit ? med.unit.toUpperCase() : 'UNITS'}
                      </span>
                      {hasSpike && (
                        <span className="text-[9px] font-bold text-[#D64545] bg-[#D64545]/10 border border-[#D64545]/20 px-2 py-0.5 rounded tracking-wide">
                          ⚠️ SPIKE (+{percentIncrease}%)
                        </span>
                      )}
                      {daysToStockOut < 3 ? (
                        <span className="text-[9px] font-bold text-[#D64545] bg-[#D64545]/10 border border-[#D64545]/20 px-2 py-0.5 rounded tracking-wide animate-pulse uppercase">
                          ⚠️ Stock-out predicted in {daysToStockOut} {daysToStockOut === 1 ? 'day' : 'days'}
                        </span>
                      ) : daysToStockOut < 7 ? (
                        <span className="text-[9px] font-bold text-[#E8A33D] bg-[#E8A33D]/10 border border-[#E8A33D]/20 px-2 py-0.5 rounded tracking-wide uppercase">
                          ⚠️ Stock-out predicted in {daysToStockOut} days
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Line Chart */}
                  <div className="bg-[#F7F9FB] border border-[#E2E8F0] rounded p-3">
                    <div className="text-[10px] text-[#64748B] font-semibold mb-2 uppercase tracking-wider">
                      14-Day Demand Run-Rate
                    </div>
                    <div className="h-[180px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart 
                          data={history} 
                          margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" opacity={0.6} />
                          <XAxis 
                            dataKey="date" 
                            stroke="#64748B" 
                            fontSize={9} 
                            tickLine={false} 
                          />
                          <YAxis 
                            stroke="#64748B" 
                            fontSize={9} 
                            tickLine={false} 
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#FFFFFF', 
                              borderColor: '#E2E8F0', 
                              borderRadius: '4px',
                              color: '#1E293B',
                              fontSize: '11px',
                              boxShadow: 'none'
                            }} 
                          />
                          {hasSpike && spikeStartDate && (
                            <ReferenceArea 
                              x1={spikeStartDate} 
                              x2={history[history.length - 1]?.date} 
                              fill="#D64545" 
                              fillOpacity={0.03}
                            />
                          )}
                          <Line 
                            type="monotone" 
                            dataKey="quantity_used" 
                            stroke={hasSpike ? '#D64545' : '#1D4E89'} 
                            strokeWidth={2}
                            dot={{ r: 1.5, fill: hasSpike ? '#D64545' : '#1D4E89', strokeWidth: 0 }}
                            activeDot={{ r: 3.5, strokeWidth: 0 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Card Info Footer */}
                  <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-between text-xs text-[#64748B]">
                    <span>REQUIRED SAFETY:</span>
                    <span className="font-semibold text-[#1E293B] font-mono">{minRequired} {med.unit ? med.unit.toUpperCase() : 'UNITS'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
