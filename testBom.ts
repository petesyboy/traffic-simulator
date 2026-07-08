import { generateBom } from './src/utils/bomEngine.ts';
import { readFileSync } from 'fs';

const skus = JSON.parse(readFileSync('./src/constants/skus.json', 'utf-8'));

const nodes = [
  {
    id: "node_1",
    type: "hardwareNode",
    data: {
      model: "GigaVUE-TA25E",
      optics: [
        { board: "Base Ports", optic: "Q28-503T (100G QSFP28 LR4)", qty: 8 },
        { board: "Base Ports", optic: "SFP-553T (25G SFP28 LR)", qty: 10 },
        { board: "Base Ports", optic: "SFP-552T (25G SFP28 SR)", qty: 10 }
      ]
    }
  }
];

const items = generateBom(nodes, [], 'Perpetual', '1 Yr', 'NAMER', true);
console.log("ITEMS", items);
