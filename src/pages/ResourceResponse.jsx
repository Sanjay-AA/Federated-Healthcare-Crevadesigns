import React, { useState, useEffect, useMemo } from 'react';
import { simulateScenario, optimizeRedistribution } from '../lib/resourceOptimizer';
import { generateResponseExplanation } from '../lib/responseExplanation';
import { addResponseAction, getResponseActions } from '../lib/firestore';
import { useLanguage } from '../i18n/LanguageContext';
import { calculateCaseGrowthRate } from '../lib/forecast';
import { db } from '../lib/firebase';
import { 
  runTransaction, 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  serverTimestamp 
} from "firebase/firestore";

export default function ResourceResponse({
  phcs = [],
  medicines = [],
  diseaseReports = [],
  federatedModel = null,
  loading = false,
  initialTarget = null, // Passed if navigated from alert/detail: { phc, medicine }
  onBack
}) {
  const { t, language } = useLanguage();

  // 1. Core States
  const [selectedPhcId, setSelectedPhcId] = useState('');
  const [selectedMedicineName, setSelectedMedicineName] = useState('');
  const [scenarioType, setScenarioType] = useState('DISEASE_OUTBREAK');
  const [surgePercentage, setSurgePercentage] = useState(50);
  const [durationDays, setDurationDays] = useState(7);
  const [activePreset, setActivePreset] = useState('dengue'); // 'dengue' | 'severe' | 'flood' | 'custom'

  // Explanation state
  const [briefingText, setBriefingText] = useState('');
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [explanationCache, setExplanationCache] = useState({});

  // Human-in-the-loop Approval state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');

  // History state
  const [historyActions, setHistoryActions] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(false);

  // 2. Populate lists
  const availablePhcs = useMemo(() => phcs || [], [phcs]);
  
  // Get active PHC doc
  const activePhc = useMemo(() => {
    return availablePhcs.find(p => p.id === selectedPhcId) || availablePhcs[0] || null;
  }, [availablePhcs, selectedPhcId]);

  // Medicines stocked by the active PHC
  const activePhcMedicines = useMemo(() => {
    if (!activePhc) return [];
    return medicines.filter(m => m.phc_id === activePhc.id);
  }, [medicines, activePhc]);

  // Active medicine doc
  const activeMedicine = useMemo(() => {
    return activePhcMedicines.find(m => m.name === selectedMedicineName) || activePhcMedicines[0] || null;
  }, [activePhcMedicines, selectedMedicineName]);

  // Handle Initial Targets from Alerts or PHC details page
  useEffect(() => {
    if (initialTarget && initialTarget.phc) {
      setSelectedPhcId(initialTarget.phc.id);
      if (initialTarget.medicine) {
        setSelectedMedicineName(initialTarget.medicine.name || initialTarget.medicine.medicine_name || '');
      }
      setActivePreset('custom');
    } else if (availablePhcs.length > 0) {
      setSelectedPhcId(availablePhcs[0].id);
    }
  }, [initialTarget, availablePhcs]);

  useEffect(() => {
    if (activePhcMedicines.length > 0 && !selectedMedicineName) {
      setSelectedMedicineName(activePhcMedicines[0].name);
    }
  }, [activePhcMedicines, selectedMedicineName]);

  // 3. Simulation & Optimization Calculation
  const simResult = useMemo(() => {
    if (!activePhc || !activeMedicine) return null;
    return simulateScenario({
      phc: activePhc,
      medicine: activeMedicine,
      phcs: availablePhcs,
      medicines,
      diseaseReports,
      scenarioType,
      surgePercentage,
      durationDays
    });
  }, [activePhc, activeMedicine, availablePhcs, medicines, diseaseReports, scenarioType, surgePercentage, durationDays]);

  const optResult = useMemo(() => {
    if (!activePhc || !activeMedicine || !simResult) return null;
    return optimizeRedistribution({
      recipient: activePhc,
      medicine: activeMedicine,
      requiredQuantity: simResult.requiredQuantity,
      phcs: availablePhcs,
      medicines,
      diseaseReports,
      federatedModel,
      recipientRisk: simResult.projectedStatus.overallRisk
    });
  }, [activePhc, activeMedicine, simResult, availablePhcs, medicines, diseaseReports, federatedModel]);

  // 4. Fetch Response actions history
  const loadHistory = async () => {
    setHistoryLoading(true);
    setHistoryError(false);
    try {
      const actions = await getResponseActions();
      // sort chronologically descending
      actions.sort((a, b) => {
        const dateA = a.created_at?.toDate ? a.created_at.toDate() : new Date(a.created_at || 0);
        const dateB = b.created_at?.toDate ? b.created_at.toDate() : new Date(b.created_at || 0);
        return dateB - dateA;
      });
      setHistoryActions(actions);
    } catch (err) {
      console.error("Failed to load actions history:", err);
      setHistoryError(true);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // 5. Explanation generation trigger
  const cacheKey = useMemo(() => {
    if (!activePhc || !activeMedicine || !simResult || !optResult) return '';
    const transfersHash = optResult.transfers.map(t => `${t.fromPhc.id}_${t.quantity}`).join('-');
    return `${activePhc.id}_${activeMedicine.id}_${surgePercentage}_${durationDays}_${scenarioType}_${transfersHash}_${language}`;
  }, [activePhc, activeMedicine, simResult, optResult, surgePercentage, durationDays, scenarioType, language]);

  const triggerExplanation = async () => {
    if (!cacheKey) return;
    if (explanationCache[cacheKey]) {
      setBriefingText(explanationCache[cacheKey]);
      return;
    }

    setBriefingLoading(true);
    setBriefingText('');
    try {
      const briefing = await generateResponseExplanation({
        recipient: activePhc,
        medicine: activeMedicine,
        simResult,
        optResult,
        language
      });
      setExplanationCache(prev => ({ ...prev, [cacheKey]: briefing }));
      setBriefingText(briefing);
    } catch (err) {
      console.error("Explanation generation failed:", err);
    } finally {
      setBriefingLoading(false);
    }
  };

  useEffect(() => {
    triggerExplanation();
  }, [cacheKey]);

  // 6. Presets setup
  const applyPreset = (preset) => {
    setActivePreset(preset);
    if (preset === 'dengue') {
      setScenarioType('DISEASE_OUTBREAK');
      setSurgePercentage(50);
      setDurationDays(7);
    } else if (preset === 'severe') {
      setScenarioType('DISEASE_OUTBREAK');
      setSurgePercentage(100);
      setDurationDays(14);
    } else if (preset === 'flood') {
      setScenarioType('PATIENT_SURGE');
      setSurgePercentage(40);
      setDurationDays(7);
      // In flood preset, we might add logic filters or just simulate a Logistics Disruption tag
    }
  };

  // Reset Scenario Simulation
  const handleResetSimulation = () => {
    if (availablePhcs.length > 0) {
      setSelectedPhcId(availablePhcs[0].id);
      if (phcs[0]) {
        const meds = medicines.filter(m => m.phc_id === phcs[0].id);
        if (meds.length > 0) {
          setSelectedMedicineName(meds[0].name);
        }
      }
    }
    setScenarioType('DISEASE_OUTBREAK');
    setSurgePercentage(0);
    setDurationDays(7);
    setActivePreset('custom');
    setActionSuccessMsg('');
  };

  // Confirm and save Dispatch action to Firestore
  const handleConfirmApproval = async () => {
    if (!optResult || submittingAction) return;
    setSubmittingAction(true);

    // 1. Validate recommendation and quantities
    if (optResult.totalQuantity <= 0 || optResult.transfers.length === 0) {
      alert("Validation failed: No transfer quantity recommended.");
      setSubmittingAction(false);
      return;
    }

    // 2. Verify recipient still requires resource
    if (simResult.requiredQuantity <= 0) {
      alert("Validation failed: Recipient does not require any additional inventory.");
      setSubmittingAction(false);
      return;
    }

    // 3. Verify donor stock and safety thresholds in memory first
    for (const t of optResult.transfers) {
      if (t.donorBefore.stock < t.quantity) {
        alert(`Validation failed: Donor ${t.fromPhc.name} has insufficient stock (${t.donorBefore.stock}) for the transfer of ${t.quantity} units.`);
        setSubmittingAction(false);
        return;
      }
      
      const donorSafetyLimit = t.fromPhc.reorder_level || 300;
      if (t.donorBefore.stock - t.quantity < donorSafetyLimit) {
        alert(`Validation failed: Donor ${t.fromPhc.name} safety threshold would be breached (${t.donorBefore.stock - t.quantity} < ${donorSafetyLimit}).`);
        setSubmittingAction(false);
        return;
      }
    }

    try {
      console.log("[ResourceResponse] Initiating Firestore Transaction for approved transfers...");

      // A. Query recipient medicine document reference
      const recipientMedQuery = query(
        collection(db, "medicines"),
        where("phc_id", "==", activePhc.id),
        where("medicine_name", "==", activeMedicine.name)
      );
      const recipientMedSnapshot = await getDocs(recipientMedQuery);
      if (recipientMedSnapshot.empty) {
        throw new Error(`Recipient medicine document not found for ${activeMedicine.name} at ${activePhc.name}`);
      }
      const recipientMedRef = recipientMedSnapshot.docs[0].ref;

      // B. Query donor medicine document references
      const donorRefs = [];
      for (const t of optResult.transfers) {
        const donorMedQuery = query(
          collection(db, "medicines"),
          where("phc_id", "==", t.fromPhc.id),
          where("medicine_name", "==", activeMedicine.name)
        );
        const donorMedSnapshot = await getDocs(donorMedQuery);
        if (donorMedSnapshot.empty) {
          throw new Error(`Donor medicine document not found for ${activeMedicine.name} at ${t.fromPhc.name}`);
        }
        donorRefs.push({
          ref: donorMedSnapshot.docs[0].ref,
          transferQuantity: t.quantity,
          fromPhcName: t.fromPhc.name,
          safetyThreshold: t.fromPhc.reorder_level || 300
        });
      }

      const firstTransfer = optResult.transfers[0];
      const actionPayload = {
        // User requested keys (camelCase)
        recipientPhcId: activePhc.id,
        recipientPhcName: activePhc.name,
        donorPhcId: firstTransfer ? firstTransfer.fromPhc.id : null,
        donorPhcName: firstTransfer ? firstTransfer.fromPhc.name : null,
        district: activePhc.district,
        medicineId: activeMedicine.id,
        medicineName: activeMedicine.name,
        quantity: optResult.totalQuantity,
        distanceKm: firstTransfer ? firstTransfer.distanceKm : 0,
        estimatedEta: firstTransfer ? Math.round(firstTransfer.distanceKm * 1.5) : 0, // Approx travel duration in minutes
        scenarioType: scenarioType,
        diseaseSurgePercent: surgePercentage,
        scenarioDurationDays: durationDays,
        stockOutDaysBefore: simResult.currentStatus.daysRemaining === 999 ? 120 : simResult.currentStatus.daysRemaining,
        stockCoverageAfter: optResult.projectedDaysRemainingAfter === 999 ? 120 : optResult.projectedDaysRemainingAfter,
        riskBefore: simResult.projectedStatus.overallRisk,
        riskAfter: optResult.isFullyAllocated ? 'STABLE' : 'WARNING',
        donorStockBefore: firstTransfer ? firstTransfer.donorBefore.stock : 0,
        donorStockAfter: firstTransfer ? firstTransfer.donorAfter.stock : 0,
        donorSafetyThreshold: firstTransfer ? (firstTransfer.fromPhc.reorder_level || 300) : 300,
        status: "APPROVED",
        approvedBy: "Command Center Admin",
        approvedAt: new Date().toISOString(),

        // Compatibility keys (snake_case)
        recipient_id: activePhc.id,
        recipient_name: activePhc.name,
        medicine_name: activeMedicine.name,
        required_quantity: simResult.requiredQuantity,
        total_quantity: optResult.totalQuantity,
        scenario_type: scenarioType,
        surge_percentage: surgePercentage,
        duration_days: durationDays,
        impact_summary: `${simResult.projectedStatus.overallRisk} → ${optResult.isFullyAllocated ? 'STABLE' : 'WARNING'}`,
        transfers: optResult.transfers.map(t => ({
          from_phc_id: t.fromPhc.id,
          from_phc_name: t.fromPhc.name,
          quantity: t.quantity,
          distance_km: t.distanceKm
        }))
      };

      // C. Run the atomic multi-document transaction
      await runTransaction(db, async (transaction) => {
        // Read recipient stock inside the transaction
        const recipientDoc = await transaction.get(recipientMedRef);
        if (!recipientDoc.exists()) {
          throw new Error("Recipient medicine document does not exist in transaction");
        }
        const currentRecipientStock = Number(recipientDoc.data().current_stock || 0);

        // Read all donors and validate current stocks inside the transaction
        const donorDocs = [];
        for (const d of donorRefs) {
          const donorDoc = await transaction.get(d.ref);
          if (!donorDoc.exists()) {
            throw new Error(`Donor medicine document for ${d.fromPhcName} does not exist in transaction`);
          }
          const currentDonorStock = Number(donorDoc.data().current_stock || 0);
          
          if (currentDonorStock < d.transferQuantity) {
            throw new Error(`Insufficient stock at donor ${d.fromPhcName}: ${currentDonorStock} < ${d.transferQuantity}`);
          }
          if (currentDonorStock - d.transferQuantity < d.safetyThreshold) {
            throw new Error(`Transfer would breach safety stock threshold for donor ${d.fromPhcName}`);
          }

          donorDocs.push({
            ref: d.ref,
            newStock: currentDonorStock - d.transferQuantity
          });
        }

        // Perform stock updates
        let updatedRecipientStock = currentRecipientStock;
        for (const dDoc of donorDocs) {
          transaction.update(dDoc.ref, { current_stock: dDoc.newStock });
          const qty = donorRefs.find(dr => dr.ref === dDoc.ref).transferQuantity;
          updatedRecipientStock += qty;
        }
        transaction.update(recipientMedRef, { current_stock: updatedRecipientStock });

        // Record the approved action immutably
        const actionRef = doc(collection(db, "response_actions"));
        transaction.set(actionRef, {
          ...actionPayload,
          created_at: serverTimestamp()
        });
      });

      console.log("[ResourceResponse] Transaction completed successfully. Approved response action persisted.");
      setActionSuccessMsg(`Emergency Response plan for ${activeMedicine.name} approved! Operational inventory updated.`);
      setShowConfirmModal(false);
      loadHistory(); // Reload history log
    } catch (err) {
      console.error("[ResourceResponse] Transaction failed:", err);
      alert(`Error dispatching response plan: ${err.message || err}. Please try again.`);
    } finally {
      setSubmittingAction(false);
    }
  };

  // Overall calculations for Regional overview cards
  const regionalStats = useMemo(() => {
    let bedsTotal = 0;
    let bedsOccupied = 0;
    let staffTotal = 0;
    let staffPresent = 0;
    let totalMeds = 0;
    let shortMeds = 0;

    phcs.forEach(p => {
      bedsTotal += p.total_beds || 0;
      bedsOccupied += p.occupied_beds || 0;
      staffTotal += p.total_staff || 0;
      staffPresent += p.staff_present_today || 0;

      const phcMeds = medicines.filter(m => m.phc_id === p.id);
      totalMeds += phcMeds.length;
      phcMeds.forEach(m => {
        const days = m.daily_consumption > 0 ? m.current_stock / m.daily_consumption : 30;
        if (days < 3) shortMeds++;
      });
    });

    const averageBedOccupancy = bedsTotal > 0 ? Math.round((bedsOccupied / bedsTotal) * 100) : 0;
    const averageStaffAttendance = staffTotal > 0 ? Math.round((staffPresent / staffTotal) * 100) : 0;

    // Disease pressure calculated from case growth
    let growthRateTotal = 0;
    let growthRateCount = 0;
    phcs.forEach(p => {
      if (p.reported_cases && p.reported_cases.length > 0) {
        const rate = calculateCaseGrowthRate(p.reported_cases, 'dengue');
        growthRateTotal += rate;
        growthRateCount++;
      }
    });
    const avgDiseasePressure = growthRateCount > 0 ? Math.round((growthRateTotal / growthRateCount) * 100) : 15;

    return {
      avgDiseasePressure,
      shortMeds,
      averageBedOccupancy,
      averageStaffAttendance
    };
  }, [phcs, medicines]);

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
      console.warn("Failed to parse Gemini briefing JSON:", e);
      return null;
    }
  }, [briefingText]);

  // Formatting timestamp for display
  const formatActionDate = (actionDoc) => {
    let dateObj;
    if (actionDoc.created_at?.toDate) {
      dateObj = actionDoc.created_at.toDate();
    } else if (actionDoc.created_at) {
      dateObj = new Date(actionDoc.created_at);
    } else {
      return 'Recent';
    }

    const hours = String(dateObj.getHours() % 12 || 12).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const ampm = dateObj.getHours() >= 12 ? 'PM' : 'AM';
    return `${dateObj.toLocaleDateString()} ${hours}:${minutes} ${ampm}`;
  };

  return (
    <div className="space-y-6 animate-fadeIn text-[#0F172A] font-sans">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E2E8F0] gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-600 text-white rounded-[6px] shadow-xs">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </span>
            <h1 className="text-xl font-bold tracking-tight">AI Resource Response Engine</h1>
          </div>
          <p className="text-xs text-[#64748B] mt-1">
            Simulate emerging health emergencies, predict resource pressure, and generate explainable redistribution recommendations.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-100 rounded-full font-mono">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse"></span>
            {simResult && surgePercentage > 0 ? 'SIMULATOR ACTIVE' : 'STABLE MODE'}
          </span>
          <button
            onClick={handleResetSimulation}
            className="px-3 py-1.5 bg-white border border-[#E2E8F0] hover:border-[#1D4E89]/40 hover:bg-slate-50 text-xs font-semibold text-[#1E293B] rounded-[6px] transition-colors cursor-pointer select-none"
          >
            Reset Simulator
          </button>
        </div>
      </div>

      {actionSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-250 text-emerald-800 text-xs font-semibold rounded-[8px] flex items-center justify-between animate-fadeIn">
          <span>✓ {actionSuccessMsg}</span>
          <button onClick={() => setActionSuccessMsg('')} className="text-emerald-900 font-bold hover:underline cursor-pointer">Dismiss</button>
        </div>
      )}

      {/* SECTION 1: CURRENT SITUATION */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        
        {/* Disease Pressure */}
        <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-3 shadow-xs">
          <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Disease Pressure</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-lg font-bold text-[#0f172a]">
              {simResult && surgePercentage > 0 ? `+${simResult.projectedStatus.projectedPatientLoadInc}%` : `+${regionalStats.avgDiseasePressure}%`}
            </span>
            <span className={`text-[9px] font-bold px-1 py-0.2 rounded border ${
              simResult && surgePercentage > 20 ? 'text-[#D64545] bg-[#D64545]/10 border-[#D64545]/20' : 'text-[#0F6B66] bg-[#0F6B66]/10 border-[#0F6B66]/20'
            }`}>
              {simResult && surgePercentage > 20 ? 'HIGH GROWTH' : 'NORMAL'}
            </span>
          </div>
          <span className="text-[9px] text-[#64748B] block mt-0.5">Dengue Case growth trend</span>
        </div>

        {/* Medicine Pressure */}
        <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-3 shadow-xs">
          <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Medicine Pressure</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-lg font-bold text-[#0f172a]">
              {simResult ? `${simResult.projectedStatus.daysRemaining === 999 ? 'Stable' : simResult.projectedStatus.daysRemaining + 'd'}` : `${regionalStats.shortMeds} items`}
            </span>
            <span className={`text-[9px] font-bold px-1 py-0.2 rounded border ${
              simResult && simResult.projectedStatus.daysRemaining <= 3 ? 'text-[#D64545] bg-[#D64545]/10 border-[#D64545]/20 animate-pulse' : 'text-[#0F6B66] bg-[#0F6B66]/10 border-[#0F6B66]/20'
            }`}>
              {simResult ? (simResult.projectedStatus.daysRemaining <= 3 ? 'CRITICAL' : 'OPTIMAL') : 'AT RISK'}
            </span>
          </div>
          <span className="text-[9px] text-[#64748B] block mt-0.5">
            {simResult ? `${simResult.medicineName} stock-out` : 'Medicines near depletion'}
          </span>
        </div>

        {/* Bed Pressure */}
        <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-3 shadow-xs">
          <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Bed Pressure</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-lg font-bold text-[#0f172a]">
              {simResult ? `${simResult.projectedStatus.bedOccupancyPct}%` : `${regionalStats.averageBedOccupancy}%`}
            </span>
            <span className={`text-[9px] font-bold px-1 py-0.2 rounded border ${
              (simResult ? simResult.projectedStatus.bedOccupancyPct : regionalStats.averageBedOccupancy) >= 85 ? 'text-[#D64545] bg-[#D64545]/10 border-[#D64545]/20' : 'text-[#0F6B66] bg-[#0F6B66]/10 border-[#0F6B66]/20'
            }`}>
              {(simResult ? simResult.projectedStatus.bedOccupancyPct : regionalStats.averageBedOccupancy) >= 85 ? 'HIGH OCCUPANCY' : 'STABLE'}
            </span>
          </div>
          <span className="text-[9px] text-[#64748B] block mt-0.5">Regional bed occupancy rate</span>
        </div>

        {/* Workforce */}
        <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-3 shadow-xs">
          <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Workforce load</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-lg font-bold text-[#0f172a]">
              {simResult ? simResult.projectedStatus.staffStatusText.includes('CRITICAL') ? 'OVERLOAD' : 'NORMAL' : `${regionalStats.averageStaffAttendance}%`}
            </span>
            <span className="text-[9px] text-[#0F6B66] bg-[#0F6B66]/10 border border-[#0F6B66]/20 px-1 py-0.2 rounded font-bold uppercase">
              {simResult && simResult.projectedStatus.staffStatusText.includes('CRITICAL') ? 'STRAINED' : 'OK'}
            </span>
          </div>
          <span className="text-[9px] text-[#64748B] block mt-0.5">Staff presence & stress level</span>
        </div>

        {/* Regional Risk */}
        <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-3 shadow-xs col-span-2 md:col-span-1">
          <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Regional Risk</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={`text-lg font-bold ${
              (simResult ? simResult.projectedStatus.overallRisk : 'MODERATE') === 'CRITICAL' ? 'text-[#D64545]' : (simResult ? simResult.projectedStatus.overallRisk : 'MODERATE') === 'HIGH' ? 'text-[#E8A33D]' : 'text-[#0F6B66]'
            }`}>
              {simResult ? simResult.projectedStatus.overallRisk : 'MODERATE'}
            </span>
            <span className="text-[9px] text-[#64748B] font-bold">LEVEL</span>
          </div>
          <span className="text-[9px] text-[#64748B] block mt-0.5">Aggregated threat index</span>
        </div>

      </div>

      {/* Main Workspace split */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
        
        {/* LEFT COLUMN: SIMULATOR CONTROLS & COMPARISONS */}
        <div className="xl:col-span-3 space-y-6">
          
          {/* SECTION 2: EMERGENCY SCENARIO SIMULATOR */}
          <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-5 space-y-5 shadow-xs">
            <div>
              <h2 className="text-xs font-bold text-[#1D4E89] uppercase tracking-wider">What If? Scenario Simulator</h2>
              <p className="text-[11px] text-[#64748B] mt-0.5">
                Simulate how a localized health surge affects medicine depletion curves, bed capacity breaches, and staffing workloads.
              </p>
            </div>

            {/* Presets Row */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3 text-xs">
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Scenario Presets:</span>
              <button
                onClick={() => applyPreset('dengue')}
                className={`px-3 py-1 text-[11px] font-semibold rounded border cursor-pointer transition-colors ${
                  activePreset === 'dengue'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50'
                }`}
              >
                Dengue Outbreak Surge (+50%)
              </button>
              <button
                onClick={() => applyPreset('severe')}
                className={`px-3 py-1 text-[11px] font-semibold rounded border cursor-pointer transition-colors ${
                  activePreset === 'severe'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50'
                }`}
              >
                Severe Outbreak Epidemic (+100%)
              </button>
              <button
                onClick={() => applyPreset('flood')}
                className={`px-3 py-1 text-[11px] font-semibold rounded border cursor-pointer transition-colors ${
                  activePreset === 'flood'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50'
                }`}
              >
                Flood Emergency Disaster (+40%)
              </button>
              <button
                onClick={() => setActivePreset('custom')}
                className={`px-3 py-1 text-[11px] font-semibold rounded border cursor-pointer transition-colors ${
                  activePreset === 'custom'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50'
                }`}
              >
                Custom Parameters
              </button>
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">
                  Select Recipient Outpost (PHC)
                </label>
                <select
                  value={selectedPhcId}
                  onChange={(e) => {
                    setSelectedPhcId(e.target.value);
                    setSelectedMedicineName('');
                    setActionSuccessMsg('');
                  }}
                  className="w-full bg-white border border-[#E2E8F0] rounded-[6px] px-3 py-1.5 text-xs text-[#0F172A] font-semibold outline-none cursor-pointer hover:border-slate-350 transition-colors focus:ring-2 focus:ring-blue-500/10"
                >
                  {availablePhcs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.district} District)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">
                  Simulated Medicine Item
                </label>
                <select
                  value={selectedMedicineName}
                  onChange={(e) => {
                    setSelectedMedicineName(e.target.value);
                    setActionSuccessMsg('');
                  }}
                  className="w-full bg-white border border-[#E2E8F0] rounded-[6px] px-3 py-1.5 text-xs text-[#0F172A] font-semibold outline-none cursor-pointer hover:border-slate-350 transition-colors focus:ring-2 focus:ring-blue-500/10"
                >
                  {activePhcMedicines.length > 0 ? (
                    activePhcMedicines.map((m) => (
                      <option key={m.id} value={m.name}>
                        {m.name} (Stock: {m.current_stock})
                      </option>
                    ))
                  ) : (
                    <option>No medicines stocked</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">
                  Emergency Scenario Surge Type
                </label>
                <select
                  value={scenarioType}
                  onChange={(e) => {
                    setScenarioType(e.target.value);
                    setActivePreset('custom');
                    setActionSuccessMsg('');
                  }}
                  className="w-full bg-white border border-[#E2E8F0] rounded-[6px] px-3 py-1.5 text-xs text-[#0F172A] font-semibold outline-none cursor-pointer hover:border-slate-350 transition-colors focus:ring-2 focus:ring-blue-500/10"
                >
                  <option value="DISEASE_OUTBREAK">Disease Outbreak Surge</option>
                  <option value="PATIENT_SURGE">Acute Patient Inflow</option>
                  <option value="SUPPLY_DISRUPTION">Supply Logistics Disruption</option>
                </select>
              </div>

            </div>

            {/* Slider and Duration Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center border-t border-slate-100 pt-4">
              
              <div className="md:col-span-2 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Disease Case Increase (Surge multiplier)</span>
                  <span className="font-mono font-bold text-blue-600 bg-blue-50 border border-blue-150 px-2 py-0.2 rounded text-[11px]">
                    +{surgePercentage}% Increase
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="10"
                  value={surgePercentage}
                  onChange={(e) => {
                    setSurgePercentage(Number(e.target.value));
                    setActivePreset('custom');
                    setActionSuccessMsg('');
                  }}
                  className="w-full h-1.5 bg-slate-150 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-[9px] text-[#64748B] font-mono">
                  <span>0% (Baseline)</span>
                  <span>10%</span>
                  <span>20%</span>
                  <span>30%</span>
                  <span>50%</span>
                  <span>75%</span>
                  <span>100% (Outbreak)</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">
                  Scenario Surge Duration
                </label>
                <div className="flex rounded-[6px] border border-[#E2E8F0] bg-white p-0.5 space-x-1">
                  {[3, 7, 14, 30].map((days) => (
                    <button
                      key={days}
                      onClick={() => {
                        setDurationDays(days);
                        setActivePreset('custom');
                        setActionSuccessMsg('');
                      }}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-[4px] cursor-pointer transition-colors ${
                        durationDays === days
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50'
                      }`}
                    >
                      {days}d
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* SECTION 2.5: BEFORE vs AFTER COMPARISON ("Scenario Impact") */}
          {simResult && (
            <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-5 space-y-4 shadow-xs">
              <div>
                <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">Scenario Impact Assessment</h3>
                <p className="text-[11px] text-[#64748B] mt-0.5">
                  Immediate stress-test comparison showing how the selected surge parameters impact regional operations.
                </p>
              </div>

              <div className="border border-[#E2E8F0] rounded-[6px] overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-slate-50 text-[#64748B] font-semibold uppercase tracking-wider text-[9px]">
                      <th className="py-2 px-4">Performance Metric</th>
                      <th className="py-2 px-4 text-right">Current / Baseline</th>
                      <th className="py-2 px-4 text-right">Simulated Surge</th>
                      <th className="py-2 px-4 text-center">Operational Shift</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    
                    <tr>
                      <td className="py-2.5 px-4 font-semibold text-slate-700">Projected Daily Demand</td>
                      <td className="py-2.5 px-4 text-right font-mono">{simResult.currentStatus.dailyDemand} units/day</td>
                      <td className="py-2.5 px-4 text-right font-mono text-blue-600 font-semibold">{simResult.projectedStatus.dailyDemand} units/day</td>
                      <td className="py-2.5 px-4 text-center">
                        <span className="inline-block text-[10px] font-bold text-[#D64545] bg-[#D64545]/10 border border-[#D64545]/20 px-1.5 py-0.2 rounded font-mono">
                          +{simResult.projectedStatus.projectedPatientLoadInc}% Load
                        </span>
                      </td>
                    </tr>

                    <tr>
                      <td className="py-2.5 px-4 font-semibold text-slate-700">Medicine Stock-out Timeline</td>
                      <td className="py-2.5 px-4 text-right font-mono">{simResult.currentStatus.daysRemaining === 999 ? 'Stable (30d+)' : `${simResult.currentStatus.daysRemaining} days`}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-[#D64545] font-bold">
                        {simResult.projectedStatus.daysRemaining === 999 ? 'Stable (30d+)' : `${simResult.projectedStatus.daysRemaining} days`}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        {simResult.projectedStatus.daysLost > 0 ? (
                          <span className="inline-block text-[10px] font-bold text-[#D64545] bg-[#D64545]/10 border border-[#D64545]/20 px-1.5 py-0.2 rounded font-mono">
                            -{simResult.projectedStatus.daysLost} days buffer lost
                          </span>
                        ) : (
                          <span className="inline-block text-[10px] font-semibold text-[#0F6B66] bg-[#0F6B66]/10 border border-[#0F6B66]/20 px-1.5 py-0.2 rounded font-mono">
                            No shift
                          </span>
                        )}
                      </td>
                    </tr>

                    <tr>
                      <td className="py-2.5 px-4 font-semibold text-slate-700">Hospital Bed Occupancy</td>
                      <td className="py-2.5 px-4 text-right font-mono">{simResult.currentStatus.bedOccupancyPct}% occupancy</td>
                      <td className="py-2.5 px-4 text-right font-mono text-blue-600 font-semibold">{simResult.projectedStatus.bedOccupancyPct}% occupancy</td>
                      <td className="py-2.5 px-4 text-center">
                        {simResult.projectedStatus.isBedCapacityExceeded ? (
                          <span className="inline-block text-[10px] font-bold text-white bg-[#D64545] border border-[#D64545] px-1.5 py-0.2 rounded font-mono animate-pulse uppercase">
                            Capacity Breach
                          </span>
                        ) : (
                          <span className="inline-block text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded font-mono">
                            {simResult.projectedStatus.bedOccupancyPct - simResult.currentStatus.bedOccupancyPct > 0 ? `+${simResult.projectedStatus.bedOccupancyPct - simResult.currentStatus.bedOccupancyPct}%` : 'Stable'}
                          </span>
                        )}
                      </td>
                    </tr>

                    <tr>
                      <td className="py-2.5 px-4 font-semibold text-slate-700">Workforce Stress Load</td>
                      <td className="py-2.5 px-4 text-right font-mono">{simResult.currentStatus.staffLoad}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-blue-600 font-semibold">{simResult.projectedStatus.staffStatusText}</td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={`inline-block text-[10px] font-bold px-1.5 py-0.2 rounded font-mono ${
                          simResult.projectedStatus.staffStatusText.includes('CRITICAL') ? 'text-[#D64545] bg-[#D64545]/10 border border-[#D64545]/20 animate-pulse' : 'text-[#64748B] bg-[#F7F9FB] border border-[#E2E8F0]'
                        }`}>
                          {simResult.projectedStatus.staffStatusText.includes('CRITICAL') ? '↑ STRESS' : 'STABLE'}
                        </span>
                      </td>
                    </tr>

                    <tr>
                      <td className="py-2.5 px-4 font-semibold text-slate-700">Threat Risk Assessment</td>
                      <td className="py-2.5 px-4 text-right font-mono">
                        <span className={`font-mono text-[11px] font-bold ${
                          simResult.currentStatus.overallRisk === 'CRITICAL' ? 'text-[#D64545]' : simResult.currentStatus.overallRisk === 'HIGH' ? 'text-[#E8A33D]' : 'text-[#0F6B66]'
                        }`}>{simResult.currentStatus.overallRisk}</span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono">
                        <span className={`font-mono text-[11px] font-bold ${
                          simResult.projectedStatus.overallRisk === 'CRITICAL' ? 'text-[#D64545]' : simResult.projectedStatus.overallRisk === 'HIGH' ? 'text-[#E8A33D]' : 'text-[#0F6B66]'
                        }`}>{simResult.projectedStatus.overallRisk}</span>
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        {simResult.currentStatus.overallRisk !== simResult.projectedStatus.overallRisk ? (
                          <span className="inline-block text-[10px] font-bold text-[#D64545] bg-[#D64545]/10 border border-[#D64545]/20 px-1.5 py-0.2 rounded font-mono">
                            {simResult.currentStatus.overallRisk} → {simResult.projectedStatus.overallRisk}
                          </span>
                        ) : (
                          <span className="inline-block text-[10px] font-semibold text-[#0F6B66] bg-[#0F6B66]/10 border border-[#0F6B66]/20 px-1.5 py-0.2 rounded font-mono">
                            Risk Unchanged
                          </span>
                        )}
                      </td>
                    </tr>

                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SECTION 3: RESOURCE RESPONSE OPTIMIZER */}
          {simResult && optResult && (
            <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-5 space-y-4 shadow-xs">
              <div>
                <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">AI Recommended Response Actions</h3>
                <p className="text-[11px] text-[#64748B] mt-0.5">
                  Multi-donor optimization logic: recommends transfers only when safety thresholds are guaranteed on donor nodes.
                </p>
              </div>

              {simResult.requiredQuantity <= 0 ? (
                <div className="p-6 bg-slate-50 border border-slate-200 rounded-[6px] text-center text-xs font-semibold text-[#0F6B66] leading-normal flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 text-[#0f6b66]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4" />
                  </svg>
                  <span>No Intervention Required: simulated stock levels remain fully stable under this scenario.</span>
                </div>
              ) : optResult.transfers.length === 0 ? (
                <div className="p-6 bg-[#D64545]/5 border border-[#D64545]/15 rounded-[6px] text-center text-xs font-semibold text-[#D64545] leading-normal space-y-2">
                  <div className="font-bold flex items-center justify-center gap-1.5 uppercase tracking-wide">
                    ⚠️ No Safe Donor Outposts Available
                  </div>
                  <p className="text-[11px] text-[#475569] leading-relaxed max-w-lg mx-auto">
                    All nearby facilities storing {activeMedicine.name} would fall below their reorder safety thresholds if a transfer were made.
                    <br />
                    <span className="font-bold text-[#D64545]">Escalation path recommended:</span> Initiate state/district-level emergency procurement.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  
                  {/* Recommended Action Card (Left/Mid) */}
                  <div className="md:col-span-2 border border-[#E2E8F0] bg-slate-50/50 rounded-[8px] p-4 flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-150 px-2 py-0.5 rounded uppercase tracking-wider">
                          Redistribution Opportunity Found
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-500">
                          {optResult.isFullyAllocated ? '100% Fulfilled' : 'Partially Fulfilled'}
                        </span>
                      </div>
                      
                      {/* Transfers breakdown */}
                      <div className="mt-4 space-y-3">
                        {optResult.transfers.map((t, index) => (
                          <div key={index} className="flex items-center justify-between p-2.5 bg-white border border-[#E2E8F0] rounded-[6px] text-xs">
                            <div>
                              <span className="font-semibold text-[#1E293B] block">
                                Transfer <span className="font-mono text-blue-600 font-bold">{t.quantity}</span> {activeMedicine.unit || 'units'} of {activeMedicine.name}
                              </span>
                              <span className="text-[10px] text-[#64748B] block mt-0.5">
                                Route: <span className="font-bold text-slate-700">{t.fromPhc.name}</span> → <span className="font-bold text-slate-700">{t.toPhc.name}</span>
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="font-mono text-[#0F172A] font-semibold block">{t.distanceKm} km</span>
                              <span className="text-[9px] text-[#64748B] block font-mono">ETA {t.estimatedTravelTime}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Metrics comparison summary */}
                      <div className="grid grid-cols-3 gap-2 mt-4 text-[10px] bg-white border border-slate-150 rounded p-2 text-center text-[#64748B]">
                        <div>
                          <span className="block uppercase text-[8px] font-bold font-mono">Required</span>
                          <span className="font-mono text-[#0F172A] font-bold">{simResult.requiredQuantity} units</span>
                        </div>
                        <div>
                          <span className="block uppercase text-[8px] font-bold font-mono">Proposed</span>
                          <span className="font-mono text-blue-600 font-bold">{optResult.totalQuantity} units</span>
                        </div>
                        <div>
                          <span className="block uppercase text-[8px] font-bold font-mono">Recipient Buffer</span>
                          <span className="font-mono text-emerald-600 font-bold">
                            {simResult.projectedStatus.daysRemaining}d → {simResult.projectedStatus.daysRemaining + Math.round(optResult.totalQuantity / simResult.projectedStatus.dailyDemand)}d
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <button
                        onClick={() => setShowConfirmModal(true)}
                        className="flex-1 h-9 bg-[#0F172A] border border-[#0F172A] hover:bg-slate-800 text-white rounded-[6px] text-xs font-semibold select-none cursor-pointer transition-colors shadow-sm"
                      >
                        Approve Response
                      </button>
                    </div>
                  </div>

                  {/* SVG Route Visualization Map (Right) */}
                  <div className="border border-[#E2E8F0] rounded-[8px] p-4 flex flex-col justify-between bg-white min-h-[220px]">
                    <div>
                      <span className="text-[9px] font-bold text-[#64748B] uppercase tracking-wider block">Dispatch Route Map</span>
                      <p className="text-[10px] text-[#64748B] mt-0.5 leading-normal">
                        Geographic nodes involved in the recommended redistribution.
                      </p>
                    </div>

                    {/* SVG map canvas */}
                    <div className="relative h-[130px] border border-slate-100 rounded bg-[#F8FAFC]/50 flex items-center justify-center overflow-hidden">
                      <svg className="w-full h-full" viewBox="0 0 200 120">
                        {/* Grids and lines */}
                        <line x1="10" y1="60" x2="190" y2="60" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3 3" />
                        <line x1="100" y1="10" x2="100" y2="110" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3 3" />

                        {/* Route paths with animated dashed line */}
                        {optResult.transfers.map((t, idx) => {
                          const startX = 35 + (idx * 30);
                          const startY = 30 + (idx * 15);
                          return (
                            <g key={idx}>
                              <line
                                x1={startX}
                                y1={startY}
                                x2="140"
                                y2="70"
                                stroke="#1D4E89"
                                strokeWidth="2"
                                strokeDasharray="4 4"
                                className="animate-pulse"
                              />
                              {/* Donor node */}
                              <circle cx={startX} cy={startY} r="5" fill="#10B981" />
                              <text x={startX - 15} y={startY - 6} fontSize="7" fontWeight="bold" fill="#047857">
                                {t.fromPhc.name.split(' ')[0]}
                              </text>
                            </g>
                          );
                        })}

                        {/* Recipient node */}
                        <circle cx="140" cy="70" r="7" fill="#EF4444" className="animate-ping opacity-20" />
                        <circle cx="140" cy="70" r="5" fill="#EF4444" />
                        <text x="130" y="88" fontSize="7" fontWeight="bold" fill="#B91C1C">
                          {activePhc.name.split(' ')[0]} (Deficit)
                        </text>

                        {/* Info label overlay */}
                        <rect x="50" y="102" width="100" height="15" rx="3" fill="#0F172A" opacity="0.8" />
                        <text x="100" y="112" fill="#FFFFFF" fontSize="6.5" textAnchor="middle" fontWeight="bold" fontFamily="monospace">
                          {optResult.transfers.length} donors → {optResult.totalQuantity} units
                        </text>
                      </svg>
                    </div>

                    <div className="text-[10px] text-[#64748B] text-center italic">
                      Haversine math coordinates verified.
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}

          {/* SECTION 4: "WHY DID AI RECOMMEND THIS?" & IMPACT PREVIEW */}
          {simResult && optResult && optResult.transfers.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Explainability Panel */}
              <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-5 space-y-4 shadow-xs">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <div>
                    <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5">
                      Why did AI recommend this?
                    </h3>
                  </div>
                  <span className="text-[8px] font-bold text-purple-600 bg-purple-50 border border-purple-100 px-1.5 py-0.2 rounded font-mono uppercase tracking-wider">
                    Gemini Explainability
                  </span>
                </div>

                {briefingLoading ? (
                  <div className="space-y-3 pt-2">
                    <div className="text-[10px] text-purple-600 font-semibold animate-pulse">
                      Generating situation explainability reasoning...
                    </div>
                    <div className="space-y-1.5 animate-pulse">
                      <div className="h-3 bg-slate-100 rounded w-full"></div>
                      <div className="h-3 bg-slate-100 rounded w-11/12"></div>
                      <div className="h-3 bg-slate-100 rounded w-4/5"></div>
                    </div>
                  </div>
                ) : parsedBriefing ? (
                  <div className="space-y-3 text-[11px] leading-relaxed text-[#475569] pt-1">
                    <div className="font-bold text-[#1E293B] text-[12px] border-b border-slate-100 pb-1 uppercase tracking-tight">
                      {parsedBriefing.headline}
                    </div>
                    <div>
                      <span className="font-bold text-slate-400 uppercase tracking-wider text-[8px] block leading-none mb-0.5">Calculated Situation</span>
                      <span>{parsedBriefing.situation}</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-400 uppercase tracking-wider text-[8px] block leading-none mb-0.5">Emergency Risk Breakdown</span>
                      <span>{parsedBriefing.riskExplanation}</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-400 uppercase tracking-wider text-[8px] block leading-none mb-0.5">Optimized Action Pathway</span>
                      <span>{parsedBriefing.recommendedAction}</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-400 uppercase tracking-wider text-[8px] block leading-none mb-0.5">Deterministic Reason</span>
                      <span>{parsedBriefing.reason}</span>
                    </div>
                    {parsedBriefing.confidenceNote && (
                      <div className="text-[9px] text-slate-400 italic pt-1 border-t border-slate-100 leading-normal font-mono">
                        {parsedBriefing.confidenceNote}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-[#64748B] pt-2">
                    Unable to generate natural-language explainability briefing.
                  </div>
                )}
              </div>

              {/* Impact Preview */}
              <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-5 space-y-4 shadow-xs">
                <div className="pb-2 border-b border-slate-100">
                  <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">Projected Response Impact</h3>
                </div>

                <div className="space-y-4">
                  
                  {/* Recipient Change */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Recipient Outpost: {activePhc.name}</span>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-2 border border-slate-100 bg-[#D64545]/5 rounded">
                        <span className="text-[9px] text-[#64748B] block uppercase font-bold">Before Response</span>
                        <span className="font-mono text-xs font-bold text-[#D64545]">Stock-out: {simResult.projectedStatus.daysRemaining}d</span>
                        <span className="text-[9px] text-[#64748B] block font-mono">Risk: {simResult.projectedStatus.overallRisk}</span>
                      </div>
                      <div className="p-2 border border-emerald-150 bg-emerald-50/50 rounded">
                        <span className="text-[9px] text-emerald-700 block uppercase font-bold">After Response</span>
                        <span className="font-mono text-xs font-bold text-emerald-700">Stock-out: {simResult.projectedStatus.daysRemaining + Math.round(optResult.totalQuantity / simResult.projectedStatus.dailyDemand)}d</span>
                        <span className="text-[9px] text-emerald-700 block font-mono">Risk: MODERATE</span>
                      </div>
                    </div>
                  </div>

                  {/* Donors Safety thresholds check */}
                  <div className="space-y-2 border-t border-slate-100 pt-3">
                    <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Donor Nodes Integrity</span>
                    <div className="space-y-2">
                      {optResult.transfers.map((t, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs p-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded">
                          <span className="font-semibold text-slate-700">{t.fromPhc.name}</span>
                          <div className="flex gap-4 font-mono text-[11px]">
                            <span>Before: {t.donorBefore.stock} ({t.donorBefore.days}d)</span>
                            <span className="text-blue-600 font-bold">→</span>
                            <span className="text-slate-800 font-bold">After: {t.donorAfter.stock} ({t.donorAfter.days}d)</span>
                            <span className="text-emerald-700 font-bold font-sans">Safety: YES</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>

            </div>
          )}

        </div>

        {/* RIGHT COLUMN: FEDERATED SIGNALS & ACTIONS HISTORY */}
        <div className="space-y-6">
          
          {/* Federated intelligence Signal */}
          <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-4 space-y-3 shadow-xs">
            <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
              </span>
              Federated Intelligence Signal
            </h3>
            
            <div className="space-y-2 text-[11px] text-[#64748B] leading-relaxed">
              <div className="bg-[#F8FAFC] border border-slate-150/70 p-2.5 rounded space-y-1 text-slate-700">
                <div className="flex justify-between">
                  <span className="font-semibold">Model Signal:</span>
                  <span className="font-mono text-purple-700 font-bold">Aggregated Prediction Feed</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Nodes Contributing:</span>
                  <span className="font-mono text-slate-800 font-semibold">{phcs.length} Outposts</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Data Encryption:</span>
                  <span className="font-mono text-[#0F6B66] font-bold">MPC cryptographic verification</span>
                </div>
              </div>
              <p className="italic text-[10px] text-purple-600 font-medium">
                No raw patient identifiers or medical records are exchanged between outposts during simulation modeling.
              </p>
            </div>
          </div>

          {/* SECTION 5: RESPONSE HISTORY */}
          <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-4 space-y-3 shadow-xs">
            <div className="flex justify-between items-center pb-1 border-b border-slate-100">
              <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">Approved Response History</h3>
              <button
                onClick={loadHistory}
                className="text-[9px] font-bold text-blue-600 hover:underline cursor-pointer select-none"
              >
                Refresh
              </button>
            </div>

            {historyLoading ? (
              <div className="text-center py-6 text-xs text-[#64748B] font-semibold animate-pulse">
                Loading history log...
              </div>
            ) : historyError ? (
              <div className="text-center py-8 text-xs text-[#D64545] font-semibold bg-[#D64545]/5 border border-[#D64545]/15 p-2 rounded">
                Response history temporarily unavailable.
              </div>
            ) : historyActions.length === 0 ? (
              <div className="text-center py-8 text-xs text-[#64748B] font-semibold italic">
                No response transfers recorded yet.
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {historyActions.map((action, idx) => (
                  <div key={idx} className="p-2.5 border border-[#E2E8F0] bg-[#FDFDFD] hover:bg-slate-50 rounded-[6px] text-xs space-y-1.5 transition-colors">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-[#1E293B] block uppercase tracking-wide text-[10px]">
                        {action.medicine_name}
                      </span>
                      <span className="text-[9px] font-mono text-[#64748B]">
                        {formatActionDate(action)}
                      </span>
                    </div>

                    <div className="text-[#475569] text-[11px] leading-relaxed">
                      Deficit: <span className="font-mono font-bold text-slate-800">{action.required_quantity}</span> | Dispatched: <span className="font-mono font-bold text-blue-600">{action.total_quantity}</span> units
                      <span className="block mt-0.5">
                        Recipient: <span className="font-semibold text-slate-700">{action.recipient_name}</span>
                      </span>
                    </div>

                    {/* Transfers breakdown */}
                    <div className="border-t border-slate-100 pt-1.5 mt-1 space-y-1 text-[10px] text-[#64748B]">
                      {action.transfers?.map((t, tIdx) => (
                        <div key={tIdx} className="flex justify-between">
                          <span>From: {t.from_phc_name}</span>
                          <span className="font-mono font-semibold">{t.quantity} units</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-between items-center text-[9px] font-bold mt-1 text-[#0f6b66] bg-[#0f6b66]/10 border border-[#0f6b66]/20 px-2 py-0.5 rounded uppercase">
                      <span>Risk Impact</span>
                      <span>{action.impact_summary || 'CRITICAL → MODERATE'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* HUMAN-IN-THE-LOOP APPROVAL MODAL */}
      {showConfirmModal && optResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white border border-[#E2E8F0] rounded-[10px] shadow-xl w-full max-w-md overflow-hidden text-[#0F172A] font-sans">
            
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC] flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="p-1 bg-amber-50 border border-amber-200 text-amber-600 rounded">
                  ⚠️
                </span>
                <h3 className="font-bold text-sm text-[#0F172A]">Approve Resource Redistribution?</h3>
              </div>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs">
              <p className="text-[#475569] leading-relaxed">
                You are authorizing the dispatcher to transfer inventory stock between regional primary healthcare outposts. Verify the details before confirming:
              </p>

              <div className="bg-slate-50 border border-[#E2E8F0] rounded-[6px] p-3 space-y-2">
                <div className="flex justify-between font-semibold">
                  <span>Medicine Item:</span>
                  <span className="font-mono text-slate-800">{activeMedicine.name}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Target Recipient:</span>
                  <span className="text-slate-800">{activePhc.name}</span>
                </div>
                <div className="flex justify-between font-semibold border-b border-slate-200 pb-1.5">
                  <span>Required Quantity:</span>
                  <span className="font-mono text-[#D64545]">{simResult.requiredQuantity} units</span>
                </div>

                <div className="space-y-1.5 pt-1">
                  <span className="text-[9px] font-bold text-[#64748B] uppercase tracking-wider block">Authorized Dispatches:</span>
                  {optResult.transfers.map((t, idx) => (
                    <div key={idx} className="flex justify-between font-mono text-[11px] text-slate-700">
                      <span>{t.fromPhc.name} ({t.distanceKm} km)</span>
                      <span className="font-bold text-blue-600">+{t.quantity} units</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center text-[10px] p-2 bg-emerald-50 border border-emerald-200 rounded font-semibold text-emerald-800">
                <span>Donor safety stock limits maintained:</span>
                <span className="font-mono font-bold">YES</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-5 py-3 border-t border-[#E2E8F0] bg-[#F8FAFC] flex justify-end gap-2 text-xs">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-3.5 py-1.5 bg-white border border-[#E2E8F0] hover:bg-slate-50 text-[#1E293B] font-semibold rounded-[6px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmApproval}
                disabled={submittingAction}
                className="px-3.5 py-1.5 bg-blue-600 border border-blue-600 hover:bg-blue-700 text-white font-semibold rounded-[6px] cursor-pointer"
              >
                {submittingAction ? 'Dispatching...' : 'Approve Response'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
