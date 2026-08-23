import { predictDaysToStockOut, calculateCaseGrowthRate, calculateConsumptionTrend } from './forecast';
import { getHaversineDistance } from './redistribution';

// Configurable prototype/hackathon weights for donor scoring
export const OPTIMIZATION_WEIGHTS = {
  stockSafety: 0.35,      // Available surplus and safety margin
  recipientUrgency: 0.20, // Urgency of the recipient
  distance: 0.15,         // Geographic proximity
  donorDemandRisk: 0.15,  // Future demand run rate risk of the donor
  diseaseRisk: 0.10,      // Disease pressure/outbreak trends in donor district
  bedCapacity: 0.05       // Bed occupancy buffer
};

/**
 * Runs an emergency scenario simulation in-memory.
 * Does NOT write or modify Firestore data.
 */
export function simulateScenario({
  phc,
  medicine,
  phcs = [],
  medicines = [],
  diseaseReports = [],
  scenarioType = 'DISEASE_OUTBREAK', // 'DISEASE_OUTBREAK' | 'PATIENT_SURGE' | 'SUPPLY_DISRUPTION'
  surgePercentage = 50, // 0 to 100
  durationDays = 7
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
  if (!currentDailyDemand || currentDailyDemand <= 0) {
    currentDailyDemand = 10; // default fallback
  }

  // 2. Surge Multiplier based on selected emergency type
  const surgeDecimal = Math.max(0, Number(surgePercentage || 0)) / 100;
  let surgeMultiplier = 1 + surgeDecimal;

  if (scenarioType === 'SUPPLY_DISRUPTION') {
    // Supply disruption cuts incoming replenishment, simulating demand pressure increase
    surgeMultiplier = 1 + (surgeDecimal * 0.5);
  }

  const projectedDailyDemand = Math.round((currentDailyDemand * surgeMultiplier) * 10) / 10;
  const demandChange = Math.round((projectedDailyDemand - currentDailyDemand) * 10) / 10;

  // 3. Stock-out Projections
  const currentDaysRemaining = currentDailyDemand > 0
    ? Math.round(currentStock / currentDailyDemand)
    : 999;

  const projectedDaysRemaining = projectedDailyDemand > 0
    ? Math.round(currentStock / projectedDailyDemand)
    : 999;

  const daysLost = Math.max(0, (currentDaysRemaining === 999 ? 120 : currentDaysRemaining) - (projectedDaysRemaining === 999 ? 120 : projectedDaysRemaining));

  // 4. Bed Occupancy Projections
  const totalBeds = Number(phc.total_beds || 1);
  const currentOccupiedBeds = Number(phc.occupied_beds || 0);
  const currentBedRate = Math.round((currentOccupiedBeds / totalBeds) * 100);

  // Surge multiplier is applied differently to bed admissions depending on patient surge settings
  const bedSurgeFactor = scenarioType === 'PATIENT_SURGE' ? 1.25 : 0.9;
  const projectedBedDemandRaw = Math.round(currentOccupiedBeds * (1 + surgeDecimal * bedSurgeFactor));
  const projectedBedOccupancy = Math.min(totalBeds, projectedBedDemandRaw);
  const projectedBedRate = Math.round((projectedBedOccupancy / totalBeds) * 100);
  const isBedCapacityExceeded = projectedBedDemandRaw > totalBeds;

  let bedStatusText = 'Manageable capacity';
  if (isBedCapacityExceeded) {
    bedStatusText = 'Capacity Breach (Overflow)';
  } else if (projectedBedRate >= 85) {
    bedStatusText = 'High capacity pressure';
  } else if (projectedBedRate >= 60) {
    bedStatusText = 'Moderate capacity pressure';
  }

  // 5. Staff Pressure Projections
  const attendanceRate = phc.total_staff > 0 
    ? Math.round((phc.staff_present_today / phc.total_staff) * 100)
    : 80;

  const projectedLoadIncPct = Math.round(surgePercentage * (scenarioType === 'PATIENT_SURGE' ? 1.15 : 0.8));
  let staffStatusText = 'Normal workload';
  if (projectedLoadIncPct >= 50) {
    staffStatusText = 'CRITICAL STAFF STRAIN';
  } else if (projectedLoadIncPct >= 20) {
    staffStatusText = 'Elevated staff workload';
  }

  // 6. Overall Risk Level
  const getRiskLevel = (days, bedPct, capacityExceeded) => {
    if (days <= 2 || capacityExceeded || bedPct >= 95) return 'CRITICAL';
    if (days <= 5 || bedPct >= 80) return 'HIGH';
    if (days <= 10 || bedPct >= 65) return 'MODERATE';
    return 'STABLE';
  };

  const currentRisk = getRiskLevel(currentDaysRemaining, currentBedRate, false);
  const projectedRisk = getRiskLevel(projectedDaysRemaining, projectedBedRate, isBedCapacityExceeded);

  // 7. Calculate deficit to maintain safety stock
  const safetyStock = Number(medicine.reorder_level || 300);
  const deficitAmount = Math.max(0, safetyStock - (currentStock - (projectedDailyDemand * durationDays)));
  const requiredQuantity = Math.round(deficitAmount);

  return {
    scenarioType,
    surgePercentage,
    durationDays,
    medicineName: medicine.name,
    requiredQuantity,
    currentStatus: {
      stock: currentStock,
      dailyDemand: currentDailyDemand,
      daysRemaining: currentDaysRemaining,
      bedOccupancyPct: currentBedRate,
      occupiedBeds: currentOccupiedBeds,
      totalBeds,
      staffAttendancePct: attendanceRate,
      staffLoad: 'Normal workload',
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
    }
  };
}

/**
 * Ranks potential donors and builds a single-donor or multi-donor redistribution plan.
 * strictly respects safety thresholds: donors must not fall below safety stock.
 */
export function optimizeRedistribution({
  recipient,
  medicine,
  requiredQuantity,
  phcs = [],
  medicines = [],
  diseaseReports = [],
  federatedModel = null,
  recipientRisk = 'HIGH'
}) {
  if (!recipient || !medicine || requiredQuantity <= 0) {
    return { transfers: [], totalQuantity: 0, requiredQuantity, isFullyAllocated: false };
  }

  const minSafetyStock = Number(medicine.reorder_level || 300);
  const candidates = [];

  phcs.forEach((candidatePhc) => {
    // Exclude recipient itself
    if (candidatePhc.id === recipient.id) return;

    // Retrieve candidate's medicine record
    const candidateMed = medicines.find(
      m => m.phc_id === candidatePhc.id && (m.name === medicine.name || m.medicine_name === medicine.name)
    );
    if (!candidateMed || candidateMed.current_stock <= 0) return;

    const candidateStock = Number(candidateMed.current_stock);
    const candidateSafetyStock = Number(candidateMed.reorder_level || minSafetyStock);
    const candidateDailyCons = Number(candidateMed.daily_consumption) || 10;
    
    // Safety constraint: donor safety threshold limit = safety stock level + 7 days baseline consumption
    const requiredSafetyLimit = candidateSafetyStock + (candidateDailyCons * 7);
    const safeSurplus = Math.max(0, candidateStock - requiredSafetyLimit);

    // Geographic distance
    const isSameDistrict = candidatePhc.district === recipient.district;
    const distance = (recipient.lat && recipient.lng && candidatePhc.lat && candidatePhc.lng)
      ? getHaversineDistance(recipient.lat, recipient.lng, candidatePhc.lat, candidatePhc.lng)
      : (isSameDistrict ? 12.0 : 40.0);

    // Calculate score parameters [0 - 100]
    // 1. Stock Safety (higher safe surplus is better)
    const stockSafetyScore = Math.min(100, (safeSurplus / 400) * 100);

    // 2. Distance (closer is better, capped at 100km)
    const distanceScore = Math.max(0, 100 - distance);

    // 3. Donor Demand Risk (predicted days to stock-out)
    const donorDays = candidateDailyCons > 0 ? Math.round(candidateStock / candidateDailyCons) : 120;
    const donorDemandRiskScore = donorDays >= 28 ? 100 : donorDays <= 7 ? 0 : ((donorDays - 7) / 21) * 100;

    // 4. Disease Risk (lower district growth rate is safer for donor)
    const reportedCases = candidatePhc.reported_cases || [];
    const diseaseGrowth = calculateCaseGrowthRate(reportedCases, medicine.name === 'Paracetamol' ? 'dengue' : 'malaria');
    const diseaseRiskScore = diseaseGrowth <= 0 ? 100 : diseaseGrowth >= 0.8 ? 0 : (1 - diseaseGrowth) * 100;

    // 5. Bed Capacity (lower occupancy is better)
    const bedOccupancyRatio = candidatePhc.total_beds > 0 ? candidatePhc.occupied_beds / candidatePhc.total_beds : 0.5;
    const bedCapacityScore = (1 - bedOccupancyRatio) * 100;

    // Combine using Configurable weights
    const donorScore = Math.round(
      OPTIMIZATION_WEIGHTS.stockSafety * stockSafetyScore +
      OPTIMIZATION_WEIGHTS.distance * distanceScore +
      OPTIMIZATION_WEIGHTS.donorDemandRisk * donorDemandRiskScore +
      OPTIMIZATION_WEIGHTS.diseaseRisk * diseaseRiskScore +
      OPTIMIZATION_WEIGHTS.bedCapacity * bedCapacityScore
    );

    // Penalize donor if located in critical/high risk district
    let finalizedScore = donorScore;
    const nodeInfo = federatedModel?.nodes?.[candidatePhc.district];
    if (nodeInfo?.status === 'OUTBREAK' || nodeInfo?.slope > 10) {
      finalizedScore = Math.max(0, finalizedScore - 25); // penalize risk
    }

    candidates.push({
      phc: candidatePhc,
      medicine: candidateMed,
      currentStock: candidateStock,
      safetyStock: candidateSafetyStock,
      requiredSafetyLimit,
      surplus: safeSurplus,
      distance: Math.round(distance * 10) / 10,
      donorScore: finalizedScore,
      donorDays,
      postTransferStock: candidateStock, // updated during allocation
      postTransferDays: donorDays,
      isSameDistrict
    });
  });

  // Filter candidates with positive surplus and sort by score descending
  const availableDonors = candidates
    .filter(c => c.surplus > 0)
    .sort((a, b) => b.donorScore - a.donorScore);

  const rejectedDonors = candidates
    .filter(c => c.surplus <= 0)
    .sort((a, b) => a.distance - b.distance);

  // Multi-donor optimization allocation
  const transfers = [];
  let totalAllocated = 0;

  for (const donor of availableDonors) {
    if (totalAllocated >= requiredQuantity) break;

    const remainingDeficit = requiredQuantity - totalAllocated;
    const allocatedQty = Math.round(Math.min(remainingDeficit, donor.surplus));

    if (allocatedQty > 0) {
      donor.postTransferStock = donor.currentStock - allocatedQty;
      const dailyCons = Number(donor.medicine.daily_consumption) || 10;
      donor.postTransferDays = dailyCons > 0 ? Math.round(donor.postTransferStock / dailyCons) : 120;

      const estimatedMinutes = Math.round((donor.distance / 45) * 60);
      const travelTimeText = estimatedMinutes > 60
        ? `~${Math.floor(estimatedMinutes / 60)}h ${estimatedMinutes % 60}m`
        : `~${estimatedMinutes} mins`;

      transfers.push({
        fromPhc: donor.phc,
        toPhc: recipient,
        medicineName: medicine.name,
        medicineId: medicine.id,
        quantity: allocatedQty,
        distanceKm: donor.distance,
        estimatedTravelTime: travelTimeText,
        donorScore: donor.donorScore,
        donorBefore: {
          stock: donor.currentStock,
          days: donor.donorDays
        },
        donorAfter: {
          stock: donor.postTransferStock,
          days: donor.postTransferDays
        },
        safetyThresholdMaintained: donor.postTransferStock >= donor.safetyStock ? 'YES' : 'NO',
        whySelected: [
          `Sufficient surplus stock is available (${donor.surplus} units over safety threshold)`,
          `Safe stock buffer remains after transfer (${donor.postTransferDays} days remaining)`,
          `Located within resource network (${donor.distance} km distance)`
        ]
      });

      totalAllocated += allocatedQty;
    }
  }

  const isFullyAllocated = totalAllocated >= requiredQuantity;

  return {
    transfers,
    totalQuantity: totalAllocated,
    requiredQuantity,
    isFullyAllocated,
    availableDonors: availableDonors.slice(0, 5),
    rejectedDonors: rejectedDonors.slice(0, 3)
  };
}
