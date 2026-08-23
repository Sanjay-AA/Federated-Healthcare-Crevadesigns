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
import { getRedistributionRecommendation } from '../lib/redistribution';
import { addTransfer } from '../lib/firestore';
import EmergencySimulationModal from '../components/EmergencySimulationModal';

export default function PhcDetail({ phc, phcs = [], medicines = [], loading = false, onBack, onSimulateResponse }) {
  const { t, language } = useLanguage();
  const activeMedsSource = medicines || [];
  const phcMedicines = activeMedsSource.filter(med => med.phc_id === phc?.id);

  // Calculate Dengue and Malaria growth rates for the current PHC
  const reportedCases = phc?.reported_cases || [];
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
  const [briefingCache, setBriefingCache] = useState({});
  const [selectedMedicineId, setSelectedMedicineId] = useState(null);
  const [approvedTransfers, setApprovedTransfers] = useState({});
  const [showEmergencySimulation, setShowEmergencySimulation] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (!phc) return;
    
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
  }, [phc?.id, medicines, dengueGrowth, malariaGrowth]);

  const activeMedId = selectedMedicineId || phcMedicines[0]?.id;
  const activeMed = phcMedicines.find(m => m.id === activeMedId);

  // Compute active medicine parameters
  const minRequired = activeMed ? (activeMed.minimum_stock || (activeMed.name === 'Paracetamol' ? 300 : activeMed.name === 'IV Fluids' ? 200 : 150)) : 150;
  const activeHistory = activeMed ? (activeMed.consumption_history || []) : [];
  const activeTrend = activeMed ? calculateConsumptionTrend(activeHistory) : 0;
  
  let activeMedGrowthRate = 0;
  if (activeMed) {
    if (activeMed.name === 'Paracetamol' || activeMed.name === 'Ibuprofen') {
      activeMedGrowthRate = Math.max(dengueGrowth, malariaGrowth);
    } else if (activeMed.name === 'IV Fluids' || activeMed.name === 'ORS') {
      activeMedGrowthRate = dengueGrowth;
    }
  }
  
  const activeDays = activeMed ? predictDaysToStockOut(activeHistory, activeMed.current_stock, activeMedGrowthRate) : 999;
  const activeRisk = activeDays <= 3 ? 'CRITICAL' : activeDays <= 7 ? 'HIGH' : activeDays <= 14 ? 'MEDIUM' : 'LOW';
  const activeRec = activeMed ? getRedistributionRecommendation(phc, activeMed.name, phcs, medicines) : null;

  const cacheKey = activeMed 
    ? `${activeMed.id}_${activeMed.current_stock}_${activeDays}_${activeRisk}_${activeRec?.recommendedTransferQuantity || 0}_${activeRec?.donorPhcId || 'none'}_${language}`
    : '';

  const handleRegenerateBriefing = () => {
    if (!cacheKey) return;
    setBriefingCache(prev => {
      const updated = { ...prev };
      delete updated[cacheKey];
      return updated;
    });
  };

  useEffect(() => {
    if (!phc || !activeMed || !cacheKey) return;
    
    // If the briefing is already in cache, do nothing
    if (briefingCache[cacheKey] !== undefined) return;

    let isMounted = true;
    
    // Set state to 'loading...' first to show a loading skeleton
    setBriefingCache(prev => ({ ...prev, [cacheKey]: 'loading...' }));

    const structuredDecision = {
      recipientPHC: phc.name,
      district: phc.district,
      state: phc.state || 'Tamil Nadu',
      medicine: activeMed.name,
      currentStock: activeMed.current_stock,
      dailyConsumption: Math.round(activeTrend * 10) / 10 || 10,
      safetyStock: minRequired,
      predictedDaysUntilStockout: activeDays,
      riskLevel: activeRisk,
      donorPHC: activeRec ? activeRec.from_phc.name : null,
      donorStock: activeRec ? activeRec.donorCurrentStock : null,
      donorSafetyStock: activeRec ? activeRec.donorSafetyStock : null,
      donorSafeSurplus: activeRec ? activeRec.donorSafeSurplus : null,
      recommendedTransferQuantity: activeRec ? activeRec.recommendedTransferQuantity : null,
      redistributionStatus: activeRec ? "RECOMMENDED" : (activeDays >= 7 ? "NOT_REQUIRED" : "NO_SAFE_DONOR")
    };

    async function fetchBriefing() {
      try {
        const briefing = await generateSituationBriefing(structuredDecision, language);
        if (isMounted) {
          setBriefingCache(prev => ({ ...prev, [cacheKey]: briefing }));
        }
      } catch (err) {
        console.error("Gemini briefing failed for", activeMed.name, err);
        if (isMounted) {
          setBriefingCache(prev => ({ ...prev, [cacheKey]: null }));
        }
      }
    }

    fetchBriefing();

    return () => {
      isMounted = false;
    };
  }, [activeMed?.id, phc?.id, cacheKey, language]);

  if (!phc) return null;

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

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowEmergencySimulation(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-[#D64545] hover:bg-[#B93838] rounded-[6px] transition-colors cursor-pointer select-none shadow-xs"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Run Emergency Simulation
          </button>
          <span className="text-[11px] text-[#64748B] font-mono">{t('phcDetail.phcNode')} {phc.id.toUpperCase()}</span>
        </div>
      </div>

      {/* Main Info Blocks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Core Profile */}
        <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-4 flex flex-col justify-between space-y-3">
          <div>
            <span className="text-[10px] font-semibold text-[#1D4E89] tracking-wider uppercase">{t('phcDetail.facilityProfile')}</span>
            <h2 className="text-lg font-heading font-bold text-[#1E293B] tracking-tight mt-0.5">{phc.name}</h2>
            <p className="text-xs text-[#64748B] mt-0.5">{phc.district} District · State of {phc.state || 'Tamil Nadu'}</p>
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
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* Left Column: Outbreak Medicine Inventories List */}
        <div className="xl:col-span-3 space-y-4">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {phcMedicines.map((med) => {
                const isSelected = med.id === activeMedId;
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
                    onClick={() => setSelectedMedicineId(med.id)}
                    className={`bg-white border rounded-[8px] p-4 flex flex-col justify-between space-y-3 cursor-pointer select-none transition-all duration-205 ${
                      isSelected 
                        ? 'border-[#1D4E89] ring-2 ring-[#1D4E89]/20 shadow-md scale-[1.01]' 
                        : 'border-[#E2E8F0] hover:border-slate-350 hover:shadow-sm'
                    }`}
                  >
                    {/* Title Row */}
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="flex items-center gap-2">
                          <input 
                            type="radio" 
                            checked={isSelected}
                            onChange={() => setSelectedMedicineId(med.id)}
                            className="w-3.5 h-3.5 accent-[#1D4E89] cursor-pointer"
                          />
                          <h4 className="font-heading font-bold text-[#1E293B] text-[14px]">{med.name}</h4>
                        </div>
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
                      </div>
                    </div>

                    {/* Line Chart */}
                    <div className="bg-[#F7F9FB] border border-[#E2E8F0] rounded-[6px] p-2.5">
                      <div className="text-[9px] text-[#64748B] font-semibold mb-1.5 uppercase tracking-wider">
                        {t('phcDetail.analytics.demandRunRate')}
                      </div>
                      <div className="h-[120px] w-full">
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

        {/* Right Column: AI Resource Optimization Pipeline Panel */}
        <div className="xl:col-span-1">
          {activeMed ? (() => {
            const minRequired = activeMed.minimum_stock || (activeMed.name === 'Paracetamol' ? 300 : activeMed.name === 'IV Fluids' ? 200 : 150);
            const activeHistory = activeMed.consumption_history || [];
            const activeTrend = calculateConsumptionTrend(activeHistory);
            
            let medGrowthRate = 0;
            if (activeMed.name === 'Paracetamol' || activeMed.name === 'Ibuprofen') {
              medGrowthRate = Math.max(dengueGrowth, malariaGrowth);
            } else if (activeMed.name === 'IV Fluids' || activeMed.name === 'ORS') {
              medGrowthRate = dengueGrowth;
            }
            
            const activeDays = predictDaysToStockOut(activeHistory, activeMed.current_stock, medGrowthRate);
            const activeRisk = activeDays <= 3 ? 'CRITICAL' : activeDays <= 7 ? 'HIGH' : activeDays <= 14 ? 'MEDIUM' : 'LOW';
            
            const activeRiskStyles = activeRisk === 'CRITICAL' 
              ? 'text-[#D64545] bg-[#D64545]/10 border-[#D64545]/20' 
              : activeRisk === 'HIGH' 
                ? 'text-[#E8A33D] bg-[#E8A33D]/10 border-[#E8A33D]/20' 
                : activeRisk === 'MEDIUM' 
                  ? 'text-[#1D4E89] bg-[#1D4E89]/10 border-[#1D4E89]/20' 
                  : 'text-[#0F6B66] bg-[#0F6B66]/10 border-[#0F6B66]/20';
            
            const rec = getRedistributionRecommendation(phc, activeMed.name, phcs, medicines);
            const isApproved = approvedTransfers[activeMed.id];
            const briefingText = briefingCache[cacheKey];
            
            // local neural net prediction
            const caseGrowthPct = Math.round(medGrowthRate * 100);
            let activeTrainedPrediction = null;
            if (modelLoaded) {
              try {
                activeTrainedPrediction = predictStockoutDaysTrained(activeTrend, caseGrowthPct, activeMed.current_stock);
              } catch (e) {}
            }
            
            // vertex ai prediction
            const vertexPred = vertexPredictions[activeMed.id];

            const handleApprove = async () => {
              if (!rec || isApproved === 'loading' || isApproved === 'approved') return;
              setApprovedTransfers(prev => ({ ...prev, [activeMed.id]: 'loading' }));
              try {
                await addTransfer({
                  from_phc_id: rec.from_phc.id,
                  from_phc_name: rec.from_phc.name,
                  to_phc_id: phc.id,
                  to_phc_name: phc.name,
                  medicine_id: activeMed.id,
                  medicine_name: activeMed.name,
                  quantity: rec.quantity,
                  status: 'DISPATCHED',
                  distance_km: rec.distance_km,
                  priority: activeRisk
                });
                setApprovedTransfers(prev => ({ ...prev, [activeMed.id]: 'approved' }));
              } catch (err) {
                console.error("Failed to add transfer:", err);
                setApprovedTransfers(prev => ({ ...prev, [activeMed.id]: false }));
              }
            };

            return (
              <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-4 space-y-4 shadow-sm sticky top-6">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5">
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                      </span>
                      {t('pipeline.title')}
                    </h3>
                  </div>
                  <p className="text-[10px] text-[#64748B] mt-0.5">
                    {t('pipeline.diagnostics', { med: activeMed.name })}
                  </p>
                  
                  <button
                    onClick={() => setShowEmergencySimulation(true)}
                    className="w-full mt-2.5 py-1.5 px-2 bg-[#D64545]/10 hover:bg-[#D64545]/15 border border-[#D64545]/20 text-[#D64545] font-bold text-[11px] rounded-[6px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Local Stress Test (Modal)
                  </button>
                </div>

                {/* Response Readiness Card */}
                {(() => {
                  const optimalMeds = phcMedicines.filter(m => {
                    const days = predictDaysToStockOut(m.consumption_history || [], m.current_stock);
                    return days >= 7;
                  }).length;
                  const medResilience = phcMedicines.length > 0 ? Math.round((optimalMeds / phcMedicines.length) * 100) : 100;
                  const bedResilience = Math.round((1 - (phc.occupied_beds / (phc.total_beds || 1))) * 100);
                  const staffResilience = Math.round(((phc.staff_present_today || 0) / (phc.total_staff || 1)) * 100);
                  const overallResilience = Math.round((medResilience + bedResilience + staffResilience) / 3);

                  return (
                    <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-3 rounded-[6px] space-y-2 text-xs">
                      <div className="flex justify-between items-center pb-1 border-b border-slate-200">
                        <span className="font-bold text-[#0F172A] uppercase tracking-wider text-[9px]">Response Readiness</span>
                        <span className="font-mono font-bold text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.2 rounded text-[10px]">
                          Overall: {overallResilience}%
                        </span>
                      </div>
                      <div className="space-y-1.5 text-[#64748B] text-[11px]">
                        <div className="flex justify-between">
                          <span>Medicine resilience</span>
                          <span className="font-mono text-[#0F172A] font-semibold">{medResilience}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Bed resilience</span>
                          <span className="font-mono text-[#0F172A] font-semibold">{bedResilience}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Staff resilience</span>
                          <span className="font-mono text-[#0F172A] font-semibold">{staffResilience}%</span>
                        </div>
                      </div>
                      <button
                        onClick={() => onSimulateResponse(phc, activeMed)}
                        className="w-full mt-1.5 py-1.5 bg-blue-600 hover:bg-blue-750 text-white font-bold text-[10px] rounded-[4px] flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-xs"
                      >
                        Run Emergency Simulation →
                      </button>
                    </div>
                  );
                })()}

                {/* Section 1: Stock Status */}
                <div className="border-t border-[#E2E8F0] pt-3 space-y-2">
                  <div className="text-[9px] font-semibold text-[#64748B] uppercase tracking-wider">
                    {t('pipeline.step1')}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-2 rounded">
                      <span className="text-[#64748B] block text-[9px] uppercase">{t('pipeline.currentStock')}</span>
                      <span className="font-mono text-[13px] font-bold text-[#1E293B]">{activeMed.current_stock}</span>
                      <span className="text-[9px] text-[#64748B] block">{t('pipeline.safetyTarget', { target: minRequired })}</span>
                    </div>
                    <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-2 rounded">
                      <span className="text-[#64748B] block text-[9px] uppercase">{t('pipeline.dailyRunRate')}</span>
                      <span className="font-mono text-[13px] font-bold text-[#1E293B]">{Math.round(activeTrend * 10) / 10 || 10}</span>
                      <span className="text-[9px] text-[#64748B] block">{t('pipeline.unitsPerDay')}</span>
                    </div>
                  </div>
                </div>

                {/* Section 2: AI Predictions & Risk */}
                <div className="border-t border-[#E2E8F0] pt-3 space-y-2">
                  <div className="text-[9px] font-semibold text-[#64748B] uppercase tracking-wider">
                    {t('pipeline.step2')}
                  </div>
                  <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-2.5 rounded space-y-2">
                    <div className="flex justify-between items-center text-xs pb-1.5 border-b border-[#E2E8F0]/70">
                      <span className="text-[#64748B]">{t('pipeline.linearForecast')}</span>
                      <span className="font-mono font-semibold text-[#1E293B]">
                        {activeDays === 999 ? t('pipeline.stable') : `${activeDays} ${t('phcDetail.analytics.days')}`}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs pb-1.5 border-b border-[#E2E8F0]/70">
                      <span className="text-[#64748B]">{t('pipeline.trainedForecast')}</span>
                      <span className="font-mono font-semibold text-[#1E293B]">
                        {activeTrainedPrediction !== null ? `${Math.round(activeTrainedPrediction)} ${t('phcDetail.analytics.days')}` : t('pipeline.loading')}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#64748B]">{t('pipeline.vertexForecast')}</span>
                      <span className="font-mono font-semibold text-[#1E293B]">
                        {vertexPred === undefined ? t('pipeline.loading') : (vertexPred === null ? t('pipeline.notAvailable') : `${Math.round(vertexPred)} ${t('phcDetail.analytics.days')}`)}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#64748B] font-medium uppercase tracking-wider text-[9px]">{t('pipeline.riskLevel')}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${activeRiskStyles}`}>
                      {t(`phcDetail.analytics.status.${activeRisk === 'CRITICAL' ? 'criticalRisk' : activeRisk === 'HIGH' ? 'lowStock' : activeRisk === 'MEDIUM' ? 'lowStock' : 'optimal'}`)}
                    </span>
                  </div>
                </div>

                {/* Section 3: Redistribution */}
                <div className="border-t border-[#E2E8F0] pt-3 space-y-2">
                  <div className="text-[9px] font-semibold text-[#64748B] uppercase tracking-wider">
                    {t('pipeline.step3')}
                  </div>
                  {rec ? (
                    <div className="space-y-2.5">
                      <div className="bg-emerald-50/50 border border-emerald-100 p-2.5 rounded space-y-1.5 text-xs text-[#0F6B66]">
                        <div className="font-semibold uppercase text-[10px] tracking-wide">{t('pipeline.opportunityFound')}</div>
                        <p className="text-[11px] text-[#334155] leading-normal">
                          {t('pipeline.transferUnits', { quantity: rec.quantity, from: rec.from_phc.name, distance: rec.distance_km })}
                        </p>
                      </div>
                      <button
                        onClick={handleApprove}
                        disabled={isApproved === 'loading' || isApproved === 'approved'}
                        className={`w-full py-2 rounded-[6px] text-xs font-semibold select-none cursor-pointer border transition-colors ${
                          isApproved === 'approved'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : isApproved === 'loading'
                              ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                              : 'bg-[#0F172A] border-[#0F172A] text-white hover:bg-slate-800'
                        }`}
                      >
                        {isApproved === 'approved' 
                          ? t('pipeline.approved') 
                          : isApproved === 'loading' 
                            ? t('pipeline.approving') 
                            : t('pipeline.approve')}
                      </button>
                    </div>
                  ) : (
                    <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-2.5 rounded text-xs text-[#64748B] leading-normal">
                      {activeDays >= 7 ? (
                        <p className="text-[11px]">
                          {t('pipeline.noRedistribution')}
                        </p>
                      ) : (
                        <p className="text-[11px] text-[#D64545] bg-[#D64545]/5 border border-[#D64545]/10 p-2 rounded">
                          {t('pipeline.noDonor')}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Section 4: Gemini Briefing */}
                <div className="border-t border-[#E2E8F0] pt-3 space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="text-[9px] font-semibold text-[#64748B] uppercase tracking-wider">
                      {t('pipeline.step4')}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {briefingText !== 'loading...' && briefingText !== undefined && (
                        <button
                          onClick={handleRegenerateBriefing}
                          className="text-[9px] font-bold text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded cursor-pointer select-none transition-colors"
                          title="Regenerate situation briefing"
                        >
                          🔄 {language === 'ta' ? 'மீண்டும் உருவாக்கு' : language === 'hi' ? 'पुनः उत्पन्न करें' : language === 'ml' ? 'വീണ്ടും സൃഷ്ടിക്കുക' : 'Regenerate'}
                        </button>
                      )}
                      <span className="text-[8px] font-bold text-purple-600 bg-purple-50 border border-purple-150 px-1 py-0.2 rounded">
                        {t('pipeline.explainability')}
                      </span>
                    </div>
                  </div>
                  
                  {briefingText === 'loading...' ? (
                    <div>
                      <div className="text-[10px] text-purple-600 font-semibold mb-2 animate-pulse">
                        {language === 'ta' ? 'AI நிலை விளக்கக்காட்சியை உருவாக்குகிறது...' : language === 'hi' ? 'AI स्थिति ब्रीफिंग उत्पन्न कर रहा है...' : language === 'ml' ? 'AI സാഹചര്യം വിശദീകരിക്കുന്നു...' : 'Generating AI situation briefing...'}
                      </div>
                      <div className="space-y-1.5 animate-pulse pt-1">
                        <div className="h-3 bg-slate-200 rounded w-full"></div>
                        <div className="h-3 bg-slate-200 rounded w-11/12"></div>
                        <div className="h-3 bg-slate-200 rounded w-4/5"></div>
                      </div>
                    </div>
                  ) : briefingText === null || briefingText === undefined ? (
                    <div className="text-[11px] text-amber-700 bg-amber-50/50 border border-amber-100 p-2 rounded leading-relaxed">
                      {t('pipeline.briefingUnavailable')}
                    </div>
                  ) : (() => {
                    let briefingObj = null;
                    let parseError = false;
                    try {
                      const start = briefingText.indexOf('{');
                      const end = briefingText.lastIndexOf('}');
                      if (start !== -1 && end !== -1) {
                        briefingObj = JSON.parse(briefingText.substring(start, end + 1));
                      } else {
                        briefingObj = JSON.parse(briefingText);
                      }
                    } catch (e) {
                      console.error("Failed to parse briefing JSON:", e);
                      parseError = true;
                    }

                    if (parseError || !briefingObj) {
                      return (
                        <p className="text-[11px] text-[#475569] leading-relaxed pt-1 font-normal bg-slate-50 border border-slate-200 p-2 rounded">
                          {briefingText}
                        </p>
                      );
                    }

                    return (
                      <div className="space-y-2.5 text-[11px] leading-relaxed text-[#475569]">
                        {/* Headline */}
                        <div className="font-bold text-[#1E293B] text-[12px] border-b border-slate-100 pb-1 uppercase tracking-tight">
                          {briefingObj.headline}
                        </div>
                        {/* Situation */}
                        <div>
                          <span className="font-bold text-slate-500 uppercase tracking-wider text-[8px] block leading-none mb-0.5">Situation</span>
                          <span className="font-normal">{briefingObj.situation}</span>
                        </div>
                        {/* Risk */}
                        <div>
                          <span className="font-bold text-slate-500 uppercase tracking-wider text-[8px] block leading-none mb-0.5">Risk</span>
                          <span className="font-normal">{briefingObj.riskExplanation}</span>
                        </div>
                        {/* Recommended Action */}
                        <div>
                          <span className="font-bold text-slate-500 uppercase tracking-wider text-[8px] block leading-none mb-0.5">Recommended Action</span>
                          <span className="font-normal">{briefingObj.recommendedAction}</span>
                        </div>
                        {/* Confidence / Footnote */}
                        {briefingObj.confidenceNote && (
                          <div className="text-[9px] text-slate-400 italic pt-1 border-t border-slate-100 mt-1 leading-normal">
                            {briefingObj.confidenceNote}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })() : (
            <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-4 text-center text-xs text-[#64748B] sticky top-6">
              {t('pipeline.selectMed')}
            </div>
          )}
        </div>
      </div>

      {showEmergencySimulation && (
        <EmergencySimulationModal
          phc={phc}
          phcs={phcs}
          medicines={medicines}
          initialMedicine={activeMed}
          onClose={() => setShowEmergencySimulation(false)}
        />
      )}
    </div>
  );
}
