import { getApp } from "firebase/app";
import { getFunctions, connectFunctionsEmulator, httpsCallable } from "firebase/functions";

// Initialize the Firebase Functions client on demand using the default app instance.
// This allows us to call our proxy function without modifying the root firebase.js file.
const app = getApp();
const functions = getFunctions(app);

if (import.meta.env.DEV && !globalThis._functionsEmulatorConnected) {
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  globalThis._functionsEmulatorConnected = true;
}

/**
 * Requests days to stockout predictions from the Vertex AI tabular regression model
 * via our server-side Firebase Cloud Function proxy.
 * 
 * @param {Object} features { consumption_trend, case_growth_rate, current_stock }
 * @returns {Promise<number>} Predicted days to stock-out.
 */
export async function predictStockoutDays(features) {
  try {
    const predictStockoutFn = httpsCallable(functions, "predictStockout");
    const result = await predictStockoutFn(features);
    
    const days = result.data?.daysToStockout;
    if (days === undefined || days === null || isNaN(days)) {
      throw new Error("Invalid response format received from Vertex AI proxy");
    }
    
    return Number(days);
  } catch (error) {
    console.error("Vertex AI prediction failed, falling back to local model:", error);
    throw error; // Propagate the error so caller can trigger local fallback
  }
}
