import React from 'react';
import { predictDaysToStockOut } from '../lib/forecast';
import { useLanguage } from '../i18n/LanguageContext';

export default function IndiaOverview({
  phcs = [],
  medicines = [],
  diseaseReports = [],
  alerts = [],
  transfers = [],
  districts = [],
  federatedModel = null,
  loading = false,
  onSelectState,
  onNavigateTab
}) {
  const { t } = useLanguage();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16 text-[#64748B] text-xs font-semibold space-x-3 animate-fadeIn">
        <svg className="w-5 h-5 animate-spin text-[#1D4E89]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
        <span>{t('indiaOverview.loading')}</span>
      </div>
    );
  }

  // 1. DYNAMIC NETWORK COVERAGE METRICS
  const districtStateMap = {};
  districts.forEach(d => {
    if (d.name) districtStateMap[d.name] = d.state;
  });

  const availableStates = Array.from(
    new Set(
      [
        ...districts.map(d => d.state),
        ...phcs.map(p => p.state || districtStateMap[p.district]),
      ].filter(Boolean)
    )
  );
  if (availableStates.length === 0) {
    availableStates.push('Tamil Nadu', 'Kerala', 'Maharashtra');
  }

  const statesCount = availableStates.length;
  const districtsCount = districts.length > 0 
    ? districts.length 
    : new Set(phcs.map(p => p.district)).size;
  const phcsCount = phcs.length;
  const medicinesCount = medicines.length;
  const activeAlertsCount = alerts.length;

  // 2. RESOURCE CALCULATIONS
  let totalBeds = 0;
  let occupiedBeds = 0;
  let totalStaff = 0;
  let staffPresent = 0;

  phcs.forEach(p => {
    totalBeds += Number(p.total_beds || 0);
    occupiedBeds += Number(p.occupied_beds || 0);
    totalStaff += Number(p.total_staff || 0);
    staffPresent += Number(p.staff_present_today || 0);
  });

  const bedUtilizationPct = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;
  const staffAttendancePct = totalStaff > 0 ? Math.round((staffPresent / totalStaff) * 100) : 0;

  // 3. MEDICINE RISK METRICS
  let criticalMedsCount = 0;
  let lowStockMedsCount = 0;

  medicines.forEach(med => {
    const days = predictDaysToStockOut(med.consumption_history || [], med.current_stock || 0);
    if (days < 3 || med.status === 'CRITICAL') {
      criticalMedsCount++;
    } else if (days < 7 || med.status === 'LOW_STOCK') {
      lowStockMedsCount++;
    }
  });

  const totalAtRiskMeds = criticalMedsCount + lowStockMedsCount;

  // 4. NETWORK DISEASE DISTRIBUTION (Dynamic calculation from diseaseReports)
  const getReportState = (r) => {
    if (r.state) return r.state;
    if (r.district && districtStateMap[r.district]) return districtStateMap[r.district];
    return null;
  };

  const calculateDiseaseDistribution = (reportsList) => {
    const diseaseTotals = {};
    let grandTotalCases = 0;

    reportsList.forEach(r => {
      const cases = Number(r.reported_cases || 0);
      const diseaseName = r.disease || 'Other';
      if (cases > 0) {
        diseaseTotals[diseaseName] = (diseaseTotals[diseaseName] || 0) + cases;
        grandTotalCases += cases;
      }
    });

    if (grandTotalCases === 0) return { totalCases: 0, breakdown: [] };

    const breakdown = Object.keys(diseaseTotals).map(dName => {
      const cases = diseaseTotals[dName];
      const pct = Math.round((cases / grandTotalCases) * 1000) / 10;
      return { disease: dName, cases, pct };
    }).sort((a, b) => b.cases - a.cases);

    return { totalCases: grandTotalCases, breakdown };
  };

  const networkDiseaseData = calculateDiseaseDistribution(diseaseReports);

  // Disease Color Palette for Progress Bars & Badges
  const diseaseColors = {
    'Dengue': { bar: 'bg-[#D64545]', text: 'text-[#D64545]', badge: 'bg-rose-50 text-rose-700 border-rose-200' },
    'Malaria': { bar: 'bg-[#E8A33D]', text: 'text-[#E8A33D]', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
    'Typhoid': { bar: 'bg-indigo-500', text: 'text-indigo-600', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    'Influenza': { bar: 'bg-[#0F6B66]', text: 'text-[#0F6B66]', badge: 'bg-teal-50 text-teal-700 border-teal-200' },
    'Acute Respiratory Infection': { bar: 'bg-[#1D4E89]', text: 'text-[#1D4E89]', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
    'ARI': { bar: 'bg-[#1D4E89]', text: 'text-[#1D4E89]', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  };

  const getDiseaseStyle = (dName) => {
    return diseaseColors[dName] || { bar: 'bg-slate-500', text: 'text-slate-600', badge: 'bg-slate-50 text-slate-700 border-slate-200' };
  };

  // 5. ALERT SUMMARY BREAKDOWN BY SEVERITY & STATE
  let criticalAlerts = 0;
  let highAlerts = 0;
  let moderateAlerts = 0;

  const stateAlertCounts = {};
  availableStates.forEach(st => { stateAlertCounts[st] = 0; });

  alerts.forEach(a => {
    const sev = (a.severity || '').toUpperCase();
    if (sev === 'CRITICAL') criticalAlerts++;
    else if (sev === 'HIGH' || sev === 'WARNING') highAlerts++;
    else moderateAlerts++;

    const aState = a.state || (a.district && districtStateMap[a.district]);
    if (aState && stateAlertCounts[aState] !== undefined) {
      stateAlertCounts[aState]++;
    }
  });

  return (
    <div className="space-y-6 animate-fadeIn pb-8">

      {/* ================================================== */}
      {/* 1. NATIONAL COMMAND HEADER & BANNER                */}
      {/* ================================================== */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 md:p-6 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-blue-50/80 via-slate-50/30 to-transparent rounded-full pointer-events-none -mr-20 -mt-20"></div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-[#1D4E89]/10 text-[#1D4E89] border border-[#1D4E89]/20">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1D4E89] animate-pulse"></span>
                {t('indiaOverview.networkBadge')}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                {t('indiaOverview.prototypeBadge')}
              </span>
            </div>

            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[#0F172A]">
              {t('indiaOverview.title')}
            </h1>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#64748B]">
              <span className="font-semibold text-[#0F172A] flex items-center gap-1">
                <svg className="w-4 h-4 text-[#1D4E89]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                {t('indiaOverview.currentCoverage')}
              </span>
              <span className="font-medium text-[#1D4E89] bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                {t('indiaOverview.coverageSummary', { states: statesCount, districts: districtsCount, phcs: phcsCount })}
              </span>
            </div>

            <p className="text-[11px] text-[#64748B]">
              {t('indiaOverview.currentlyCoveredStates')} <strong className="text-[#0F172A]">{availableStates.join(' • ')}</strong>
            </p>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex items-center gap-3 bg-[#F8FAFC] border border-[#E2E8F0] p-3 rounded-lg self-start lg:self-center shrink-0">
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-100">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider font-semibold text-[#64748B]">{t('indiaOverview.federatedConsensus')}</div>
              <div className="text-xs font-bold text-[#0F6B66]">
                {federatedModel ? t('indiaOverview.consensusRound', { round: federatedModel.rounds || 1, accuracy: Math.round((federatedModel.accuracy || 0.94) * 100) }) : t('indiaOverview.activeNodeConsensus')}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================== */}
      {/* 2. NATIONAL KPI CARDS                              */}
      {/* ================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
        
        {/* States Covered */}
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-3.5 shadow-2xs hover:border-slate-300 transition-all">
          <div className="text-[10px] uppercase font-bold tracking-wider text-[#64748B]">{t('indiaOverview.statesCovered')}</div>
          <div className="text-2xl font-bold text-[#0F172A] mt-1 flex items-baseline gap-2">
            {statesCount}
            <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">{t('indiaOverview.active')}</span>
          </div>
          <div className="text-[10px] text-[#64748B] mt-1 truncate">TN, KL, MH Nodes</div>
        </div>

        {/* Districts */}
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-3.5 shadow-2xs hover:border-slate-300 transition-all">
          <div className="text-[10px] uppercase font-bold tracking-wider text-[#64748B]">{t('indiaOverview.districtsMonitored')}</div>
          <div className="text-2xl font-bold text-[#0F172A] mt-1">{districtsCount}</div>
          <div className="text-[10px] text-[#64748B] mt-1">{t('indiaOverview.acrossStateNetworks')}</div>
        </div>

        {/* PHCs */}
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-3.5 shadow-2xs hover:border-slate-300 transition-all">
          <div className="text-[10px] uppercase font-bold tracking-wider text-[#64748B]">{t('indiaOverview.phcsMonitored')}</div>
          <div className="text-2xl font-bold text-[#0F172A] mt-1">{phcsCount}</div>
          <div className="text-[10px] text-[#64748B] mt-1">{t('indiaOverview.primaryHealthCenters')}</div>
        </div>

        {/* Medicines */}
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-3.5 shadow-2xs hover:border-slate-300 transition-all">
          <div className="text-[10px] uppercase font-bold tracking-wider text-[#64748B]">{t('indiaOverview.medicinesTracked')}</div>
          <div className="text-2xl font-bold text-[#0F172A] mt-1">{medicinesCount}</div>
          <div className="text-[10px] text-[#64748B] mt-1">{t('indiaOverview.supplyChainInventory')}</div>
        </div>

        {/* At-Risk Stockouts */}
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-3.5 shadow-2xs hover:border-slate-300 transition-all col-span-2 sm:col-span-1">
          <div className="text-[10px] uppercase font-bold tracking-wider text-[#64748B]">{t('indiaOverview.atRiskStockouts')}</div>
          <div className="text-2xl font-bold text-[#D64545] mt-1 flex items-baseline gap-1.5">
            {totalAtRiskMeds}
            <span className="text-[10px] font-semibold text-[#D64545] bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">
              {t('indiaOverview.criticalCount', { count: criticalMedsCount })}
            </span>
          </div>
          <div className="text-[10px] text-[#64748B] mt-1">{t('indiaOverview.predictedStockout7d')}</div>
        </div>
      </div>

      {/* Secondary Resource KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Total Beds */}
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-[#64748B]">{t('indiaOverview.totalAvailableBeds')}</div>
            <div className="text-xl font-bold text-[#0F172A] mt-0.5">{t('indiaOverview.bedsCount', { count: totalBeds })}</div>
            <div className="text-[11px] text-[#64748B]">{t('indiaOverview.currentlyOccupiedBeds', { count: occupiedBeds })}</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-[#1D4E89]">{bedUtilizationPct}%</div>
            <div className="text-[10px] text-[#64748B]">{t('indiaOverview.utilization')}</div>
          </div>
        </div>

        {/* Staff Attendance */}
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-[#64748B]">{t('indiaOverview.staffAttendance')}</div>
            <div className="text-xl font-bold text-[#0F172A] mt-0.5">{staffPresent} / {totalStaff}</div>
            <div className="text-[11px] text-[#64748B]">{t('indiaOverview.staffOnDuty')}</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-[#0F6B66]">{staffAttendancePct}%</div>
            <div className="text-[10px] text-[#64748B]">{t('indiaOverview.attendance')}</div>
          </div>
        </div>

        {/* Active Alerts */}
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-[#64748B]">{t('indiaOverview.activeAlerts')}</div>
            <div className="text-xl font-bold text-[#0F172A] mt-0.5">{t('indiaOverview.alertsCount', { count: activeAlertsCount })}</div>
            <div className="text-[11px] text-[#64748B]">{t('indiaOverview.criticalPriorityAlerts', { count: criticalAlerts })}</div>
          </div>
          <div className="text-right">
            <span className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded text-xs font-semibold">
              {t('indiaOverview.activeAlertsCount', { count: activeAlertsCount })}
            </span>
          </div>
        </div>
      </div>

      {/* ================================================== */}
      {/* 3. NETWORK DISEASE DISTRIBUTION                    */}
      {/* ================================================== */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 md:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E2E8F0] gap-2">
          <div>
            <h2 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
              <svg className="w-5 h-5 text-[#1D4E89]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              {t('indiaOverview.networkDiseaseDistribution')}
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              {t('indiaOverview.diseaseDistributionSubtitle', { count: diseaseReports.length })}
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs font-semibold text-[#0F172A]">
              {t('indiaOverview.totalCases')} <span className="font-bold text-[#1D4E89]">{networkDiseaseData.totalCases}</span>
            </span>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {networkDiseaseData.breakdown.length > 0 ? (
            networkDiseaseData.breakdown.map((item) => {
              const style = getDiseaseStyle(item.disease);
              return (
                <div key={item.disease} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#0F172A] flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${style.bar}`}></span>
                      {item.disease}
                    </span>
                    <div className="flex items-center gap-3 font-mono">
                      <span className="text-[#64748B]">{t('indiaOverview.diseaseCases', { count: item.cases })}</span>
                      <span className={`font-bold text-sm ${style.text}`}>{item.pct}%</span>
                    </div>
                  </div>
                  
                  {/* Progress Bar Container */}
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
                    <div
                      className={`h-full ${style.bar} transition-all duration-500 rounded-full`}
                      style={{ width: `${Math.max(item.pct, 2)}%` }}
                    ></div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-xs text-[#64748B] text-center py-6">{t('indiaOverview.noDiseaseData')}</div>
          )}
        </div>
      </div>

      {/* ================================================== */}
      {/* 4. STATE HEALTH SNAPSHOT (DYNAMIC STATE CARDS)     */}
      {/* ================================================== */}
      {/* ================================================== */}
      {/* 4. STATE HEALTH SNAPSHOT (DYNAMIC STATE CARDS)     */}
      {/* ================================================== */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
              <svg className="w-5 h-5 text-[#0F6B66]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              {t('indiaOverview.stateHealthSnapshots')}
            </h2>
            <p className="text-xs text-[#64748B]">
              {t('indiaOverview.stateSnapshotsSubtitle')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {availableStates.map((stateName) => {
            // Filter state-specific records
            const stateDistricts = districts.filter(d => d.state === stateName);
            const statePhcs = phcs.filter(p => p.state === stateName || districtStateMap[p.district] === stateName);
            const stateReports = diseaseReports.filter(r => getReportState(r) === stateName);

            // Calculate state disease profile
            const stateDiseaseData = calculateDiseaseDistribution(stateReports);

            return (
              <div
                key={stateName}
                className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-2xs hover:shadow-md hover:border-[#1D4E89]/40 transition-all flex flex-col justify-between group cursor-pointer"
                onClick={() => onSelectState && onSelectState(stateName)}
              >
                <div>
                  {/* Card Top Header */}
                  <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3 mb-4">
                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-[#1D4E89] bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                        {t('indiaOverview.stateNode')}
                      </span>
                      <h3 className="text-lg font-bold text-[#0F172A] mt-1 group-hover:text-[#1D4E89] transition-colors">
                        {stateName}
                      </h3>
                    </div>
                    <span className="w-8 h-8 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-[#1D4E89] group-hover:bg-[#1D4E89] group-hover:text-white transition-all">
                      →
                    </span>
                  </div>

                  {/* Operational Summary */}
                  <div className="grid grid-cols-3 gap-2 text-center bg-[#F8FAFC] p-2.5 rounded-lg border border-[#E2E8F0] mb-4">
                    <div>
                      <div className="text-xs font-bold text-[#0F172A]">{stateDistricts.length || '3'}</div>
                      <div className="text-[9px] uppercase text-[#64748B]">{t('indiaOverview.districtsLabel')}</div>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#0F172A]">{statePhcs.length || '0'}</div>
                      <div className="text-[9px] uppercase text-[#64748B]">{t('indiaOverview.phcsLabel')}</div>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#1D4E89]">{stateDiseaseData.totalCases}</div>
                      <div className="text-[9px] uppercase text-[#64748B]">{t('indiaOverview.totalCasesLabel')}</div>
                    </div>
                  </div>

                  {/* Disease Profile */}
                  <div className="space-y-2 mb-4">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-[#64748B]">
                      {t('indiaOverview.diseaseProfile', { state: stateName })}
                    </div>
                    {stateDiseaseData.breakdown.length > 0 ? (
                      stateDiseaseData.breakdown.slice(0, 5).map((dItem) => {
                        const style = getDiseaseStyle(dItem.disease);
                        return (
                          <div key={dItem.disease} className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-[#0F172A] font-medium">{dItem.disease}</span>
                              <span className={`font-bold font-mono ${style.text}`}>{dItem.pct}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${style.bar} rounded-full`}
                                style={{ width: `${Math.max(dItem.pct, 3)}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-[11px] text-[#64748B] italic py-2">{t('indiaOverview.noStateDiseaseData')}</div>
                    )}
                  </div>
                </div>

                {/* Primary Action Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onSelectState) onSelectState(stateName);
                  }}
                  className="w-full py-2 px-3 bg-slate-900 hover:bg-[#1D4E89] text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-2xs"
                >
                  <span>{t('indiaOverview.viewStateDashboard', { state: stateName })}</span>
                  <span>→</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ================================================== */}
      {/* 5. FEDERATED SYSTEM VISUALIZATION ARCHITECTURE     */}
      {/* ================================================== */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 md:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-[#E2E8F0] pb-3 mb-5 gap-2">
          <div>
            <h2 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
              <svg className="w-5 h-5 text-[#1D4E89]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
              </svg>
              {t('indiaOverview.federatedHealthArchitecture')}
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              {t('indiaOverview.architectureSubtitle')}
            </p>
          </div>
          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 self-start md:self-auto">
            🔒 {t('indiaOverview.privacyPreservingArchitecture')}
          </span>
        </div>

        {/* Architecture Flow Visual */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          {availableStates.map((st) => (
            <div key={st} className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-4 text-center relative">
              <div className="text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-1">{t('indiaOverview.stateNodeTitle', { state: st })}</div>
              <div className="text-[10px] text-[#64748B] space-y-0.5">
                <div>{t('indiaOverview.localPhcsMonitoring')}</div>
                <div>{t('indiaOverview.localDiseaseModels')}</div>
              </div>
              <div className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold text-[#1D4E89] bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                {t('indiaOverview.stateInsights')}
              </div>
            </div>
          ))}
        </div>

        {/* Aggregated Central Hub Visual */}
        <div className="bg-gradient-to-r from-slate-900 to-[#1D4E89] rounded-lg p-4 text-white text-center">
          <div className="text-xs font-bold uppercase tracking-wider text-blue-200">
            {t('indiaOverview.indiaHubTitle')}
          </div>
          <p className="text-xs text-slate-200 mt-1 max-w-2xl mx-auto">
            {t('indiaOverview.indiaHubDesc')}
          </p>
        </div>
      </div>

      {/* ================================================== */}
      {/* 6. NATIONAL ALERT SUMMARY & BREAKDOWN               */}
      {/* ================================================== */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 md:p-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
              <svg className="w-5 h-5 text-[#D64545]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {t('indiaOverview.networkAlertSummary')}
            </h2>
            <p className="text-xs text-[#64748B]">{t('indiaOverview.alertSummarySubtitle')}</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab && onNavigateTab('alerts')}
            className="text-xs font-semibold text-[#1D4E89] hover:underline cursor-pointer"
          >
            {t('indiaOverview.viewAllAlerts', { count: alerts.length })}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Priority Breakdown */}
          <div className="space-y-3">
            <div className="text-[10px] uppercase font-bold tracking-wider text-[#64748B]">{t('indiaOverview.severityBreakdown')}</div>
            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-center">
                <div className="text-lg font-bold text-rose-700">{criticalAlerts}</div>
                <div className="text-[10px] font-semibold text-rose-800 uppercase">{t('indiaOverview.critical')}</div>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-center">
                <div className="text-lg font-bold text-amber-700">{highAlerts}</div>
                <div className="text-[10px] font-semibold text-amber-800 uppercase">{t('indiaOverview.highPriority')}</div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
                <div className="text-lg font-bold text-slate-700">{moderateAlerts}</div>
                <div className="text-[10px] font-semibold text-slate-800 uppercase">{t('indiaOverview.moderate')}</div>
              </div>
            </div>
          </div>

          {/* State Affected Breakdown */}
          <div className="space-y-3">
            <div className="text-[10px] uppercase font-bold tracking-wider text-[#64748B]">{t('indiaOverview.statewiseAlertBreakdown')}</div>
            <div className="space-y-2">
              {availableStates.map(st => (
                <div key={st} className="flex items-center justify-between p-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs">
                  <span className="font-semibold text-[#0F172A]">{st}</span>
                  <span className="font-bold text-[#1D4E89] font-mono">{t('indiaOverview.activeAlertsCount', { count: stateAlertCounts[st] || 0 })}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
