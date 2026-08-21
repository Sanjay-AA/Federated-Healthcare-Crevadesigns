import fs from 'fs';
import path from 'url';
import fileSystem from 'fs';
import pathModule from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = pathModule.dirname(__filename);

const OUTPUT_FILE = pathModule.join(__dirname, 'training-data-federated.csv');
const ROWS_PER_DISTRICT = 400; // 1,200 rows total

function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

function generate() {
  const records = [];
  const districts = ['Namakkal', 'Salem', 'Erode'];

  districts.forEach(district => {
    for (let i = 0; i < ROWS_PER_DISTRICT; i++) {
      let consumption_trend, case_growth_rate;
      const current_stock = Number(randomRange(5, 500).toFixed(2));

      if (district === 'Namakkal') {
        // Namakkal outbreak: skewed toward higher consumption trend and high case growth rate
        consumption_trend = Number(randomRange(2.0, 15.0).toFixed(2));
        case_growth_rate = Number(randomRange(40.0, 180.0).toFixed(2));
      } else if (district === 'Salem') {
        // Salem stable: normal/low values
        consumption_trend = Number(randomRange(-2.0, 5.0).toFixed(2));
        case_growth_rate = Number(randomRange(-10.0, 30.0).toFixed(2));
      } else {
        // Erode stable: normal/low values
        consumption_trend = Number(randomRange(-2.0, 4.0).toFixed(2));
        case_growth_rate = Number(randomRange(-15.0, 25.0).toFixed(2));
      }

      // Compute days to stockout label
      const base_consumption = 20;
      const daily_consumption = Math.max(1, base_consumption + consumption_trend);
      
      let effective_daily_consumption = daily_consumption;
      if (case_growth_rate > 15) {
        effective_daily_consumption *= (1 + case_growth_rate / 100);
      }

      const raw_days = current_stock / effective_daily_consumption;
      const noise = randomRange(0.9, 1.1); // +/- 10% random noise
      const actual_days_to_stockout = Number(Math.max(0.1, raw_days * noise).toFixed(2));

      records.push({
        district,
        consumption_trend,
        case_growth_rate,
        current_stock,
        actual_days_to_stockout
      });
    }
  });

  // Shuffle records to mix districts
  const shuffled = records.sort(() => Math.random() - 0.5);

  const header = 'district,consumption_trend,case_growth_rate,current_stock,actual_days_to_stockout\n';
  const csvRows = shuffled.map(r => 
    `${r.district},${r.consumption_trend},${r.case_growth_rate},${r.current_stock},${r.actual_days_to_stockout}`
  ).join('\n');

  fileSystem.writeFileSync(OUTPUT_FILE, header + csvRows, 'utf8');
  console.log(`Generated federated training dataset at: ${OUTPUT_FILE} (${shuffled.length} rows).`);
}

generate();
