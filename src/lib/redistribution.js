// Redistribution Algorithm - Connected to Real Firestore Stock & Safety Stock Levels
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
  const deficitMed = allMedicines.find(m => m.phc_id === deficitPhc.id && (m.medicine_name === medicineName || m.name === medicineName));
  if (!deficitMed) return null;

  // Recipient safety stock comes directly from Firestore reorder_level (fallback to 300 if missing)
  const deficitSafetyStock = Number(deficitMed.reorder_level ?? 300);
  const deficitAmount = Math.max(0, deficitSafetyStock - deficitMed.current_stock);
  
  // Only trigger redistribution if recipient stock is below safety stock or at risk
  if (deficitAmount <= 0) return null;

  const candidates = [];

  // Scan other PHCs for donors
  allPhcs.forEach((candidatePhc) => {
    if (candidatePhc.id === deficitPhc.id) return;

    // Get the candidate's medicine stock
    const candidateMed = allMedicines.find(m => m.phc_id === candidatePhc.id && (m.medicine_name === medicineName || m.name === medicineName));
    if (!candidateMed || candidateMed.current_stock <= 0) return;

    // Protect donor PHCs that are themselves at risk
    const candidateDaysToStockOut = predictDaysToStockOut(candidateMed.consumption_history, candidateMed.current_stock);
    if (candidateDaysToStockOut <= 7) return; // Keep buffer for near-risk nodes

    // Donor safety stock comes directly from Firestore reorder_level (fallback to 300)
    const candidateSafetyStock = Number(candidateMed.reorder_level ?? 300);
    const surplus = candidateMed.current_stock - candidateSafetyStock;

    if (surplus > 0) {
      // Prioritize simple geographic distance if lat/lng coords exist
      const distance = (deficitPhc.lat && deficitPhc.lng && candidatePhc.lat && candidatePhc.lng)
        ? getHaversineDistance(deficitPhc.lat, deficitPhc.lng, candidatePhc.lat, candidatePhc.lng)
        : 10.0; // dummy default distance if coords missing

      candidates.push({
        phc: candidatePhc,
        currentStock: candidateMed.current_stock,
        safetyStock: candidateSafetyStock,
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

  const daysLabel = deficitMed.status === "CRITICAL" ? "soon" : "shortly";

  return {
    // Existing UI compatibility fields
    from_phc: bestDonor.phc,
    to_phc: deficitPhc,
    medicine: medicineName,
    quantity: Math.round(transferQuantity),
    distance_km: parseFloat(bestDonor.distance.toFixed(1)),

    // Phase 5 Result Contract Fields
    recipientPhcId: deficitPhc.id,
    donorPhcId: bestDonor.phc.id,
    medicineId: deficitMed.id || deficitMed.medicine_id || "",
    medicineName: medicineName,
    recipientCurrentStock: deficitMed.current_stock,
    recipientSafetyStock: deficitSafetyStock,
    donorCurrentStock: bestDonor.currentStock,
    donorSafetyStock: bestDonor.safetyStock,
    donorSafeSurplus: Math.round(bestDonor.surplus),
    recommendedTransferQuantity: Math.round(transferQuantity),
    recipientRisk: deficitMed.status || "CRITICAL",
    reason: `${deficitPhc.name} is predicted to stock out ${daysLabel}. ${bestDonor.phc.name} has ${Math.round(bestDonor.surplus)} tablets safely available above its safety stock of ${bestDonor.safetyStock} tablets. A transfer of ${Math.round(transferQuantity)} tablets is recommended.`
  };
}
