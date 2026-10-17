// Usage: node scripts/gerar-planilha-demo.mjs [output-folder]
// Writes two fictional spreadsheets used to present the import feature.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { gerarPlanilhaDemo } from '../src/lib/importacao/demo.ts'

const pasta = resolve(process.argv[2] ?? 'demo')
mkdirSync(pasta, { recursive: true })
writeFileSync(join(pasta, 'clientes-demo.xlsx'), await gerarPlanilhaDemo())
writeFileSync(join(pasta, 'clientes-demo-com-erros.xlsx'), await gerarPlanilhaDemo({ comErros: true }))
console.log(`Planilhas geradas em ${pasta}`)
