import React, { useState, useMemo } from 'react';
import { runEmergencySimulation } from '../lib/simulationEngine';
import { addTransfer } from '../lib/firestore';
import { useLanguage } from '../i18n/LanguageContext';

export default function EmergencySimulationModal({
  phc,
  phcs = [],
  medicines = [],
  initialMedicine = null,
  onClose,
  onTransferCreated
}) {
  const { t } = useLanguage();
  const phcMedicines = (medicines || []).filter(m => m.phc_id === phc?.id);
  const defaultMed = initialMedicine || phcMedicines[0] || null;

  // Controls state
  const [selectedMedicineId, setSelectedMedicineId] = useState(defaultMed?.id || '');
  const [scenarioType, setScenarioType] = useState('DISEASE_OUTBREAK'); // 'DISEASE_OUTBREAK' | 'PATIENT_SURGE' | 'SUPPLY_DISRUPTION'
  const [surgePercentage, setSurgePercentage] = useState(50);
  const [durationDays, setDurationDays] = useState(7);
  
  // Custom modified transfer quantity
  const [customQuantity, setCustomQuantity] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  // Approval state
  const [submitting, setSubmitting] = useState(false);
  const [transferApproved, setTransferApproved] = useState(false);
  const [approvalError, setApprovalError] = useState(null);

  const activeMedicine = phcMedicines.find(m => m.id === selectedMedicineId) || defaultMed;

  // Run deterministic simulation engine
  const simResult = useMemo(() => {
    if (!phc || !activeMedicine) return null;
    return runEmergencySimulation({
      phc,
      medicine: activeMedicine,
      phcs,
      medicines,
      scenarioType,
      surgePercentage,
      durationDays
    });
  }, [phc, activeMedicine, phcs, medicines, scenarioType, surgePercentage, durationDays]);

  if (!phc || !activeMedicine || !simResult) return null;

  const { currentStatus, projectedStatus, recommendation } = simResult;
  const transferQuantity = customQuantity !== null ? customQuantity : (recommendation?.recommendedQuantity || 0);

  const handleApproveClick = () => {
    if (!recommendation) return;
    setShowConfirmModal(true);
  };

  const handleConfirmTransfer = async () => {
    if (!recommendation || submitting) return;
    setSubmitting(true);
    setApprovalError(null);

    try {
      await addTransfer({
        from_phc_id: recommendation.fromPhc.id,
        from_phc_name: recommendation.fromPhc.name,
        to_phc_id: phc.id,
        to_phc_name: phc.name,
        medicine_id: activeMedicine.id,
        medicine_name: activeMedicine.name,
        quantity: Number(transferQuantity),
        status: 'DISPATCHED',
        distance_km: recommendation.distanceKm,
        priority: projectedStatus.overallRisk,
        simulation_event: {
          scenarioType,
          surgePercentage,
          durationDays
        }
      });
      setSubmitting(false);
      setShowConfirmModal(false);
      setTransferApproved(true);
      if (onTransferCreated) {
        onTransferCreated();
      }
    } catch (err) {
      console.error("Failed to execute transfer:", err);
      setSubmitting(false);
      setApprovalError("Failed to dispatch transfer request. Please try again.");
    }
  };

  const getRiskColor = (risk) => {
    switch (risk) {
      case 'CRITICAL':
        return 'text-[#D64545] bg-[#D64545]/10 border-[#D64545]/20';
      case 'HIGH':
        return 'text-[#E8A33D] bg-[#E8A33D]/10 border-[#E8A33D]/20';
      case 'MODERATE':
        return 'text-blue-700 bg-blue-50 border-blue-200';
      default:
        return 'text-[#0F6B66] bg-[#0F6B66]/10 border-[#0F6B66]/20';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white border border-[#E2E8F0] rounded-[10px] shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-[#0F172A] font-sans">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#D64545]/10 text-[#D64545] border border-[#D64545]/20 rounded-[6px]">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-sans font-bold text-base text-[#0F172A] tracking-tight">
                  {t('emergencyModal.title')}
                </h2>
                <span className="text-[10px] font-semibold text-[#1D4E89] bg-[#1D4E89]/10 border border-[#1D4E89]/20 px-2 py-0.5 rounded uppercase">
                  {t('emergencyModal.badge')}
                </span>
              </div>
              <p className="text-xs text-[#64748B] mt-0.5">
                {t('emergencyModal.facility')} <span className="font-semibold text-[#0F172A]">{phc.name}</span> ({phc.district} District · {phc.state || 'State'})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[#64748B] hover:text-[#0F172A] hover:bg-slate-200/60 rounded-[6px] transition-colors cursor-pointer"
            title={t('emergencyModal.close')}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Controls Bar */}
          <div className="bg-[#F7F9FB] border border-[#E2E8F0] rounded-[8px] p-4 space-y-4">
            
            {/* Top Row: Scenario Type & Medicine Dropdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">
                  {t('emergencyModal.scenarioTypeLabel')}
                </label>
                <div className="flex rounded-[6px] border border-[#E2E8F0] bg-white p-0.5 space-x-1">
                  <button
                    onClick={() => setScenarioType('DISEASE_OUTBREAK')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-[4px] cursor-pointer transition-colors ${
                      scenarioType === 'DISEASE_OUTBREAK'
                        ? 'bg-[#0F172A] text-white'
                        : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50'
                    }`}
                  >
                    {t('emergencyModal.scenarios.outbreak')}
                  </button>
                  <button
                    onClick={() => setScenarioType('PATIENT_SURGE')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-[4px] cursor-pointer transition-colors ${
                      scenarioType === 'PATIENT_SURGE'
                        ? 'bg-[#0F172A] text-white'
                        : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50'
                    }`}
                  >
                    {t('emergencyModal.scenarios.surge')}
                  </button>
                  <button
                    onClick={() => setScenarioType('SUPPLY_DISRUPTION')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-[4px] cursor-pointer transition-colors ${
                      scenarioType === 'SUPPLY_DISRUPTION'
                        ? 'bg-[#0F172A] text-white'
                        : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50'
                    }`}
                  >
                    {t('emergencyModal.scenarios.cut')}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">
                  {t('emergencyModal.simulatedMedicineLabel')}
                </label>
                <select
                  value={selectedMedicineId}
                  onChange={(e) => {
                    setSelectedMedicineId(e.target.value);
                    setCustomQuantity(null);
                  }}
                  className="w-full bg-white border border-[#E2E8F0] rounded-[6px] px-3 py-1.5 text-xs text-[#0F172A] font-semibold outline-none cursor-pointer hover:border-slate-300 transition-colors"
                >
                  {phcMedicines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({t('emergencyModal.inStock', { count: m.current_stock, unit: m.unit || t('emergencyModal.units') })})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Middle Row: Surge Controls & Period */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center border-t border-[#E2E8F0] pt-3">
              <div className="md:col-span-2 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                    {t('emergencyModal.surgeIncreaseLabel')}
                  </span>
                  <span className="font-mono font-bold text-[#D64545] bg-[#D64545]/10 px-2 py-0.5 rounded text-xs">
                    +{surgePercentage}% Surge
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={surgePercentage}
                    onChange={(e) => setSurgePercentage(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#D64545]"
                  />
                </div>

                {/* Surge Presets */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[0, 10, 20, 30, 50, 75, 100].map((val) => (
                    <button
                      key={val}
                      onClick={() => setSurgePercentage(val)}
                      className={`px-2 py-0.5 text-[10px] font-semibold rounded border cursor-pointer transition-colors ${
                        surgePercentage === val
                          ? 'bg-[#D64545] text-white border-[#D64545]'
                          : 'bg-white border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100'
                      }`}
                    >
                      {val === 0 ? t('emergencyModal.surgePresetNormal') : `+${val}%`}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">
                  Simulation Window
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {[3, 7, 14].map((days) => (
                    <button
                      key={days}
                      onClick={() => setDurationDays(days)}
                      className={`py-1.5 text-xs font-semibold rounded border cursor-pointer transition-colors text-center ${
                        durationDays === days
                          ? 'bg-[#1D4E89] text-white border-[#1D4E89]'
                          : 'bg-white border-[#E2E8F0] text-[#64748B] hover:bg-slate-100'
                      }`}
                    >
                      {days} Days
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <p className="text-[10px] text-[#64748B] italic">
              * Projected impact based on current consumption rates and selected scenario parameters.
            </p>
          </div>

          {/* Results Comparison Grid */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-[#1D4E89] uppercase tracking-wider flex items-center justify-between">
              <span>Simulation Readout Comparison</span>
              <span className="text-[10px] text-[#64748B] font-normal lowercase">Current status vs Projected scenario</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              
              {/* Medicine Card */}
              <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-3.5 space-y-3 flex flex-col justify-between">
                <div>
                  {/* Header */}
                  <div className="flex justify-between items-center text-[10px] text-[#64748B] font-bold uppercase tracking-wider pb-2 border-b border-[#E2E8F0]">
                    <span>Medicine Demand</span>
                    <span className="text-[#1D4E89] font-mono font-bold">{activeMedicine.name}</span>
                  </div>

                  {/* Current Section */}
                  <div className="pt-2 space-y-0.5 text-xs">
                    <span className="text-[9px] font-bold text-[#64748B] uppercase tracking-wider block">Current</span>
                    <div className="font-medium text-[#1E293B] leading-tight">{currentStatus.stock} units available</div>
                    <div className="font-medium text-[#1E293B] leading-tight">{currentStatus.dailyDemand} units/day</div>
                    <div className="font-mono font-semibold text-[#1E293B] leading-tight">
                      {currentStatus.daysRemaining !== null ? `${currentStatus.daysRemaining} days remaining` : 'Insufficient consumption data'}
                    </div>
                  </div>

                  {/* Projected Section */}
                  <div className="pt-2 border-t border-[#E2E8F0] space-y-0.5 text-xs">
                    <span className="text-[9px] font-bold text-[#64748B] uppercase tracking-wider block">
                      Projected {surgePercentage > 0 ? `(+${surgePercentage}% surge)` : '(0% surge)'}
                    </span>
                    <div className="font-medium text-[#1E293B] leading-tight">{projectedStatus.dailyDemand} units/day</div>
                    <div className="font-mono font-bold text-[#D64545] leading-tight">
                      {projectedStatus.daysRemaining !== null ? `${projectedStatus.daysRemaining} days remaining` : 'Insufficient consumption data'}
                    </div>
                  </div>
                </div>

                {/* Impact Section */}
                <div className="pt-2 border-t border-[#E2E8F0] text-[10px] space-y-0.5">
                  <span className="font-bold text-[#64748B] uppercase tracking-wider block">Impact</span>
                  {surgePercentage === 0 || projectedStatus.daysLost === 0 || projectedStatus.daysLost === null ? (
                    <span className="text-[#0F6B66] font-semibold block leading-tight">
                      No significant change under this scenario
                    </span>
                  ) : (
                    <div className="space-y-0.5">
                      <span className="text-[#D64545] font-bold block leading-tight">
                        Stock expected to run out <span className="font-mono">{projectedStatus.daysLost} days earlier</span>
                      </span>
                      <span className="text-[9px] text-[#64748B] font-mono block">
                        (Demand change: +{projectedStatus.demandChange} units/day)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Beds Card */}
              <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-3.5 space-y-2 flex flex-col justify-between">
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-[#64748B] font-bold uppercase tracking-wider">
                    <span>Bed Capacity</span>
                    <span className="font-mono">{currentStatus.occupiedBeds}/{currentStatus.totalBeds} Beds</span>
                  </div>
                  <div className="text-xs space-y-1 pt-1">
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">Current:</span>
                      <span className="font-mono font-semibold">{currentStatus.bedOccupancyPct}% occupied</span>
                    </div>
                    <div className={`flex justify-between font-semibold ${projectedStatus.isBedCapacityExceeded ? 'text-[#D64545]' : 'text-[#E8A33D]'}`}>
                      <span>Projected:</span>
                      <span className="font-mono">{projectedStatus.bedOccupancyPct}% occupied</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#E2E8F0] text-[10px]">
                  <span className={`font-bold ${projectedStatus.isBedCapacityExceeded ? 'text-[#D64545]' : 'text-[#64748B]'}`}>
                    {projectedStatus.bedStatusText}
                  </span>
                </div>
              </div>

              {/* Staff Workload Card */}
              <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-3.5 space-y-2 flex flex-col justify-between">
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-[#64748B] font-bold uppercase tracking-wider">
                    <span>Staff Pressure</span>
                    <span>{phc.staff_present_today}/{phc.total_staff} Staff</span>
                  </div>
                  <div className="text-xs space-y-1 pt-1">
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">Current:</span>
                      <span className="font-semibold">{currentStatus.staffLoad}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-[#E8A33D]">
                      <span>Projected:</span>
                      <span>+{projectedStatus.projectedPatientLoadInc}% load</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#E2E8F0] text-[10px] text-[#64748B]">
                  <span>{projectedStatus.staffStatusText}</span>
                </div>
              </div>

              {/* Overall Risk Card */}
              <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-3.5 space-y-2 flex flex-col justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] text-[#64748B] font-bold uppercase tracking-wider block">
                    Overall Facility Risk
                  </span>
                  <div className="flex items-center gap-2 pt-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getRiskColor(currentStatus.overallRisk)}`}>
                      {currentStatus.overallRisk}
                    </span>
                    <span className="text-xs text-[#64748B]">→</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getRiskColor(projectedStatus.overallRisk)}`}>
                      {projectedStatus.overallRisk}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#E2E8F0] text-[10px] text-[#64748B]">
                  <span>Stress level: <strong className="text-[#0F172A]">{projectedStatus.overallRisk === 'CRITICAL' ? 'High Emergency Deficit' : 'Elevated Demand'}</strong></span>
                </div>
              </div>

            </div>
          </div>

          {/* Recommended Response & Redistribution Integration */}
          <div className="border-t border-[#E2E8F0] pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                  Recommended Response & Resource Transfer
                </h3>
                <p className="text-xs text-[#64748B]">
                  Evaluated donor facilities based on surplus stock, safety buffer protection, and regional proximity.
                </p>
              </div>
            </div>

            {recommendation ? (
              <div className="bg-white border border-emerald-200 rounded-[8px] p-4 space-y-4 shadow-xs">
                
                {/* Donor Header Information */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-3 border-b border-emerald-100 text-xs">
                  <div>
                    <span className="text-[9px] text-[#64748B] font-bold uppercase tracking-wider block">Recommended Donor PHC</span>
                    <span className="font-bold text-[#0F172A] text-[13px]">{recommendation.fromPhc.name}</span>
                    <span className="text-[10px] text-[#64748B] block">{recommendation.fromPhc.district} District</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-[#64748B] font-bold uppercase tracking-wider block">Transfer Quantity</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <input
                        type="number"
                        min="10"
                        max={recommendation.donorBefore.stock}
                        value={transferQuantity}
                        onChange={(e) => setCustomQuantity(Number(e.target.value))}
                        className="w-24 bg-white border border-[#E2E8F0] rounded px-2 py-1 font-mono font-bold text-xs text-[#0F172A] outline-none"
                      />
                      <span className="text-[10px] text-[#64748B] font-semibold">{activeMedicine.unit || 'units'}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[9px] text-[#64748B] font-bold uppercase tracking-wider block">Route & Proximity</span>
                    <span className="font-mono font-bold text-[#0F172A]">{recommendation.distanceKm} km</span>
                    <span className="text-[10px] text-[#64748B] block">Estimated travel time: {recommendation.estimatedTravelTime}</span>
                  </div>
                </div>

                {/* Impact Preview Section (BEFORE vs AFTER) */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">
                    Impact Preview (Before vs After Transfer)
                  </span>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    
                    {/* Recipient Facility Preview */}
                    <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[6px] p-3 space-y-1.5">
                      <span className="font-bold text-[#1E293B] block">Receiving Facility: {phc.name}</span>
                      <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-[#E2E8F0]">
                        <div>
                          <span className="text-[#64748B] block text-[9px] uppercase">Before Transfer</span>
                          <span className="font-mono font-semibold text-[#D64545]">
                            {recommendation.recipientBefore.days} days supply ({recommendation.recipientBefore.risk})
                          </span>
                        </div>
                        <div>
                          <span className="text-[#64748B] block text-[9px] uppercase">After Transfer</span>
                          <span className="font-mono font-bold text-[#0F6B66]">
                            {recommendation.recipientAfter.days} days supply ({recommendation.recipientAfter.risk})
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Donor Facility Preview */}
                    <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[6px] p-3 space-y-1.5">
                      <span className="font-bold text-[#1E293B] block">Donor Facility: {recommendation.fromPhc.name}</span>
                      <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-[#E2E8F0]">
                        <div>
                          <span className="text-[#64748B] block text-[9px] uppercase">Before Transfer</span>
                          <span className="font-mono font-semibold text-[#0F6B66]">
                            {recommendation.donorBefore.days} days supply ({recommendation.donorBefore.risk})
                          </span>
                        </div>
                        <div>
                          <span className="text-[#64748B] block text-[9px] uppercase">After Transfer</span>
                          <span className="font-mono font-bold text-[#0F6B66]">
                            {recommendation.donorAfter.days} days supply ({recommendation.donorAfter.risk})
                          </span>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Expandable Recommendation Details Accordion */}
                <div className="border-t border-emerald-100 pt-2">
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="flex items-center justify-between w-full py-1 text-xs font-semibold text-[#1D4E89] hover:underline cursor-pointer select-none"
                  >
                    <span>{showDetails ? 'Hide Recommendation Details' : 'View Recommendation Details (Why this facility was selected)'}</span>
                    <span>{showDetails ? '▲' : '▼'}</span>
                  </button>

                  {showDetails && (
                    <div className="mt-3 p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[6px] space-y-3 text-xs animate-fadeIn">
                      
                      {/* Why Selected */}
                      <div className="space-y-1">
                        <span className="font-bold text-[#0F6B66] text-[11px] block">
                          ✓ This facility was prioritized because:
                        </span>
                        <ul className="space-y-1 text-[#334155] pl-1">
                          {recommendation.whySelected.map((reason, idx) => (
                            <li key={idx} className="flex items-start gap-1.5 text-[11px]">
                              <span className="text-[#0F6B66] font-bold">✓</span>
                              <span>{reason}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Other Facilities Evaluated & Rejected */}
                      {recommendation.rejectedCandidates && recommendation.rejectedCandidates.length > 0 && (
                        <div className="space-y-1.5 pt-2 border-t border-[#E2E8F0]">
                          <span className="font-bold text-[#64748B] text-[11px] block">
                            Other facilities evaluated & rejected:
                          </span>
                          <div className="space-y-1">
                            {recommendation.rejectedCandidates.map((cand, idx) => (
                              <div key={idx} className="text-[11px] text-[#64748B] flex justify-between bg-white p-1.5 border border-[#E2E8F0] rounded">
                                <span className="font-medium text-[#1E293B]">{cand.phc.name}</span>
                                <span className="text-[#D64545]">{cand.reason}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>
                  )}
                </div>

                {/* Transfer Approval Banner / Controls */}
                {transferApproved ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-[6px] text-xs font-semibold flex items-center justify-between">
                    <span>✓ Resource redistribution of {transferQuantity} units of {activeMedicine.name} successfully dispatched to {recommendation.fromPhc.name}.</span>
                    <button
                      onClick={onClose}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <div className="pt-2 flex items-center justify-end gap-3">
                    <button
                      onClick={onClose}
                      className="px-4 py-2 bg-white border border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100 rounded-[6px] text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Cancel Simulation
                    </button>
                    <button
                      onClick={handleApproveClick}
                      className="px-4 py-2 bg-[#0F172A] hover:bg-slate-800 text-white rounded-[6px] text-xs font-bold cursor-pointer transition-colors shadow-xs"
                    >
                      Approve Recommendation
                    </button>
                  </div>
                )}

              </div>
            ) : (
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] p-4 text-xs text-[#64748B] leading-relaxed">
                <p>
                  No resource transfer required under current simulation parameters or no safe donor facility available within safety stock thresholds.
                </p>
              </div>
            )}

          </div>

        </div>

        {/* Confirmation Modal Overlay */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
            <div className="bg-white border border-[#E2E8F0] rounded-[8px] shadow-2xl p-6 max-w-md w-full space-y-4 text-xs">
              <div>
                <h3 className="font-bold text-sm text-[#0F172A]">Confirm Resource Redistribution</h3>
                <p className="text-xs text-[#64748B] mt-1 leading-normal">
                  You are approving the transfer of:
                </p>
              </div>

              <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-3 rounded space-y-1.5 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Medicine:</span>
                  <span className="font-bold text-[#0F172A]">{activeMedicine.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Approved Quantity:</span>
                  <span className="font-bold text-[#0F6B66]">{transferQuantity} {activeMedicine.unit || 'units'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Donor Facility:</span>
                  <span className="font-bold text-[#0F172A]">{recommendation.fromPhc.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Receiving Facility:</span>
                  <span className="font-bold text-[#0F172A]">{phc.name}</span>
                </div>
              </div>

              {approvalError && (
                <p className="text-[#D64545] font-semibold text-xs">{approvalError}</p>
              )}

              <p className="text-[11px] text-[#64748B] leading-normal">
                This action will log the dispatched transfer into the system registry and update regional allocation.
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  disabled={submitting}
                  className="px-3.5 py-1.5 border border-[#E2E8F0] text-[#64748B] hover:bg-slate-100 rounded text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmTransfer}
                  disabled={submitting}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold cursor-pointer"
                >
                  {submitting ? 'Dispatching...' : 'Confirm Transfer'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
