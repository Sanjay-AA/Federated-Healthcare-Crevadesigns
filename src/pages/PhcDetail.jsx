import React, { useState, useEffect } from 'react';
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

import { predictDaysToStockOut, calculateCaseGrowthRate, calculateConsumptionTrend } from '../lib/forecast';
import { predictStockoutDays } from '../lib/vertexPredict';
import { generateSituationBriefing } from '../lib/geminiInsights';
import { predictStockoutDaysTrained, isModelLoaded, loadModel } from '../lib/loadModel';
import { useLanguage } from '../i18n/LanguageContext';

export default function PhcDetail({ phc, medicines = [], loading = false, onBack }) {
  const { t } = useLanguage();
  const activeMedsSource = medicines || [];
  const phcMedicines = activeMedsSource.filter(med => med.phc_id === phc?.id);

  if (!phc) return null;

  // Calculate Dengue and Malaria growth rates for the current PHC
  const reportedCases = phc.reported_cases || [];
  const dengueGrowth = calculateCaseGrowthRate(reportedCases, 'dengue');
  const malariaGrowth = calculateCaseGrowthRate(reportedCases, 'malaria');

  const [modelLoaded, setModelLoaded] = useState(isModelLoaded());
  const [modelLoadFailed, setModelLoadFailed] = useState(false);

  useEffect(() => {
    if (isModelLoaded()) return;

    let isMounted = true;
    loadModel().then(() => {
      if (isMounted) setModelLoaded(true);
    }).catch(err => {
      console.error("TFJS trained model failed to load in page:", err);
      if (isMounted) setModelLoadFailed(true);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const [vertexPredictions, setVertexPredictions] = useState({});
  const [aiBriefings, setAiBriefings] = useState({});

  useEffect(() => {
    let isMounted = true;
    
    if (phcMedicines.length === 0) {
      setVertexPredictions({});
      return;
    }

    async function fetchPredictions() {
      const preds = {};
      phcMedicines.forEach(med => {
        preds[med.id] = undefined;
      });
      setVertexPredictions({ ...preds });

      const promises = phcMedicines.map(async (med) => {
        const history = med.consumption_history || [];
        const trend = calculateConsumptionTrend(history);
        
        let medGrowthRate = 0;
        if (med.name === 'Paracetamol' || med.name === 'Ibuprofen') {
          medGrowthRate = Math.max(dengueGrowth, malariaGrowth);
        } else if (med.name === 'IV Fluids' || med.name === 'ORS') {
          medGrowthRate = dengueGrowth;
        }

        const case_growth_rate = Math.round(medGrowthRate * 100);
        const current_stock = med.current_stock;

        try {
          const prediction = await predictStockoutDays({
            consumption_trend: trend,
            case_growth_rate: case_growth_rate,
            current_stock: current_stock
          });
          
          if (isMounted) {
            setVertexPredictions(prev => ({
              ...prev,
              [med.id]: prediction
            }));
          }
        } catch (err) {
          console.error(`Vertex AI failed for ${med.name}, falling back to local prediction:`, err);
          if (isMounted) {
            setVertexPredictions(prev => ({
              ...prev,
              [med.id]: null
            }));
          }
        }
      });

      await Promise.all(promises);
    }

    fetchPredictions();

    return () => {
      isMounted = false;
    };
  }, [phc.id, medicines, dengueGrowth, malariaGrowth]);

  useEffect(() => {
    let isMounted = true;

    // Identify at-risk medicines based on local forecast (daysToStockOut < 7) or stock below minimum
    const atRiskMeds = phcMedicines.filter(med => {
      const history = med.consumption_history || [];
      let medGrowthRate = 0;
      if (med.name === 'Paracetamol' || med.name === 'Ibuprofen') {
        medGrowthRate = Math.max(dengueGrowth, malariaGrowth);
      } else if (med.name === 'IV Fluids' || med.name === 'ORS') {
        medGrowthRate = dengueGrowth;
      }
      const daysToStockOut = predictDaysToStockOut(history, med.current_stock, medGrowthRate);
      const minRequired = med.minimum_stock || (med.name === 'Paracetamol' ? 300 : med.name === 'IV Fluids' ? 200 : 150);
      
      return daysToStockOut < 7 || med.current_stock < minRequired;
    });

    if (atRiskMeds.length === 0) {
      setAiBriefings({});
      return;
    }

    async function fetchBriefings() {
      const briefings = {};

      const promises = atRiskMeds.map(async (med) => {
        const history = med.consumption_history || [];
        let medGrowthRate = 0;
        if (med.name === 'Paracetamol' || med.name === 'Ibuprofen') {
          medGrowthRate = Math.max(dengueGrowth, malariaGrowth);
        } else if (med.name === 'IV Fluids' || med.name === 'ORS') {
          medGrowthRate = dengueGrowth;
        }

        const daysToStockOut = predictDaysToStockOut(history, med.current_stock, medGrowthRate);
        const case_growth_rate = Math.round(medGrowthRate * 100);

        try {
          const briefing = await generateSituationBriefing({
            phc_name: phc.name,
            district: phc.district,
            medicine_name: med.name,
            predicted_days_to_stockout: daysToStockOut,
            case_growth_rate: case_growth_rate,
            current_stock: med.current_stock
          });
          if (isMounted) {
            briefings[med.id] = briefing;
          }
        } catch (err) {
          console.error("AI briefing failed for med:", med.name, err);
        }
      });

      await Promise.all(promises);

      if (isMounted) {
        setAiBriefings(briefings);
      }
    }

    fetchBriefings();

    return () => {
      isMounted = false;
    };
  }, [phc.id, medicines, dengueGrowth, malariaGrowth]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16 text-[#64748B] text-xs font-semibold space-x-3 animate-fadeIn">
        <svg className="w-5 h-5 animate-spin text-[#1D4E89]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
        <span>{t('phcDetail.loading')}</span>
      </div>
    );
  }

  const totalBeds = phc.total_beds || 1;
  const totalStaff = phc.total_staff || 1;
  const occupancyRate = Math.round(((phc.occupied_beds || 0) / totalBeds) * 100);
  const staffRate = Math.round(((phc.staff_present_today || 0) / totalStaff) * 100);

  const getStockStatus = (stock, minRequired) => {
    if (stock <= 0) {
      return { code: 'STOCKOUT', label: t('phcDetail.analytics.status.stockout'), color: 'text-[#D64545] bg-[#D64545]/10 border-[#D64545]/20' };
    }
    if (stock <= minRequired * 0.15) {
      return { code: 'CRITICAL_RISK', label: t('phcDetail.analytics.status.criticalRisk'), color: 'text-[#D64545] bg-[#D64545]/10 border-[#D64545]/20 animate-pulse' };
    }
    if (stock < minRequired) {
      return { code: 'LOW_STOCK', label: t('phcDetail.analytics.status.lowStock'), color: 'text-[#E8A33D] bg-[#E8A33D]/10 border-[#E8A33D]/20' };
    }
    return { code: 'OPTIMAL', label: t('phcDetail.analytics.status.optimal'), color: 'text-[#0F6B66] bg-[#0F6B66]/10 border-[#0F6B66]/20' };
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Back Navigation Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1E293B] hover:text-[#1D4E89] bg-white border border-[#E2E8F0] hover:border-[#1D4E89]/40 rounded-[6px] transition-colors cursor-pointer select-none"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          {t('phcDetail.back')}
        </button>
        <span className="text-[11px] text-[#64748B] font-mono">{t('phcDetail.phcNode')} {phc.id.toUpperCase()}</span>
      </div>

      {/* Main Info Blocks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Core Profile */}
        <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-4 flex flex-col justify-between space-y-3">
          <div>
            <span className="text-[10px] font-semibold text-[#1D4E89] tracking-wider uppercase">{t('phcDetail.facilityProfile')}</span>
            <h2 className="text-lg font-heading font-bold text-[#1E293B] tracking-tight mt-0.5">{phc.name}</h2>
            <p className="text-xs text-[#64748B] mt-0.5">{t('phcDetail.districtState', { district: phc.district })}</p>
          </div>

          <div className="space-y-1.5 pt-2.5 border-t border-[#E2E8F0] text-[11px]">
            <div className="flex justify-between">
              <span className="text-[#64748B] font-medium uppercase tracking-wider text-[9px]">{t('phcDetail.gpsCoordinates')}</span>
              <span className="font-mono text-[#1E293B] font-medium">{phc.lat ? phc.lat.toFixed(4) : 'N/A'}, {phc.lng ? phc.lng.toFixed(4) : 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748B] font-medium uppercase tracking-wider text-[9px]">{t('phcDetail.regionalOutpost')}</span>
              <span className="text-[#1E293B] font-medium">{t('phcDetail.zoneWest')}</span>
            </div>
          </div>

          {phc.district === 'Namakkal' && phc.id === 'phc-nmk-1' && (
            <div className="bg-[#D64545]/10 border border-[#D64545]/20 rounded-[6px] p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-[#D64545] font-bold text-[11px] uppercase tracking-wide">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {t('phcDetail.epidemicOutbreak.title')}
              </div>
              <p className="text-[10px] text-[#D64545]/85 leading-normal">
                {t('phcDetail.epidemicOutbreak.desc')}
              </p>
            </div>
          )}
        </div>

        {/* Capacity Overview */}
        <div className="lg:col-span-2 bg-white border border-[#E2E8F0] rounded-[8px] p-4 space-y-3">
          <h3 className="text-xs font-semibold text-[#1D4E89] uppercase tracking-wider">{t('phcDetail.capacity.title')}</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bed Occupancy Card */}
            <div className="bg-[#F7F9FB] border border-[#E2E8F0] rounded-[6px] p-3 space-y-2">
              <div className="flex justify-between items-center text-[9px] text-[#64748B] font-semibold uppercase tracking-wider">
                <span>{t('phcDetail.capacity.bedOccupancy')}</span>
                <span className={occupancyRate >= 85 ? 'text-[#D64545]' : 'text-[#64748B]'}>{occupancyRate}%</span>
              </div>
              <div className="text-lg font-bold text-[#1E293B]">
                <span className="font-mono text-xl">{phc.occupied_beds}</span>
                <span className="text-[11px] font-normal text-[#64748B]"> {t('phcDetail.capacity.bedsOccupied', { total: phc.total_beds })}</span>
              </div>
              <div className="h-[4px] w-full bg-[#E2E8F0] rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    occupancyRate >= 85 ? 'bg-[#D64545]' : occupancyRate >= 60 ? 'bg-[#E8A33D]' : 'bg-[#0F6B66]'
                  }`} 
                  style={{ width: `${occupancyRate}%` }}
                ></div>
              </div>
              <p className="text-[10px] text-[#64748B]">
                {t('phcDetail.capacity.bedsRemaining', { remaining: phc.total_beds - phc.occupied_beds })}
              </p>
            </div>

            {/* Staff Attendance Card */}
            <div className="bg-[#F7F9FB] border border-[#E2E8F0] rounded-[6px] p-3 space-y-2">
              <div className="flex justify-between items-center text-[9px] text-[#64748B] font-semibold uppercase tracking-wider">
                <span>{t('phcDetail.capacity.staffAttendance')}</span>
                <span className="text-[#0F6B66]">{staffRate}%</span>
              </div>
              <div className="text-lg font-bold text-[#1E293B]">
                <span className="font-mono text-xl">{phc.staff_present_today}</span>
                <span className="text-[11px] font-normal text-[#64748B]"> {t('phcDetail.capacity.activeStaff', { total: phc.total_staff })}</span>
              </div>
              <div className="h-[4px] w-full bg-[#E2E8F0] rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full bg-[#0F6B66] transition-all duration-500" 
                  style={{ width: `${staffRate}%` }}
                ></div>
              </div>
              <p className="text-[10px] text-[#64748B]">
                {t('phcDetail.capacity.staffOffline', { offline: phc.total_staff - phc.staff_present_today })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* AI Situation Briefing Card */}
      {Object.keys(aiBriefings).length > 0 && (
        <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-4 space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[#0F172A] font-semibold text-xs uppercase tracking-wider">
              <svg className="w-3.5 h-3.5 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              {t('phcDetail.briefing.title')}
            </div>
            <span className="text-[9px] font-semibold text-blue-600 bg-blue-50 border border-blue-150 px-1.5 py-0.5 rounded-[4px]">
              Gemini Flash 2.5
            </span>
          </div>
          <div className="space-y-3 text-xs text-[#475569] leading-relaxed">
            {Object.entries(aiBriefings).map(([medId, text]) => {
              const med = phcMedicines.find(m => m.id === medId);
              return (
                <div key={medId} className="pb-3 border-b border-[#E2E8F0] last:border-0 last:pb-0">
                  <span className="font-semibold uppercase tracking-wider text-[9px] text-[#0F172A] block mb-0.5">
                    {t('phcDetail.briefing.outpostStatus', { med: med?.name })}
                  </span>
                  <p className="text-xs font-normal text-[#475569]">{text}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Outbreak Medicine Inventories */}
      <div className="space-y-3">
        <div>
          <h3 className="text-xs font-bold text-[#1D4E89] uppercase tracking-wider">{t('phcDetail.analytics.title')}</h3>
          <p className="text-xs text-[#64748B]">
            {t('phcDetail.analytics.subtitle')}
          </p>
        </div>

        {phcMedicines.length === 0 ? (
          <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-6 text-center text-xs text-[#64748B]">
            {t('phcDetail.analytics.noRecords')}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

              // Determine case growth rate for this medicine
              let medGrowthRate = 0;
              const growthLabels = [];

              const denguePct = Math.round(dengueGrowth * 100);
              const malariaPct = Math.round(malariaGrowth * 100);

              if (med.name === 'Paracetamol' || med.name === 'Ibuprofen') {
                medGrowthRate = Math.max(dengueGrowth, malariaGrowth);
                growthLabels.push(t('phcDetail.analytics.dengueCases', { percent: denguePct }));
                growthLabels.push(t('phcDetail.analytics.malariaCases', { percent: malariaPct }));
              } else if (med.name === 'IV Fluids' || med.name === 'ORS') {
                medGrowthRate = dengueGrowth;
                growthLabels.push(t('phcDetail.analytics.dengueCases', { percent: denguePct }));
              }

              // Predict days until stock-out
              const daysToStockOut = predictDaysToStockOut(history, med.current_stock, medGrowthRate);

              // Predict days using local trained neural network model
              const trend = calculateConsumptionTrend(history);
              const caseGrowthPct = Math.round(medGrowthRate * 100);
              let trainedPrediction = null;
              
              if (modelLoaded) {
                try {
                  trainedPrediction = predictStockoutDaysTrained(trend, caseGrowthPct, med.current_stock);
                } catch (err) {
                  console.error("Trained model prediction failed:", err);
                }
              }

              return (
                <div 
                  key={med.id} 
                  className="bg-white border border-[#E2E8F0] rounded-[8px] p-4 flex flex-col justify-between space-y-3"
                >
                  {/* Title Row */}
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-1.5">
                      <h4 className="font-heading font-bold text-[#1E293B] text-[14px]">{med.name}</h4>
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border shrink-0 ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-[9px] font-medium text-[#64748B] bg-[#F7F9FB] px-1.5 py-0.2 rounded border border-[#E2E8F0]">
                        {t('phcDetail.analytics.stock')} <span className="font-mono text-[#1E293B] font-semibold">{med.current_stock}</span> {med.unit ? med.unit.toUpperCase() : t('phcDetail.analytics.units')}
                      </span>
                      {hasSpike && (
                        <span className="text-[9px] font-bold text-[#D64545] bg-[#D64545]/10 border border-[#D64545]/20 px-1.5 py-0.2 rounded tracking-wide">
                          {t('phcDetail.analytics.spike', { percent: percentIncrease })}
                        </span>
                      )}
                      {daysToStockOut < 3 ? (
                        <span className="text-[9px] font-bold text-[#D64545] bg-[#D64545]/10 border border-[#D64545]/20 px-1.5 py-0.2 rounded tracking-wide animate-pulse uppercase">
                          {t('phcDetail.analytics.stockOutPredictedIn', { days: daysToStockOut })}
                        </span>
                      ) : daysToStockOut < 7 ? (
                        <span className="text-[9px] font-bold text-[#E8A33D] bg-[#E8A33D]/10 border border-[#E8A33D]/20 px-1.5 py-0.2 rounded tracking-wide uppercase">
                          {t('phcDetail.analytics.stockOutPredictedIn', { days: daysToStockOut })}
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold text-[#0F6B66] bg-[#0F6B66]/10 border border-[#0F6B66]/20 px-1.5 py-0.2 rounded tracking-wide uppercase">
                          {t('phcDetail.analytics.stockOutPredictedInStable', { days: daysToStockOut === 999 ? t('phcDetail.analytics.stable') : `${daysToStockOut}d` })}
                        </span>
                      )}
                      {growthLabels.map((lbl, idx) => (
                        <span key={idx} className="text-[9px] font-bold text-[#1D4E89] bg-[#1D4E89]/10 border border-[#1D4E89]/20 px-1.5 py-0.2 rounded tracking-wide uppercase">
                          📈 {lbl}
                        </span>
                      ))}
                      {/* Vertex AI Prediction Badge */}
                      {vertexPredictions[med.id] === undefined ? (
                        <span className="text-[9px] font-bold text-purple-600 bg-purple-50 border border-purple-200 px-1.5 py-0.2 rounded tracking-wide uppercase animate-pulse">
                          {t('phcDetail.analytics.vertexLoading')}
                        </span>
                      ) : vertexPredictions[med.id] !== null ? (
                        <span className="text-[9px] font-bold text-purple-600 bg-purple-50 border border-purple-200 px-1.5 py-0.2 rounded tracking-wide uppercase">
                          {t('phcDetail.analytics.vertexPrediction', { days: vertexPredictions[med.id] === 999 ? t('phcDetail.analytics.stable') : `${Math.round(vertexPredictions[med.id])} ${t('phcDetail.analytics.days')}` })}
                        </span>
                      ) : null}
                      {/* Trained Model Prediction Badge */}
                      {!modelLoaded && !modelLoadFailed ? (
                        <span className="text-[9px] font-bold text-teal-600 bg-teal-50 border border-teal-200 px-1.5 py-0.2 rounded tracking-wide uppercase animate-pulse">
                          {t('phcDetail.analytics.trainedLoading')}
                        </span>
                      ) : modelLoaded && trainedPrediction !== null ? (
                        <span className="text-[9px] font-bold text-teal-600 bg-teal-50 border border-teal-200 px-1.5 py-0.2 rounded tracking-wide uppercase">
                          {t('phcDetail.analytics.trainedPrediction', { days: trainedPrediction >= 90 ? t('phcDetail.analytics.stable') : `${Math.round(trainedPrediction)} ${Math.round(trainedPrediction) === 1 ? t('phcDetail.analytics.day') : t('phcDetail.analytics.days')}` })}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Line Chart */}
                  <div className="bg-[#F7F9FB] border border-[#E2E8F0] rounded-[6px] p-2.5">
                    <div className="text-[9px] text-[#64748B] font-semibold mb-1.5 uppercase tracking-wider">
                      {t('phcDetail.analytics.demandRunRate')}
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
                  <div className="pt-2 border-t border-[#E2E8F0] flex items-center justify-between text-xs text-[#64748B]">
                    <span>{t('phcDetail.analytics.requiredSafety')}</span>
                    <span className="font-semibold text-[#1E293B] font-mono">{minRequired} {med.unit ? med.unit.toUpperCase() : t('phcDetail.analytics.units')}</span>
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
