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
      'COMO APRESENTAR O PREÇO: só depois de saberes a operadora e o valor atual do cliente, propõe UM pacote (o que melhor encaixa no que ele tem: com ou sem telemóveis) e diz o preço como "fica por volta de X euros por mês". ' +
        'Se o cliente disse quanto paga, compara só com contas simples (ex.: paga 70, este fica 57, são cerca de 13 euros a menos por mês). Não prometas poupança total, fidelização ou condições que não estejam aqui' +
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
