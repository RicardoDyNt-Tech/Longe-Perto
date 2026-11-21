// Jogo: Leitura labial — Longe & Perto
(function () {
  const CLIMAS = [
    ["todos", "Todos"],
    ["leve", "Leve"],
    ["absurdo", "Absurdo"],
    ["romantico", "Romântico"],
    ["ousado", "Ousado"]
  ];

  let raiz = null;
  let ctxJogo = null;
  let banco = null;
  let clima = "todos";
  let segredoFrase = null;
  let segredoRodada = 0;

  function el(tag, cls, txt) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt !== undefined && txt !== null) n.textContent = txt;
    return n;
  }

  async function carregarBanco(sb) {
    if (banco) return banco;
    const { data, error } = await sb
      .from("jogos_conteudo")
      .select("id, categoria, ousado, dados")
      .eq("jogo_id", "leitura-labial")
      .eq("ativo", true);
    if (error || !Array.isArray(data)) return [];
    banco = data;
    return banco;
  }

  async function sortearFrase() {
    const { sb, permitidoOusado } = ctxJogo.dadosSala;
    const p = ctxJogo.partida;
    const est = (p && p.estado) || {};
    const lista = await carregarBanco(sb);
    const podeOusado = !!permitidoOusado;
    if (clima === "ousado" && !podeOusado) clima = "todos";

    let pool = lista.filter(item => podeOusado || !item.ousado);
    if (clima !== "todos") {
      pool = pool.filter(item => item.categoria === clima);
    }
    const usadas = Array.isArray(est.usadas) ? est.usadas : [];
    let naoUsadas = pool.filter(item => !usadas.includes(item.id));
    if (!naoUsadas.length) naoUsadas = pool;
    if (!naoUsadas.length) {
      ctxJogo.aviso("Nenhuma frase disponível para esse clima.");
      return;
    }

    const item = naoUsadas[Math.floor(Math.random() * naoUsadas.length)];
    const frase = (item.dados && item.dados.frase) || "";
    const rodada = Number(p.rodada || 1);
    const vez = Number(est.vez || 0);

    const ok = await ctxJogo.enviarSegredo(rodada, "frase", { frase, categoria: item.categoria });
    if (!ok) return;

    segredoFrase = frase;
    segredoRodada = rodada;
    await ctxJogo.salvarEstado({
      fase: "pronto_45",
      vez,
      clima,
      categoria: item.categoria,
      frase_revelada: null,
      pontos_rodada: null,
      cronometro_fim: 0,
      usadas: usadas.concat(item.id).slice(-40)
    });
  }

  async function iniciar45s() {
    await ctxJogo.salvarEstado({ fase: "falando" });
    await ctxJogo.iniciarCronometro(45);
  }

  async function encerrarRodada(pontos) {
    const p = ctxJogo.partida;
    const est = p.estado || {};
    const rodada = Number(p.rodada || 1);
    ctxJogo.pararCronometro();
    const revs = await ctxJogo.revelarRodada(rodada);
    const item = revs.find(r => r.chave === "frase") || revs[0];
    const frase = (item && item.valor && item.valor.frase) || segredoFrase || "";

    const novoPlacar = { ...(p.placar || {}) };
    if (pontos > 0) {
      const adv = String(1 - Number(est.vez || 0));
      novoPlacar[adv] = (Number(novoPlacar[adv]) || 0) + Number(pontos);
    }
    await ctxJogo.salvarEstado(
      {
        fase: "revelado",
        frase_revelada: frase,
        pontos_rodada: Number(pontos),
        cronometro_fim: 0
      },
      { placar: novoPlacar }
    );
  }

  async function proximaRodada() {
    const p = ctxJogo.partida;
    const est = p.estado || {};
    segredoFrase = null;
    await ctxJogo.salvarEstado(
      {
        fase: "escolha",
        vez: 1 - Number(est.vez || 0),
        frase_revelada: null,
        pontos_rodada: null,
        cronometro_fim: 0
      },
      { rodada: Number(p.rodada || 1) + 1 }
    );
  }

  async function garantirFrase() {
    if (!ctxJogo || !ctxJogo.partida) return;
    const { eu } = ctxJogo.dadosSala;
    const p = ctxJogo.partida;
    const est = p.estado || {};
    const rodada = Number(p.rodada || 1);
    if ((est.fase === "pronto_45" || est.fase === "falando") && Number(est.vez || 0) === eu && segredoRodada !== rodada) {
      const val = await ctxJogo.lerMeuSegredo(rodada, "frase");
      segredoFrase = val && val.frase ? val.frase : null;
      segredoRodada = rodada;
    }
  }

  function render() {
    if (!raiz || !ctxJogo || !ctxJogo.partida) return;
    const p = ctxJogo.partida;
    const est = p.estado || {};
    const { eu, nomes, permitidoOusado } = ctxJogo.dadosSala;
    const vez = Number(est.vez || 0);
    const minhaVez = vez === eu;
    const fase = est.fase || "escolha";

    raiz.textContent = "";

    const card = el("div", "jogos-subcard");
    card.appendChild(el("p", "jogos-rodada-lbl", `Rodada ${p.rodada || 1} · Quem articula: ${nomes[vez]}`));

    if (fase === "escolha") {
      const chips = el("div", "jogos-filtros");
      CLIMAS.filter(([v]) => v !== "ousado" || !!permitidoOusado).forEach(([v, rot]) => {
        const b = el("button", "jogos-chip", rot);
        b.type = "button";
        b.setAttribute("aria-pressed", clima === v ? "true" : "false");
        b.addEventListener("click", () => { clima = v; render(); });
        chips.appendChild(b);
      });
      card.appendChild(chips);

      if (minhaVez) {
        card.appendChild(el("p", "jogos-sub", "Desligue o microfone no WhatsApp antes de começar."));
        const btn = el("button", "primary", "Sortear frase");
        btn.type = "button";
        btn.addEventListener("click", sortearFrase);
        card.appendChild(btn);
      } else {
        card.appendChild(el("p", "jogos-sub", `Aguardando ${nomes[vez]} escolher o clima e sortear a frase.`));
      }
      raiz.appendChild(card);
      return;
    }

    if (fase === "pronto_45" || fase === "falando") {
      if (minhaVez) {
        card.appendChild(el("p", "jogos-sub", "Desligue o microfone no WhatsApp e articule devagar olhando para a câmera:"));
        card.appendChild(el("p", "jogos-destaque", segredoFrase || "..."));
        if (fase === "pronto_45") {
          const btn45 = el("button", "primary", "Iniciar 45s");
          btn45.type = "button";
          btn45.addEventListener("click", iniciar45s);
          card.appendChild(btn45);
        } else {
          const acoes = el("div", "jogos-acoes-linha");
          [
            [2, "De primeira (+2)"],
            [1, "Quase (+1)"],
            [0, "Passou longe (0)"]
          ].forEach(([pts, rot]) => {
            const b = el("button", pts > 0 ? "primary" : "secondary", rot);
            b.type = "button";
            b.addEventListener("click", () => encerrarRodada(pts));
            acoes.appendChild(b);
          });
          card.appendChild(acoes);
        }
      } else {
        card.appendChild(el("p", "jogos-sub", fase === "pronto_45"
          ? `${nomes[vez]} está pronto para começar. Observe os lábios na chamada.`
          : `Valendo! Tente decifrar o que ${nomes[vez]} está falando sem som.`));
      }
      raiz.appendChild(card);
      return;
    }

    if (fase === "revelado") {
      card.appendChild(el("p", "jogos-destaque", est.frase_revelada || ""));
      card.appendChild(el("p", "jogos-sub", `Pontuação da rodada: +${est.pontos_rodada || 0}`));
      const btnProx = el("button", "primary", "Próxima rodada");
      btnProx.type = "button";
      btnProx.addEventListener("click", proximaRodada);
      card.appendChild(btnProx);
      raiz.appendChild(card);
    }
  }

  window.JogosHub.registrar("leitura-labial", {
    async montar(container, ctx) {
      raiz = container;
      ctxJogo = ctx;
      segredoFrase = null;
      segredoRodada = 0;
      await garantirFrase();
      render();
    },
    async aoAtualizar() {
      await garantirFrase();
      render();
    },
    desmontar() {
      raiz = null;
      ctxJogo = null;
    }
  });
})();
