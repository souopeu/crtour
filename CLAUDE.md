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

## Antes de mexer (leia o doc da área)
| Trabalho em | Leia antes |
|---|---|
| Produto, regras R1–R41, escopo de cada entrega | `docs/` do Drive: `09-spec-entrega-3.md`, `decisoes.md` |
| Banco, RLS, migrações | `supabase/migrations/` e `supabase/tests/database/` (pgTAP) |
| Importação de planilha | `src/lib/importacao/config.ts` (limites) e `supabase/migrations/*_sugestoes_importacao.sql` |
| Next.js | `node_modules/next/dist/docs/` |

## Dados e regras (vindas da análise do Comp AI CRM)
- **Nunca adivinhar dado de cliente.** Campo vazio pode ser preenchido por uma fonte (planilha, importação). Valor diferente de um já existente vira **sugestão** (`sugestoes_cliente`) que uma pessoa aceita ou recusa. Planilha nunca muda nome, WhatsApp nem consentimento.
- **Todo lembrete diz o motivo** (`atividades.motivo`) e a tela mostra.
- **Constantes ajustáveis ficam em um arquivo por área** (`src/lib/<area>/config.ts`, objeto `as const`, unidades derivadas de uma base). Nada de número solto no código.
- **Dado sem tipo (JSON do banco, resultado de RPC, corpo de requisição) é validado com zod na entrada**; o tipo vem de `z.infer`. Não passar `unknown` nem `as` adiante.
- **Recurso opcional nunca derruba o sistema.** Sem a chave (ex.: API do WhatsApp na v3), some a capacidade; não dá erro.
- **Rotina periódica roda em agenda** (pg_cron ou Vercel Cron), nunca no login nem "depois da resposta" de uma função serverless.

## Relatório final de cada tarefa
Termine toda resposta com a lista abaixo, uma linha para o problema e uma para a correção. Sem problemas: `None.`

```
## Problemas
1. QUEBRADO — o que falha agora. Efeito.
   Correção: ...
2. RISCO — o que pode falhar depois. Efeito.
   Correção: não feita. O que falta.
3. NÃO FEITO — o que não foi construído.
4. DESCONHECIDO — o que não foi investigado.
```
Se o problema foi criado pela própria mudança, escreva "Eu causei isto" na linha da correção.
