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
  {
    imagem: "/formacao/mypoupar-modo-poupanca-ativado.png",
    etiqueta: "JUNTOS SOMOS +",
    titulo: "Ativa o modo poupança em cada família.",
    texto: "+ TV · + Energia · + Poupança · + Resultados",
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
    <section className="relative mb-8 aspect-[16/9] min-h-[360px] overflow-hidden rounded-2xl bg-slate-950 text-white shadow-xl">
      {SLIDES.map((slide, indice) => (
        <div
          key={slide.titulo}
          className={`absolute inset-0 transition-opacity duration-700 ${indice === atual ? "opacity-100" : "pointer-events-none opacity-0"}`}
          aria-hidden={indice !== atual}
        >
          <Image src={slide.imagem} alt="" fill priority={indice === 0} className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/20" />
          <div className="relative flex h-full max-w-2xl flex-col justify-center p-8 sm:p-12">
            <p className="mb-3 text-xs font-bold tracking-[0.24em] text-amber-400 sm:text-sm">{slide.etiqueta}</p>
            <h2 className="text-2xl font-black leading-tight sm:text-4xl">{slide.titulo}</h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-200 sm:text-lg">{slide.texto}</p>
          </div>
        </div>
      ))}

      <button type="button" onClick={() => mudar(atual - 1)} aria-label="Slide anterior" className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-3 py-2 text-xl hover:bg-black/75">‹</button>
      <button type="button" onClick={() => mudar(atual + 1)} aria-label="Slide seguinte" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-3 py-2 text-xl hover:bg-black/75">›</button>

      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
        {SLIDES.map((slide, indice) => (
          <button key={slide.titulo} type="button" onClick={() => mudar(indice)} aria-label={`Mostrar slide ${indice + 1}`} className={`h-2.5 rounded-full transition-all ${indice === atual ? "w-8 bg-amber-400" : "w-2.5 bg-white/60"}`} />
        ))}
      </div>
    </section>
  );
}
