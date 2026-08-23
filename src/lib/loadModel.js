import * as tf from '@tensorflow/tfjs';

let model = null;
let normalizationParams = null;
let isLoaded = false;
let loadPromise = null;

/**
 * Loads the trained TensorFlow.js layers model and Z-score parameters.
 * Only loads once; subsequent calls return the active loading promise.
 */
export function loadModel() {
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      // 1. Load normalization parameters
      const normResponse = await fetch('/model-federated/normalization.json');
      if (!normResponse.ok) {
        throw new Error(`Failed to load normalization JSON: ${normResponse.statusText}`);
      }
      normalizationParams = await normResponse.json();

      // 2. Load layers model
      model = await tf.loadLayersModel('/model-federated/model.json');
      
      isLoaded = true;
      console.log("TensorFlow.js trained model and normalization parameters loaded.");
    } catch (error) {
      console.error("TensorFlow.js model loading failed:", error);
      isLoaded = false;
      model = null;
      normalizationParams = null;
      throw error;
    }
  })();

  return loadPromise;
}

/**
 * Returns whether the model has successfully loaded.
 */
export function isModelLoaded() {
  return isLoaded;
}

/**
 * Executes inference on the loaded TensorFlow.js neural network.
 * 
 * @param {number} consumption_trend
 * @param {number} case_growth_rate
 * @param {number} current_stock
 * @returns {number} Predicted days to stockout.
 */
export function predictStockoutDaysTrained(consumption_trend, case_growth_rate, current_stock) {
  if (!isLoaded || !model || !normalizationParams) {
    throw new Error("Trained model is not loaded yet");
  }

  // Apply Z-score normalization using values from training
  const normTrend = (consumption_trend - normalizationParams.consumption_trend.mean) / normalizationParams.consumption_trend.std;
  const normGrowth = (case_growth_rate - normalizationParams.case_growth_rate.mean) / normalizationParams.case_growth_rate.std;
  const normStock = (current_stock - normalizationParams.current_stock.mean) / normalizationParams.current_stock.std;

  // Run prediction within tf.tidy to avoid GPU/WebGL texture memory leaks
  return tf.tidy(() => {
    const inputTensor = tf.tensor2d([[normTrend, normGrowth, normStock]]);
    const outputTensor = model.predict(inputTensor);
    const predVal = outputTensor.dataSync()[0];
    
    // Clamp days to stockout to non-negative
    return Math.max(0, predVal);
  });
}

// Automatically trigger loading when the module is imported
loadModel().catch(err => console.error("Self-triggered model loading failed:", err));
