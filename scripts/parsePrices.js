import fs from 'fs';
import path from 'path';

const csvPath = 'WWPL_20260731.csv';
const jsonPath = 'src/constants/prices.json';

const content = fs.readFileSync(csvPath, 'utf8');
const lines = content.split(/\r?\n/);

const prices = {};

// Skip headers (lines 0 and 1)
for (let i = 2; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  // Simple CSV parser that handles quotes
  const cells = [];
  let current = '';
  let inQuotes = false;
  for (let c = 0; c < line.length; c++) {
    const char = line[c];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);

  if (cells.length < 5) continue;

  const sku = cells[1]?.trim();
  if (!sku) continue;

  // Clean prices
  const cleanPrice = (val) => {
    if (!val) return 0;
    const cleaned = val.replace(/[$\s,]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  const listPrice = cleanPrice(cells[3]);
  const monthlyPrice = cleanPrice(cells[4]);

  prices[sku] = {
    listPrice,
    monthlyPrice
  };
}

fs.writeFileSync(jsonPath, JSON.stringify(prices, null, 2), 'utf8');
console.log(`Parsed ${Object.keys(prices).length} SKUs into ${jsonPath}`);
