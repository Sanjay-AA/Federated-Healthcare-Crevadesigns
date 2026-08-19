import { predictDaysToStockOut } from './forecast';

/**
 * Calculates geographic distance in km between two lat/lng coordinates.
 */
export function getHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Generates a redistribution recommendation for a specific deficit PHC and medicine.
 * 
 * @param {Object} deficitPhc The PHC experiencing stock-out risk
 * @param {string} medicineName Name of the medicine in deficit ("Paracetamol", "IV Fluids", "ORS")
 * @param {Array<Object>} allPhcs List of all PHC objects
 * @param {Array<Object>} allMedicines List of all medicine objects
 * @returns {Object|null} Recommendation object or null if no surplus donor exists
 */
export function getRedistributionRecommendation(deficitPhc, medicineName, allPhcs, allMedicines) {
  // Find medicine record for the deficit PHC
  const deficitMed = allMedicines.find(m => m.phc_id === deficitPhc.id && m.name === medicineName);
  if (!deficitMed) return null;

  // Calculate deficit PHC consumption metrics
  const deficitHistory = deficitMed.consumption_history || [];
  const deficitAvg = deficitHistory.length > 0
    ? deficitHistory.slice(-7).reduce((sum, d) => sum + d.quantity_used, 0) / Math.min(7, deficitHistory.length)
    : 1;

  // Deficit target buffer is 14 days of average consumption
  const deficitSafetyBuffer = Math.max(50, Math.round(deficitAvg * 14));
  const deficitAmount = Math.max(0, deficitSafetyBuffer - deficitMed.current_stock);
  if (deficitAmount <= 0) return null;

  const candidates = [];

  // Scan other PHCs for donors
  allPhcs.forEach((candidatePhc) => {
    if (candidatePhc.id === deficitPhc.id) return;

    // Get the candidate's medicine stock and consumption
    const candidateMed = allMedicines.find(m => m.phc_id === candidatePhc.id && m.name === medicineName);
    if (!candidateMed || candidateMed.current_stock <= 0) return;

    // Check if candidate is at risk itself
    const candidateDaysToStockOut = predictDaysToStockOut(candidateMed.consumption_history, candidateMed.current_stock);
    if (candidateDaysToStockOut < 10) return; // Keep buffer for near-risk nodes

    const candidateHistory = candidateMed.consumption_history || [];
    const candidateAvg = candidateHistory.length > 0
      ? candidateHistory.slice(-7).reduce((sum, d) => sum + d.quantity_used, 0) / Math.min(7, candidateHistory.length)
      : 1;

    // Safety buffer for candidate to ensure they remain safe (14-day supply)
    const candidateSafetyBuffer = Math.max(50, Math.round(candidateAvg * 14));
    const surplus = candidateMed.current_stock - candidateSafetyBuffer;

    if (surplus > 0) {
      const distance = getHaversineDistance(
        deficitPhc.lat,
        deficitPhc.lng,
        candidatePhc.lat,
        candidatePhc.lng
      );

      candidates.push({
        phc: candidatePhc,
        surplus,
        distance
      });
    }
  });

  if (candidates.length === 0) return null;

  // Rank candidates:
  // 1. Same-district prioritization
  // 2. Closer geographic proximity
  candidates.sort((a, b) => {
    const aSameDistrict = a.phc.district === deficitPhc.district ? 1 : 0;
    const bSameDistrict = b.phc.district === deficitPhc.district ? 1 : 0;
    
    if (aSameDistrict !== bSameDistrict) {
      return bSameDistrict - aSameDistrict; // Same district comes first
    }
    return a.distance - b.distance; // Closer distance comes next
  });

  const bestDonor = candidates[0];
  const transferQuantity = Math.min(bestDonor.surplus, deficitAmount);

  if (transferQuantity <= 0) return null;

  return {
    from_phc: bestDonor.phc,
    to_phc: deficitPhc,
    medicine: medicineName,
    quantity: Math.round(transferQuantity),
    distance_km: parseFloat(bestDonor.distance.toFixed(1))
  };
}
