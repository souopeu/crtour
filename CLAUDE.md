# crTOUR

CRM SaaS para agências de turismo (PWA). Documentação de produto, spec e arquitetura fica no Google Drive
(`.../APK CRM/docs/`): ficha, viabilidade, spec, arquitetura, plano. Plano de tarefas = `docs/04-plano.md`.

## Stack
Next.js 16 (App Router), TypeScript estrito, Tailwind 4, Supabase (Postgres + Auth + RLS), Vercel, Vitest, pgTAP, Playwright.

## Comandos
- `npm run dev` / `build` / `start`
- `npm run lint` · `npm run typecheck` · `npm test` · `npm run test:coverage`

## Regras
- Código em inglês, commits em português (`tipo: descrição`), UI só em português do Brasil.
- TDD: teste primeiro, cobertura ≥ 80%. Lógica pura em `src/lib/` com teste ao lado.
- Validar toda entrada com zod; RLS em toda tabela; chaves compostas `(id, agencia_id)`.
- Sem segredos no código; só `NEXT_PUBLIC_SUPABASE_URL` e a chave pública no cliente.
- Mensagens ao usuário em português claro; erros do banco traduzidos sem vazar detalhe.
- Referência técnica e visual: `ESPECIFICACAO_SALVEI.md` (azul `#1d4ed8`, amarelo `#facc15`, Inter).
