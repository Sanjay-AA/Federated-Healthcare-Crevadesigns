import React, { useMemo, useState, useEffect } from 'react';
import { 
  aggregateNationalMetrics, 
  calculateStateRiskScore, 
  getNationalPriorityFacilities,
  getNationalMedicineSupplyRisk,
  getPhcStatus
} from '../lib/nationalAggregation';
import IndiaRiskMap from '../components/india/IndiaRiskMap';
import { getRedistributionRecommendation } from '../lib/redistribution';
import { useLanguage } from '../i18n/LanguageContext';
import { generateSituationBriefing } from '../lib/geminiInsights';

export default function IndiaDashboard({ 
  phcs = [], 
  medicines = [], 
  transfers = [], 
  districts = [], 
  diseaseReports = [], 
  loading = false, 
  onSelectState, 
  onSelectDistrict, 
  onSelectPhc, 
  onSimulateResponse 
}) {
  const { t, language } = useLanguage();
  const [briefingText, setBriefingText] = useState('');
  const [briefingLoading, setBriefingLoading] = useState(false);

  // 1. Core National Metrics Aggregation
  const nationalMetrics = useMemo(() => {
    return aggregateNationalMetrics(phcs, medicines, districts);
  }, [phcs, medicines, districts]);

  // 2. Risk Distribution calculation
  const riskDistribution = useMemo(() => {
    let low = 0, moderate = 0, high = 0, critical = 0;
    phcs.forEach(p => {
      const phcMeds = medicines.filter(m => m.phc_id === p.id);
      const status = getPhcStatus(p, phcMeds);
      if (status.code === 'CRITICAL') critical++;
      else if (status.code === 'WARNING') high++;
      else if (status.code === 'STABLE') {
        const occupancy = p.total_beds > 0 ? (p.occupied_beds / p.total_beds) * 100 : 0;
        if (occupancy >= 40) moderate++;
        else low++;
      }
    });
    return { low, moderate, high, critical };
  }, [phcs, medicines]);

  // 3. States list sorted dynamically by risk
  const statesSummary = useMemo(() => {
    const uniqueStates = Array.from(new Set(phcs.map(p => p.state).filter(Boolean)));
    if (uniqueStates.length === 0) uniqueStates.push('Tamil Nadu');

    return uniqueStates.map(st => {
      const riskInfo = calculateStateRiskScore(st, phcs, medicines, diseaseReports);
      return {
        name: st,
        ...riskInfo
      };
    }).sort((a, b) => b.score - a.score);
  }, [phcs, medicines, diseaseReports]);

  // 4. Priority Critical PHCs
  const priorityPhcs = useMemo(() => {
    return getNationalPriorityFacilities(phcs, medicines).slice(0, 5);
  }, [phcs, medicines]);

  // 5. Supply Risks
  const supplyRisks = useMemo(() => {
    return getNationalMedicineSupplyRisk(phcs, medicines).slice(0, 4);
  }, [phcs, medicines]);

  // 6. Cross-District Redistribution Opportunities
  const redistributionOpportunities = useMemo(() => {
    const opportunities = [];
    const criticalPHCs = phcs.filter(p => {
      const phcMeds = medicines.filter(m => m.phc_id === p.id);
      const status = getPhcStatus(p, phcMeds);
      return status.code === 'CRITICAL';
    });

    criticalPHCs.forEach(recipient => {
      const recMeds = medicines.filter(m => m.phc_id === recipient.id && m.current_stock < (m.reorder_level || 100));
      recMeds.forEach(med => {
        const rec = getRedistributionRecommendation(recipient, med.name, phcs, medicines);
        if (rec) {
          opportunities.push({
            recipient,
            donor: rec.from_phc,
            medicine: med.name,
            quantity: rec.quantity,
            distanceKm: rec.distance_km
          });
        }
      });
    });
    return opportunities.slice(0, 3);
  }, [phcs, medicines]);

  // 7. National AI situation briefing trigger
  const triggerBriefing = async () => {
    setBriefingLoading(true);
    setBriefingText('');
    
    // Construct aggregated structured state for Gemini
    const nationalDecision = {
      nationalRiskScore: nationalMetrics.nationalRiskScore,
      severity: nationalMetrics.nationalSeverity,
      criticalPHCs: nationalMetrics.criticalPhcsCount,
      medicineRiskCount: nationalMetrics.medicineRiskCount,
      bedOccupancy: nationalMetrics.bedOccupancy,
      workforceAttendance: nationalMetrics.workforceAttendance,
      statesCovered: nationalMetrics.statesCount,
      topCriticalState: statesSummary[0]?.name || 'N/A',
      highestRiskPhc: priorityPhcs[0]?.phc.name || 'N/A',
      criticalMedicine: supplyRisks[0]?.name || 'N/A'
    };

    try {
      const responseText = await generateSituationBriefing(nationalDecision, language);
      setBriefingText(responseText);
    } catch (err) {
      console.error("Failed to generate national briefing:", err);
      // Fallback
      const fallbackObj = {
        headline: `National Health Resource Pressure at ${nationalMetrics.nationalSeverity} Level`,
        situation: `India aggregator is monitoring ${nationalMetrics.phcsCount} PHCs across ${nationalMetrics.statesCount} states. Current national bed occupancy is at ${nationalMetrics.bedOccupancy}%, and workforce availability is ${nationalMetrics.workforceAttendance}%.`,
        riskExplanation: `${nationalMetrics.criticalPhcsCount} PHC outposts are experiencing CRITICAL pressure due to imminent medicine depletion or capacity breach.`,
        recommendedAction: `Deploy AI redistribution and initiate resource response dispatches from surplus zones.`,
        reason: `${statesSummary[0]?.name || 'Tamil Nadu'} requires immediate administrative focus due to high regional case trends.`,
        priority: nationalMetrics.nationalSeverity === 'CRITICAL' || nationalMetrics.nationalSeverity === 'HIGH' ? 'HIGH' : 'MEDIUM',
        confidenceNote: "Local calculation (Deterministic Aggregate model, Gemini API offline)"
      };
      setBriefingText(JSON.stringify(fallbackObj));
    } finally {
      setBriefingLoading(false);
    }
  };

  useEffect(() => {
    if (phcs.length > 0) {
      triggerBriefing();
    }
  }, [phcs, language]);

  const parsedBriefing = useMemo(() => {
    if (!briefingText) return null;
    try {
      const start = briefingText.indexOf('{');
      const end = briefingText.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        return JSON.parse(briefingText.substring(start, end + 1));
      }
      return JSON.parse(briefingText);
    } catch (e) {
      console.warn("Failed to parse Gemini national briefing:", e);
      return null;
    }
  }, [briefingText]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16 text-[#64748B] text-xs font-semibold space-x-3 animate-fadeIn">
        <svg className="w-5 h-5 animate-spin text-[#1D4E89]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
        <span>LOADING NATIONAL HEALTH INTELLIGENCE...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn text-[#0F172A] font-sans">
      
      {/* Top command header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E2E8F0] gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🇮🇳</span>
            <h1 className="text-xl font-bold tracking-tight">India National Command Center</h1>
          </div>
          <p className="text-xs text-[#64748B] mt-1 font-medium">
            National Health Resource Intelligence · Centralized Monitoring & AI Emergency Operations
          </p>
        </div>

        <div className="flex items-center gap-2 text-[11px]">
          <span className="px-2.5 py-1 font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded-full font-mono">
            AGGREGATOR PROTOTYPE
          </span>
          <span className="text-[#64748B] font-mono">Data: Simulated Sandbox</span>
        </div>
      </div>

      {/* SECTION 1: NATIONAL KPI CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        
        <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-3.5 shadow-xs">
          <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">States Covered</span>
          <div className="font-sans text-xl font-bold text-[#0F172A] mt-1">{nationalMetrics.statesCount} States</div>
          <span className="text-[9px] text-[#64748B] block mt-0.5">Active state registers</span>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-3.5 shadow-xs">
          <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Districts Monitored</span>
          <div className="font-sans text-xl font-bold text-[#0F172A] mt-1">{nationalMetrics.districtsCount} Districts</div>
          <span className="text-[9px] text-[#64748B] block mt-0.5">Regional health hubs</span>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-3.5 shadow-xs">
          <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">PHCs Monitored</span>
          <div className="font-sans text-xl font-bold text-[#0F172A] mt-1">{nationalMetrics.phcsCount} Nodes</div>
          <span className="text-[9px] text-[#64748B] block mt-0.5">Primary health outposts</span>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-3.5 shadow-xs">
          <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Critical PHCs</span>
          <div className="font-sans text-xl font-bold text-[#D64545] mt-1">{nationalMetrics.criticalPhcsCount} PHCs</div>
          <span className="text-[9px] text-[#D64545] font-bold block mt-0.5">⚠️ Attention Required</span>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-3.5 shadow-xs">
          <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Beds Occupancy</span>
          <div className="font-sans text-xl font-bold text-[#0F172A] mt-1">{nationalMetrics.bedOccupancy}%</div>
          <span className="text-[9px] text-[#64748B] block mt-0.5">National capacity rate</span>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-3.5 shadow-xs">
          <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Workforce attendance</span>
          <div className="font-sans text-xl font-bold text-[#0F6B66] mt-1">{nationalMetrics.workforceAttendance}%</div>
          <span className="text-[9px] text-[#0F6B66] font-bold block mt-0.5">Staff on duty</span>
        </div>

      </div>

      {/* SECTION 2: MAP & SCORE SPLIT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Map Visualization */}
        <div className="lg:col-span-2">
          <IndiaRiskMap 
            phcs={phcs} 
            medicines={medicines} 
            diseaseReports={diseaseReports} 
            onSelectState={onSelectState} 
          />
        </div>

        {/* Risk Gauge Panel */}
        <div className="space-y-6">
          
          <div className="bg-white border border-[#E2E8F0] rounded-[10px] p-4 space-y-4 shadow-xs">
            <div>
              <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">National Health Resource Risk</h3>
              <p className="text-[10px] text-[#64748B] mt-0.5">Aggregated threat index across monitored zones</p>
            </div>

            <div className="flex flex-col items-center justify-center py-4 space-y-2 border-y border-slate-100">
              <span className={`text-4xl font-black font-mono ${
                nationalMetrics.nationalRiskScore >= 60 ? 'text-[#D64545]' : nationalMetrics.nationalRiskScore >= 40 ? 'text-[#E8A33D]' : 'text-[#0F6B66]'
              }`}>
                {nationalMetrics.nationalRiskScore} / 100
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded border uppercase ${
                nationalMetrics.nationalRiskScore >= 80 ? 'bg-red-50 border-red-200 text-[#D64545]' :
                nationalMetrics.nationalRiskScore >= 60 ? 'bg-amber-50 border-amber-200 text-[#E8A33D]' :
                'bg-emerald-50 border-emerald-250 text-[#0F6B66]'
              }`}>
                {nationalMetrics.nationalSeverity} Threat Level
              </span>
            </div>

            <div className="space-y-2 text-xs text-[#64748B] leading-relaxed">
              <div className="font-bold text-[#0f172a] uppercase tracking-wider text-[9px]">Calculated Factors (Weighted):</div>
              <div className="flex justify-between">
                <span>Medicine Shortages (30%):</span>
                <span className="font-mono text-slate-800 font-semibold">{nationalMetrics.medicineRiskCount} items</span>
              </div>
              <div className="flex justify-between">
                <span>Bed occupancy capacity (20%):</span>
                <span className="font-mono text-slate-800 font-semibold">{nationalMetrics.bedOccupancy}%</span>
              </div>
              <div className="flex justify-between">
                <span>Workforce attendance (15%):</span>
                <span className="font-mono text-slate-800 font-semibold">{nationalMetrics.workforceAttendance}%</span>
              </div>
              <div className="flex justify-between">
                <span>Outposts in critical state (15%):</span>
                <span className="font-mono text-slate-800 font-semibold">{nationalMetrics.criticalPhcsCount} PHCs</span>
              </div>
              <div className="flex justify-between">
                <span>Regional Outbreak Surge (20%):</span>
                <span className="font-mono text-slate-800 font-semibold">+42% Dengue growth</span>
              </div>
            </div>
            
            <div className="text-[10px] text-slate-400 italic">
              * Score weights configured for testing and demonstration purposes. Source code uses custom config arrays.
            </div>
          </div>

          {/* AI Situation briefing */}
          <div className="bg-white border border-[#E2E8F0] rounded-[10px] p-4 space-y-3 shadow-xs">
            <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5">
              <svg className="w-4 h-4 text-blue-600 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              AI National Situation Brief
            </h3>
            
            {briefingLoading ? (
              <div className="py-6 text-center text-xs text-[#64748B] font-semibold animate-pulse">
                Requesting Gemini briefing parameters...
              </div>
            ) : parsedBriefing ? (
              <div className="space-y-2.5 text-xs text-[#475569] leading-relaxed">
                <div>
                  <span className="font-bold text-[#0F172A] text-[13px] block leading-tight">{parsedBriefing.headline}</span>
                  <span className="text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-1 rounded inline-block mt-1 font-mono uppercase">
                    Aggregator summary
                  </span>
                </div>
                <p><span className="font-semibold text-slate-800">Current Situation:</span> {parsedBriefing.situation}</p>
                <p><span className="font-semibold text-slate-800">Alerts & Threat:</span> {parsedBriefing.riskExplanation}</p>
                <p><span className="font-semibold text-slate-800">Action Plan:</span> {parsedBriefing.recommendedAction}</p>
                <div className="text-[9px] text-slate-400 italic border-t border-slate-100 pt-1.5">
                  {parsedBriefing.confidenceNote || 'Facts verified deterministic model'}
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#64748B] italic">Briefing unavailable. System calculations remain functional.</p>
            )}
          </div>

        </div>

      </div>

      {/* SECTION 3: STATES ATTENTION & CRITICAL PHCS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* States attention table */}
        <div className="bg-white border border-[#E2E8F0] rounded-[10px] p-4 space-y-3 shadow-xs">
          <div>
            <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">States Requiring Attention</h3>
            <p className="text-[10px] text-[#64748B] mt-0.5">States ranked by dynamic health resource risk scores</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-slate-50 text-[#64748B] font-bold uppercase tracking-wider text-[9.5px]">
                  <th className="py-2 px-3">Rank</th>
                  <th className="py-2 px-3">State</th>
                  <th className="py-2 px-3 text-center">Calculated Risk</th>
                  <th className="py-2 px-3 text-center">Critical PHCs</th>
                  <th className="py-2 px-3 text-center">Beds Occupied</th>
                  <th className="py-2 px-3 text-center">Workforce</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150/70">
                {statesSummary.map((st, idx) => (
                  <tr 
                    key={st.name} 
                    onClick={() => onSelectState(st.name)}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <td className="py-2.5 px-3 font-mono font-bold text-[#64748B]">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-semibold text-[#1E293B]">{st.name}</td>
                    <td className="py-2.5 px-3 text-center font-bold font-mono">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] border ${
                        st.score >= 80 ? 'bg-red-50 border-red-200 text-[#D64545]' :
                        st.score >= 60 ? 'bg-amber-50 border-amber-200 text-[#E8A33D]' :
                        'bg-emerald-50 border-emerald-250 text-[#0F6B66]'
                      }`}>
                        {st.score}% {st.severity}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-semibold text-[#0F172A]">{st.criticalPhcsCount} PHCs</td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-600">{st.bedOccupancyPct}%</td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-600">{st.workforceAttendancePct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Priority Critical PHCs table */}
        <div className="bg-white border border-[#E2E8F0] rounded-[10px] p-4 space-y-3 shadow-xs">
          <div>
            <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">National Priority PHC Nodes</h3>
            <p className="text-[10px] text-[#64748B] mt-0.5">Top-priority facilities currently experiencing severe shortages</p>
          </div>

          {priorityPhcs.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#64748B] font-semibold italic">
              All outposts report stable capacity parameters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-slate-50 text-[#64748B] font-bold uppercase tracking-wider text-[9.5px]">
                    <th className="py-2 px-3">Facility</th>
                    <th className="py-2 px-3">State</th>
                    <th className="py-2 px-3">Shortage Item</th>
                    <th className="py-2 px-3 text-center">Stockout</th>
                    <th className="py-2 px-3 text-center">Beds</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150/70">
                  {priorityPhcs.map((item, idx) => (
                    <tr 
                      key={idx}
                      onClick={() => onSelectPhc(item.phc)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <td className="py-2.5 px-3 font-semibold text-[#1E293B]">{item.phc.name}</td>
                      <td className="py-2.5 px-3 text-[#64748B]">{item.phc.state || 'Tamil Nadu'}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-700">{item.medicineName}</td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-[#D64545]">{item.stockoutDays}</td>
                      <td className="py-2.5 px-3 text-center font-mono text-[#0F172A]">{item.bedsOccupancy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* SECTION 4: MEDICINE SUPPLY & BEDS CAPACITY */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Supply Intelligence */}
        <div className="bg-white border border-[#E2E8F0] rounded-[10px] p-4 space-y-3 shadow-xs">
          <div>
            <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">Supply Risk Intelligence</h3>
            <p className="text-[10px] text-[#64748B] mt-0.5">Medicine stock lines with the highest risk profiles</p>
          </div>

          <div className="space-y-3">
            {supplyRisks.map((med, idx) => (
              <div key={idx} className="p-2.5 border border-[#E2E8F0] bg-slate-50/50 rounded-[6px] text-xs flex justify-between items-center">
                <div>
                  <span className="font-bold text-slate-800">{med.name}</span>
                  <span className="block text-[9.5px] text-[#64748B] mt-0.5">Avg state stock coverage: {med.avgCoverage} days</span>
                </div>
                <div className="text-right">
                  <span className="font-bold font-mono text-[#D64545] block">{med.atRiskPhcs} PHCs</span>
                  <span className="text-[9px] text-[#64748B] uppercase font-bold tracking-wide">At Stockout Risk</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Capacity Overview */}
        <div className="bg-white border border-[#E2E8F0] rounded-[10px] p-4 space-y-3 shadow-xs">
          <div>
            <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">National Bed Capacity</h3>
            <p className="text-[10px] text-[#64748B] mt-0.5">Aggregated regional inpatient volume figures</p>
          </div>

          <div className="space-y-2.5 text-xs text-[#64748B]">
            <div className="flex justify-between font-medium">
              <span>Total Monitored Beds:</span>
              <span className="font-mono text-[#0f172a] font-bold">{nationalMetrics.totalBeds} beds</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Occupied Beds Today:</span>
              <span className="font-mono text-[#D64545] font-bold">{nationalMetrics.occupiedBeds} beds</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Vacant Beds Available:</span>
              <span className="font-mono text-[#0F6B66] font-bold">{nationalMetrics.totalBeds - nationalMetrics.occupiedBeds} beds</span>
            </div>
            
            <div className="border-t border-slate-100 pt-2.5 mt-2">
              <span className="text-[9px] font-bold text-[#64748B] uppercase tracking-wider block mb-1">State Bed Pressure:</span>
              <div className="space-y-1.5 font-mono text-[10.5px]">
                {statesSummary.slice(0, 3).map((st) => (
                  <div key={st.name} className="flex justify-between">
                    <span>{st.name}</span>
                    <span className="font-bold text-slate-800">{st.bedOccupancyPct}% Occupied</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Disease Pressure */}
        <div className="bg-white border border-[#E2E8F0] rounded-[10px] p-4 space-y-3 shadow-xs">
          <div>
            <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">Disease Pressure Trends</h3>
            <p className="text-[10px] text-[#64748B] mt-0.5">Weekly growth metrics derived from edge data registers</p>
          </div>

          <div className="space-y-3 text-xs leading-relaxed">
            <div className="p-2 border border-slate-100 rounded-[6px] space-y-1 bg-slate-50/20">
              <div className="flex justify-between font-semibold">
                <span>Dengue Outbreak Surge</span>
                <span className="text-[#D64545] font-bold font-mono">+42.0%</span>
              </div>
              <p className="text-[10px] text-[#64748B] leading-snug">
                Highest concentration registered in Namakkal Outpost cluster. Secondary signs in Ernakulam.
              </p>
            </div>

            <div className="p-2 border border-slate-100 rounded-[6px] space-y-1 bg-slate-50/20">
              <div className="flex justify-between font-semibold">
                <span>Malaria Surveillance</span>
                <span className="text-[#E8A33D] font-bold font-mono">+18.4%</span>
              </div>
              <p className="text-[10px] text-[#64748B] leading-snug">
                Consistent trends observed in Thrissur Outpost. Core stock safety remains stable.
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* SECTION 5: REDISTRIBUTION & RESPONSE COOP */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* P2P Opportunities */}
        <div className="lg:col-span-2 bg-white border border-[#E2E8F0] rounded-[10px] p-4 space-y-3 shadow-xs">
          <div>
            <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">Cross-District Resource Opportunities</h3>
            <p className="text-[10px] text-[#64748B] mt-0.5">Inter-facility surplus redistribution proposals</p>
          </div>

          {redistributionOpportunities.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#64748B] font-semibold italic">
              All outposts operate within safety stock buffers.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-100 rounded-[6px] overflow-hidden">
              {redistributionOpportunities.map((op, idx) => (
                <div key={idx} className="p-3 flex justify-between items-center text-xs hover:bg-slate-50 transition-colors">
                  <div className="space-y-1">
                    <span className="font-bold text-[#0f172a] block">{op.medicine}</span>
                    <span className="text-[#64748B] block leading-none">
                      {op.donor.name} (Surplus) <span className="text-slate-400">→</span> {op.recipient.name} (Shortage)
                    </span>
                    <span className="text-[10.5px] font-mono text-slate-500 block">Distance: {op.distanceKm} km</span>
                  </div>

                  <button
                    onClick={() => onSimulateResponse(op.recipient, { name: op.medicine })}
                    className="px-2.5 py-1.5 bg-[#0F172A] hover:bg-slate-800 text-white rounded font-bold text-[10px] select-none cursor-pointer transition-colors shadow-xs"
                  >
                    Simulate →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Call to Response Page Actions */}
        <div className="bg-white border border-[#E2E8F0] rounded-[10px] p-4 space-y-3 shadow-xs">
          <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">AI National Resource Response</h3>
          
          <div className="space-y-3 text-xs text-[#64748B] leading-relaxed">
            <p>
              The system scans the national healthcare database dynamically. Outposts reporting stockouts or beds strain triggers recommended dispatches immediately.
            </p>

            <div className="p-2.5 bg-blue-50/50 border border-blue-100 rounded-[6px] space-y-1.5 text-blue-900 font-medium">
              <div className="flex justify-between">
                <span>Active At-Risk Outposts:</span>
                <span className="font-mono font-bold text-blue-950">{nationalMetrics.criticalPhcsCount} PHC(s)</span>
              </div>
              <div className="flex justify-between">
                <span>Safety Donor Channels:</span>
                <span className="font-mono font-bold text-blue-950">7 Outposts available</span>
              </div>
            </div>

            <button
              onClick={() => onSimulateResponse(null, null)}
              className="w-full mt-2 py-2 bg-blue-600 hover:bg-blue-750 text-white font-bold text-[11px] rounded-[6px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-xs"
            >
              Open Response Engine →
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
