import { arcoSemicirculo, pontoNoSemicirculo } from '@/lib/graficos/graficos'
import { formatarReais } from '@/lib/passeios/dinheiro'

const CX = 120
const CY = 118
const R = 96

// R120: the goal as a gauge (monday "Meta"). Decoration only; the numbers below and the meter's aria-valuetext say it all.
export function Velocimetro({ efetivo, meta }: { efetivo: number; meta: number }) {
  const fracao = meta > 0 ? efetivo / meta : 0
  const ponta = pontoNoSemicirculo(CX, CY, R - 30, fracao)
  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 240 140" aria-hidden="true" className="w-full max-w-72">
        <path d={arcoSemicirculo(CX, CY, R, 0, 1)} className="fill-none stroke-superficie-suave" strokeWidth="24" />
        {fracao > 0 && <path d={arcoSemicirculo(CX, CY, R, 0, fracao)} className="fill-none stroke-primaria" strokeWidth="24" />}
        <line x1={CX} y1={CY} x2={ponta.x} y2={ponta.y} className="stroke-tinta" strokeWidth="5" strokeLinecap="round" />
        <circle cx={CX} cy={CY} r="7" className="fill-tinta" />
        <text x={CX - R} y="138" textAnchor="middle" className="fill-tinta-suave text-[11px]">0</text>
        <text x={CX + R} y="138" textAnchor="middle" className="fill-tinta-suave text-[11px]">100%</text>
      </svg>
      <div className="flex w-full max-w-72 justify-between text-center">
        <p><span className="block text-xs uppercase tracking-wide text-tinta-suave">Atual</span><strong className="text-xl">{formatarReais(efetivo)}</strong></p>
        <p><span className="block text-xs uppercase tracking-wide text-tinta-suave">Meta</span><strong className="text-xl">{formatarReais(meta)}</strong></p>
      </div>
    </div>
  )
}
