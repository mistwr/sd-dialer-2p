"use client";

import { ExternalLink, FileSpreadsheet } from "lucide-react";

/**
 * URL do simulador de energia (repo tiagofelicia.github.io rebrandizado para
 * Soluções Diferentes, hospedado na Netlify). Substitui pelo domínio final
 * assim que o rebrand estiver publicado.
 */
const SIMULADOR_URL = "https://simulador.solucoesdiferentes.pt"; // TODO: confirmar URL final
const EXCEL_URL = "/simuladores/Simulador_MEO_Energia_2026_Mobile.xlsx";

/**
 * Cartão para a aba "Formação" (ou dentro da campanha MEO Energia) com:
 *  1. o simulador embebido (iframe) para o cliente ver a poupança em tempo real
 *  2. um resumo das ofertas que DUPLICAM quando o cliente já é MEO
 *     (Duplica Net Fixa / Duplica Net Móvel — retirado das folhas de códigos)
 */
export function SimuladorEnergiaCard() {
  return (
    <div className="min-w-0 space-y-4">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <h3 className="mb-2 text-sm font-semibold text-emerald-800">
          Ofertas que duplicam para clientes MEO
        </h3>
        <ul className="space-y-1 text-sm text-emerald-900">
          <li>
            <strong>Cliente MEO TV/Fibra M4</strong> → adesão à MEO Energia
            duplica dados da <strong>Net Fixa e Net Móvel</strong>.
          </li>
          <li>
            <strong>Cliente MEO TV/Fibra M3</strong> → duplica dados da{" "}
            <strong>Net Fixa</strong>.
          </li>
          <li>
            <strong>Cliente MEO TV ADSL/Satélite M4</strong> → duplica dados
            da <strong>Net Móvel</strong>.
          </li>
        </ul>
        <p className="mt-2 text-xs text-emerald-700">
          Usa isto como argumento de venda: mostra primeiro a poupança na
          fatura de energia no simulador abaixo, depois soma o valor do bónus
          de dados duplicados.
        </p>
      </div>

      <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-emerald-50 p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
            <FileSpreadsheet size={22} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-gray-900">Simulador MEO Energia 2026</h3>
            <p className="mt-1 text-sm leading-relaxed text-gray-600">
              Versão otimizada para telemóvel, com menu por tarifa e cálculos automáticos.
            </p>
          </div>
        </div>
        <a
          href={EXCEL_URL}
          download
          className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
        >
          <FileSpreadsheet size={18} aria-hidden="true" />
          Abrir / Descarregar Excel
        </a>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm max-sm:-mx-3 max-sm:rounded-none max-sm:border-x-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Simulador online</h3>
            <p className="mt-0.5 text-xs text-gray-500">Resultado atualizado em tempo real</p>
          </div>
          <a
            href={SIMULADOR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Ecrã inteiro <ExternalLink size={14} aria-hidden="true" />
          </a>
        </div>
        <div className="relative w-full overflow-hidden bg-white">
          <iframe
            src={SIMULADOR_URL}
            title="Simulador de poupança de energia"
            className="block h-[720px] min-h-[640px] w-full border-0 max-sm:h-[calc(100dvh-9rem)]"
            loading="lazy"
            allow="clipboard-write"
          />
        </div>
      </div>
    </div>
  );
}
