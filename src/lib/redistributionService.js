// Redistribution Service Boundary - Phase 5 AI Stock Redistribution Interface
import { getRedistributionRecommendation } from './redistribution';

export const redistributionService = {
  /**
   * Evaluates donor candidates from Firestore lists and generates a safe redistribution transfer recommendation.
   * 
   * @param {Object} deficitPhc The recipient PHC doc
   * @param {string} medicineName Target medicine name
   * @param {Array<Object>} allPhcs List of all active PHC docs from Firestore
   * @param {Array<Object>} allMedicines List of all medicine docs from Firestore
   * @returns {Object|null} Recommendation contract object or null if no surplus donor is found
   */
  getRecommendation: (deficitPhc, medicineName, allPhcs, allMedicines) => {
    return getRedistributionRecommendation(deficitPhc, medicineName, allPhcs, allMedicines);
  }
};
