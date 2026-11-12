// Catálogo de venda para o robot (agente "lumin-telecom").
// Lê do CRM (Supabase) a campanha da lead, os pacotes/preços de referência, o guião e as respostas
// a objeções da empresa e devolve um bloco de texto que é acrescentado às notas do agente no momento
// da chamada. Não toca no motor de voz (STT, LLM, TTS, VAD) nem na transcrição.
// Nunca lança erro: sem dados, devolve '' e a chamada corre como antes.

const MAX_BLOCK = 16000

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
      // O robot não propõe DIGI (decisão da empresa).
      if (/digi/i.test(String(t.operador || ''))) continue
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
          (bits.length ? ' (' + bits.join(' + ') + ')' : '') + campanha + (d.nota ? ' — ' + clip(d.nota, 420) : ''),
      )
    }
    if (!pacotes.length) return ''
    parts.push('PACOTES DISPONÍVEIS (preço mensal de referência, com IVA). Se houver CAMPANHA em vigor para uma operadora, usa o preço da campanha em vez do preço normal dessa operadora. Nunca digas promoções que não estejam aqui:\n' + pacotes.join('\n'))
    parts.push(
      'CARTÃO MÓVEL LOW-COST (para MONTAR o pacote): 5,00 €/mês por cartão (valor indicado pela empresa; o cartão exato é confirmado no pedido). ' +
        'Quando o cliente tem telemóveis e nenhum pacote da lista com cartões fica mais barato do que paga hoje, MONTA a proposta: um pacote 3P (internet + TV) da lista + um cartão low-cost por cada telemóvel. ' +
        'Total = preço da linha do 3P + 5 € x número de cartões (confirma quantos telemóveis tem). Diz o total mensal, a operadora do 3P e que os cartões são low-cost a 5 € cada. Há quase sempre solução mais barata assim: se nem assim ficar mais barato, não digas que não há: marca a chamada do consultor. ' +
        'Se o cliente paga um valor baixo, MENOR do que os preços de lista: procura a solução mais barata possível, em TODAS as operadoras (MEO, NOS, Vodafone): usa o 3P mais barato e o preço com desconto que vem no campo nota da linha (ex.: "com desconto de adesão fica X euros"), junta cartão low-cost só se ele tiver telemóveis, e compara o total com o que ele paga. NUNCA digas ao cliente que não há nada mais barato nem que não encontras poupança: em caso de dúvida, ou se nada ficar mais barato, diz que o consultor consegue ver condições melhores e agenda a chamada do consultor (dia e hora, com schedule_follow_up).',
    )
    // Totais exatos 3P + cartões low-cost por operadora (o robot não faz contas de cabeça nem inventa preços).
    try {
      const melhor3p: Record<string, number> = {}
      for (const t of tarifas) {
        const nome = String(t.nome_pacote || '')
        const op = String(t.operador || '')
        if (/digi/i.test(op) || !/\(3P\)|fibra3/i.test(nome) || /2\s*Gbps/i.test(nome)) continue
        let d: any = {}
        try { d = typeof t.detalhes === 'string' ? JSON.parse(t.detalhes) : t.detalhes || {} } catch { d = {} }
        if (d.valido_ate && String(d.valido_ate) < hoje) continue
        const m = /PREÇO A DIZER AO CLIENTE:\s*([\d]+[,.]?\d*)/i.exec(String(d.nota || ''))
        const preco = m ? Number(m[1].replace(',', '.')) : Number(t.preco_mensal)
        if (Number.isFinite(preco) && (melhor3p[op] === undefined || preco < melhor3p[op])) melhor3p[op] = preco
      }
      const porCartoes: string[] = []
      for (let n = 1; n <= 4; n++) {
        const ord = Object.entries(melhor3p).map(([op, p3]) => [op, p3 + 5 * n] as [string, number]).sort((a, b) => a[1] - b[1])
        if (ord.length) porCartoes.push('- ' + n + (n === 1 ? ' cartão' : ' cartões') + ': ' + ord.map(([op, t]) => clip(op, 20) + ' ' + euro(t)).join(' < '))
      }
      if (porCartoes.length) {
        parts.push(
          'PROPOSTA OBRIGATÓRIA QUANDO O CLIENTE TEM TELEMÓVEIS (ordenadas da mais barata para a mais cara; o total já inclui os cartões low-cost de 5 € cada): escolhe a PRIMEIRA que não seja a operadora atual do cliente e diz "[operadora] por [total] euros por mês, com internet, TV e [N] cartões a 5 euros cada". Só podes propor outro pacote do catálogo (mais caro) se o cliente recusar este ou pedir mais telemóveis/dados:\n' + porCartoes.join('\n'),
        )
      }
    } catch {
      // sem propostas montadas: segue com a lista
    }
    parts.push(
      'REGRAS DE PROPOSTA E FECHO (têm prioridade sobre o resto): ' +
        '(a) Só propões com os preços da lista ou das PROPOSTAS MONTADAS; nunca digas um valor que não esteja lá. Se o cliente paga X e o teu total não for claramente mais barato (pelo menos uns 5 euros a menos), escolhe outro operador da lista ou monta 3P + cartões; o cliente nunca é da mesma operadora que propões. Com telemóveis, usa sempre as PROPOSTAS MONTADAS (3P + cartões de 5 €). ' +
        '(b) NUNCA peças email. Só fechas depois de o cliente dizer claramente que aceita ("sim", "avançamos", "pode ser"): diz que o pedido segue para este número de telemóvel e que o consultor lhe envia o link para confirmar e assinar. ' +
        '(c) Depois de ele aceitar o telecom, antes do email, se ainda não ofereceste a energia, oferece-a. Se ele já te disse o que paga de luz, usa-o: "paga cerca de X por mês de luz; o consultor vê se consegue baixar". ' +
        '(e) Mensagem da proposta: diz o total, quanto poupa por mês e por ano (diferença x 12) e termina com UMA só pergunta, "Faz sentido avançarmos?". Não juntes "se continuar 12 meses, compensa?" nem pedidos de confirmação na mesma frase; espera pela resposta. ' +
        '(d) NUNCA te despeças com "boa noite" nem digas "não avanço com o pedido" enquanto o cliente continuar a falar ou não tiver recusado. Se o cliente voltar a falar depois de te despedires, continua a ajudá-lo com simpatia.',
    )
    const verificado = clip(tarifas[0]?.fonte, 60)
    parts.push(
      'COMO APRESENTAR O PREÇO: só depois de saberes a operadora e o valor atual do cliente, propõe UM pacote da lista acima (o que melhor encaixa no que ele tem: com ou sem telemóveis) e diz o preço exato dessa linha com o nome da operadora dessa linha. ' +
        'O pacote tem de custar MENOS do que o cliente paga hoje: se o escolhido for igual ou mais caro, não o apresentes e escolhe outro mais barato da lista que encaixe; se nenhum for mais barato, tenta montar o 3P + cartões low-cost (regra acima) e se nem assim for mais barato, não digas que não há poupança: agenda a chamada do consultor. Nunca propões DIGI, mesmo que o cliente seja de outra operadora ou pergunte por ela. Nunca uses preços de exemplo nem de outra operadora. Compara com contas simples entre o valor que ele disse e o preço da linha escolhida. Não prometas poupança total, fidelização ou condições que não estejam aqui' +
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

    // Energia (luz/gás): campanhas das operadoras de energia importadas do CRM. Sem preços (estão nos PDFs):
    // o robot não inventa tarifas, abre a porta e passa ao consultor.
    try {
      const { data: camps } = await admin
        .from('campanhas_operadoras')
        .select('title,operator,description,service_type')
        .eq('company_id', companyId)
        .eq('status', 'ativa')
      const { data: precos } = await admin
        .from('energia_tarifas_ref')
        .select('operador,plano,potencia_kva,preco_potencia_dia,preco_energia_kwh,condicoes,ordem')
        .eq('company_id', companyId)
        .order('ordem', { ascending: true })
        .order('potencia_kva', { ascending: true })
      const precosEnergia = (precos || [])
        .map((r: any) => '- ' + clip(r.operador, 20) + ' ' + clip(r.plano, 40) + ' ' + Number(r.potencia_kva).toString().replace('.', ',') + ' kVA: ' +
          Number(r.preco_potencia_dia).toFixed(4).replace('.', ',') + ' €/dia + ' + Number(r.preco_energia_kwh).toFixed(4).replace('.', ',') + ' €/kWh (' + clip(r.condicoes, 150) + ')')
        .join('\n')
      const energia = (camps || []).filter((c: any) => c.service_type === 'energia' || /energia/i.test(String(c.title)))
      if (energia.length) {
        const lista = energia
          .map((c: any) => '- ' + clip(c.operator, 20) + ': ' + clip(c.title, 50) + (c.description ? ' — ' + clip(c.description, 110) : ''))
          .join('\n')
        parts.push(
          'VENDER ENERGIA TAMBÉM (luz e gás): além de telecomunicações, a empresa vende luz e gás. Usa isto em 3 situações: ' +
            '(1) o cliente não quer mudar de telecom, já paga pouco, está fidelizado e não há solução, ou recusa o telecom (antes de desistires, depois da escada do não ao sim: "e na luz e no gás, já comparou? Muita gente poupa aí e é a mesma coisa, sem compromisso"); ' +
            '(2) o cliente aceita telecom: no fim, "aproveitando, a luz e o gás também?"; (3) o cliente fala de luz, gás, fatura de energia ou painéis. Podes propor telecom e energia no mesmo contacto. ' +
            'Pergunta só: com que empresa tem a luz, quanto paga por mês mais ou menos, se tem gás. Não peças NIF, morada, CPE, contador nem dados pessoais. ' +
            'PREÇOS DE ENERGIA (tarifa simples, sem IVA e impostos; valores base):\n' + precosEnergia + '\n' +
            'Para propor, escolhe a comercializadora com menor preço do kWh e da potência para o cliente. Gás: não digas valores, diz que o consultor simula. ' +
            'Estima a poupança só se o cliente souber potência (casa normal costuma ser 6,9 kVA, 3,45 kVA em casas pequenas) e kWh por mês; senão diz que o consultor compara com a fatura real. Diz sempre que são valores base sem impostos, sujeitos a confirmação do consultor. Nunca prometas poupança concreta. ' +
            'Se aceitar, agenda a chamada do consultor (dia e hora) com schedule_follow_up e escreve no motivo que é ENERGIA (luz/gás) e a empresa e valor que ele disse. Não envies link de adesão para energia. ' +
            'Se disser que não, aplica a mesma escada de objeções (poupar sem mudar nada no dia a dia, sem compromisso, só uma simulação), no máximo 2 tentativas, e termina com simpatia. Respeita sempre "não me liguem mais".\n' +
            'CAMPANHAS DE ENERGIA ATIVAS (só para teu conhecimento; menciona o nome da comercializadora se ajudar):\n' + lista,
        )
      }
    } catch {
      // sem energia: segue só telecom
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
  'FECHO COM LINK (substitui os passos 6 e 7; ignora o agendamento do consultor): quando a pessoa aceitar o pacote, NÃO peças email e NÃO marques consultor. ' +
  '1) Diz: "Perfeito! Vou enviar o pedido para este número de telemóvel e o consultor trata de lhe enviar o link para confirmar os dados e assinar; demora cerca de 2 minutos." ' +
  '2) Antes de te despedires, se ainda não ofereceste a energia, oferece-a uma vez (regras de energia acima). ' +
  '3) Diz: "Vai receber a mensagem dentro de alguns minutos. Quando assinar fica tudo tratado. Tenha à mão o cartão de cidadão e uma fatura." ' +
  '4) Despede-te com simpatia. NÃO peças email, NIF, morada nem dados de pagamento. Se a pessoa não quiser receber o link, volta ao fecho normal com o consultor.'
