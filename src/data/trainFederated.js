import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as tf from '@tensorflow/tfjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CSV_PATH = path.join(__dirname, 'training-data-federated.csv');
const MODEL_DIR = path.join(__dirname, '..', '..', 'public', 'model-federated');
const NORMALIZATION_SAVE_PATH = path.join(MODEL_DIR, 'normalization.json');
const LOG_SAVE_PATH = path.join(__dirname, 'federatedTrainingLog.json');

// 1. Read and parse CSV
function loadAndParseCSV() {
  const content = fs.readFileSync(CSV_PATH, 'utf8').trim();
  const lines = content.split('\n');
  
  return lines.slice(1).map(line => {
    const parts = line.split(',');
    return {
      district: parts[0],
      consumption_trend: parseFloat(parts[1]),
      case_growth_rate: parseFloat(parts[2]),
      current_stock: parseFloat(parts[3]),
      actual_days_to_stockout: parseFloat(parts[4])
    };
  });
}

// Compute normalization statistics (mean & standard deviation)
function getNormalizationParams(data, key) {
  const values = data.map(item => item[key]);
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const std = Math.sqrt(variance) || 1.0;
  return { mean, std };
}

// Build standard sequential neural network architecture
function createModel() {
  const model = tf.sequential();
  
  // Layer 1: Input (3 features) -> Dense 12 (ReLU)
  model.add(tf.layers.dense({
    inputShape: [3],
    units: 12,
    activation: 'relu'
  }));

  // Layer 2: Dense 8 (ReLU)
  model.add(tf.layers.dense({
    units: 8,
    activation: 'relu'
  }));

  // Layer 3: Output 1 (Linear)
  model.add(tf.layers.dense({
    units: 1,
    activation: 'linear'
  }));
  
  model.compile({
    optimizer: tf.train.adam(),
    loss: tf.losses.meanSquaredError
  });
  return model;
}

async function runFederatedLearning() {
  console.log("Loading federated dataset...");
  const rawData = loadAndParseCSV();
  console.log(`Loaded ${rawData.length} total rows.`);

  // Calculate global normalization parameters across all districts
  const globalNormParams = {
    consumption_trend: getNormalizationParams(rawData, 'consumption_trend'),
    case_growth_rate: getNormalizationParams(rawData, 'case_growth_rate'),
    current_stock: getNormalizationParams(rawData, 'current_stock')
  };

  console.log("Global normalization parameters computed:", globalNormParams);

  // Split datasets by district and normalize inputs
  const districts = ['Namakkal', 'Salem', 'Erode'];
  const districtData = {};
  districts.forEach(d => {
    districtData[d] = { inputs: [], outputs: [] };
  });

  const globalInputs = [];
  const globalOutputs = [];

  rawData.forEach(item => {
    const normTrend = (item.consumption_trend - globalNormParams.consumption_trend.mean) / globalNormParams.consumption_trend.std;
    const normGrowth = (item.case_growth_rate - globalNormParams.case_growth_rate.mean) / globalNormParams.case_growth_rate.std;
    const normStock = (item.current_stock - globalNormParams.current_stock.mean) / globalNormParams.current_stock.std;

    const input = [normTrend, normGrowth, normStock];
    const output = [item.actual_days_to_stockout];

    globalInputs.push(input);
    globalOutputs.push(output);

    if (districtData[item.district]) {
      districtData[item.district].inputs.push(input);
      districtData[item.district].outputs.push(output);
    }
  });

  // Convert to Tensors
  const xs_global = tf.tensor2d(globalInputs);
  const ys_global = tf.tensor2d(globalOutputs);

  const districtTensors = {};
  districts.forEach(d => {
    districtTensors[d] = {
      xs: tf.tensor2d(districtData[d].inputs),
      ys: tf.tensor2d(districtData[d].outputs)
    };
    console.log(`District ${d.padEnd(8)}: ${districtData[d].inputs.length} training examples.`);
  });

  // Initialize 3 separate copies of model architecture
  const localModels = {};
  districts.forEach(d => {
    localModels[d] = createModel();
  });

  // Initialize central global model for aggregation
  const globalModel = createModel();

  // Sync initial weights across all models
  const initialWeights = globalModel.getWeights();
  districts.forEach(d => {
    const clonedWeights = initialWeights.map(t => t.clone());
    localModels[d].setWeights(clonedWeights);
  });

  const lossHistory = [];

  console.log("\nStarting Federated Averaging (FedAvg) training loop...");
  console.log("====================================================");

  const numRounds = 10;
  const localEpochs = 5;

  for (let round = 1; round <= numRounds; round++) {
    const roundLog = { round, Salem: 0, Erode: 0, Namakkal: 0, Global: 0 };
    
    // 1. Train each district model locally on its own dataset
    const localTrainPromises = districts.map(async d => {
      const history = await localModels[d].fit(districtTensors[d].xs, districtTensors[d].ys, {
        epochs: localEpochs,
        verbose: 0
      });
      const finalLoss = history.history.loss[localEpochs - 1];
      roundLog[d] = parseFloat(finalLoss.toFixed(4));
    });

    await Promise.all(localTrainPromises);

    // 2. Average local model weights layer-by-layer (FedAvg weight aggregation)
    tf.tidy(() => {
      const averagedWeights = [];
      const numLayers = initialWeights.length;

      for (let l = 0; l < numLayers; l++) {
        let sum = localModels[districts[0]].getWeights()[l];
        for (let i = 1; i < districts.length; i++) {
          sum = tf.add(sum, localModels[districts[i]].getWeights()[l]);
        }
        const avg = tf.div(sum, tf.scalar(districts.length));
        averagedWeights.push(avg);
      }

      // 3. Update global aggregator model with averaged weights
      globalModel.setWeights(averagedWeights.map(t => t.clone()));

      // 4. Update all local client models to start next round from aggregated state
      districts.forEach(d => {
        localModels[d].setWeights(averagedWeights.map(t => t.clone()));
      });
    });

    // 5. Evaluate the combined global model's performance on full state dataset
    const globalEval = globalModel.evaluate(xs_global, ys_global, { verbose: 0 });
    const globalLoss = globalEval.dataSync()[0];
    roundLog.Global = parseFloat(globalLoss.toFixed(4));
    globalEval.dispose();

    lossHistory.push(roundLog);
    
    console.log(`Round ${round.toString().padStart(2)}/${numRounds}: ` +
                `Salem Loss = ${roundLog.Salem.toFixed(4)} | ` +
                `Erode Loss = ${roundLog.Erode.toFixed(4)} | ` +
                `Namakkal Loss = ${roundLog.Namakkal.toFixed(4)} || ` +
                `Global Loss = ${roundLog.Global.toFixed(4)}`);
  }

  console.log("====================================================");
  console.log("Federated Averaging training complete.\n");

  // Save global model and normalization params
  if (!fs.existsSync(MODEL_DIR)) {
    fs.mkdirSync(MODEL_DIR, { recursive: true });
  }

  // Save normalization parameters JSON
  fs.writeFileSync(NORMALIZATION_SAVE_PATH, JSON.stringify(globalNormParams, null, 2), 'utf8');
  console.log(`Saved global normalization params to: ${NORMALIZATION_SAVE_PATH}`);

  // Custom tf.io Save Handler for saving layers model without native modules
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

  await globalModel.save(saveHandler);
  console.log(`Saved federated global model successfully to: ${MODEL_DIR}`);

  // Save loss logs to json
  fs.writeFileSync(LOG_SAVE_PATH, JSON.stringify(lossHistory, null, 2), 'utf8');
  console.log(`Saved federated training log history to: ${LOG_SAVE_PATH}`);

  // Clean up tensors
  xs_global.dispose();
  ys_global.dispose();
  districts.forEach(d => {
    districtTensors[d].xs.dispose();
    districtTensors[d].ys.dispose();
  });
}

runFederatedLearning().catch(err => {
  console.error("Federated training failed:", err);
});
