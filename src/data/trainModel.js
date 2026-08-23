import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as tf from '@tensorflow/tfjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CSV_PATH = path.join(__dirname, 'training-data.csv');
const NORMALIZATION_SAVE_PATH = path.join(__dirname, '..', '..', 'public', 'model', 'normalization.json');
const MODEL_DIR = path.join(__dirname, '..', '..', 'public', 'model');

// 1. Read and parse CSV
function loadAndParseCSV() {
  const content = fs.readFileSync(CSV_PATH, 'utf8').trim();
  const lines = content.split('\n');
  
  const records = lines.slice(1).map(line => {
    const parts = line.split(',');
    return {
      consumption_trend: parseFloat(parts[0]),
      case_growth_rate: parseFloat(parts[1]),
      current_stock: parseFloat(parts[2]),
      actual_days_to_stockout: parseFloat(parts[3])
    };
  });

  return records;
}

// Helper to compute mean and standard deviation for Z-score normalization
function getNormalizationParams(data, key) {
  const values = data.map(item => item[key]);
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const std = Math.sqrt(variance) || 1.0; // fallback to 1 to avoid division by zero
  return { mean, std };
}

async function train() {
  console.log("Loading training data...");
  const rawData = loadAndParseCSV();
  console.log(`Loaded ${rawData.length} records.`);

  // 2. Calculate normalization parameters
  console.log("Calculating normalization parameters...");
  const normParams = {
    consumption_trend: getNormalizationParams(rawData, 'consumption_trend'),
    case_growth_rate: getNormalizationParams(rawData, 'case_growth_rate'),
    current_stock: getNormalizationParams(rawData, 'current_stock')
  };

  console.log("Normalization parameters:", normParams);

  // Normalize dataset
  const inputs = [];
  const outputs = [];

  rawData.forEach(item => {
    const normTrend = (item.consumption_trend - normParams.consumption_trend.mean) / normParams.consumption_trend.std;
    const normGrowth = (item.case_growth_rate - normParams.case_growth_rate.mean) / normParams.case_growth_rate.std;
    const normStock = (item.current_stock - normParams.current_stock.mean) / normParams.current_stock.std;
    
    inputs.push([normTrend, normGrowth, normStock]);
    outputs.push([item.actual_days_to_stockout]);
  });

  // Convert to Tensors
  const xs = tf.tensor2d(inputs);
  const ys = tf.tensor2d(outputs);

  // 3. Build the sequential neural network
  console.log("Building neural network model...");
  const model = tf.sequential();
  
  // Layer 1: Input (3 features) -> Dense 12 neurons (ReLU)
  model.add(tf.layers.dense({
    inputShape: [3],
    units: 12,
    activation: 'relu'
  }));

  // Layer 2: Dense 8 neurons (ReLU)
  model.add(tf.layers.dense({
    units: 8,
    activation: 'relu'
  }));

  // Layer 3: Output (1 neuron, linear activation)
  model.add(tf.layers.dense({
    units: 1,
    activation: 'linear'
  }));

  // Compile with Adam and MSE
  model.compile({
    optimizer: tf.train.adam(),
    loss: tf.losses.meanSquaredError
  });

  // 4. Train the model
  console.log("Training model for 100 epochs...");
  
  await model.fit(xs, ys, {
    epochs: 100,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        if ((epoch + 1) % 10 === 0 || epoch === 0) {
          console.log(`Epoch ${(epoch + 1).toString().padStart(3)}: Loss = ${logs.loss.toFixed(4)}`);
        }
      }
    }
  });

  // 5. Save normalization parameters and model
  console.log("Saving model and parameters to public assets...");
  if (!fs.existsSync(MODEL_DIR)) {
    fs.mkdirSync(MODEL_DIR, { recursive: true });
  }

  // Save normalization JSON
  fs.writeFileSync(NORMALIZATION_SAVE_PATH, JSON.stringify(normParams, null, 2), 'utf8');
  console.log(`Saved normalization parameters to: ${NORMALIZATION_SAVE_PATH}`);

  // Custom tf.io Save Handler for Node.js (writing model.json and weights.bin)
  const saveHandler = {
    save: async (modelArtifacts) => {
      const modelJson = {
        modelTopology: modelArtifacts.modelTopology,
        format: modelArtifacts.format,
        generatedBy: modelArtifacts.generatedBy,
        convertedBy: modelArtifacts.convertedBy,
        weightsManifest: [{
          paths: ['./weights.bin'],
          weights: modelArtifacts.weightSpecs
        }]
      };

      fs.writeFileSync(
        path.join(MODEL_DIR, 'model.json'),
        JSON.stringify(modelJson, null, 2),
        'utf8'
      );

      if (modelArtifacts.weightData) {
        fs.writeFileSync(
          path.join(MODEL_DIR, 'weights.bin'),
          Buffer.from(modelArtifacts.weightData)
        );
      }

      return {
        modelArtifactsInfo: {
          dateSaved: new Date(),
          modelTopologyType: 'JSON',
          modelTopologyBytes: JSON.stringify(modelArtifacts.modelTopology).length,
          weightSpecsBytes: JSON.stringify(modelArtifacts.weightSpecs).length,
          weightDataBytes: modelArtifacts.weightData ? modelArtifacts.weightData.byteLength : 0,
        }
      };
    }
  };

  await model.save(saveHandler);
  console.log(`Saved TensorFlow.js model successfully in: ${MODEL_DIR}`);

  // 6. Run sanity check predictions
  console.log("\n=== Sanity Check Predictions ===");
  const testIndices = [0, 100, 200, 400, 600, 799];
  
  testIndices.forEach(idx => {
    const item = rawData[idx];
    const normTrend = (item.consumption_trend - normParams.consumption_trend.mean) / normParams.consumption_trend.std;
    const normGrowth = (item.case_growth_rate - normParams.case_growth_rate.mean) / normParams.case_growth_rate.std;
    const normStock = (item.current_stock - normParams.current_stock.mean) / normParams.current_stock.std;

    const inputTensor = tf.tensor2d([[normTrend, normGrowth, normStock]]);
    const predTensor = model.predict(inputTensor);
    const predVal = predTensor.dataSync()[0];

    console.log(`Row #${idx.toString().padStart(3)}:`);
    console.log(`  Trend: ${item.consumption_trend.toFixed(2).padStart(6)} | Case Growth: ${item.case_growth_rate.toFixed(2).padStart(6)}% | Stock: ${item.current_stock.toFixed(2).padStart(6)}`);
    console.log(`  Actual Days: ${item.actual_days_to_stockout.toFixed(2).padStart(6)} | Predicted Days: ${predVal.toFixed(2).padStart(6)}`);
    console.log(`  Difference : ${(predVal - item.actual_days_to_stockout).toFixed(2).padStart(6)}`);
    console.log("-----------------------------------------");
  });

  // Clean up tensors
  xs.dispose();
  ys.dispose();
}

train().catch(err => {
  console.error("Training failed:", err);
});
