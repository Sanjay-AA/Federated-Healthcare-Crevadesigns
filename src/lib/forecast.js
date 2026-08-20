/**
 * Predicts the number of days until a medicine's stock is depleted using
 * simple linear regression on the last 7 days of consumption history.
 * 
 * @param {Array<{date: string, quantity_used: number}>} consumptionHistory 14-day history
 * @param {number} currentStock Current inventory level
 * @returns {number} Predicted days until stock-out (rounded). Returns 999 if no stock-out is expected in the near future.
 */
export function predictDaysToStockOut(consumptionHistory, currentStock) {
  if (!consumptionHistory || consumptionHistory.length === 0) {
    return 999;
  }
  
  if (currentStock <= 0) {
    return 0;
  }

  // Use the last 7 days to capture the latest trend
  const historySegment = consumptionHistory.slice(-7);
  const n = historySegment.length;

  if (n < 2) {
    // Fallback if there is not enough history: use average of whatever is available
    const avg = consumptionHistory.reduce((sum, d) => sum + d.quantity_used, 0) / consumptionHistory.length;
    return avg > 0 ? Math.round(currentStock / avg) : 999;
  }

  // Simple Linear Regression: y = m * x + c
  // x is the time index (0 to n-1), y is the daily quantity_used
  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumXY = 0;

  for (let i = 0; i < n; i++) {
    const x = i;
    const y = historySegment[i].quantity_used;
    sumX += x;
    sumY += y;
    sumXX += x * x;
    sumXY += x * y;
  }

  const denominator = n * sumXX - sumX * sumX;
  
  // Calculate slope (m) and intercept (c)
  let m = 0;
  let c = 0;

  if (denominator !== 0) {
    m = (n * sumXY - sumX * sumY) / denominator;
    c = (sumY - m * sumX) / n;
  } else {
    // Fallback: flat trend based on average
    m = 0;
    c = sumY / n;
  }

  // Calculate average baseline consumption to prevent division by zero / negative rates
  const averageConsumption = sumY / n;
  
  // Simulate depletion day-by-day in the future
  let remainingStock = currentStock;
  let dayIndex = n; // start predicting from next day index (i.e. day 7 relative to history)
  let predictedDays = 0;
  const maxSimulationDays = 120; // Cap to avoid infinite loops

  while (remainingStock > 0 && predictedDays < maxSimulationDays) {
    // Project the rate: y_t = m * t + c
    let predictedConsumption = m * dayIndex + c;

    // Operational sanity check: if the regression predicts negative or extremely low consumption
    // because of a downward slope, we fallback to a baseline floor of 1 or the average consumption.
    // This ensures we don't predict infinite stock for fluctuating locations.
    const baselineFloor = Math.max(1, averageConsumption * 0.5);
    if (predictedConsumption < baselineFloor) {
      predictedConsumption = baselineFloor;
    }

    remainingStock -= predictedConsumption;
    predictedDays++;
    dayIndex++;
  }

  // If stock is not depleted within the cap window, report 999 (stable)
  return predictedDays >= maxSimulationDays ? 999 : predictedDays;
}

/**
 * Calculates dynamic risk assessment for a district based on Firestore data
 * (diseaseReports, phcs, medicines, federatedModel).
 * 
 * @param {string} districtName Name of the district (e.g. "Namakkal", "Salem", "Erode")
 * @param {Array<Object>} diseaseReports List of disease report documents
 * @param {Array<Object>} phcs List of PHC documents
 * @param {Array<Object>} medicines List of medicine documents
 * @param {Object} federatedModel Federated model document
 * @returns {{ district: string, riskScore: number, severity: 'CRITICAL'|'HIGH'|'MODERATE'|'STABLE', riskColor: string, barBg: string }}
 */
export function calculateDistrictRisk(districtName, diseaseReports = [], phcs = [], medicines = [], federatedModel = null) {
  if (!districtName) {
    return { district: '', riskScore: 0, severity: 'STABLE', riskColor: 'text-[#0F6B66] bg-[#0F6B66]/10 border-[#0F6B66]/20', barBg: 'bg-[#0F6B66]' };
  }

  // 1. Disease Activity Signal (Max 40 points)
  // Combines relative disease activity (60% weight = max 24 pts)
  // and absolute case severity (40% weight = max 16 pts)
  const casesByDistrict = {};
  (diseaseReports || []).forEach((report) => {
    const d = report.district;
    if (d) {
      casesByDistrict[d] = (casesByDistrict[d] || 0) + (report.reported_cases || 0);
    }
  });

  const districtCases = casesByDistrict[districtName] || 0;
  const maxCases = Math.max(1, ...Object.values(casesByDistrict), 1);
  const relativeRatio = maxCases > 0 ? districtCases / maxCases : 0;

  // Normalization threshold benchmark for high outbreak severity
  const ABSOLUTE_CAP_THRESHOLD = 1000;
  const absoluteRatio = Math.min(1.0, districtCases / ABSOLUTE_CAP_THRESHOLD);

  const diseaseScore = (relativeRatio * 24) + (absoluteRatio * 16);

  // 2. PHC Pressure Signal (Max 35 points: 25 for bed occupancy, 10 for medicine shortages)
  const districtPhcs = (phcs || []).filter(p => p.district === districtName);
  let totalBeds = 0;
  let occupiedBeds = 0;
  let shortMedsCount = 0;
  let totalMedsCount = 0;

  districtPhcs.forEach((phc) => {
    totalBeds += phc.total_beds || 0;
    occupiedBeds += phc.occupied_beds || 0;

    const phcMeds = (medicines || []).filter(m => m.phc_id === phc.id);
    totalMedsCount += phcMeds.length;
    phcMeds.forEach((med) => {
      const days = predictDaysToStockOut(med.consumption_history, med.current_stock);
      if (days < 7 || med.current_stock <= (med.minimum_stock || 50)) {
        shortMedsCount++;
      }
    });
  });

  const bedOccupancyRatio = totalBeds > 0 ? Math.min(1, Math.max(0, occupiedBeds / totalBeds)) : 0;
  const bedScore = bedOccupancyRatio * 25;

  const medShortageRatio = totalMedsCount > 0 ? Math.min(1, shortMedsCount / totalMedsCount) : 0;
  const medScore = medShortageRatio * 10;

  const phcPressureScore = bedScore + medScore;

  // 3. Federated AI Model Trend Signal (Max 25 points)
  const nodeInfo = federatedModel?.nodes?.[districtName];
  let federatedScore = 0;
  if (nodeInfo) {
    const slope = nodeInfo.slope || 0;
    if (slope > 0) {
      federatedScore = Math.min(25, slope * 2);
    }
    if (nodeInfo.status === 'OUTBREAK') {
      federatedScore = Math.max(federatedScore, 20);
    }
  }

  // Aggregate raw score and clamp to 0 - 100
  const rawScore = diseaseScore + phcPressureScore + federatedScore;
  const riskScore = Math.round(Math.min(100, Math.max(0, rawScore)));

  // Determine Severity Level & styling tokens
  let severity = 'STABLE';
  let riskColor = 'text-[#0F6B66] bg-[#0F6B66]/10 border-[#0F6B66]/20';
  let barBg = 'bg-[#0F6B66]';

  if (riskScore >= 70) {
    severity = 'CRITICAL';
    riskColor = 'text-[#D64545] bg-[#D64545]/10 border-[#D64545]/20 animate-pulse';
    barBg = 'bg-[#D64545]';
  } else if (riskScore >= 40) {
    severity = 'HIGH';
    riskColor = 'text-[#E8A33D] bg-[#E8A33D]/10 border-[#E8A33D]/20';
    barBg = 'bg-[#E8A33D]';
  } else if (riskScore >= 20) {
    severity = 'MODERATE';
    riskColor = 'text-blue-600 bg-blue-50 border-blue-200';
    barBg = 'bg-blue-500';
  }

  return {
    district: districtName,
    riskScore,
    severity,
    riskColor,
    barBg
  };
}
