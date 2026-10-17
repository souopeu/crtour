import { ROTULO_ORIGEM } from '@/lib/clientes/rotulos'
import { ORIGENS } from '@/lib/clientes/schema'
import { MOTIVOS } from '@/lib/negociacoes/negociacoes'
import { MESES, type Criterios } from '@/lib/segmentos/segmentos'

const campo = 'h-12 rounded-xl border border-controle bg-superficie px-3 text-base'
const rotulo = 'text-sm font-medium'

type Props = { criterios: Criterios; etiquetas: { id: string; nome: string }[]; cidades: string[] }

// Plain GET form: the criteria live in the URL, so the preview can be shared, reloaded and works without JavaScript.
export function FiltrosSegmento({ criterios: c, etiquetas, cidades }: Props) {
  return (
    <form method="get" action="/remarketing/novo" aria-label="Critérios do segmento" className="grid gap-3 rounded-[--radius-cartao] border border-linha bg-superficie p-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1">
        <label htmlFor="destino" className={rotulo}>Destino de interesse</label>
        <input id="destino" name="destino" defaultValue={c.destino} maxLength={80} placeholder="Ex.: Lisboa" className={campo} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="etiqueta" className={rotulo}>Etiqueta</label>
        <select id="etiqueta" name="etiqueta" defaultValue={c.etiqueta ?? ''} className={campo}>
          <option value="">Qualquer</option>
          {etiquetas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="origem" className={rotulo}>Como conheceu a agência</label>
        <select id="origem" name="origem" defaultValue={c.origem ?? ''} className={campo}>
          <option value="">Qualquer</option>
          {ORIGENS.map((o) => <option key={o} value={o}>{ROTULO_ORIGEM[o]}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="cidade" className={rotulo}>Cidade</label>
        <select id="cidade" name="cidade" defaultValue={c.cidade ?? ''} className={campo}>
          <option value="">Qualquer</option>
          {cidades.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="aniversarioMes" className={rotulo}>Aniversariantes do mês</label>
        <select id="aniversarioMes" name="aniversarioMes" defaultValue={c.aniversarioMes ?? ''} className={campo}>
          <option value="">Qualquer</option>
          {MESES.map((m, i) => <option key={m} value={i + 1}>{m[0].toUpperCase() + m.slice(1)}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="motivoPerda" className={rotulo}>Perdeu negociação por</label>
        <select id="motivoPerda" name="motivoPerda" defaultValue={c.motivoPerda ?? ''} className={campo}>
          <option value="">Qualquer</option>
          {MOTIVOS.map((m) => <option key={m.valor} value={m.valor}>{m.rotulo}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="semContatoDias" className={rotulo}>Sem contato há (dias ou mais)</label>
        <input id="semContatoDias" name="semContatoDias" inputMode="numeric" defaultValue={c.semContatoDias} placeholder="Ex.: 60" className={campo} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="passaporteMeses" className={rotulo}>Passaporte vence em até (meses)</label>
        <input id="passaporteMeses" name="passaporteMeses" inputMode="numeric" defaultValue={c.passaporteMeses} placeholder="Ex.: 6" className={campo} />
      </div>
      <div className="sm:col-span-2">
        <button type="submit" className="inline-flex min-h-12 items-center rounded-full bg-destaque px-6 font-semibold text-destaque-texto">Ver clientes</button>
      </div>
    </form>
  )
}
