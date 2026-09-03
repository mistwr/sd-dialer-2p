'use client'

interface MensagemMotivacionalProps {
  userId: string
  companyId: string
}

const mensagens = [
  'Cada contacto é uma oportunidade para ajudar alguém a poupar.',
  'Método + acompanhamento + ação = resultados.',
  'Vamos vender MEO e Energia. Juntos Somos +',
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
