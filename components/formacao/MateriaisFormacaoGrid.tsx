/**
 * Materiais de Formação — MyPoupar Elite MEO.
 * Texto extraído diretamente dos guiões/scripts em imagem, para poder ser
 * pesquisado, copiado e mantido atualizado em texto (as imagens ficam em
 * public/formacao/ como referência visual/para partilhar).
 */

export interface PassoGuiao {
  numero: number;
  titulo: string;
  texto: string;
}

export interface MaterialFormacao {
  id: string;
  tipo: "guiao" | "post";
  titulo: string;
  subtitulo?: string;
  imagem: string; // caminho em /public
  passos?: PassoGuiao[];
  notas?: string[];
  destaque?: string; // frase de fecho / call-to-action
}

export const materiaisFormacao: MaterialFormacao[] = [
  {
    id: "guiao-pronto-a-usar",
    tipo: "guiao",
    titulo: "Guião pronto a usar",
    subtitulo: "Para fechar com a MyPoupar + SD Dialer",
    imagem: "/formacao/mypoupar-guiao-pronto-a-usar.png",
    passos: [
      {
        numero: 1,
        titulo: "Abertura",
        texto:
          "Boa tarde, fala o [NOME] da MyPoupar. Ajudamos famílias a baixar o que pagam em telecomunicações e energia. Posso fazer-lhe 3 perguntas rápidas para perceber se faz sentido no seu caso?",
      },
      {
        numero: 2,
        titulo: "Diagnóstico",
        texto:
          "Que operador tem atualmente? · Quanto paga mais ou menos por mês? · Tem fidelização? · E na energia, quanto costuma pagar?",
      },
      {
        numero: 3,
        titulo: "Transição",
        texto:
          "Perfeito. Pelo que me está a dizer, vale a pena comparar. A nossa função é simples: manter ou melhorar o serviço e tentar reduzir o custo.",
      },
      {
        numero: 4,
        titulo: "Proposta",
        texto:
          "Consigo apresentar-lhe uma solução MEO por [X€]. Neste momento paga [Y€], por isso estamos a falar de uma diferença de cerca de [Z€] por mês.",
      },
      {
        numero: 5,
        titulo: "Fecho",
        texto:
          "Se fizer sentido para si, tratamos já do processo consigo e fica acompanhado pela MyPoupar. Tem aí os seus dados para avançarmos?",
      },
      {
        numero: 6,
        titulo: 'Se disser "vou pensar"',
        texto:
          "Claro. Só para eu perceber: o que ainda precisa de confirmar? Preço? Fidelização? Cobertura? Condições? Ficando essa dúvida resolvida, podemos avançar?",
      },
      {
        numero: 7,
        titulo: "Regra SD Dialer",
        texto:
          "Nenhuma chamada termina sem registo do próximo passo: Venda · Follow-up com data · Interessado · Sem interesse · Inválido",
      },
    ],
    destaque:
      "Não vendemos só MEO. Somos gestores de poupança. Método + acompanhamento + ação = resultados.",
  },
  {
    id: "novo-script-registo",
    tipo: "guiao",
    titulo: "Novo script — Registo + acompanhamento + produção",
    subtitulo: "MyPoupar Elite MEO",
    imagem: "/formacao/mypoupar-elite-meo-novo-script.png",
    notas: [
      "Registem sempre todas as vendas no CRM SD Dialer.",
      "Acompanhem os estados da venda em tempo real, do registo até à instalação, para dar acompanhamento ao cliente e às vossas comissões.",
      "Quanto mais organizado estiver, mais fácil é acompanhar, fechar e receber.",
      "500 leads por pessoa · 2 tipos: fim de contrato + cross-sell energia.",
      "A cada 3 vendas de energia, vale praticamente 1 TV.",
    ],
    passos: [
      { numero: 1, titulo: "Abertura", texto: "Boa tarde, fala o [NOME] da MyPoupar. Posso fazer-lhe 3 perguntas rápidas?" },
      { numero: 2, titulo: "Diagnóstico", texto: "Operador? Quanto paga? Fidelização? E a energia?" },
      { numero: 3, titulo: "Proposta", texto: "Telecom + Energia. Procuramos a melhor solução e mais poupança." },
      { numero: 4, titulo: "Fecho", texto: "Se fizer sentido, tratamos já do processo consigo." },
      { numero: 5, titulo: "SD Dialer", texto: "Registar sempre: Venda · Interessado · Follow-up · Sem interesse · Inválido" },
    ],
    destaque: "Bora equipa. Juntos Somos +",
  },
];

export const logoEliteMeo = "/formacao/mypoupar-elite-meo-logo.png";
