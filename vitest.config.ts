import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      exclude: [
        'src/lib/**/*.test.ts',
        'src/lib/forms.ts', // types only
        // Thin wrappers over the Supabase client / Next runtime ("server-only"). Their behaviour is
        // covered by the pgTAP tests (database side) and the Playwright e2e tests (app side).
        'src/lib/supabase/**',
        'src/lib/auth/usuario.ts',
        'src/lib/auth/agencia.ts',
        'src/lib/clientes/dados.ts',
        'src/lib/exportacao/dados.ts',
        'src/lib/passeios/dados.ts',
        'src/lib/pagamentos/dados.ts',
        'src/lib/negociacoes/dados.ts',
        'src/lib/atividades/dados.ts',
        'src/lib/hoje/dados.ts',
        'src/lib/segmentos/dados.ts',
        'src/lib/painel/dados.ts',
        'src/lib/equipe/dados.ts',
        'src/lib/negociacoes/sugestoesDados.ts',
        'src/lib/importacao/dadosReservas.ts',
        'src/lib/comissao/dados.ts',
      ],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
})
