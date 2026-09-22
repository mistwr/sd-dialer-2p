"use client";

import { useEffect, useState } from "react";

const SLIDES = [
  {
    imagem: "/formacao/mypoupar-marketing-casa-energia.svg",
    etiqueta: "MYPOUPAR · MEO + ENERGIA",
    titulo: "Mais poupança para o cliente. Mais resultados para a equipa.",
    texto: "Compara telecomunicações e energia numa só conversa e transforma cada contacto em duas oportunidades.",
  },
  {
    imagem: "/formacao/mypoupar-guiao-pronto-a-usar.svg",
    etiqueta: "GUIÃO COMERCIAL",
    titulo: "Pergunta. Compara. Mostra a poupança. Fecha.",
    texto: "Segue o método MyPoupar e regista sempre o próximo passo no SD Dialer.",
  },
  {
    imagem: "/formacao/mypoupar-elite-meo-novo-script.svg",
    etiqueta: "MODO PRODUÇÃO",
    titulo: "Cada lead bem acompanhada pode valer MEO + Energia.",
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

  const mudar = (indice: number) =>
    setAtual((indice + SLIDES.length) % SLIDES.length);

  const slide = SLIDES[atual];

  return (
    <section className="relative mb-8 overflow-hidden rounded-2xl bg-slate-950 text-white shadow-xl">
      <div className="flex flex-col sm:grid sm:grid-cols-[1fr_46%]">
        <div className="order-1 flex w-full items-center justify-center bg-black sm:order-2">
          <img
            key={slide.imagem}
            src={slide.imagem}
            alt={slide.titulo}
            className="block h-auto w-full max-w-full sm:max-h-[620px] sm:w-auto"
          />
        </div>

        <div className="order-2 flex flex-col justify-center px-6 pb-16 pt-7 sm:order-1 sm:min-h-[460px] sm:px-10 sm:py-12">
          <p className="mb-3 text-xs font-bold tracking-[0.2em] text-amber-400 sm:text-sm">
            {slide.etiqueta}
          </p>

          <h2 className="text-2xl font-black leading-tight sm:text-3xl">
            {slide.titulo}
          </h2>

          <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-200 sm:text-base">
            {slide.texto}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => mudar(atual - 1)}
        aria-label="Slide anterior"
        className="absolute left-3 top-[28%] z-10 -translate-y-1/2 rounded-full bg-black/70 px-3 py-2 text-xl hover:bg-black sm:top-1/2"
      >
        ‹
      </button>

      <button
        type="button"
        onClick={() => mudar(atual + 1)}
        aria-label="Slide seguinte"
        className="absolute right-3 top-[28%] z-10 -translate-y-1/2 rounded-full bg-black/70 px-3 py-2 text-xl hover:bg-black sm:top-1/2"
      >
        ›
      </button>

      <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2">
        {SLIDES.map((item, indice) => (
          <button
            key={item.titulo}
            type="button"
            onClick={() => mudar(indice)}
            aria-label={`Mostrar slide ${indice + 1}`}
            className={`h-2.5 rounded-full transition-all ${
              indice === atual ? "w-8 bg-amber-400" : "w-2.5 bg-white/60"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
