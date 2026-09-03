"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const SLIDES = [
  {
    imagem: "/formacao/mypoupar-marketing-casa-energia.png",
    etiqueta: "MYPOUPAR · MEO + ENERGIA",
    titulo: "Mais poupança para o cliente. Mais resultados para a equipa.",
    texto: "Compara telecomunicações e energia numa só conversa e transforma cada contacto em duas oportunidades.",
  },
  {
    imagem: "/formacao/mypoupar-guiao-pronto-a-usar.png",
    etiqueta: "GUIÃO COMERCIAL",
    titulo: "Pergunta. Compara. Mostra a poupança. Fecha.",
    texto: "Segue o método MyPoupar e regista sempre o próximo passo no SD Dialer.",
  },
  {
    imagem: "/formacao/mypoupar-elite-meo-novo-script.png",
    etiqueta: "MODO PRODUÇÃO",
    titulo: "Cada lead bem acompanhado pode valer MEO + Energia.",
    texto: "Organização, acompanhamento e ação: a fórmula para vender mais e receber melhor.",
  },
];

export function MarketingSlideshow() {
  const [atual, setAtual] = useState(0);

  useEffect(() => {
    const temporizador = window.setInterval(
      () => setAtual((indice) => (indice + 1) % SLIDES.length),
      6000,
    );
    return () => window.clearInterval(temporizador);
  }, []);

  const mudar = (indice: number) => setAtual((indice + SLIDES.length) % SLIDES.length);

  return (
    <section className="relative mb-8 min-h-[560px] overflow-hidden rounded-2xl bg-slate-950 text-white shadow-xl sm:min-h-[460px]">
      {SLIDES.map((slide, indice) => (
        <div
          key={slide.titulo}
          className={`absolute inset-0 flex flex-col transition-opacity duration-700 sm:flex-row ${indice === atual ? "opacity-100" : "pointer-events-none opacity-0"}`}
          aria-hidden={indice !== atual}
        >
          <div className="relative h-[285px] w-full shrink-0 bg-black sm:h-full sm:w-[46%] sm:order-2">
            <Image
              src={slide.imagem}
              alt={slide.titulo}
              fill
              priority={indice === 0}
              unoptimized
              sizes="(max-width: 640px) 100vw, 46vw"
              className="object-contain"
            />
          </div>
          <div className="relative flex min-h-0 flex-1 flex-col justify-center px-6 pb-14 pt-7 sm:px-10 sm:py-12">
            <p className="mb-3 text-xs font-bold tracking-[0.2em] text-amber-400 sm:text-sm">{slide.etiqueta}</p>
            <h2 className="text-2xl font-black leading-tight sm:text-3xl">{slide.titulo}</h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-200 sm:text-base">{slide.texto}</p>
          </div>
        </div>
      ))}

      <button type="button" onClick={() => mudar(atual - 1)} aria-label="Slide anterior" className="absolute left-3 top-[142px] -translate-y-1/2 rounded-full bg-black/70 px-3 py-2 text-xl hover:bg-black sm:top-1/2">‹</button>
      <button type="button" onClick={() => mudar(atual + 1)} aria-label="Slide seguinte" className="absolute right-3 top-[142px] -translate-y-1/2 rounded-full bg-black/70 px-3 py-2 text-xl hover:bg-black sm:top-1/2">›</button>

      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
        {SLIDES.map((slide, indice) => (
          <button key={slide.titulo} type="button" onClick={() => mudar(indice)} aria-label={`Mostrar slide ${indice + 1}`} className={`h-2.5 rounded-full transition-all ${indice === atual ? "w-8 bg-amber-400" : "w-2.5 bg-white/60"}`} />
        ))}
      </div>
    </section>
  );
}
