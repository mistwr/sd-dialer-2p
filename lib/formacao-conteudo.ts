// Conteúdo da formação SD Dialer / MyPoupar+.
// Cada módulo tem secções (texto e guiões) e um quiz curto; passar no quiz conta para a gamificação.

export type Seccao = { titulo: string; texto?: string; guiao?: string[]; pontos?: string[]; aviso?: string }
export type Pergunta = { pergunta: string; opcoes: string[]; certa: number; porque: string }
export type Modulo = {
  id: string
  grupo: 'comecar' | 'metodo' | 'mypoupar' | 'operadora' | 'natal'
  titulo: string
  resumo: string
  operadora?: string // nome usado nas campanhas (/api/campanhas-operadoras)
  tipo?: 'telecom' | 'energia' | 'solar'
  seccoes: Seccao[]
  quiz: Pergunta[]
}

export const PONTOS = { chamada: 1, conversa: 3, venda: 50, modulo: 10 }

// ── Começar aqui ────────────────────────────────────────────────────────────
const comecar: Modulo = {
  id: 'comecar',
  grupo: 'comecar',
  titulo: 'O teu primeiro dia no SD Dialer',
  resumo: 'O que fazer, passo a passo, desde que entras até à primeira venda. Sem robot: és tu que ligas.',
  seccoes: [
    {
      titulo: '1. Abre "Minhas Leads"',
      texto: 'É a tua lista de trabalho. Cada lead é uma pessoa que autorizou ser contactada. Começa pelas que estão em "Nova" e pelas que têm chamada marcada para hoje (cartão "Para ligar hoje", no topo).',
    },
    {
      titulo: '2. Abre a lead e lê antes de ligar',
      texto: 'Vê o nome, a operadora (se houver), as notas e o histórico. Se aparecer o aviso "Este número já existe noutras leads", lê o que já aconteceu para não repetir a conversa.',
    },
    {
      titulo: '3. Carrega em "Ligar"',
      texto: 'A chamada sai do teu telemóvel (o teu cartão). O cronómetro começa sozinho. Usa o guião do método AEDCRAFAM (módulo seguinte) — perguntas, não discursos.',
    },
    {
      titulo: '4. Regista SEMPRE o resultado',
      texto: 'Quando desligas, escolhe o resultado: Não atende, Ligar depois, Não interessado, Venda, Número errado… Usa as notas rápidas ("Acha caro", "Fidelizado", "Pediu proposta"). Sem resultado registado, a chamada não conta para os teus pontos.',
    },
    {
      titulo: '5. "Ligar depois" = marcar na Agenda',
      texto: 'Se a pessoa pedir para ligares noutra altura, marca dia e hora. Aparece-te em "Agenda" e no cartão "Para ligar hoje". Cumprir a hora combinada vale vendas.',
    },
    {
      titulo: '6. Fechou? Regista a venda',
      texto: 'Na lead carrega em "Venda" (ou em Vendas → Nova). Preenche operadora, serviço e valor e anexa os documentos. A lead passa a "Vendido" e a venda entra no ranking.',
    },
    {
      titulo: '7. O teu objetivo do dia',
      texto: 'No topo de "Minhas Leads" tens a barra "Chamadas hoje" com o objetivo definido pelo teu supervisor. Constância ganha a sorte: muitas chamadas bem registadas trazem as vendas.',
    },
    {
      titulo: 'Regras que não se quebram',
      pontos: [
        'Liga só entre as 9h e as 21h, de segunda a sábado.',
        'Se a pessoa disser "não me liguem mais", regista "Não interessado" com a nota e não voltas a ligar.',
        'Nunca prometas preços ou condições que não estejam numa campanha ativa.',
        'Os dados pessoais (NIF, morada, IBAN) só se pedem no fecho, com consentimento claro.',
      ],
    },
  ],
  quiz: [
    { pergunta: 'Acabaste uma chamada. O que fazes primeiro?', opcoes: ['Ligo logo à seguinte', 'Registo o resultado da chamada', 'Fecho a lead'], certa: 1, porque: 'Sem resultado registado a chamada não conta e a equipa perde a informação.' },
    { pergunta: 'O cliente pede para ligares amanhã às 18h. O que fazes?', opcoes: ['Escrevo num papel', 'Marco "Ligar depois" com dia e hora na lead', 'Ligo quando me lembrar'], certa: 1, porque: 'Assim aparece na Agenda e no cartão "Para ligar hoje".' },
    { pergunta: 'Quando pedes NIF e morada?', opcoes: ['Logo no início', 'No fecho, com consentimento', 'Nunca'], certa: 1, porque: 'Os dados pessoais só no fecho, quando o cliente já quer avançar.' },
  ],
}

// ── Método AEDCRAFAM ao telefone ─────────────────────────────────────────────
const metodo: Modulo = {
  id: 'metodo-aedcrafam',
  grupo: 'metodo',
  titulo: 'Método AEDCRAFAM ao telefone',
  resumo: 'O método MyPoupar+ adaptado à chamada: perguntas certas em vez de frases decoradas.',
  seccoes: [
    {
      titulo: 'A — Abordar (primeiros 10 segundos)',
      texto: 'Objetivo: ganhar autorização para continuar. Diz quem és, de onde ligas e o motivo, e acaba com uma pergunta fácil.',
      guiao: [
        '"Boa tarde, fala o [nome], da MyPoupar+. Estou a ligar por causa da internet e televisão lá de casa — hoje são de que operadora?"',
        'Nunca: "É má altura?" — convida ao "não".',
      ],
    },
    {
      titulo: 'E — Escutar',
      texto: 'O cliente dá-te informação logo na primeira resposta. Não interrompas para apresentar produto.',
      guiao: ['"Ah, a [operadora]. E o que é que gosta mais nela?"'],
      aviso: 'O que o cliente valoriza é o que não podes tirar na proposta.',
    },
    {
      titulo: 'D — Descobrir',
      texto: 'Encontra a dor e percebe o que tem. Uma pergunta de cada vez.',
      guiao: [
        '"E mais ou menos quanto paga por mês, com tudo?"',
        '"Tem telemóveis incluídos? Quantos?"',
        '"Está contente com o serviço ou gostava de pagar menos?"',
        '"Tem a fatura à mão? Assim comparamos ao cêntimo."',
      ],
    },
    {
      titulo: 'C — Comparar',
      texto: 'Compara com dados reais, de preferência com o cliente a participar. Usa as campanhas ativas da operadora (em "Por operadora") e o simulador de energia.',
      guiao: ['"Vamos ver juntos: com 2 telemóveis e esses 70 €, comparo já com as campanhas que temos ativas."'],
      aviso: 'Não digas "eu consigo mais barato". Mostra a comparação.',
    },
    {
      titulo: 'R — Resolver',
      texto: 'Apresenta só a solução que resolve a dor que encontraste. Uma proposta, não um catálogo.',
      guiao: ['"Pelo que me disse, a diferença fica em cerca de X € por mês, mantendo a televisão que gosta."'],
      aviso: 'Nunca inventes poupanças. Se não há melhor, diz — ganhas confiança para a próxima.',
    },
    {
      titulo: 'F — Fechar',
      texto: 'Fecho assumido, com escolha entre duas opções. Só agora pedes os dados.',
      guiao: [
        '"Prefere que a instalação seja de manhã ou de tarde?"',
        '"Tem aí o cartão de cidadão? Eu ajudo a preencher, é rápido."',
      ],
      aviso: 'O cliente tem de conhecer preço, serviços, fidelização e condições. Sem consentimento claro, não há venda.',
    },
    {
      titulo: 'A — Acompanhar',
      texto: 'A venda não acaba na submissão: combina o próximo passo (instalação, portabilidade, documentos) e marca na Agenda.',
    },
    {
      titulo: 'M — Multiplicar',
      texto: 'Depois de ajudares, pede uma apresentação, com consentimento.',
      guiao: ['"Tem alguém na família que também gostasse de perceber se está a pagar a mais? Pode mandar-lhe o meu contacto."'],
    },
  ],
  quiz: [
    { pergunta: 'Qual é a melhor abertura?', opcoes: ['"É má altura?"', '"Estou a ligar por causa da internet e TV — hoje são de que operadora?"', '"Tenho uma promoção imperdível!"'], certa: 1, porque: 'Diz o motivo e acaba com uma pergunta fácil.' },
    { pergunta: 'Em que fase pedes os dados pessoais?', opcoes: ['Descobrir', 'Comparar', 'Fechar'], certa: 2, porque: 'Só no Fechar, quando o cliente já quer avançar.' },
    { pergunta: 'Não há proposta melhor do que a atual. O que dizes?', opcoes: ['Invento uma poupança', 'Digo a verdade e fico com o contacto para o futuro', 'Desligo'], certa: 1, porque: 'Honestidade gera confiança e vendas futuras.' },
  ],
}

// ── Apresentar o MyPoupar+ ──────────────────────────────────────────────────
const mypoupar: Modulo = {
  id: 'mypoupar-site',
  grupo: 'mypoupar',
  titulo: 'Apresentar o MyPoupar+ (mypoupar.pt)',
  resumo: 'Como usar o site na chamada para dar confiança ao cliente.',
  seccoes: [
    {
      titulo: 'O que é o MyPoupar+',
      texto: 'Serviço gratuito de comparação de faturas de internet, TV, telemóvel e luz. O cliente diz a operadora e quanto paga, a equipa compara as campanhas ativas e o cliente só assina online se quiser.',
    },
    {
      titulo: 'Quando usar o site na chamada',
      pontos: [
        'Quando o cliente desconfia ("quem são vocês?"): manda o link por WhatsApp para ele ver que existimos.',
        'Para comparar energia: usa o simulador do site (ou "Simulador energia" aqui no SD Dialer).',
        'Para mostrar as campanhas ativas: secção "Campanhas" do site.',
      ],
    },
    {
      titulo: 'Guião',
      guiao: [
        '"Somos a MyPoupar+, um comparador gratuito. Vou mandar-lhe agora o nosso site por WhatsApp para ver com calma: mypoupar.pt."',
        '"Lá vê as campanhas que estão ativas. Eu faço a comparação consigo e só avança se fizer sentido."',
        '"Se preferir, tire uma foto à fatura e mande-me por WhatsApp — comparo ao cêntimo."',
      ],
    },
    {
      titulo: 'Contactos oficiais',
      pontos: ['Site: mypoupar.pt', 'WhatsApp: +351 968 677 320', 'Email: parcerias@mypoupar.pt'],
    },
  ],
  quiz: [
    { pergunta: 'O cliente pergunta "quem são vocês?". O que fazes?', opcoes: ['Insisto na proposta', 'Mando o link mypoupar.pt por WhatsApp e explico que somos um comparador gratuito', 'Desligo'], certa: 1, porque: 'O site dá confiança e mostra as campanhas ativas.' },
    { pergunta: 'A comparação no MyPoupar+ tem custo para o cliente?', opcoes: ['Sim', 'Não, é gratuita e sem compromisso'], certa: 1, porque: 'Só assina se quiser.' },
  ],
}

// ── Por operadora ───────────────────────────────────────────────────────────
function moduloOperadora(id: string, operadora: string, tipo: 'telecom' | 'energia' | 'solar', perguntas: string[], dicas: string[]): Modulo {
  return {
    id: `op-${id}`,
    grupo: 'operadora',
    titulo: operadora,
    resumo: tipo === 'telecom' ? 'Campanhas ativas e como vender internet, TV e telemóvel.' : tipo === 'energia' ? 'Campanhas ativas e como vender eletricidade e gás.' : 'Como qualificar e marcar visita para painéis solares.',
    operadora,
    tipo,
    seccoes: [
      { titulo: 'Perguntas que tens de fazer', pontos: perguntas },
      { titulo: 'Dicas', pontos: dicas },
    ],
    quiz: [
      { pergunta: `Onde vês os preços e condições da ${operadora} que podes dizer ao cliente?`, opcoes: ['Na minha memória', 'Nas campanhas ativas desta página', 'Invento um valor próximo'], certa: 1, porque: 'Só podes dizer preços e condições de campanhas ativas.' },
      { pergunta: 'O que pedes ao cliente para a comparação ficar exata?', opcoes: ['A última fatura', 'O IBAN logo no início', 'Nada'], certa: 0, porque: 'Com a fatura a comparação é real.' },
    ],
  }
}

const TELECOM_Q = ['Que serviços tem (internet, TV, fixo, telemóveis)?', 'Quanto paga por mês, com tudo?', 'Quantos telemóveis e de quem?', 'Está contente ou gostava de pagar menos?', 'Quando termina a fidelização? (se o cliente falar disso)']
const ENERGIA_Q = ['Tem eletricidade e gás? Com quem?', 'Quanto paga por mês (inverno e verão)?', 'Potência contratada e tarifa (simples ou bi-horária)? — está na fatura', 'É casa ou empresa?']

const operadoras: Modulo[] = [
  moduloOperadora('meo', 'MEO', 'telecom', TELECOM_Q, ['Clientes MEO antigos costumam pagar mais do que um cliente novo: compara com a campanha ativa.', 'Se o cliente já é MEO, vê se compensa juntar telemóveis no mesmo pacote.']),
  moduloOperadora('nos', 'NOS', 'telecom', TELECOM_Q, ['Pergunta o que mais usa (TV, desporto, velocidade) antes de comparar.', 'O STT do robot ouve "Nós" — tu ouves NOS; confirma sempre.']),
  moduloOperadora('vodafone', 'Vodafone', 'telecom', TELECOM_Q, ['Vê quantos cartões ilimitados tem: é onde costuma estar a diferença.']),
  moduloOperadora('meo-energia', 'MEO Energia', 'energia', ENERGIA_Q, ['Bom argumento para quem já é cliente MEO telecom: tudo no mesmo fornecedor.', 'Usa o Simulador energia com a fatura do cliente.']),
  moduloOperadora('endesa', 'Endesa', 'energia', ENERGIA_Q, ['Compara sempre o preço por kWh e o termo de potência no simulador.']),
  moduloOperadora('iberdrola', 'Iberdrola', 'energia', ENERGIA_Q, ['Confirma se o cliente tem gás para propor dual (luz + gás).']),
  moduloOperadora('edp', 'EDP', 'energia', [...ENERGIA_Q, 'Empresarial: NIF da empresa, CAE e consumo anual.'], ['Muitos clientes estão na EDP há anos sem rever: é aí que está a poupança.', 'Empresas: marca visita/chamada com o decisor (gerente).']),
  moduloOperadora('galp', 'Galp', 'energia', ENERGIA_Q, ['Pergunta se abastece na Galp — pode haver vantagens associadas (confirma na campanha ativa).']),
  moduloOperadora('repsol', 'Repsol', 'energia', ENERGIA_Q, ['Compara o preço final na fatura, não só o kWh.']),
  moduloOperadora('solar', 'Painéis solares', 'solar', ['É moradia? Tem telhado próprio (orientação, sombras)?', 'Quanto paga de luz por mês?', 'É o proprietário?', 'Quando pode receber uma visita técnica?'], ['O objetivo da chamada é marcar a visita técnica, não vender ao telefone.', 'Usa o simulador (autoconsumo) para mostrar a ordem de grandeza da poupança.']),
]

// ── Natal ───────────────────────────────────────────────────────────────────
const natal: Modulo = {
  id: 'natal',
  grupo: 'natal',
  titulo: 'Guião de Natal 🎄',
  resumo: 'Argumentos para dezembro: poupar antes das festas e começar o ano a pagar menos.',
  seccoes: [
    {
      titulo: 'Porque é que o Natal ajuda',
      texto: 'Em dezembro as famílias estão a fazer contas às prendas e ao início do ano. Poupar na fatura todos os meses é um argumento natural — sem pressão.',
    },
    {
      titulo: 'Abertura de Natal',
      guiao: [
        '"Boa tarde, fala o [nome], da MyPoupar+. Nesta altura do Natal estamos a ajudar as famílias a rever as faturas de internet e TV para começarem o ano a pagar menos. Hoje são de que operadora?"',
      ],
    },
    {
      titulo: 'Frases para usar no Comparar/Resolver',
      guiao: [
        '"Essa diferença por mês, ao fim do ano, dá para as prendas do próximo Natal."',
        '"Se tratarmos disto agora, entra em janeiro já com a fatura nova."',
        '"É a melhor prenda que pode dar à carteira lá de casa." (com um sorriso)',
      ],
    },
    {
      titulo: 'Cuidados',
      pontos: [
        'Instalações em dezembro podem demorar mais: confirma prazos antes de prometer datas.',
        'Nada de pressão do tipo "só hoje" se não for verdade.',
        'Dias 24, 25 e 31 à tarde: não liges — as famílias estão juntas.',
      ],
    },
  ],
  quiz: [
    { pergunta: 'Qual destas frases de Natal é boa?', opcoes: ['"É só hoje, despache-se!"', '"Essa diferença ao fim do ano dá para as prendas do próximo Natal."', '"O Natal é caro, tem de mudar."'], certa: 1, porque: 'Mostra o benefício sem pressão.' },
    { pergunta: 'Dia 24 à tarde, ligas aos clientes?', opcoes: ['Sim', 'Não'], certa: 1, porque: 'Respeita as famílias — ganhas mais noutra altura.' },
  ],
}

export const MODULOS: Modulo[] = [comecar, metodo, mypoupar, ...operadoras, natal]
export const MODULO_IDS = MODULOS.map((m) => m.id)

// Desafio de Natal (datas por defeito; o admin pode mudar os prémios).
export const NATAL_PADRAO = { inicio: '2026-11-24', fim: '2026-12-23', premios: ['1.º lugar: prémio a definir', '2.º lugar: prémio a definir', '3.º lugar: prémio a definir'] }

export function epocaNatal(d = new Date()) {
  const m = d.getMonth(), dia = d.getDate()
  return (m === 10 && dia >= 20) || m === 11 || (m === 0 && dia <= 6)
}
