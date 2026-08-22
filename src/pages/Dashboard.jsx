import React, { useState } from 'react';

import { predictDaysToStockOut, calculateDistrictRisk } from '../lib/forecast';
import { getRedistributionRecommendation } from '../lib/redistribution';
import { useLanguage } from '../i18n/LanguageContext';

export default function Dashboard({ 
  phcs = [], 
  medicines = [], 
  transfers = [], 
  districts = [], 
  diseaseReports = [], 
  federatedModel = null, 
  loading = false, 
  onSelectPhc, 
  districtFilter,
  onBackToIndia
}) {
  const { t } = useLanguage();
  const [dispatchedRecs, setDispatchedRecs] = useState({});

  const districtList = districts && districts.length > 0
    ? districts.map(d => d.name)
    : Array.from(new Set(['Namakkal', 'Salem', 'Erode', ...phcs.map(p => p.district)]));

  const activeMeds = medicines || [];

  const getStatus = (occupied, total, phcMeds) => {
    const occupancyRate = total > 0 ? occupied / total : 0;
    
    // Check if any medicine is near stockout (< 3 days)
    const stockoutTimes = phcMeds.map(m => predictDaysToStockOut(m.consumption_history, m.current_stock));
    const minDays = stockoutTimes.length > 0 ? Math.min(...stockoutTimes) : 999;

    if (occupancyRate >= 0.85 || minDays < 3) {
      return { 
        dot: 'bg-[#D64545]', 
        text: 'text-[#D64545]', 
        code: 'CRITICAL',
        label: t('dashboard.grid.critical'), 
        barBg: 'bg-[#D64545]' 
      };
    }
    if (occupancyRate >= 0.60 || minDays < 7) {
      return { 
        dot: 'bg-[#E8A33D]', 
        text: 'text-[#E8A33D]', 
        code: 'WARNING',
        label: t('dashboard.grid.warning'), 
        barBg: 'bg-[#E8A33D]' 
      };
    }
    return { 
      dot: 'bg-[#0F6B66]', 
      text: 'text-[#0F6B66]', 
      code: 'STABLE',
      label: t('dashboard.grid.stable'), 
      barBg: 'bg-[#0F6B66]' 
    };
  };

  // Filter PHCs
  const filteredPhcs = districtFilter === 'All'
    ? phcs
    : phcs.filter(phc => phc.district === districtFilter);

  const activeDistricts = districtFilter === 'All'
    ? districtList
    : districtList.filter(d => d === districtFilter);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center p-16 text-[#64748B] text-xs font-semibold space-x-3 animate-fadeIn">
        <svg className="w-5 h-5 animate-spin text-[#1D4E89]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
        <span>{t('dashboard.loading')}</span>
      </div>
    );
  }

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
    const phcMeds = activeMeds.filter(m => m.phc_id === phc.id);
    const status = getStatus(phc.occupied_beds, phc.total_beds, phcMeds);
    
    if (status.code === 'CRITICAL') criticalCount++;
    else if (status.code === 'WARNING') atRiskCount++;

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
    const phcMeds = activeMeds.filter(med => med.phc_id === phc.id);
    phcMeds.forEach((med) => {
      const daysToStockOut = predictDaysToStockOut(med.consumption_history, med.current_stock);
      if (daysToStockOut < 7) {
        const rec = getRedistributionRecommendation(phc, med.name, phcs, activeMeds);
        if (rec) {
          allRecommendations.push(rec);
        }
      }
    });
  });

  // Fallback to Firestore transfers if available and no recommendations generated
  if (allRecommendations.length === 0 && transfers.length > 0) {
    transfers.forEach((tDoc) => {
      const fromPhc = phcs.find(p => p.id === tDoc.from_phc_id);
      const toPhc = phcs.find(p => p.id === tDoc.to_phc_id);
      if (fromPhc && toPhc) {
        allRecommendations.push({
          from_phc: fromPhc,
          to_phc: toPhc,
          medicine: tDoc.medicine_name || tDoc.medicine_id,
          quantity: tDoc.quantity,
          distance_km: tDoc.distance_km
        });
      }
    });
  }

  if (totalPhcs === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-12 text-center text-xs text-[#64748B] animate-fadeIn">
        <svg className="w-8 h-8 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
        <p className="font-semibold text-slate-700">{t('dashboard.noPhcNodes.title')}</p>
        <p className="mt-1 text-slate-500">{t('dashboard.noPhcNodes.desc')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      {onBackToIndia && (
        <div className="flex items-center justify-between bg-white border border-[#E2E8F0] px-4 py-2.5 rounded-lg shadow-2xs">
          <button
            type="button"
            onClick={onBackToIndia}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-[#1D4E89] bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors cursor-pointer"
          >
            <span>← India Overview</span>
          </button>
          <span className="text-xs font-semibold text-[#64748B]">
            Viewing State Command Center
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
        {/* LEFT COLUMN: MAIN WORKSPACE (KPIs, Recommendations, PHC Grids) */}
        <div className="xl:col-span-3 space-y-5">
        
        {/* Critical Operations Alert Banner */}
        {criticalCount > 0 && (
          <div className="bg-[#D64545]/10 border border-[#D64545]/20 rounded-[8px] p-3 px-4 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-[#D64545]">
              <span className="font-bold flex items-center gap-1.5 uppercase text-[11px] tracking-wide shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Critical Alert
              </span>
              <span className="text-[#0F172A] font-medium hidden sm:inline">
                {criticalCount} facility node(s) currently experiencing severe stockout or capacity pressure.
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold text-[#D64545] bg-[#D64545]/10 px-2 py-0.5 rounded border border-[#D64545]/20">
              ATTENTION REQUIRED
            </span>
          </div>
        )}

        {/* A. DYNAMIC KPI ROW */}
        <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-3.5 px-4 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 shadow-xs">
          <div className="text-left border-r border-[#E2E8F0] pr-2">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">{t('dashboard.kpi.totalPhcs')}</span>
            <div className="font-sans text-lg font-bold text-[#0F172A] mt-0.5">{totalPhcs}</div>
          </div>
          <div className="text-left border-r border-[#E2E8F0] pr-2">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">{t('dashboard.kpi.criticalNodes')}</span>
            <div className="font-sans text-lg font-bold text-[#D64545] mt-0.5">{criticalCount}</div>
          </div>
          <div className="text-left border-r border-[#E2E8F0] pr-2">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">{t('dashboard.kpi.atRiskNodes')}</span>
            <div className="font-sans text-lg font-bold text-[#E8A33D] mt-0.5">{atRiskCount}</div>
          </div>
          <div className="text-left border-r border-[#E2E8F0] pr-2">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">{t('dashboard.kpi.bedUtilization')}</span>
            <div className="font-sans text-lg font-bold text-[#0F172A] mt-0.5">{bedUtilization}%</div>
          </div>
          <div className="text-left border-r border-[#E2E8F0] pr-2">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">{t('dashboard.kpi.staffOnDuty')}</span>
            <div className="font-sans text-lg font-bold text-[#0F172A] mt-0.5">{staffAvailability}%</div>
          </div>
          <div className="text-left pr-1">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">{t('dashboard.kpi.drugShortages')}</span>
            <div className="font-sans text-lg font-bold text-[#D64545] mt-0.5">{medicineShortages}</div>
          </div>
        </div>

        {/* B. P2P RECOMMENDATIONS PANEL */}
        {allRecommendations.length > 0 && (
          <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-4 space-y-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold text-[#0F172A] uppercase tracking-wider">
                  {t('dashboard.recs.title')}
                </h3>
                <span className="text-[9px] font-semibold text-blue-600 bg-blue-50 border border-blue-150/70 px-1.5 py-0.5 rounded-[4px] uppercase tracking-wider">
                  {t('dashboard.recs.aiBadge')}
                </span>
              </div>
              <p className="text-[10px] text-[#64748B] mt-0.5">{t('dashboard.recs.subtitle')}</p>
            </div>

            <div className="divide-y divide-slate-100 border border-[#E2E8F0] rounded-[6px] overflow-hidden">
              {allRecommendations.map((rec, idx) => {
                const recKey = `${rec.from_phc.id}-${rec.to_phc.id}-${rec.medicine}`;
                const isDispatched = dispatchedRecs[recKey];

                return (
                  <div 
                    key={idx} 
                    className="p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#FDFDFD] hover:bg-[#F8FAFC] transition-colors"
                  >
                    {/* Left: Info Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-center flex-1 text-xs">
                      <div>
                        <span className="text-[9px] text-[#64748B] font-semibold tracking-wider uppercase block">{t('dashboard.recs.medicine')}</span>
                        <span className="font-semibold text-[#0F172A]">{rec.medicine}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-[#64748B] font-semibold tracking-wider uppercase block">{t('dashboard.recs.quantity')}</span>
                        <span className="font-mono font-semibold text-[#0F172A]">{rec.quantity} {t('dashboard.recs.units')}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[9px] text-[#64748B] font-semibold tracking-wider uppercase block">{t('dashboard.recs.dispatchRoute')}</span>
                        <span className="text-[#0F172A] font-medium leading-none">
                          {rec.from_phc.name} <span className="text-[#64748B]">→</span> {rec.to_phc.name}
                        </span>
                        <span className="text-[10px] text-[#64748B] font-mono block mt-0.5">({rec.distance_km} km)</span>
                      </div>
                    </div>
                    {/* Right: Approve action */}
                    <button
                      onClick={() => setDispatchedRecs(prev => ({ ...prev, [recKey]: !prev[recKey] }))}
                      className={`h-8 px-3 rounded-[6px] text-xs font-medium tracking-wider border select-none cursor-pointer transition-colors ${
                        isDispatched 
                          ? 'bg-emerald-50 border-emerald-250 text-emerald-700' 
                          : 'bg-[#0F172A] border-[#0F172A] text-white hover:bg-slate-800'
                      }`}
                    >
                      {isDispatched ? t('dashboard.recs.approved') : t('dashboard.recs.approve')}
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
                    {districtName} {t('dashboard.grid.districtSuffix')}
                  </h2>
                  <span className="px-2 py-0.5 text-[9px] font-semibold rounded bg-[#F0F5FA] text-[#1D4E89] border border-[#E2E8F0] font-mono">
                    {districtPhcs.length} {t('dashboard.grid.nodesSuffix')}
                  </span>
                  <div className="h-px bg-slate-200 flex-1 ml-2"></div>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {districtPhcs.map((phc) => {
                    const phcMeds = activeMeds.filter(m => m.phc_id === phc.id);
                    const status = getStatus(phc.occupied_beds, phc.total_beds, phcMeds);
                    const occupancyRate = phc.total_beds > 0 ? Math.round((phc.occupied_beds / phc.total_beds) * 100) : 0;
                    const staffRate = phc.total_staff > 0 ? Math.round((phc.staff_present_today / phc.total_staff) * 100) : 0;
                    
                    const isCritical = status.code === 'CRITICAL';

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
                        className={`group bg-white border rounded-[8px] p-4 flex flex-col justify-between hover:border-slate-300 transition-colors cursor-pointer ${
                          isCritical 
                            ? 'border-l-2 border-l-[#D64545] border-slate-200' 
                            : 'border-slate-200'
                        }`}
                      >
                        {/* Header Details */}
                        <div className="space-y-1">
                          <div className="flex justify-between items-start gap-1">
                            <h3 className="font-sans font-semibold text-[#0F172A] text-[13px] group-hover:text-[#1D4E89] transition-colors line-clamp-1">
                              {phc.name}
                            </h3>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-[#64748B]">
                            <span>{phc.district} {t('dashboard.grid.districtSuffix')}</span>
                            <span className="flex items-center gap-1 font-bold text-[9px] tracking-wider">
                              <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`}></span>
                              <span className={status.text}>{status.label}</span>
                            </span>
                          </div>
                          {minDays < 7 && (
                            <span className={`inline-block font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border mt-0.5 select-none ${
                              minDays < 3 
                                ? 'bg-[#D64545]/10 border-[#D64545]/20 text-[#D64545] animate-pulse' 
                                : 'bg-[#E8A33D]/10 border-[#E8A33D]/20 text-[#E8A33D]'
                            }`}>
                              {minDays === 0 ? t('dashboard.grid.stockOutToday') : t('dashboard.grid.stockOutIn', { days: minDays })}
                            </span>
                          )}
                        </div>

                        {/* Bed and Staff metrics inline */}
                        <div className="my-3 space-y-2 pt-2 border-t border-slate-100 text-[11px]">
                          {/* Bed occupancy */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <span className="text-[#64748B] text-[9px] uppercase tracking-wider">{t('dashboard.grid.beds')}</span>
                              <span className="font-medium text-[#0F172A]">{phc.occupied_beds}/{phc.total_beds}</span>
                            </div>
                            <div className="w-20 h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${status.barBg}`} 
                                style={{ width: `${occupancyRate}%` }}
                              ></div>
                            </div>
                          </div>

                          {/* Staff availability */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <span className="text-[#64748B] text-[9px] uppercase tracking-wider">{t('dashboard.grid.staff')}</span>
                              <span className="font-medium text-[#0F172A]">{phc.staff_present_today}/{phc.total_staff}</span>
                            </div>
                            <div className="w-20 h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full rounded-full bg-[#0F6B66] transition-all duration-500" 
                                style={{ width: `${staffRate}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>

                        {/* Medicine Stocks */}
                        <div className="bg-[#F8FAFC] p-2 rounded-[6px] border border-slate-150/60 text-[11px] space-y-1 mb-3">
                          <div className="text-[9px] text-[#64748B] font-semibold uppercase tracking-wider mb-0.5">{t('dashboard.grid.stockProjections')}</div>
                          <div className="flex justify-between">
                            <span className="text-[#64748B]">Paracetamol</span>
                            <span className={`font-mono ${paraDays < 3 ? 'text-[#D64545] font-semibold' : 'text-[#0F172A]'}`}>
                              {medPara ? `${medPara.current_stock} ${t('dashboard.grid.tab')}` : 'N/A'}{' '}
                              <span className="text-[9px] text-[#64748B]">({paraDays === 999 ? t('dashboard.grid.stableDays') : `${paraDays}d`})</span>
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#64748B]">IV Fluids</span>
                            <span className={`font-mono ${ivDays < 3 ? 'text-[#D64545] font-semibold' : 'text-[#0F172A]'}`}>
                              {medIv ? `${medIv.current_stock} ${t('dashboard.grid.bot')}` : 'N/A'}{' '}
                              <span className="text-[9px] text-[#64748B]">({ivDays === 999 ? t('dashboard.grid.stableDays') : `${ivDays}d`})</span>
                            </span>
                          </div>
                        </div>

                        {/* View Action */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[9px] font-semibold text-[#64748B] group-hover:text-[#1D4E89] transition-colors uppercase tracking-wider">
                          <span>{t('dashboard.grid.viewFacilityComms')}</span>
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
        <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-4 space-y-3">
          <div>
            <h3 className="text-xs font-semibold text-[#0F172A] uppercase tracking-wider">
              {t('dashboard.risk.title')}
            </h3>
            <p className="text-[10px] text-[#64748B] mt-0.5">{t('dashboard.risk.subtitle')}</p>
          </div>

          <div className="space-y-3">
            {districtList.map((dName) => {
              const riskInfo = calculateDistrictRisk(dName, diseaseReports, phcs, activeMeds, federatedModel);
              
              return (
                <div key={dName} className="space-y-1">
                  <div className="flex justify-between items-baseline text-xs">
                    <span className="font-sans font-medium text-[#475569]">{dName} {t('dashboard.risk.nodeSuffix')}</span>
                    <span className={`font-mono text-[11px] font-bold ${riskInfo.severity === 'CRITICAL' ? 'text-[#D64545]' : riskInfo.severity === 'HIGH' ? 'text-[#E8A33D]' : 'text-[#0F6B66]'}`}>
                      {riskInfo.riskScore}% {riskInfo.severity}
                    </span>
                  </div>
                  <div className="h-1 w-full bg-slate-100 rounded-full relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500 rounded-full opacity-15"></div>
                    <div 
                      className={`absolute top-1/2 -translate-y-1/2 h-2 w-1.5 rounded-[1px] ${
                        riskInfo.severity === 'CRITICAL' ? 'bg-[#D64545]' : riskInfo.severity === 'HIGH' ? 'bg-[#E8A33D]' : 'bg-[#0F6B66]'
                      }`}
                      style={{ left: `${Math.min(96, Math.max(2, riskInfo.riskScore))}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* System Diagnostics explainer card */}
        <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-4 text-[11px] text-[#64748B] space-y-2">
          <div className="font-semibold text-[#0F172A] uppercase tracking-wider text-[9px]">{t('dashboard.platformIntel.title')}</div>
          <p className="leading-relaxed">
            {t('dashboard.platformIntel.desc')}
          </p>
        </div>

        </div>

      </div>
    </div>
  );
}
