import { ROTULO_ORIGEM } from '@/lib/clientes/rotulos'
import { ORIGENS } from '@/lib/clientes/schema'
import { MOTIVOS } from '@/lib/negociacoes/negociacoes'
import { MESES, type Criterios } from '@/lib/segmentos/segmentos'

const campo = 'h-12 rounded-xl border border-controle bg-superficie px-3 text-base'
const rotulo = 'text-sm font-medium'

type Props = { criterios: Criterios; etiquetas: { id: string; nome: string }[]; cidades: string[]; acao?: string }

// Plain GET form: the criteria live in the URL, so the preview can be shared, reloaded and works without JavaScript.
// The previous page stays mounted (hidden) after navigating, so ids carry a per-page prefix to keep labels pointing at this form.
export function FiltrosSegmento({ criterios: c, etiquetas, cidades, acao = '/remarketing/novo' }: Props) {
  const id = (campo: string) => `${acao === '/remarketing/novo' ? 'novo' : 'editar'}-${campo}`
  return (
    <form method="get" action={acao} aria-label="Critérios do segmento" className="grid gap-3 rounded-[--radius-cartao] border border-linha bg-superficie p-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1">
        <label htmlFor={id('destino')} className={rotulo}>Destino de interesse</label>
        <input id={id('destino')} name="destino" defaultValue={c.destino} maxLength={80} placeholder="Ex.: Lisboa" className={campo} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={id('viajouPara')} className={rotulo}>Já viajou para (destino ou passeio)</label>
        <input id={id('viajouPara')} name="viajouPara" defaultValue={c.viajouPara} maxLength={80} placeholder="Ex.: Gramado" className={campo} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={id('etiqueta')} className={rotulo}>Etiqueta</label>
        <select id={id('etiqueta')} name="etiqueta" defaultValue={c.etiqueta ?? ''} className={campo}>
          <option value="">Qualquer</option>
          {etiquetas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={id('origem')} className={rotulo}>Como conheceu a agência</label>
        <select id={id('origem')} name="origem" defaultValue={c.origem ?? ''} className={campo}>
          <option value="">Qualquer</option>
          {ORIGENS.map((o) => <option key={o} value={o}>{ROTULO_ORIGEM[o]}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={id('cidade')} className={rotulo}>Cidade</label>
        <select id={id('cidade')} name="cidade" defaultValue={c.cidade ?? ''} className={campo}>
          <option value="">Qualquer</option>
          {cidades.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={id('aniversarioMes')} className={rotulo}>Aniversariantes do mês</label>
        <select id={id('aniversarioMes')} name="aniversarioMes" defaultValue={c.aniversarioMes ?? ''} className={campo}>
          <option value="">Qualquer</option>
          {MESES.map((m, i) => <option key={m} value={i + 1}>{m[0].toUpperCase() + m.slice(1)}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={id('motivoPerda')} className={rotulo}>Perdeu negociação por</label>
        <select id={id('motivoPerda')} name="motivoPerda" defaultValue={c.motivoPerda ?? ''} className={campo}>
          <option value="">Qualquer</option>
          {MOTIVOS.map((m) => <option key={m.valor} value={m.valor}>{m.rotulo}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={id('semContatoDias')} className={rotulo}>Sem contato há (dias ou mais)</label>
        <input id={id('semContatoDias')} name="semContatoDias" inputMode="numeric" defaultValue={c.semContatoDias} placeholder="Ex.: 60" className={campo} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={id('passaporteMeses')} className={rotulo}>Passaporte vence em até (meses)</label>
        <input id={id('passaporteMeses')} name="passaporteMeses" inputMode="numeric" defaultValue={c.passaporteMeses} placeholder="Ex.: 6" className={campo} />
      </div>
      <div className="sm:col-span-2">
        <button type="submit" className="inline-flex min-h-12 items-center rounded-full bg-destaque px-6 font-semibold text-destaque-texto">Ver clientes</button>
      </div>
    </form>
  )
}
