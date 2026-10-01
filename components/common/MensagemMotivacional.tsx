'use client'

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

export default function MensagemMotivacional({ userId, companyId }: MensagemMotivacionalProps) {
  const indice = (userId.length + companyId.length + new Date().getDate()) % mensagens.length

  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm">
      <span className="mr-2 text-amber-500">✦</span>
      {mensagens[indice]}
    </div>
  )
}
