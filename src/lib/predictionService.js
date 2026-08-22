// Prediction Service Boundary - Phase 4 AI Pipeline Interface
import { predictDaysToStockOut, calculateConsumptionTrend, calculateCaseGrowthRate } from './forecast';
import { predictStockoutDaysTrained, isModelLoaded } from './loadModel';
import { predictStockoutDays } from './vertexPredict';

export const predictionService = {
  /**
   * Executes linear, trained neural net, and Vertex AI models on Firestore stock inputs.
   * 
   * @param {Object} medicine Raw medicine document from Firestore
   * @param {number} caseGrowthRate Case growth rate for the district (decimal ratio)
   * @returns {Promise<Object>} Unified prediction result contract
   */
  getPredictions: async (medicine, caseGrowthRate = 0) => {
    const history = medicine.consumption_history || [];
    const currentStock = Number(medicine.current_stock ?? 0);
    const trend = calculateConsumptionTrend(history);
    const caseGrowthPct = Math.round(caseGrowthRate * 100);

    // 1. Local Linear Forecast
    const linearDays = predictDaysToStockOut(history, currentStock, caseGrowthRate);
    const linearRisk = linearDays <= 3 ? 'CRITICAL' : linearDays <= 7 ? 'HIGH' : linearDays <= 14 ? 'MEDIUM' : 'LOW';

    // 2. TensorFlow.js Neural Net
    let trainedDays = null;
    if (isModelLoaded()) {
      try {
        trainedDays = predictStockoutDaysTrained(trend, caseGrowthPct, currentStock);
      } catch (err) {
        console.error("[TFJS Neural Net Error] prediction failed:", err);
      }
    }

    // 3. Vertex AI Tabular Prediction (Cloud Function proxy)
    let vertexDays = null;
    try {
      vertexDays = await predictStockoutDays({
        consumption_trend: trend,
        case_growth_rate: caseGrowthPct,
        current_stock: currentStock
      });
    } catch (err) {
      console.warn("[Vertex AI Proxy Error] prediction failed (expected if endpoint not set), returning null:", err.message);
    }

    return {
      phcId: medicine.phc_id || "",
      medicineId: medicine.id || "",
      currentStock: currentStock,
      dailyConsumption: Number(medicine.daily_consumption ?? 0),
      predictedDaysUntilStockout: linearDays,
      riskLevel: linearRisk,
      model: {
        linear: linearDays,
        trained: trainedDays,
        vertex: vertexDays
      },
      calculatedAt: new Date()
    };
  }
};
