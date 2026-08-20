import React from 'react';
import { mockMedicines } from '../data/mockMedicines';
import { predictDaysToStockOut, calculateDistrictRisk } from '../lib/forecast';

export default function DistrictsSummary({ 
  phcs = [], 
  medicines = [], 
  districts = [], 
  diseaseReports = [], 
  federatedModel = null, 
  loading = false, 
  onSelectDistrict 
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center p-16 text-[#64748B] text-xs font-semibold space-x-3 animate-fadeIn">
        <svg className="w-5 h-5 animate-spin text-[#1D4E89]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
        <span>LOADING DISTRICT NODE SUMMARIES...</span>
      </div>
    );
  }

  const activeMedsSource = medicines && medicines.length > 0 ? medicines : mockMedicines;
  
  // Extract district list from Firestore or fallback
  const districtList = districts.length > 0
    ? districts.map(d => d.name)
    : Array.from(new Set(['Namakkal', 'Salem', 'Erode', ...phcs.map(p => p.district)]));

  const getDistrictMetrics = (districtName) => {
    const districtPhcs = phcs.filter(phc => phc.district === districtName);
    const totalBeds = districtPhcs.reduce((sum, p) => sum + (p.total_beds || 0), 0);
    const occupiedBeds = districtPhcs.reduce((sum, p) => sum + (p.occupied_beds || 0), 0);
    const totalStaff = districtPhcs.reduce((sum, p) => sum + (p.total_staff || 0), 0);
    const staffPresent = districtPhcs.reduce((sum, p) => sum + (p.staff_present_today || 0), 0);
    
    // Find count of at-risk medicines (stock-out < 7 days)
    let atRiskMedsCount = 0;
    districtPhcs.forEach((phc) => {
      const phcMeds = activeMedsSource.filter(m => m.phc_id === phc.id);
      phcMeds.forEach((med) => {
        const days = predictDaysToStockOut(med.consumption_history, med.current_stock);
        if (days < 7) {
          atRiskMedsCount++;
        }
      });
    });

    const bedOccupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;
    const staffAttendanceRate = totalStaff > 0 ? Math.round((staffPresent / totalStaff) * 100) : 0;

    // Calculate dynamic district risk score
    const riskInfo = calculateDistrictRisk(districtName, diseaseReports, phcs, activeMedsSource, federatedModel);
    const riskLevel = riskInfo.severity;
    const riskColor = riskInfo.riskColor;
    const riskPercentage = riskInfo.riskScore;
    const barBg = riskInfo.barBg;

    return {
      totalPhcs: districtPhcs.length,
      totalBeds,
      occupiedBeds,
      bedOccupancyRate,
      totalStaff,
      staffPresent,
      staffAttendanceRate,
      atRiskMedsCount,
      riskLevel,
      riskColor,
      riskPercentage,
      barBg
    };
  };

  if (districtList.length === 0) {
    return (
      <div className="bg-white border border-[#E2E8F0] rounded-lg p-12 text-center text-xs text-[#64748B] animate-fadeIn">
        No health districts found in Firestore database.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="pb-5 border-b border-[#E2E8F0]">
        <h1 className="text-xl font-heading font-semibold text-[#1D4E89]">
          District Node Summaries
        </h1>
        <p className="text-xs text-[#64748B] mt-1">
          Comparative overview of regional health district capacities and crisis assessments from Firestore.
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {districtList.map((dName) => {
          const m = getDistrictMetrics(dName);
          return (
            <div 
              key={dName} 
              className="bg-white border border-[#E2E8F0] rounded-lg p-6 space-y-6 flex flex-col justify-between"
            >
              {/* Header */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading font-bold text-[#1E293B] text-base">{dName} District</h3>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${m.riskColor}`}>
                    {m.riskLevel}
                  </span>
                </div>
                <div className="text-[11px] text-[#64748B]">Node Cluster TN-{dName.toUpperCase().slice(0,3)}</div>
              </div>

              {/* Combined Metrics */}
              <div className="space-y-4">
                {/* Risk Slider Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#64748B] font-medium">District Risk Level</span>
                    <span className="font-mono font-semibold text-[#1E293B]">{m.riskPercentage}%</span>
                  </div>
                  <div className="h-2 w-full bg-[#E2E8F0] rounded-full relative overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${m.barBg}`}
                      style={{ width: `${m.riskPercentage}%` }}
                    ></div>
                  </div>
                </div>

                {/* Details Table */}
                <div className="space-y-2.5 pt-2 border-t border-[#E2E8F0] text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#64748B] font-medium">PHC Outposts</span>
                    <span className="font-mono font-semibold text-[#1E293B]">{m.totalPhcs} Nodes</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B] font-medium">Beds Capacity</span>
                    <span className="font-mono text-[#1E293B]">
                      {m.occupiedBeds}/{m.totalBeds} <span className="text-[#64748B]">({m.bedOccupancyRate}%)</span>
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B] font-medium">Staff Attendance</span>
                    <span className="font-mono text-[#1E293B]">
                      {m.staffPresent}/{m.totalStaff} <span className="text-[#64748B]">({m.staffAttendanceRate}%)</span>
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B] font-medium">Medicines At-Risk</span>
                    <span className={`font-mono font-semibold ${m.atRiskMedsCount > 0 ? 'text-[#D64545]' : 'text-[#0F6B66]'}`}>
                      {m.atRiskMedsCount} items
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={() => onSelectDistrict(dName)}
                className="w-full py-2 bg-[#1D4E89] hover:bg-[#153B68] text-white text-xs font-semibold uppercase tracking-wider rounded transition-colors cursor-pointer select-none"
              >
                Open District Panel
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
