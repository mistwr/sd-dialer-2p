// Catálogo de venda para o robot (agente "lumin-telecom").
// Lê do CRM (Supabase) a campanha da lead, os pacotes/preços de referência, o guião e as respostas
// a objeções da empresa e devolve um bloco de texto que é acrescentado às notas do agente no momento
// da chamada. Não toca no motor de voz (STT, LLM, TTS, VAD) nem na transcrição.
// Nunca lança erro: sem dados, devolve '' e a chamada corre como antes.

const MAX_BLOCK = 8000

function clip(value: unknown, max: number): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function euro(value: unknown): string {
  const n = Number(value)
  return Number.isFinite(n) ? n.toFixed(2).replace('.', ',') + ' €' : ''
}

export async function buildSalesCatalog(
  admin: any,
  companyId: string,
  opts: { campanhaId?: string | null; operadorAtual?: string | null } = {},
): Promise<string> {
  try {
    const [campanhaRes, tarifasRes, roteirosRes, objecoesRes] = await Promise.all([
      opts.campanhaId
        ? admin.from('campanhas').select('name,description').eq('id', opts.campanhaId).maybeSingle()
        : Promise.resolve({ data: null }),
      admin
        .from('tarifarios_referencia')
        .select('operador,segmento,nome_pacote,preco_mensal,detalhes,fonte,updated_at')
        .eq('company_id', companyId)
        .eq('segmento', 'telecom')
        .order('preco_mensal', { ascending: true }),
      admin
        .from('roteiros_venda')
        .select('segmento,titulo,conteudo,ordem')
        .eq('company_id', companyId)
        .eq('ativo', true)
        .in('segmento', ['TELECOM', 'geral'])
        .order('ordem', { ascending: true }),
      admin
        .from('banco_objecoes')
        .select('segmento,objecao,resposta_sugerida,ordem')
        .eq('company_id', companyId)
        .eq('ativo', true)
        .in('segmento', ['TELECOM', 'geral'])
        .order('ordem', { ascending: true }),
    ])

    const tarifas: any[] = tarifasRes?.data || []
    if (!tarifas.length) return ''

    const parts: string[] = []
    parts.push('CATÁLOGO DE VENDA (usa apenas estes dados; nunca inventes pacotes, preços, descontos ou condições):')

    const campanha = campanhaRes?.data
    if (campanha?.name) {
      parts.push('CAMPANHA DESTA LEAD: ' + clip(campanha.name, 80) + (campanha.description ? ' — ' + clip(campanha.description, 200) : ''))
    }
    if (opts.operadorAtual) {
      parts.push('OPERADORA ATUAL REGISTADA NA LEAD (confirma com o cliente, não assumas): ' + clip(opts.operadorAtual, 40))
    }

    const hoje = new Date().toISOString().slice(0, 10)
    const pacotes: string[] = []
    for (const t of tarifas) {
      let d: any = {}
      try {
        d = typeof t.detalhes === 'string' ? JSON.parse(t.detalhes) : t.detalhes || {}
      } catch {
        d = {}
      }
      // Campanhas com data de fim: deixam de ser usadas depois de expirar.
      if (d.valido_ate && String(d.valido_ate) < hoje) continue
      const bits: string[] = []
      if (d.velocidade) bits.push('internet ' + d.velocidade)
      if (d.tv) bits.push('TV')
      if (d.cartoes) bits.push(d.cartoes + (Number(d.cartoes) === 1 ? ' cartão móvel' : ' cartões móveis'))
      const campanha = d.valido_ate ? ' [CAMPANHA ATÉ ' + String(d.valido_ate).split('-').reverse().join('/') + ']' : ''
      pacotes.push(
        '- ' + clip(t.operador, 30) + ' · ' + clip(t.nome_pacote, 100) + ' · ' + (d.desde ? 'a partir de ' : '') + euro(t.preco_mensal) + '/mês' +
          (bits.length ? ' (' + bits.join(' + ') + ')' : '') + campanha + (d.nota ? ' — ' + clip(d.nota, 220) : ''),
      )
    }
    if (!pacotes.length) return ''
    parts.push('PACOTES DISPONÍVEIS (preço mensal de referência, com IVA). Se houver CAMPANHA em vigor para uma operadora, usa o preço da campanha em vez do preço normal dessa operadora. Nunca digas promoções que não estejam aqui:\n' + pacotes.join('\n'))
    const verificado = clip(tarifas[0]?.fonte, 60)
    parts.push(
      'COMO APRESENTAR O PREÇO: só depois de saberes a operadora e o valor atual do cliente, propõe UM pacote da lista acima (o que melhor encaixa no que ele tem: com ou sem telemóveis) e diz o preço exato dessa linha com o nome da operadora dessa linha. ' +
        'O pacote tem de custar MENOS do que o cliente paga hoje: se o escolhido for igual ou mais caro, não o apresentes e escolhe outro mais barato da lista que encaixe; se nenhum for mais barato, diz que neste momento não encontras poupança. Nunca uses preços de exemplo nem de outra operadora. Compara com contas simples entre o valor que ele disse e o preço da linha escolhida. Não prometas poupança total, fidelização ou condições que não estejam aqui' +
        (verificado ? ' (preços: ' + verificado + ')' : '') +
        '. O valor final é confirmado no link de adesão que o cliente recebe.',
    )

    const roteiros: any[] = roteirosRes?.data || []
    const metodo = roteiros
      .filter((r) => !/VODAFONE.*TESTE/i.test(String(r.titulo)))
      .map((r) => clip(r.conteudo, 260))
      .filter(Boolean)
    if (metodo.length) {
      parts.push('PERGUNTAS DO MÉTODO DE VENDA DA EMPRESA (adapta ao que o cliente já disse, não leias como robot):\n' + metodo.map((m) => '- ' + m).join('\n'))
    }

    const objecoes: any[] = (objecoesRes?.data || []).filter((o: any) => String(o.objecao).length < 90).slice(0, 8)
    if (objecoes.length) {
      parts.push(
        'RESPOSTAS A OBJEÇÕES (do método da empresa; usa o sentido, em frases curtas):\n' +
          objecoes.map((o) => '- ' + clip(o.objecao, 70) + ' → ' + clip(o.resposta_sugerida, 330)).join('\n'),
      )
    }

    return parts.join('\n').slice(0, MAX_BLOCK)
  } catch (error) {
    console.error('[sales-catalog] failed', error instanceof Error ? error.message : 'unknown')
    return ''
  }
}

// Envio automático do link de adesão (ver ai-sale.ts). Ligado por agente em voice_call_agent_configs:
//   autoSendSaleLink: true            -> liga
//   autoSendSalePhones: ["+3519..."]  -> opcional: só estes números (fase de teste); vazio/ausente = todos
export function saleLinkEnabledFor(config: any, phone: string): boolean {
  if (!config || config.autoSendSaleLink !== true) return false
  const phones = Array.isArray(config.autoSendSalePhones) ? config.autoSendSalePhones.map((p: unknown) => String(p)) : []
  return phones.length === 0 || phones.includes(String(phone))
}

export const SALE_LINK_CLOSING =
  'FECHO COM LINK (substitui os passos 6 e 7; ignora o agendamento do consultor): quando a pessoa aceitar o pacote, NÃO marques consultor. ' +
  '1) Diz que vais enviar já uma mensagem com o link para confirmar os dados e assinar, e que demora cerca de 2 minutos. ' +
  '2) Pergunta: "Qual é o melhor email para lhe enviar também?" Quando disser, repete o email devagar, por extenso (por exemplo "joao ponto silva arroba gmail ponto com") e pergunta "Está correto?". Se corrigir, repete outra vez. Se não tiver email, não faz mal: segue só por SMS. ' +
  '3) Diz: "Perfeito, vai receber a mensagem no telemóvel e no email dentro de alguns minutos. Quando assinar fica tudo tratado. Tenha à mão o cartão de cidadão e uma fatura." ' +
  '4) Despede-te com simpatia. NÃO peças NIF, morada nem dados de pagamento. Se a pessoa não quiser receber o link, volta ao fecho normal com o consultor.'
