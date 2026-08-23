import { getApp } from "firebase/app";
import { getFunctions, connectFunctionsEmulator, httpsCallable } from "firebase/functions";

const app = getApp();
const functions = getFunctions(app);

// Use a global flag to ensure connectFunctionsEmulator is only called once
if (import.meta.env.DEV && !globalThis._functionsEmulatorConnected) {
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  globalThis._functionsEmulatorConnected = true;
}

/**
 * Generates an AI situation briefing for health officials regarding a specific PHC and medicine status.
 * Delegates securely to a Firebase Cloud Function backend to hide API credentials.
 *
 * @param {Object} briefingData
 * @returns {Promise<string>} Plain-language briefing text.
 */
export async function generateSituationBriefing(decision, language) {
  try {
    const generateBriefingFn = httpsCallable(functions, "generateBriefing");
    const result = await generateBriefingFn({ decision, language });
    return result.data;
  } catch (error) {
    console.error("Gemini briefing generation failed, falling back to local description:", error);
    
    const fallbackObj = {
      headline: `${decision.medicine} stockout risk at ${decision.recipientPHC}`,
      situation: `Current stock of ${decision.medicine} is ${decision.currentStock} units against safety target of ${decision.safetyStock} units. Daily consumption is approximately ${decision.dailyConsumption || 10} units/day.`,
      riskExplanation: `Stockout is predicted in ${decision.predictedDaysUntilStockout} days. Risk level is ${decision.riskLevel}.`,
      recommendedAction: decision.donorPHC
        ? `Consider transferring ${decision.recommendedTransferQuantity} units from ${decision.donorPHC}.`
        : "No safe donor PHC is currently available.",
      reason: "Local fallback briefing.",
      priority: decision.riskLevel === 'CRITICAL' || decision.riskLevel === 'HIGH' ? 'HIGH' : decision.riskLevel === 'MEDIUM' ? 'MEDIUM' : 'LOW',
      confidenceNote: "Local calculation (Gemini API unavailable)."
    };
    
    return JSON.stringify(fallbackObj);
  }
}
