// Writes public/research/hematocrit.json: the NASA hematocrit comparison shown in the
// Cardiovascular panel on Crew health. The page reads this file when there is no server
// (for example the Vercel link), so the panel shows real NASA data there too.
// Rebuild it after updating the research bundle:
//   python -m ml.ingest
//   npm run research:snapshot

import { mkdirSync, writeFileSync } from 'node:fs'
import { researchResponse } from '../server/research.ts'
import { hematocritQuery } from '../src/data/researchContract.ts'

const reply = researchResponse(new URL(hematocritQuery, 'http://localhost'))
if (!reply || reply.status !== 200) {
  console.error('No hematocrit comparison. Build the research bundle first: python -m ml.ingest', reply?.body ?? '')
  process.exit(1)
}
mkdirSync('public/research', { recursive: true })
writeFileSync('public/research/hematocrit.json', JSON.stringify(reply.body, null, 2) + '\n')
console.log('Wrote public/research/hematocrit.json')
