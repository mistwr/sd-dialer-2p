"use client";

/**
 * URL do simulador de energia (repo tiagofelicia.github.io rebrandizado para
 * Soluções Diferentes, hospedado na Netlify). Substitui pelo domínio final
 * assim que o rebrand estiver publicado.
 */
const SIMULADOR_URL = "https://simulador.solucoesdiferentes.pt"; // TODO: confirmar URL final

/**
 * Cartão para a aba "Formação" (ou dentro da campanha MEO Energia) com:
 *  1. o simulador embebido (iframe) para o cliente ver a poupança em tempo real
 *  2. um resumo das ofertas que DUPLICAM quando o cliente já é MEO
 *     (Duplica Net Fixa / Duplica Net Móvel — retirado das folhas de códigos)
 */
export function SimuladorEnergiaCard() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
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

      <div className="overflow-hidden rounded-xl border border-gray-200">
        <div className="bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-800">
          Simulador de poupança — em tempo real
        </div>
        <iframe
          src={SIMULADOR_URL}
          title="Simulador de poupança de energia"
          className="h-[720px] w-full border-0"
          loading="lazy"
        />
      </div>
    </div>
  );
}
