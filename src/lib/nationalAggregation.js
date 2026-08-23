import { predictDaysToStockOut, calculateCaseGrowthRate } from './forecast';
import { getRedistributionRecommendation } from './redistribution';

export const NATIONAL_RISK_WEIGHTS = {
  medicine: 0.30,      // Medicine shortage risk (30%)
  beds: 0.20,          // Bed occupancy level (20%)
  disease: 0.20,       // Disease case growth (20%)
  workforce: 0.15,     // Staff absence/workforce strain (15%)
  criticalPhcs: 0.15   // Ratio of critical PHCs (15%)
};

/**
 * Helper to determine a PHC node's risk status
 */
export function getPhcStatus(phc, phcMedicines) {
  if (!phc) return { code: 'STABLE', label: 'STABLE' };
  
  const totalBeds = phc.total_beds || 1;
  const occupiedBeds = phc.occupied_beds || 0;
  const occupancyRate = occupiedBeds / totalBeds;
  
  const stockoutTimes = phcMedicines.map(m => predictDaysToStockOut(m.consumption_history || [], m.current_stock || 0));
  const minDays = stockoutTimes.length > 0 ? Math.min(...stockoutTimes) : 999;

  if (occupancyRate >= 0.85 || minDays < 3) {
    return { code: 'CRITICAL', label: 'CRITICAL' };
  }
  if (occupancyRate >= 0.60 || minDays < 7) {
    return { code: 'WARNING', label: 'WARNING' };
  }
  return { code: 'STABLE', label: 'STABLE' };
}

/**
 * Calculates a deterministic risk score (0-100) for a given state
 */
export function calculateStateRiskScore(stateName, phcs = [], medicines = [], diseaseReports = []) {
  // Filter state outposts
  const statePhcs = phcs.filter(p => p.state === stateName);
  if (statePhcs.length === 0) return { score: 10, severity: 'LOW' };

  const stateMeds = medicines.filter(m => statePhcs.some(p => p.id === m.phc_id));

  // 1. Medicine Risk: Percentage of meds near stockout (< 7 days)
  let stateShortMeds = 0;
  stateMeds.forEach(m => {
    const days = predictDaysToStockOut(m.consumption_history || [], m.current_stock || 0);
    if (days < 7) stateShortMeds++;
  });
  const medRisk = stateMeds.length > 0 ? (stateShortMeds / stateMeds.length) * 100 : 0;

  // 2. Bed Pressure: Average occupancy rate
  let stateBeds = 0;
  let stateOccupied = 0;
  statePhcs.forEach(p => {
    stateBeds += p.total_beds || 0;
    stateOccupied += p.occupied_beds || 0;
  });
  const bedOccupancy = stateBeds > 0 ? (stateOccupied / stateBeds) * 100 : 0;

  // 3. Workforce Pressure: Absence rate (100 - attendance)
  let stateStaff = 0;
  let statePresent = 0;
  statePhcs.forEach(p => {
    stateStaff += p.total_staff || 0;
    statePresent += p.staff_present_today || 0;
  });
  const workforceAttendance = stateStaff > 0 ? (statePresent / stateStaff) * 100 : 100;
  const workforceAbsence = 100 - workforceAttendance;

  // 4. Disease Pressure: Average case growth
  let growthSum = 0;
  let growthCount = 0;
  statePhcs.forEach(p => {
    if (p.reported_cases && p.reported_cases.length > 0) {
      growthSum += calculateCaseGrowthRate(p.reported_cases, 'dengue');
      growthCount++;
    }
  });
  const diseasePressure = growthCount > 0 ? Math.min(100, Math.max(0, growthSum / growthCount)) : 15;

  // 5. Critical PHCs ratio
  let stateCriticalCount = 0;
  statePhcs.forEach(p => {
    const phcMeds = stateMeds.filter(m => m.phc_id === p.id);
    const status = getPhcStatus(p, phcMeds);
    if (status.code === 'CRITICAL') {
      stateCriticalCount++;
    }
  });
  const criticalPhcRatio = (stateCriticalCount / statePhcs.length) * 100;

  // Aggregate weighted score
  const scoreRaw = 
    (medRisk * NATIONAL_RISK_WEIGHTS.medicine) +
    (bedOccupancy * NATIONAL_RISK_WEIGHTS.beds) +
    (diseasePressure * NATIONAL_RISK_WEIGHTS.disease) +
    (workforceAbsence * NATIONAL_RISK_WEIGHTS.workforce) +
    (criticalPhcRatio * NATIONAL_RISK_WEIGHTS.criticalPhcs);

  const score = Math.round(Math.min(100, Math.max(0, scoreRaw)));
  
  let severity = 'LOW';
  if (score >= 80) severity = 'CRITICAL';
  else if (score >= 60) severity = 'HIGH';
  else if (score >= 40) severity = 'MODERATE';

  return {
    score,
    severity,
    criticalPhcsCount: stateCriticalCount,
    medicineRiskPct: Math.round(medRisk),
    bedOccupancyPct: Math.round(bedOccupancy),
    workforceAttendancePct: Math.round(workforceAttendance),
    totalPhcs: statePhcs.length
  };
}

/**
 * Aggregates all national level metrics from the complete Firestore dataset
 */
export function aggregateNationalMetrics(phcs = [], medicines = [], districts = []) {
  const uniqueStates = Array.from(new Set(phcs.map(p => p.state).filter(Boolean)));
  if (uniqueStates.length === 0) uniqueStates.push('Tamil Nadu');

  const uniqueDistricts = Array.from(new Set(phcs.map(p => p.district).filter(Boolean)));

  let totalBeds = 0;
  let occupiedBeds = 0;
  let totalStaff = 0;
  let staffPresent = 0;
  let criticalPhcsCount = 0;
  let medicineRiskCount = 0;

  phcs.forEach(p => {
    totalBeds += p.total_beds || 0;
    occupiedBeds += p.occupied_beds || 0;
    totalStaff += p.total_staff || 0;
    staffPresent += p.staff_present_today || 0;

    const phcMeds = medicines.filter(m => m.phc_id === p.id);
    const status = getPhcStatus(p, phcMeds);
    if (status.code === 'CRITICAL') {
      criticalPhcsCount++;
    }

    // Count meds at risk of stock-out in less than 7 days
    phcMeds.forEach(m => {
      const days = predictDaysToStockOut(m.consumption_history || [], m.current_stock || 0);
      if (days < 7) {
        medicineRiskCount++;
      }
    });
  });

  const bedOccupancy = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;
  const workforceAttendance = totalStaff > 0 ? Math.round((staffPresent / totalStaff) * 100) : 100;

  // Calculate national risk score (average of all populated states)
  let nationalRiskSum = 0;
  uniqueStates.forEach(st => {
    const riskInfo = calculateStateRiskScore(st, phcs, medicines);
    nationalRiskSum += riskInfo.score;
  });
  const nationalRiskScore = uniqueStates.length > 0 
    ? Math.round(nationalRiskSum / uniqueStates.length) 
    : 35;

  let nationalSeverity = 'LOW';
  if (nationalRiskScore >= 80) nationalSeverity = 'CRITICAL';
  else if (nationalRiskScore >= 60) nationalSeverity = 'HIGH';
  else if (nationalRiskScore >= 40) nationalSeverity = 'MODERATE';

  return {
    statesCount: uniqueStates.length,
    districtsCount: uniqueDistricts.length || districts.length,
    phcsCount: phcs.length,
    criticalPhcsCount,
    medicineRiskCount,
    bedOccupancy,
    workforceAttendance,
    nationalRiskScore,
    nationalSeverity,
    totalBeds,
    occupiedBeds,
    totalStaff,
    staffPresent
  };
}

/**
 * Gets a sorted list of the national critical facilities requiring immediate focus
 */
export function getNationalPriorityFacilities(phcs = [], medicines = []) {
  const criticalList = [];
  phcs.forEach(p => {
    const phcMeds = medicines.filter(m => m.phc_id === p.id);
    const status = getPhcStatus(p, phcMeds);
    
    if (status.code === 'CRITICAL') {
      // Find critical medicine details
      const criticalMeds = phcMeds.filter(m => predictDaysToStockOut(m.consumption_history || [], m.current_stock || 0) < 3);
      const mainCritMedName = criticalMeds.length > 0 ? criticalMeds[0].name : 'N/A';
      const mainCritMedStockOut = criticalMeds.length > 0 
        ? predictDaysToStockOut(criticalMeds[0].consumption_history || [], criticalMeds[0].current_stock || 0)
        : 999;

      criticalList.push({
        phc: p,
        medicineName: mainCritMedName,
        stockoutDays: mainCritMedStockOut === 999 ? 'N/A' : `${mainCritMedStockOut} days`,
        bedsOccupancy: p.total_beds > 0 ? `${Math.round((p.occupied_beds / p.total_beds) * 100)}%` : 'N/A',
        overallRisk: 'CRITICAL'
      });
    }
  });

  return criticalList;
}

/**
 * Aggregates all national medicine risks
 */
export function getNationalMedicineSupplyRisk(phcs = [], medicines = []) {
  const medSummaries = {};
  medicines.forEach(m => {
    const days = predictDaysToStockOut(m.consumption_history || [], m.current_stock || 0);
    if (!medSummaries[m.name]) {
      medSummaries[m.name] = {
        name: m.name,
        atRiskCount: 0,
        coverageSum: 0,
        coverageCount: 0
      };
    }
    
    if (days < 7) {
      medSummaries[m.name].atRiskCount++;
    }
    medSummaries[m.name].coverageSum += days === 999 ? 30 : days;
    medSummaries[m.name].coverageCount++;
  });

  return Object.values(medSummaries).map(s => ({
    name: s.name,
    atRiskPhcs: s.atRiskCount,
    avgCoverage: s.coverageCount > 0 ? Math.round(s.coverageSum / s.coverageCount) : 0
  })).sort((a, b) => b.atRiskPhcs - a.atRiskPhcs);
}
