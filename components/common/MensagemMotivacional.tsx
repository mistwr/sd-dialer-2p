'use client'

import { epocaNatal } from '@/lib/formacao-conteudo'
import { NatalEstilos, PaiNatalMini } from '@/components/common/NatalArte'

interface MensagemMotivacionalProps {
  userId: string
  companyId: string
}

const mensagens = [
  'Cada contacto é uma oportunidade para criar valor.',
  'Método + acompanhamento + ação = resultados.',
  'Consistência todos os dias transforma esforço em resultados.',
  'Uma boa conversa pode abrir a próxima oportunidade.',
  'Foco no cliente, clareza na proposta e atitude no fecho.',
  'Juntos Somos +',
]

const natal = [
  'Este Natal, ajuda as famílias a começarem o ano a pagar menos.',
  'Cada chamada conta para o Desafio de Natal. Vê onde estás no ranking!',
  'A melhor prenda para um cliente: uma fatura mais baixa todos os meses.',
  'Juntos Somos + — e no Natal ainda mais.',
]

export default function MensagemMotivacional({ userId, companyId }: MensagemMotivacionalProps) {
  if (epocaNatal()) {
    const msg = natal[(userId.length + companyId.length + new Date().getDate()) % natal.length]
    return (
      <a href="/gamificacao" className="mb-4 flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm shadow-sm"
        style={{ background: 'linear-gradient(120deg, #0C2B1E 0%, #123B2A 55%, #3B0D0D 100%)', border: '1px solid rgba(212,175,55,0.45)', color: '#F8FAFC', textDecoration: 'none' }}>
        <span className="flex items-center gap-3">
          <NatalEstilos />
          <span aria-hidden style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.5)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><PaiNatalMini size={24} /></span>
          <span style={{ fontWeight: 600 }}>{msg}</span>
        </span>
        <span className="sd-brilho whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold" style={{ background: '#D4AF37', color: '#1F2937' }}>Desafio de Natal →</span>
      </a>
    )
  }
  const indice = (userId.length + companyId.length + new Date().getDate()) % mensagens.length
  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm">
      <span className="mr-2 text-amber-500">✦</span>
      {mensagens[indice]}
    </div>
  )
}
