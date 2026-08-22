import { predictDaysToStockOut, calculateConsumptionTrend } from './forecast';
import { getHaversineDistance } from './redistribution';

/**
 * Calculates emergency scenario projections for a PHC & medicine.
 * Uses exact baseline daily demand and surge multiplier to compute projected demand and days remaining.
 */
export function runEmergencySimulation({
  phc,
  medicine,
  phcs = [],
  medicines = [],
  scenarioType = 'DISEASE_OUTBREAK', // 'DISEASE_OUTBREAK' | 'PATIENT_SURGE' | 'SUPPLY_DISRUPTION'
  surgePercentage = 50, // 0, 10, 20, 30, 50, 75, 100
  durationDays = 7, // 3, 7, 14
}) {
  if (!phc || !medicine) return null;

  const currentStock = Number(medicine.current_stock || 0);

  // 1. Baseline Daily Demand Calculation
  let currentDailyDemand = Number(medicine.daily_consumption || 0);

  const history = medicine.consumption_history || [];
  if ((!currentDailyDemand || currentDailyDemand <= 0) && history.length > 0) {
    const totalConsumed = history.reduce((sum, h) => sum + Number(h.quantity_used || 0), 0);
    currentDailyDemand = Math.round((totalConsumed / history.length) * 10) / 10;
  }

  // Fallback if missing or 0 to prevent division by zero / NaN
  if (!currentDailyDemand || currentDailyDemand <= 0) {
    currentDailyDemand = 10;
  }

  // 2. Surge Multiplier & Projected Daily Demand
  const surgeDecimal = Math.max(0, Number(surgePercentage || 0)) / 100;
  let surgeMultiplier = 1 + surgeDecimal;

  if (scenarioType === 'SUPPLY_DISRUPTION') {
    surgeMultiplier = 1 + (surgeDecimal * 0.5);
  }

  const projectedDailyDemand = Math.round((currentDailyDemand * surgeMultiplier) * 10) / 10;
  const demandChange = Math.round((projectedDailyDemand - currentDailyDemand) * 10) / 10;

  // 3. Days Remaining Calculations
  const currentDaysRemaining = currentDailyDemand > 0
    ? Math.round(currentStock / currentDailyDemand)
    : null;

  const projectedDaysRemaining = projectedDailyDemand > 0
    ? Math.round(currentStock / projectedDailyDemand)
    : null;

  const daysLost = (currentDaysRemaining !== null && projectedDaysRemaining !== null)
    ? Math.max(0, currentDaysRemaining - projectedDaysRemaining)
    : null;

  // 4. Bed Calculation
  const totalBeds = Number(phc.total_beds || 1);
  const currentOccupiedBeds = Number(phc.occupied_beds || 0);
  const currentBedRate = Math.round((currentOccupiedBeds / totalBeds) * 100);

  const projectedBedDemandRaw = Math.round(currentOccupiedBeds * (1 + surgeDecimal * (scenarioType === 'PATIENT_SURGE' ? 1.2 : 0.9)));
  const projectedBedOccupancy = Math.min(totalBeds, projectedBedDemandRaw);
  const projectedBedRate = Math.round((projectedBedOccupancy / totalBeds) * 100);
  const isBedCapacityExceeded = projectedBedDemandRaw > totalBeds;

  let bedStatusText = 'Manageable capacity';
  if (isBedCapacityExceeded) {
    bedStatusText = 'Capacity likely to be exceeded';
  } else if (projectedBedRate >= 85) {
    bedStatusText = 'High capacity pressure';
  } else if (projectedBedRate >= 60) {
    bedStatusText = 'Moderate capacity pressure';
  }

  // 5. Staff Calculation
  const currentStaffLoadText = 'Normal workload';
  const projectedLoadIncPct = Math.round(surgePercentage * (scenarioType === 'PATIENT_SURGE' ? 1.1 : 0.8));

  let staffStatusText = 'Normal workload';
  if (projectedLoadIncPct >= 50) {
    staffStatusText = 'Critical staff strain — Additional staff required';
  } else if (projectedLoadIncPct >= 20) {
    staffStatusText = 'Elevated staff workload';
  }

  // 6. Overall Risk Calculation
  const getRiskLevel = (days, bedPct, capacityExceeded) => {
    if ((days !== null && days <= 2) || capacityExceeded || bedPct >= 90) return 'CRITICAL';
    if ((days !== null && days <= 5) || bedPct >= 75) return 'HIGH';
    if ((days !== null && days <= 10) || bedPct >= 60) return 'MODERATE';
    return 'STABLE';
  };

  const currentRisk = getRiskLevel(currentDaysRemaining, currentBedRate, false);
  const projectedRisk = getRiskLevel(projectedDaysRemaining, projectedBedRate, isBedCapacityExceeded);

  // 7. Redistribution Donor Recommendation & Transparent Evaluation
  const minSafetyStock = Number(medicine.reorder_level || (medicine.name === 'Paracetamol' ? 300 : medicine.name === 'IV Fluids' ? 200 : 150));
  const deficitAmount = Math.max(0, (minSafetyStock * 1.5) - (projectedDailyDemand * durationDays));
  const neededUnits = Math.max(100, Math.min(1000, Math.round(deficitAmount)));

  const evaluatedCandidates = [];

  phcs.forEach((candidatePhc) => {
    if (candidatePhc.id === phc.id) return;

    const candidateMed = (medicines || []).find(
      m => m.phc_id === candidatePhc.id && (m.medicine_name === medicine.name || m.name === medicine.name)
    );

    if (!candidateMed) {
      evaluatedCandidates.push({
        phc: candidatePhc,
        selected: false,
        reason: `Does not stock ${medicine.name}`
      });
      return;
    }

    const candidateStock = Number(candidateMed.current_stock || 0);
    const candidateSafetyLevel = Number(candidateMed.reorder_level || minSafetyStock);
    const candidateDailyCons = Number(candidateMed.daily_consumption) || 10;
    const candidateCurrentDays = candidateDailyCons > 0 ? Math.round(candidateStock / candidateDailyCons) : 999;

    const surplus = candidateStock - candidateSafetyLevel;
    const isSameDistrict = candidatePhc.district === phc.district;
    const isSameState = candidatePhc.state === phc.state;

    const distance = (phc.lat && phc.lng && candidatePhc.lat && candidatePhc.lng)
      ? getHaversineDistance(phc.lat, phc.lng, candidatePhc.lat, candidatePhc.lng)
      : (isSameDistrict ? 15.0 : 45.0);

    const transferQty = Math.min(surplus, neededUnits);
    const postTransferStock = candidateStock - transferQty;
    const postTransferDays = candidateDailyCons > 0 ? Math.round(postTransferStock / candidateDailyCons) : 999;

    const donorRemainsSafe = surplus > 0 && postTransferDays >= 7 && postTransferStock >= candidateSafetyLevel;

    if (!donorRemainsSafe) {
      let rejectionReason = 'Projected stock level would fall below safety threshold';
      if (surplus <= 0) {
        rejectionReason = `No surplus stock available (Current: ${candidateStock}, Minimum required: ${candidateSafetyLevel})`;
      } else if (postTransferDays < 7) {
        rejectionReason = `Post-transfer stock (${postTransferDays} days) would put facility at stockout risk`;
      }
      evaluatedCandidates.push({
        phc: candidatePhc,
        selected: false,
        distance: Math.round(distance * 10) / 10,
        surplus,
        reason: rejectionReason
      });
      return;
    }

    const candidateRisk = postTransferDays <= 3 ? 'CRITICAL' : postTransferDays <= 7 ? 'HIGH' : postTransferDays <= 14 ? 'MODERATE' : 'STABLE';

    evaluatedCandidates.push({
      phc: candidatePhc,
      medicine: candidateMed,
      selected: true,
      distance: Math.round(distance * 10) / 10,
      surplus,
      transferQty,
      candidateStock,
      postTransferStock,
      candidateCurrentDays,
      postTransferDays,
      candidateRisk,
      isSameDistrict,
      isSameState,
      reasons: [
        `Sufficient surplus stock is available (${surplus} units over safety threshold)`,
        `Safe stock buffer remains after transfer (${postTransferDays} days of supply remaining)`,
        `Located within resource network (${Math.round(distance * 10) / 10} km distance)`,
        `Post-transfer risk level remains ${candidateRisk}`
      ]
    });
  });

  const validCandidates = evaluatedCandidates.filter(c => c.selected);
  validCandidates.sort((a, b) => {
    if (a.isSameDistrict !== b.isSameDistrict) return b.isSameDistrict ? 1 : -1;
    return a.distance - b.distance;
  });

  const rejectedCandidates = evaluatedCandidates.filter(c => !c.selected);
  const bestDonor = validCandidates[0] || null;

  let recommendation = null;
  if (bestDonor) {
    const recommendedQty = Math.max(50, Math.min(bestDonor.surplus, neededUnits));
    const recipientPostTransferStock = currentStock + recommendedQty;
    const recipientPostTransferDays = projectedDailyDemand > 0
      ? Math.round(recipientPostTransferStock / projectedDailyDemand)
      : 999;
    const recipientPostTransferRisk = getRiskLevel(recipientPostTransferDays, projectedBedRate, isBedCapacityExceeded);

    const estimatedMinutes = Math.round((bestDonor.distance / 45) * 60);
    const travelTimeText = estimatedMinutes > 60
      ? `~${Math.floor(estimatedMinutes / 60)}h ${estimatedMinutes % 60}m`
      : `~${estimatedMinutes} mins`;

    recommendation = {
      fromPhc: bestDonor.phc,
      toPhc: phc,
      medicineName: medicine.name,
      medicineId: medicine.id,
      recommendedQuantity: recommendedQty,
      distanceKm: bestDonor.distance,
      estimatedTravelTime: travelTimeText,

      recipientBefore: {
        stock: currentStock,
        days: projectedDaysRemaining,
        risk: projectedRisk
      },
      recipientAfter: {
        stock: recipientPostTransferStock,
        days: recipientPostTransferDays,
        risk: recipientPostTransferRisk
      },
      donorBefore: {
        stock: bestDonor.candidateStock,
        days: bestDonor.candidateCurrentDays,
        risk: 'STABLE'
      },
      donorAfter: {
        stock: bestDonor.postTransferStock,
        days: bestDonor.postTransferDays,
        risk: bestDonor.candidateRisk
      },

      whySelected: bestDonor.reasons,
      rejectedCandidates: rejectedCandidates.slice(0, 3)
    };
  }

  return {
    scenarioType,
    surgePercentage,
    durationDays,
    medicineName: medicine.name,
    currentStatus: {
      stock: currentStock,
      dailyDemand: currentDailyDemand,
      daysRemaining: currentDaysRemaining,
      bedOccupancyPct: currentBedRate,
      occupiedBeds: currentOccupiedBeds,
      totalBeds,
      staffLoad: currentStaffLoadText,
      overallRisk: currentRisk
    },
    projectedStatus: {
      dailyDemand: projectedDailyDemand,
      daysRemaining: projectedDaysRemaining,
      daysLost,
      demandChange,
      bedOccupancyPct: projectedBedRate,
      projectedOccupiedBeds: projectedBedOccupancy,
      totalBeds,
      isBedCapacityExceeded,
      bedStatusText,
      projectedPatientLoadInc: projectedLoadIncPct,
      staffStatusText,
      overallRisk: projectedRisk
    },
    recommendation
  };
}
