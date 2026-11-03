#!/usr/bin/env node
// Dev-only helper: fetch one object from the SIMBAD TAP service and print a YAML system record
// in the import format. The application never calls external services; committed results feed
// the demo seed and hand-authored packages.
//
// Usage: node scripts/fetch-star.mjs <simbad-main-id> <key> [display name]
// Example: node scripts/fetch-star.mjs "NAME Proxima Centauri" proxima "Proxima Centauri"

const MIRRORS = ['https://simbad.cds.unistra.fr/simbad/sim-tap/sync', 'https://simbad.cfa.harvard.edu/simbad/sim-tap/sync']

const [simbadId, key, displayName] = process.argv.slice(2)
if (!simbadId || !key) {
  console.error('Usage: node scripts/fetch-star.mjs <simbad-main-id> <key> [display name]')
  process.exit(1)
}

const query = `SELECT main_id, ra, dec, plx_value, sp_type FROM basic WHERE main_id = '${simbadId.replaceAll("'", "''")}'`

async function queryMirror(url) {
  const target = new URL(url)
  target.searchParams.set('REQUEST', 'doQuery')
  target.searchParams.set('LANG', 'ADQL')
  target.searchParams.set('FORMAT', 'csv')
  target.searchParams.set('QUERY', query)
  const response = await fetch(target, { signal: AbortSignal.timeout(30_000) })
  if (!response.ok) throw new Error(`${target.host} answered HTTP ${response.status}`)
  return response.text()
}

function parseRow(csv) {
  const lines = csv
    .trim()
    .split('\n')
    .filter((line) => line.trim().length > 0)
  if (lines.length < 2) return null
  const cells = lines[1].split(',').map((cell) => cell.trim().replaceAll(/^"|"$/g, ''))
  const [mainId, ra, dec, plx, spType] = cells
  return { mainId, ra: Number(ra), dec: Number(dec), plx: plx === '' ? null : Number(plx), spType: spType || null }
}

let row = null
let usedMirror = ''
const errors = []
for (const mirror of MIRRORS) {
  try {
    const csv = await queryMirror(mirror)
    row = parseRow(csv)
    usedMirror = new URL(mirror).host
    if (row) break
  } catch (error) {
    errors.push(`${new URL(mirror).host}: ${error.message}`)
  }
}

if (!row) {
  console.error(`Object "${simbadId}" not found.${errors.length > 0 ? ` Mirrors tried: ${errors.join('; ')}` : ''}`)
  process.exit(1)
}

const distance = row.plx === null ? null : (1000 / row.plx).toFixed(5)
const quote = (value) => `"${String(value).replaceAll('"', '\\"')}"`
console.log(`systems:
  - key: ${key}
    name: ${quote(displayName ?? row.mainId)}
    astronomy:
      designation: ${quote(row.mainId)}
      raDegrees: ${row.ra}
      decDegrees: ${row.dec}
      distancePc: ${distance ?? 'null'}
      spectralType: ${row.spType ? quote(row.spType) : 'null'}
      catalogSource: SIMBAD (${usedMirror})
      epoch: J2000.0`)
