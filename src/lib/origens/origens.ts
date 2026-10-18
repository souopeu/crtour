// E7-3 (R80–R83): where a client came from, described for people. Nothing here guesses: it only names what arrived.

const CANAL = { meta: 'Anúncio no Meta (Facebook/Instagram)', google: 'Anúncio no Google', outro: 'Link com etiqueta de campanha' } as const
const VIA = { whatsapp: 'chegou pelo WhatsApp', formulario: 'chegou pelo formulário' } as const
const UTM_MAX = 100
const CLIQUE_MAX = 255

const valor = (sp: URLSearchParams, n: string, max: number) => {
  const v = (sp.get(n) ?? '').trim().slice(0, max)
  return v === '' ? null : v
}

// R81: what the Google ad link carries (auto-tagging adds gclid; the tags come from the ad's final URL).
export function lerCliqueDoLink(sp: URLSearchParams) {
  return {
    gclid: valor(sp, 'gclid', CLIQUE_MAX), utmFonte: valor(sp, 'utm_source', UTM_MAX), utmMidia: valor(sp, 'utm_medium', UTM_MAX),
    utmCampanha: valor(sp, 'utm_campaign', UTM_MAX), utmTermo: valor(sp, 'utm_term', UTM_MAX), utmConteudo: valor(sp, 'utm_content', UTM_MAX),
  }
}

// The database finds "cód. XXXXX" in the first message; keep this format in sync with private.registrar_origem_whatsapp.
export const mensagemComCodigo = (mensagem: string, codigo: string) => `${mensagem.trim()} (cód. ${codigo})`

type Origem = { canal: string; via: string; campanha: string | null; anuncio_titulo: string | null; anuncio_id: string | null }

export function descreverOrigem(o: Origem): { titulo: string; detalhe: string } {
  const titulo = CANAL[o.canal as keyof typeof CANAL] ?? CANAL.outro
  const qual = o.anuncio_titulo ? `Anúncio "${o.anuncio_titulo}"`
    : o.anuncio_id ? `Anúncio ${o.anuncio_id}`
    : o.campanha ? `Campanha "${o.campanha}"` : 'Sem campanha informada'
  return { titulo, detalhe: `${qual} · ${VIA[o.via as keyof typeof VIA] ?? o.via}` }
}

// R83: the name of a campaign row in the report: the registered name, else the ad, else the tag.
export function tituloDaChave(l: { nome: string | null; titulo: string | null; chave: string | null }): string {
  if (l.nome) return l.nome
  if (l.titulo) return `Anúncio "${l.titulo}"`
  if (l.chave === null) return 'Origem não identificada'
  if (l.chave.startsWith('anuncio:')) return `Anúncio ${l.chave.slice('anuncio:'.length)}`
  if (l.chave.startsWith('canal:')) return 'Sem campanha informada'
  return `Campanha "${l.chave}"`
}

export const rotuloDoCanalOrigem = (c: string | null) => (c === 'meta' ? 'Meta' : c === 'google' ? 'Google' : c === 'outro' ? 'Outro' : '')
