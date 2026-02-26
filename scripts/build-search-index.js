/**
 * Build a lightweight search index for apprenticeship ratio data
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import path from 'path';

const DATA_DIR = 'data';
const OUTPUT_FILE = 'web/public/search-index.json';

const stateNames = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
  'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'DC': 'District of Columbia', 'FL': 'Florida',
  'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana',
  'IA': 'Iowa', 'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine',
  'MD': 'Maryland', 'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
  'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire',
  'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota',
  'OH': 'Ohio', 'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania',
  'RI': 'Rhode Island', 'SC': 'South Carolina', 'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas',
  'UT': 'Utah', 'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington',
  'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'
};

function buildIndex() {
  const files = readdirSync(DATA_DIR).filter(f => f.endsWith('.json') && f !== 'index.json');

  const entries = [];

  for (const file of files) {
    const stateCode = file.replace('.json', '');
    const stateName = stateNames[stateCode] || stateCode;
    const data = JSON.parse(readFileSync(path.join(DATA_DIR, file), 'utf-8'));

    entries.push({
      type: 'state',
      text: `${stateName} (${stateCode})`,
      state: stateCode,
      stateName,
      hasRequirement: data.hasPublicWorksRequirement,
      agencyType: data.agencyType,
      ratioValue: data.requirement?.ratioValue || null,
      url: `/state/${stateCode.toLowerCase()}`
    });
  }

  entries.sort((a, b) => a.text.localeCompare(b.text));

  console.log(`Built search index with ${entries.length} entries`);
  console.log(`  - States with requirements: ${entries.filter(e => e.hasRequirement).length}`);

  writeFileSync(OUTPUT_FILE, JSON.stringify(entries));
  console.log(`Saved to ${OUTPUT_FILE}`);
}

buildIndex();
