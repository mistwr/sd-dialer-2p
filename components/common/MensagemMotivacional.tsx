'use client'

import Link from 'next/link'
import { epocaNatal } from '@/lib/formacao-conteudo'

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
      <Link href="/gamificacao" className="mb-4 flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm"
        style={{ background: 'linear-gradient(90deg,#991B1B,#B91C1C 50%,#166534)', textDecoration: 'none' }}>
        <span><span className="mr-2">🎄</span>{msg}</span>
        <span className="whitespace-nowrap rounded-full bg-white/20 px-3 py-1 text-xs font-bold">🎁 Desafio de Natal →</span>
      </Link>
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
