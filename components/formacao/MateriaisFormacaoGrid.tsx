"use client";

import { useState } from "react";
import Image from "next/image";
import { materiaisFormacao, type MaterialFormacao } from "@/lib/data/materiais-formacao";

function GuiaoCard({ material }: { material: MaterialFormacao }) {
  const [aberto, setAberto] = useState(false);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200">
      <div className="grid gap-4 p-4 sm:grid-cols-[160px_1fr]">
        <div className="relative h-40 w-full overflow-hidden rounded-lg bg-gray-900 sm:h-full">
          <Image src={material.imagem} alt={material.titulo} fill className="object-cover" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-indigo-500">
            {material.tipo === "guiao" ? "Guião" : "Post"}
          </p>
          <h3 className="text-base font-bold text-gray-900">{material.titulo}</h3>
          {material.subtitulo && <p className="text-sm text-gray-500">{material.subtitulo}</p>}

          {material.notas && (
            <ul className="mt-2 space-y-1 text-sm text-gray-600">
              {material.notas.map((n, i) => (
                <li key={i}>• {n}</li>
              ))}
            </ul>
          )}

          {material.passos && (
            <button
              onClick={() => setAberto((v) => !v)}
              className="mt-3 text-sm font-medium text-indigo-600 hover:underline"
            >
              {aberto ? "Esconder guião passo a passo" : "Ver guião passo a passo"}
            </button>
          )}
        </div>
      </div>

      {material.passos && aberto && (
        <div className="space-y-3 border-t border-gray-100 bg-gray-50 p-4">
          {material.passos.map((p) => (
            <div key={p.numero} className="flex gap-3 text-sm">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                {p.numero}
              </span>
              <div>
                <p className="font-semibold text-gray-800">{p.titulo}</p>
                <p className="text-gray-600">{p.texto}</p>
              </div>
            </div>
          ))}
          {material.destaque && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
              {material.destaque}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Galeria de materiais de formação (guiões + posts), imagem + texto pesquisável. */
export function MateriaisFormacaoGrid() {
  return (
    <div className="space-y-4">
      {materiaisFormacao
        .filter((m) => m.id !== "post-bom-arranque")
        .map((m) => (
        <GuiaoCard key={m.id} material={m} />
      ))}
    </div>
  );
}
