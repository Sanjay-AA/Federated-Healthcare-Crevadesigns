import React, { useState } from 'react';
import { mockMedicines } from '../data/mockMedicines';
import { predictDaysToStockOut } from '../lib/forecast';
import { getRedistributionRecommendation } from '../lib/redistribution';

export default function Dashboard({ phcs, onSelectPhc, districtFilter }) {
  const [dispatchedRecs, setDispatchedRecs] = useState({});
  const districts = ['Namakkal', 'Salem', 'Erode'];

  const getStatus = (occupied, total, phcMeds) => {
    const occupancyRate = occupied / total;
    
    // Check if any medicine is near stockout (< 3 days)
    const stockoutTimes = phcMeds.map(m => predictDaysToStockOut(m.consumption_history, m.current_stock));
    const minDays = stockoutTimes.length > 0 ? Math.min(...stockoutTimes) : 999;

    if (occupancyRate >= 0.85 || minDays < 3) {
      return { 
        dot: 'bg-[#D64545]', 
        text: 'text-[#D64545]', 
        label: 'CRITICAL', 
        barBg: 'bg-[#D64545]' 
      };
    }
    if (occupancyRate >= 0.60 || minDays < 7) {
      return { 
        dot: 'bg-[#E8A33D]', 
        text: 'text-[#E8A33D]', 
        label: 'WARNING', 
        barBg: 'bg-[#E8A33D]' 
      };
    }
    return { 
      dot: 'bg-[#0F6B66]', 
      text: 'text-[#0F6B66]', 
      label: 'STABLE', 
      barBg: 'bg-[#0F6B66]' 
    };
  };

  // Filter PHCs
  const filteredPhcs = districtFilter === 'All'
    ? phcs
    : phcs.filter(phc => phc.district === districtFilter);

  const activeDistricts = districtFilter === 'All'
    ? districts
    : districts.filter(d => d === districtFilter);

  // 1. CALCULATE KPI METRICS DYNAMICALLY
  const totalPhcs = filteredPhcs.length;
  
  let criticalCount = 0;
  let atRiskCount = 0;
  let totalBeds = 0;
  let occupiedBeds = 0;
  let totalStaff = 0;
  let staffPresent = 0;
  let medicineShortages = 0;

  filteredPhcs.forEach((phc) => {
    const phcMeds = mockMedicines.filter(m => m.phc_id === phc.id);
    const status = getStatus(phc.occupied_beds, phc.total_beds, phcMeds);
    
    if (status.label === 'CRITICAL') criticalCount++;
    else if (status.label === 'WARNING') atRiskCount++;

    totalBeds += phc.total_beds;
    occupiedBeds += phc.occupied_beds;
    totalStaff += phc.total_staff;
    staffPresent += phc.staff_present_today;

    // Count shortages (stockout in < 3 days)
    phcMeds.forEach((med) => {
      const days = predictDaysToStockOut(med.consumption_history, med.current_stock);
      if (days < 3) medicineShortages++;
    });
  });

  const bedUtilization = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;
  const staffAvailability = totalStaff > 0 ? Math.round((staffPresent / totalStaff) * 100) : 0;

  // 2. SCAN FOR REDISTRIBUTION RECOMMENDATIONS
  const allRecommendations = [];
  filteredPhcs.forEach((phc) => {
    const phcMeds = mockMedicines.filter(med => med.phc_id === phc.id);
    phcMeds.forEach((med) => {
      const daysToStockOut = predictDaysToStockOut(med.consumption_history, med.current_stock);
      if (daysToStockOut < 7) {
        const rec = getRedistributionRecommendation(phc, med.name, phcs, mockMedicines);
        if (rec) {
          allRecommendations.push(rec);
        }
      }
    });
  });

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start animate-fadeIn">
      
      {/* LEFT COLUMN: MAIN WORKSPACE (KPIs, Recommendations, PHC Grids) */}
      <div className="xl:col-span-3 space-y-6">
        
        {/* A. DYNAMIC KPI ROW */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <div className="text-center md:text-left border-r border-slate-100/80 pr-2">
            <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Total PHCs</span>
            <div className="font-mono text-xl font-semibold text-[#0F172A] mt-1">{totalPhcs}</div>
          </div>
          <div className="text-center md:text-left border-r border-slate-100/80 pr-2">
            <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Critical Nodes</span>
            <div className="font-mono text-xl font-semibold text-[#D64545] mt-1">{criticalCount}</div>
          </div>
          <div className="text-center md:text-left border-r border-slate-100/80 pr-2">
            <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">At-Risk Nodes</span>
            <div className="font-mono text-xl font-semibold text-[#E8A33D] mt-1">{atRiskCount}</div>
          </div>
          <div className="text-center md:text-left border-r border-slate-100/80 pr-2">
            <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Bed Utilization</span>
            <div className="font-mono text-xl font-semibold text-[#0F172A] mt-1">{bedUtilization}%</div>
          </div>
          <div className="text-center md:text-left border-r border-slate-100/80 pr-2">
            <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Staff On-Duty</span>
            <div className="font-mono text-xl font-semibold text-[#0F172A] mt-1">{staffAvailability}%</div>
          </div>
          <div className="text-center md:text-left pr-2">
            <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Drug Shortages</span>
            <div className="font-mono text-xl font-semibold text-[#D64545] mt-1">{medicineShortages}</div>
          </div>
        </div>

        {/* B. P2P RECOMMENDATIONS PANEL */}
        {allRecommendations.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold text-[#1D4E89] uppercase tracking-wider">
                  Recommended Resource Transfers
                </h3>
                <span className="text-[9px] font-semibold text-indigo-500 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded uppercase tracking-wider">
                  AI Recommendation
                </span>
              </div>
              <p className="text-[11px] text-[#64748B] mt-0.5">AI-generated · Updated 2 min ago</p>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-100 rounded">
              {allRecommendations.map((rec, idx) => {
                const recKey = `${rec.from_phc.id}-${rec.to_phc.id}-${rec.medicine}`;
                const isDispatched = dispatchedRecs[recKey];

                return (
                  <div 
                    key={idx} 
                    className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#FDFDFD] hover:bg-[#F8FAFC] transition-colors"
                  >
                    {/* Left: Info Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-center flex-1">
                      <div>
                        <span className="text-[9px] text-[#64748B] font-semibold tracking-wider uppercase block">Medicine</span>
                        <span className="text-xs font-bold text-[#0F172A] font-heading">{rec.medicine.toUpperCase()}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-[#64748B] font-semibold tracking-wider uppercase block">Quantity</span>
                        <span className="text-xs font-mono font-bold text-[#1D4E89]">{rec.quantity} UNITS</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[9px] text-[#64748B] font-semibold tracking-wider uppercase block">Dispatch Route</span>
                        <span className="text-xs text-[#0F172A] font-medium leading-none">
                          {rec.from_phc.name} <span className="text-[#64748B]">→</span> {rec.to_phc.name}
                        </span>
                        <span className="text-[10px] text-[#64748B] font-mono block mt-0.5">({rec.distance_km} km)</span>
                      </div>
                    </div>
                    {/* Right: Approve action */}
                    <button
                      onClick={() => setDispatchedRecs(prev => ({ ...prev, [recKey]: !prev[recKey] }))}
                      className={`h-9 px-4 rounded text-xs font-semibold tracking-wider border select-none cursor-pointer transition-colors ${
                        isDispatched 
                          ? 'bg-[#0F6B66]/10 border-[#0F6B66]/20 text-[#0F6B66]' 
                          : 'bg-[#1D4E89] border-[#1D4E89] text-white hover:bg-[#153B68]'
                      }`}
                    >
                      {isDispatched ? '✓ Approved' : 'Approve'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* C. PHC GRIDS BY DISTRICT */}
        <div className="space-y-6">
          {activeDistricts.map((districtName) => {
            const districtPhcs = filteredPhcs.filter(phc => phc.district === districtName);
            if (districtPhcs.length === 0) return null;

            return (
              <div key={districtName} className="space-y-3">
                {/* District Section Title */}
                <div className="flex items-center gap-3">
                  <h2 className="text-xs font-bold text-[#1D4E89] tracking-wider uppercase font-heading">
                    {districtName} District
                  </h2>
                  <span className="px-2 py-0.5 text-[9px] font-semibold rounded bg-[#F0F5FA] text-[#1D4E89] border border-[#E2E8F0] font-mono">
                    {districtPhcs.length} Nodes
                  </span>
                  <div className="h-px bg-slate-200 flex-1 ml-2"></div>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {districtPhcs.map((phc) => {
                    const phcMeds = mockMedicines.filter(m => m.phc_id === phc.id);
                    const status = getStatus(phc.occupied_beds, phc.total_beds, phcMeds);
                    const occupancyRate = Math.round((phc.occupied_beds / phc.total_beds) * 100);
                    const staffRate = Math.round((phc.staff_present_today / phc.total_staff) * 100);
                    
                    const isCritical = status.label === 'CRITICAL';

                    // Get detailed stockout predictions for card display
                    const medPara = phcMeds.find(m => m.name === 'Paracetamol');
                    const medIv = phcMeds.find(m => m.name === 'IV Fluids');
                    
                    const paraDays = medPara ? predictDaysToStockOut(medPara.consumption_history, medPara.current_stock) : 999;
                    const ivDays = medIv ? predictDaysToStockOut(medIv.consumption_history, medIv.current_stock) : 999;

                    const stockoutTimes = phcMeds.map(m => predictDaysToStockOut(m.consumption_history, m.current_stock));
                    const minDays = stockoutTimes.length > 0 ? Math.min(...stockoutTimes) : 999;

                    return (
                      <div
                        key={phc.id}
                        onClick={() => onSelectPhc(phc)}
                        className={`group bg-white border rounded-lg p-5 flex flex-col justify-between hover:bg-[#F8FAFC] transition-colors cursor-pointer ${
                          isCritical 
                            ? 'border-l-4 border-l-[#D64545] border-slate-200' 
                            : 'border-slate-200 hover:border-slate-350'
                        }`}
                      >
                        {/* Header Details */}
                        <div className="space-y-1">
                          <div className="flex justify-between items-start gap-2">
                            <h3 className="font-heading font-semibold text-[#0F172A] group-hover:text-[#1D4E89] text-[15px] transition-colors line-clamp-1">
                              {phc.name}
                            </h3>
                          </div>
                          <div className="flex items-center justify-between text-xs text-[#64748B]">
                            <span>TN / {phc.district}</span>
                            <span className="flex items-center gap-1.5 font-bold text-[10px] tracking-wider">
                              <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`}></span>
                              <span className={status.text}>{status.label}</span>
                            </span>
                          </div>
                          {minDays < 7 && (
                            <span className={`inline-block font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border mt-1 select-none ${
                              minDays < 3 
                                ? 'bg-[#D64545]/10 border-[#D64545]/20 text-[#D64545] animate-pulse' 
                                : 'bg-[#E8A33D]/10 border-[#E8A33D]/20 text-[#E8A33D]'
                            }`}>
                              {minDays === 0 ? 'STOCK-OUT TODAY' : `STOCK-OUT IN ${minDays} ${minDays === 1 ? 'DAY' : 'DAYS'}`}
                            </span>
                          )}
                        </div>

                        {/* Bed and Staff metrics */}
                        <div className="my-4 space-y-3 pt-3 border-t border-slate-100">
                          {/* Bed occupancy */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-[#64748B] font-medium text-[10px] uppercase tracking-wider">Bed Occupancy</span>
                              <span className="font-mono text-[#0F172A]">
                                {phc.occupied_beds}/{phc.total_beds} <span className={`font-semibold ${occupancyRate >= 85 ? 'text-[#D64545]' : 'text-[#64748B]'}`}>({occupancyRate}%)</span>
                              </span>
                            </div>
                            <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${status.barBg}`} 
                                style={{ width: `${occupancyRate}%` }}
                              ></div>
                            </div>
                          </div>

                          {/* Staff availability */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-[#64748B] font-medium text-[10px] uppercase tracking-wider">Staff Attendance</span>
                              <span className="font-mono text-[#0F172A]">
                                {phc.staff_present_today}/{phc.total_staff} <span className="text-[#64748B]">({staffRate}%)</span>
                              </span>
                            </div>
                            <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full rounded-full bg-[#0F6B66] transition-all duration-500" 
                                style={{ width: `${staffRate}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>

                        {/* Medicine Stocks */}
                        <div className="bg-[#F8FAFC] p-2.5 rounded border border-slate-100 text-xs space-y-1 mb-4">
                          <div className="text-[9px] text-[#64748B] font-semibold uppercase tracking-wider mb-1">Stock Projections</div>
                          <div className="flex justify-between">
                            <span className="text-[#64748B]">Paracetamol</span>
                            <span className={`font-mono ${paraDays < 3 ? 'text-[#D64545] font-semibold' : 'text-[#0F172A]'}`}>
                              {medPara ? `${medPara.current_stock} Tab` : 'N/A'}{' '}
                              <span className="text-[9px] text-[#64748B]">({paraDays === 999 ? 'Stable' : `${paraDays}d`})</span>
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#64748B]">IV Fluids</span>
                            <span className={`font-mono ${ivDays < 3 ? 'text-[#D64545] font-semibold' : 'text-[#0F172A]'}`}>
                              {medIv ? `${medIv.current_stock} Bot` : 'N/A'}{' '}
                              <span className="text-[9px] text-[#64748B]">({ivDays === 999 ? 'Stable' : `${ivDays}d`})</span>
                            </span>
                          </div>
                        </div>

                        {/* View Action */}
                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] font-semibold text-[#64748B] group-hover:text-[#1D4E89] transition-colors uppercase tracking-wider">
                          <span>View Facility Comms</span>
                          <svg className="w-3 h-3 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

      </div>

      {/* RIGHT COLUMN: SIDEBAR DETAILS (District Threat Matrix) */}
      <div className="space-y-6">
        
        {/* District Risk Panel */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div>
            <h3 className="text-xs font-semibold text-[#1D4E89] uppercase tracking-wider">
              District Risk Index
            </h3>
            <p className="text-[10px] text-[#64748B] mt-0.5">Aggregated threat assessments</p>
          </div>

          <div className="space-y-4">
            {/* Namakkal */}
            <div className="space-y-1">
              <div className="flex justify-between items-baseline text-xs">
                <span className="font-heading font-semibold text-[#0F172A]">Namakkal Node</span>
                <span className="font-mono text-xs font-bold text-[#D64545]">92% CRITICAL</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full relative">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-[#E8A33D] to-[#D64545] rounded-full opacity-20"></div>
                <div 
                  className="absolute top-1/2 -translate-y-1/2 h-3.5 w-1 bg-[#D64545] rounded"
                  style={{ left: '92%' }}
                ></div>
              </div>
            </div>

            {/* Erode */}
            <div className="space-y-1">
              <div className="flex justify-between items-baseline text-xs">
                <span className="font-heading font-semibold text-[#0F172A]">Erode Node</span>
                <span className="font-mono text-xs font-bold text-[#0F6B66]">24% STABLE</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full relative">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-[#E8A33D] to-[#D64545] rounded-full opacity-20"></div>
                <div 
                  className="absolute top-1/2 -translate-y-1/2 h-3.5 w-1 bg-[#0F6B66] rounded"
                  style={{ left: '24%' }}
                ></div>
              </div>
            </div>

            {/* Salem */}
            <div className="space-y-1">
              <div className="flex justify-between items-baseline text-xs">
                <span className="font-heading font-semibold text-[#0F172A]">Salem Node</span>
                <span className="font-mono text-xs font-bold text-[#0F6B66]">12% STABLE</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full relative">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-[#E8A33D] to-[#D64545] rounded-full opacity-20"></div>
                <div 
                  className="absolute top-1/2 -translate-y-1/2 h-3.5 w-1 bg-[#0F6B66] rounded"
                  style={{ left: '12%' }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* System Diagnostics explainer card */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 text-xs text-[#64748B] space-y-3">
          <div className="font-semibold text-slate-700 uppercase tracking-wider text-[9px]">Platform Intel</div>
          <p className="leading-relaxed">
            Data aggregates hourly from secure edge PHC nodes. Model parameter transfers leverage MPC cryptography to verify state stocks.
          </p>
        </div>

      </div>

    </div>
  );
}
