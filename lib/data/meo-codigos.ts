/**
 * Base de dados dos códigos D2D — MEO Fibra, MEO Satélite e MEO Energia.
 *
 * ⚠️ IMPORTANTE: estes códigos foram transcritos das "Folhas de Códigos D2D"
 * fornecidas (MEO Fibra 2026-JULHO-14, MEO Satélite 2026-ABRIL-20,
 * MEO Energia 2025-08-MAIO). Sempre que a operadora enviar uma folha nova,
 * atualiza APENAS este ficheiro — todos os componentes (Campanhas e
 * Formação) leem daqui, por isso nunca ficam desatualizados em dois sítios.
 *
 * "---" = não aplicável nesse cenário
 * "AGUARDA" = a operadora ainda não disponibilizou o código
 */

export type Celula = string | null; // null = "---"

export interface LinhaCodigos {
  cenario: string;
  valores: Celula[]; // um valor por coluna, na mesma ordem de `colunas`
  nota?: string; // ex: "Usar código de alteração de pacote para M4e 2 Cartões"
}

export interface TabelaCodigos {
  id: string;
  titulo: string;
  colunas: string[];
  linhas: LinhaCodigos[];
}

export interface FolhaCodigos {
  id: string;
  produto: "MEO Fibra" | "MEO Satélite" | "MEO Energia";
  atualizadoEm: string; // data impressa na folha original
  tabelas: TabelaCodigos[];
}

// ---------------------------------------------------------------------------
// MEO FIBRA — Folha D2D 2026-JULHO-14
// ---------------------------------------------------------------------------
export const meoFibra: FolhaCodigos = {
  id: "meo-fibra",
  produto: "MEO Fibra",
  atualizadoEm: "2026-07-14",
  tabelas: [
    {
      id: "m4e-gb-fixo",
      titulo: "M4e — 1000 200GB / 1000 Ilimitado",
      colunas: [
        "1C · 1000 200GB",
        "1C · 1000 200GB Desporto",
        "1C · 1000 Ilimitado",
        "1C · 1000 Ilimitado Desporto",
        "2C · 1000 Ilimitado",
        "2C · 1000 Ilimitado Desporto",
        "3C · 1000 Ilimitado",
        "3C · 1000 Ilimitado Desporto",
      ],
      linhas: [
        {
          cenario: "Nova instalação sem portabilidade Voz Fixa",
          valores: ["1196674", "1383949", "586175", "1384052", "1116874", "1384081", "1447593", "1445981"],
        },
        {
          cenario: "Nova instalação com portabilidade Voz Fixa",
          valores: ["1196462", "1384189", "588983", "1384208", "1116783", "1384256", "1447644", "1445932"],
        },
        {
          cenario: "Migração de Net+Voz Fibra — acresce TV",
          valores: ["1196316", "1382157", "1044522", "1382180", "1110934", "1382207", "1448094", "1446601"],
        },
        {
          cenario: "Upgrade de atual M3e/M2e/M1e · Alteração de atual M4e",
          valores: ["1200274", "1382301", "1200288", "1382320", "1200297", "1382401", "1447256", "1446588"],
        },
        {
          cenario: "Acréscimo de cartões a atual cliente M4e nesse pacote",
          valores: [null, null, null, null, "520628", null, "520628", null],
          nota: "Colunas 1 Cartão: usar código de alteração de pacote para M4e 2 Cartões",
        },
      ],
    },
    {
      id: "m4e-gb-variavel",
      titulo: "M4e — 2GB / 10GB Ilimitado",
      colunas: [
        "1C · 2GB Ilimitado",
        "1C · 10GB Ilimitado",
        "2C · 2GB Ilimitado",
        "2C · 2GB Ilimitado Desporto",
        "2C · 10GB Ilimitado",
        "2C · 10GB Ilimitado Desporto",
        "3C · 2GB Ilimitado",
        "3C · 2GB Ilimitado Desporto",
        "3C · 10GB Ilimitado",
        "3C · 10GB Ilimitado Desporto",
      ],
      linhas: [
        {
          cenario: "Nova instalação sem portabilidade Voz Fixa",
          valores: ["1377014", "1090167", "1376812", "1384109", "1186625", "1384094", "1446620", "1446008", "1447240", "1446013"],
        },
        {
          cenario: "Nova instalação com portabilidade Voz Fixa",
          valores: ["1376995", "1090169", "1376824", "1384293", "1186616", "1384281", "1446623", "1445910", "1447285", "1445924"],
        },
        {
          cenario: "Migração de Net+Voz Fibra — acresce TV",
          valores: ["1376147", "1307728", "1376442", "1382239", "1307430", "1382234", "1447234", "1446597", "1447223", "1446572"],
        },
        {
          cenario: "Upgrade de atual M3e/M2e/M1e · Alteração de atual M4e",
          valores: ["1376417", "1307446", "1376418", "1382462", "1307447", "1382411", "1447174", "1446509", "1447187", "1446561"],
        },
        {
          cenario: "Acréscimo de cartões a atual cliente M4e nesse pacote",
          valores: [null, null, "1376882", null, "1186578", null, "1376882", null, "1186578", null],
          nota: "Colunas 1 Cartão: usar código de alteração de pacote para M4e 2 Cartões",
        },
      ],
    },
    {
      id: "m3e",
      titulo: "M3e",
      colunas: ["1000", "1000 Desporto", "2GB", "2GB Desporto", "10GB", "10GB Desporto"],
      linhas: [
        { cenario: "Nova instalação sem portabilidade Voz Fixa", valores: ["1182926", "1384040", "1375954", "1384062", "1090220", "1383914"] },
        { cenario: "Nova instalação com portabilidade Voz Fixa", valores: ["590105", "1384162", "1375937", "1384253", "1090223", "1384154"] },
        { cenario: "Migração de Net+Voz Fibra — acresce TV", valores: ["1044031", "1382152", "1375895", "1382141", "AGUARDA", "1382133"] },
        { cenario: "Upgrade de TV Fibra M1e/M2e", valores: ["1200149", "1382270", "1375930", "1382293", "1097968", "1382283"] },
      ],
    },
    {
      id: "m2e-m1e",
      titulo: "M2e / M1e",
      colunas: [
        "M2e · 1000 200GB",
        "M2e · 1000 500GB",
        "M2e · 1000 Ilimitado",
        "M2e · 2GB",
        "M2e · 10GB",
        "M2e · 2ª Casa TV s/box+NET",
        "M1e · TV",
        "M1e · NET 1000",
        "M1e · 2GB",
      ],
      linhas: [
        {
          cenario: "Nova instalação sem portabilidade Voz Fixa",
          valores: ["1300825", "1300833", "1300840", "1377167", "1377207", "593743", "593921", "593891", "1377096"],
        },
        {
          cenario: "Upgrade de TV Fibra M1e/M2e",
          valores: ["1300723", "1300755", "1300767", "1377145", "1377119", null, null, null, null],
        },
        {
          cenario: "Acréscimo de cartões a atual cliente M2e",
          valores: ["1300720", "1300733", "1300712", null, null, null, null, null, null],
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// MEO SATÉLITE — Folha D2D 2026-ABRIL-20
// ---------------------------------------------------------------------------
export const meoSatelite: FolhaCodigos = {
  id: "meo-satelite",
  produto: "MEO Satélite",
  atualizadoEm: "2026-04-20",
  tabelas: [
    {
      id: "m4e",
      titulo: "M4e Ilimitado / M4e — Instalação com OT",
      colunas: [
        "M4e Ilim · 1C · Sem Port.",
        "M4e Ilim · 1C · Com Port.",
        "M4e Ilim · 2C · Sem Port.",
        "M4e Ilim · 2C · Com Port.",
        "M4e · 1C · 200GB · Sem Port.",
        "M4e · 1C · 200GB · Com Port.",
      ],
      linhas: [
        { cenario: "Novo cliente sem serviços", valores: ["523897", "9523897", "1118309", "91118309", "1192062", "91192062"] },
        { cenario: 'Já cliente Voz vai acrescentar TV+NET', valores: ["1141193", null, "1141196", null, "1192107", null] },
        { cenario: 'Já cliente Net vai acrescentar TV+Voz', valores: ["1141194", "91141194", "1141197", "91141197", "1192108", "91192108"] },
        { cenario: 'Já cliente Net+Voz "Total" vai acrescentar TV', valores: ["1141191", null, "1141204", null, "1192109", null] },
        { cenario: 'Já cliente Net+Voz "Noites" vai acrescentar TV', valores: ["1141192", null, "1141195", null, "1192110", null] },
        { cenario: "Já cliente Satélite TV = Nº canais", valores: ["1137790", "91137790", "1137800", "91137800", "1192111", "91192111"] },
        { cenario: "Já cliente Satélite TV ≠ Nº canais", valores: ["523890", "9523890", "AGUARDA", "AGUARDA", "AGUARDA", "AGUARDA"] },
        {
          cenario: "Acréscimo de cartões a já cliente M4e = características",
          valores: [null, null, "520628", "520628", null, null],
          nota: 'Colunas M4e (1 cartão): alterar já cliente SAT para pacote com M4e 2 Cartões',
        },
      ],
    },
    {
      id: "m3e-m2e-m1e",
      titulo: "M3e / M2e / M1e — Instalação com OT",
      colunas: [
        "M3e TV90 · Sem Port.",
        "M3e TV90 · Com Port.",
        "M2e TV110 2ª Casa TV+NET",
        "M1e TV20 · Aluguer",
        "M1e TV20 · Compra",
        "M1e TV90 · Aluguer",
        "M1e TV90 · Compra",
        "M1e TV110 2ª Casa · Aluguer",
        "M1e TV110 2ª Casa · Compra",
      ],
      linhas: [
        {
          cenario: "Novo cliente sem serviços",
          valores: ["379139", "9379139", "379339", "206381", "206380", "181550", "181549", "191407", "191439"],
        },
        { cenario: "Já cliente Voz vai acrescentar TV+NET", valores: ["622302", null, null, null, null, null, null, null, null] },
        { cenario: "Já cliente Net vai acrescentar TV+Voz", valores: ["622304", "9622304", "622297", null, null, null, null, null, null] },
        { cenario: "Já cliente Voz vai acrescentar NET", valores: [null, null, null, null, null, null, null, null, null] },
        { cenario: 'Já cliente Net+Voz "Total" vai acrescentar TV', valores: ["622305", null, "622297", null, null, null, null, null, null] },
        { cenario: 'Já cliente Net+Voz "Noites" vai acrescentar TV', valores: ["622303", null, null, null, null, null, null, null, null] },
        { cenario: "Já cliente Satélite TV = Nº canais", valores: [null, null, null, null, null, null, null, null, null] },
        { cenario: "Já cliente Satélite TV ≠ Nº canais", valores: ["375863", "9375863", "381595", null, null, null, null, null, null] },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// MEO ENERGIA — Folha D2D 2025-08-MAIO (4 páginas)
// Cada tabela = uma forma de pagamento; colunas = tarifa fixa/variável ×
// residencial (Simples/Bi/Tri) × empresarial (Simples/Bi/Tri)
// ---------------------------------------------------------------------------
const colunasEnergia = [
  "Residencial · Simples",
  "Residencial · Bi-horário",
  "Residencial · Tri-horário",
  "Empresarial · Simples",
  "Empresarial · Bi-horário",
  "Empresarial · Tri-horário",
];

export const meoEnergia: FolhaCodigos = {
  id: "meo-energia",
  produto: "MEO Energia",
  atualizadoEm: "2025-05-08",
  tabelas: [
    {
      id: "dd-fe-fixa",
      titulo: "Adesão com Débito Direto + Fatura Eletrónica — Tarifa Fixa",
      colunas: colunasEnergia,
      linhas: [
        { cenario: "Nova adesão MEO TV/Fibra M4 (registo com TV) — duplica Net Fixa + Net Móvel", valores: ["1156650", "1156409", "1156830", "1157140", "1157121", "1157123"] },
        { cenario: "Nova adesão MEO TV/Fibra M3 (registo com TV) — duplica Net Fixa", valores: ["1156590", "1156380", "1156787", "1157139", "1157151", "1157124"] },
        { cenario: "Nova adesão MEO TV ADSL/Satélite M4 — duplica Net Móvel", valores: ["1156694", "1156492", "1156912", "699297", "699295", "699299"] },
        { cenario: "Nova adesão MEO TV ADSL/Satélite M2 ou M1", valores: ["1156530", "1156323", "1156734", "1157106", "1157108", "1157091"] },
        { cenario: "Registo isolado — atual cliente TV ADSL/Satélite com pacote convergente (M4/MXO) — duplica Net Móvel", valores: ["1156582", "1156343", "1156772", "AGUARDA", "AGUARDA", "AGUARDA"] },
        { cenario: "Registo isolado — atual cliente TV ADSL/Satélite sem pacote convergente", valores: ["1156530", "1156323", "1156734", "1157106", "1157108", "1157091"] },
      ],
    },
    {
      id: "dd-fp-fixa",
      titulo: "Adesão com Débito Direto + Fatura em Papel — Tarifa Fixa",
      colunas: colunasEnergia,
      linhas: [
        { cenario: "Nova adesão MEO TV/Fibra M4 — duplica Net Fixa + Net Móvel", valores: ["1156631", "1156418", "1156865", "1157038", "1157021", "1157026"] },
        { cenario: "Nova adesão MEO TV/Fibra M3 — duplica Net Fixa", valores: ["1156605", "1156390", "1156809", "1157036", "1157041", "1157027"] },
        { cenario: "Nova adesão MEO TV Fibra M2/M1 (sem benefício)", valores: ["1156568", "1156362", "1156761", "1157037", "1157032", "1157023"] },
        { cenario: "Nova adesão MEO TV ADSL/Satélite M4 — duplica Net Móvel", valores: ["1156561", "1156352", "1156782", "1157033", "1157039", "1157024"] },
        { cenario: "Nova adesão MEO TV ADSL/Satélite M2 ou M1 (sem benefício)", valores: ["1156568", "1156362", "1156761", "1157037", "1157032", "1157023"] },
        { cenario: "Registo isolado — atual cliente TV ADSL/Satélite com M4/MXO — duplica Net Móvel", valores: ["1156561", "1156352", "1156782", "1157033", "1157039", "1157024"] },
        { cenario: "Registo isolado — atual cliente TV ADSL/Satélite sem pacote convergente", valores: ["1156568", "1156362", "1156761", "1157037", "1157032", "1157023"] },
      ],
    },
    {
      id: "mb-fp-fixa",
      titulo: "Adesão com Multibanco + Fatura em Papel — Tarifa Fixa",
      colunas: colunasEnergia,
      linhas: [
        { cenario: "Nova adesão MEO TV/Fibra M4 — duplica Net Fixa + Net Móvel", valores: ["1156640", "1156439", "1156850", "1157183", "1157185", "1157186"] },
        { cenario: "Nova adesão MEO TV/Fibra M3 — duplica Net Fixa", valores: ["1156620", "1156400", "1156820", "1157182", "1157184", "1157187"] },
        { cenario: "Nova adesão MEO TV Fibra M2/M1 (sem benefício)", valores: ["1156900", "1156450", "1156869", "1157146", "1157113", "1157114"] },
        { cenario: "Nova adesão MEO TV ADSL/Satélite M4 — duplica Net Móvel", valores: ["1156669", "1156462", "1156882", "1157145", "1157111", "1157115"] },
        { cenario: "Nova adesão MEO TV ADSL/Satélite M2 ou M1 (sem benefício)", valores: ["1156900", "1156450", "1156869", "1157146", "1157113", "1157114"] },
        { cenario: "Registo isolado — atual cliente TV ADSL/Satélite com M4/MXO — duplica Net Móvel", valores: ["1156669", "1156462", "1156882", "1157145", "1157111", "1157115"] },
        { cenario: "Registo isolado — atual cliente TV ADSL/Satélite sem pacote convergente", valores: ["1156900", "1156450", "1156869", "1157146", "1157113", "1157114"] },
      ],
    },
    {
      id: "dd-fe-variavel",
      titulo: "Adesão com Débito Direto + Fatura Eletrónica — Tarifa Variável",
      colunas: colunasEnergia,
      linhas: [
        { cenario: "Nova adesão MEO TV/Fibra M4 — duplica Net Fixa + Net Móvel", valores: ["1138147", "1138166", "1138262", "1138437", "1138436", "1138438"] },
        { cenario: "Nova adesão MEO TV/Fibra M3 — duplica Net Fixa", valores: ["1138154", "1138152", "1138153", "1138437", "1138436", "1138438"] },
        { cenario: "Nova adesão MEO TV/Fibra M2 Net+Voz — duplica Net Fixa", valores: [null, null, null, "1138437", "1138436", "1138438"] },
        { cenario: "Nova adesão MEO TV M2/M1 Fibra/ADSL/Satélite (sem benefício)", valores: ["1138265", "1138258", "1138263", "1138423", "1138421", "1138418"] },
        { cenario: "Nova adesão MEO TV ADSL/Satélite M4 — duplica Net Móvel", valores: ["1138264", "1138266", "1138262", "1138422", "1138420", "1138424"] },
        { cenario: "Registo isolado — atual cliente TV ADSL/Satélite com M4/MXO — duplica Net Móvel", valores: ["1138264", "1138266", "1138262", "1138422", "1138420", "1138424"] },
        { cenario: "Registo isolado — atual cliente TV ADSL/Satélite sem pacote convergente", valores: ["1138265", "1138258", "1138263", "1138423", "1138421", "1138418"] },
      ],
    },
  ],
};

export const folhasCodigos: FolhaCodigos[] = [meoFibra, meoSatelite, meoEnergia];

/** Pesquisa livre por cenário, coluna ou código, em todas as folhas. */
export function pesquisarCodigos(query: string): {
  folha: FolhaCodigos;
  tabela: TabelaCodigos;
  linha: LinhaCodigos;
  colunaIdx: number;
}[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const resultados: { folha: FolhaCodigos; tabela: TabelaCodigos; linha: LinhaCodigos; colunaIdx: number }[] = [];

  for (const folha of folhasCodigos) {
    for (const tabela of folha.tabelas) {
      for (const linha of tabela.linhas) {
        linha.valores.forEach((valor, colunaIdx) => {
          const coluna = tabela.colunas[colunaIdx];
          const alvo = `${linha.cenario} ${coluna} ${valor ?? ""}`.toLowerCase();
          if (alvo.includes(q)) {
            resultados.push({ folha, tabela, linha, colunaIdx });
          }
        });
      }
    }
  }
  return resultados;
        }
