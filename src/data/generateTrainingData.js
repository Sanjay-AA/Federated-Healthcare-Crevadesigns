import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NUM_EXAMPLES = 800;
const OUTPUT_DIR = __dirname;
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'training-data.csv');

// Helper to generate a random float between min and max
function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

function generateData() {
  const records = [];
  
  // To keep track of min/max values for statistics
  let stats = {
    consumption_trend: { min: Infinity, max: -Infinity },
    case_growth_rate: { min: Infinity, max: -Infinity },
    current_stock: { min: Infinity, max: -Infinity },
    actual_days_to_stockout: { min: Infinity, max: -Infinity }
  };

  const updateStats = (field, val) => {
    if (val < stats[field].min) stats[field].min = val;
    if (val > stats[field].max) stats[field].max = val;
  };

  for (let i = 0; i < NUM_EXAMPLES; i++) {
    // 1. Generate features
    const consumption_trend = Number(randomRange(-2, 15).toFixed(2));
    const case_growth_rate = Number(randomRange(-10, 150).toFixed(2));
    const current_stock = Number(randomRange(5, 500).toFixed(2));

    // 2. Calculate label using case_growth_rate boost
    const base_consumption = 20;
    const daily_consumption = Math.max(1, base_consumption + consumption_trend);
    
    let effective_daily_consumption = daily_consumption;
    if (case_growth_rate > 15) {
      effective_daily_consumption *= (1 + case_growth_rate / 100);
    }

    const raw_days = current_stock / effective_daily_consumption;
    const noise = randomRange(0.9, 1.1); // +/- 10% noise
    const actual_days_to_stockout = Number(Math.max(0, raw_days * noise).toFixed(2));

    // Update stats
    updateStats('consumption_trend', consumption_trend);
    updateStats('case_growth_rate', case_growth_rate);
    updateStats('current_stock', current_stock);
    updateStats('actual_days_to_stockout', actual_days_to_stockout);

    records.push({
      consumption_trend,
      case_growth_rate,
      current_stock,
      actual_days_to_stockout
    });
  }

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Convert to CSV
  const header = 'consumption_trend,case_growth_rate,current_stock,actual_days_to_stockout\n';
  const csvRows = records.map(r => 
    `${r.consumption_trend},${r.case_growth_rate},${r.current_stock},${r.actual_days_to_stockout}`
  ).join('\n');

  fs.writeFileSync(OUTPUT_FILE, header + csvRows, 'utf8');

  // Print Summary
  console.log(`=== DATA GENERATION COMPLETE ===`);
  console.log(`Output file: ${OUTPUT_FILE}`);
  console.log(`Total records: ${records.length}`);
  console.log(`\n--- Summary Statistics ---`);
  
  Object.keys(stats).forEach(field => {
    console.log(`${field.padEnd(25)}: Min = ${stats[field].min.toFixed(2)}, Max = ${stats[field].max.toFixed(2)}`);
  });
}

generateData();
