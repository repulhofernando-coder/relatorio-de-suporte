// TEMP: inspects the user's real Movidesk hours XLSX (removed after inspection)
import XLSX from 'npm:xlsx@0.18.5'

const URL =
  'https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/ef6772a1-2ea4-4422-a10d-3ca3547cb705/tempo-trabalhado-nos-tickets-f3c83.xlsx'

const res = await fetch(URL)
if (!res.ok) {
  console.error('DOWNLOAD FALHOU:', res.status, res.statusText)
  process.exit(1)
}
const buf = Buffer.from(await res.arrayBuffer())
console.log('Bytes:', buf.length)

const wb = XLSX.read(buf, { type: 'buffer', cellDates: true })
console.log('Abas:', wb.SheetNames)

for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false, raw: true })
  console.log(`\n===== ABA "${name}" — ${rows.length} linhas =====`)
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    console.log(`L${i}:`, JSON.stringify(rows[i]))
  }
  if (rows.length > 10) console.log(`L${rows.length - 1}:`, JSON.stringify(rows[rows.length - 1]))
}
