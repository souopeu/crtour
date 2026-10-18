import { matrizQr } from '@/lib/formulario/qr'

// One SVG rect per dark module, with a quiet zone of 4; always black on white so phones can read it in dark mode too.
export function QrCode({ texto, rotulo }: { texto: string; rotulo: string }) {
  const m = matrizQr(texto)
  const lado = m.length + 8
  return (
    <svg role="img" aria-label={rotulo} viewBox={`0 0 ${lado} ${lado}`} shapeRendering="crispEdges" className="size-40 rounded-lg border border-linha bg-white">
      <rect width={lado} height={lado} fill="#ffffff" />
      {m.flatMap((linha, l) => linha.map((escuro, c) => (escuro ? <rect key={`${l}-${c}`} x={c + 4} y={l + 4} width="1" height="1" fill="#000000" /> : null)))}
    </svg>
  )
}
