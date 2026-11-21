// Jogo: Tabu do casal — Longe & Perto
(function () {
  let raiz = null;
  let ctxJogo = null;
  let banco = null;
  let cartaSecreta = null;
  let cartaRodada = 0;

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
      .eq("jogo_id", "tabu-do-casal")
      .eq("ativo", true);
    if (error || !Array.isArray(data)) return [];
    banco = data;
    return banco;
  }

  async function sortearEIniciar() {
    const { sb, permitidoOusado } = ctxJogo.dadosSala;
    const p = ctxJogo.partida;
    const est = (p && p.estado) || {};
    const lista = (await carregarBanco(sb)).filter(x => !!permitidoOusado || !x.ousado);
    if (!lista.length) {
      ctxJogo.aviso("Nenhuma carta disponível.");
      return;
    }
    const usadas = Array.isArray(est.usadas) ? est.usadas : [];
    let pool = lista.filter(x => !usadas.includes(x.id));
    if (!pool.length) pool = lista;
    const item = pool[Math.floor(Math.random() * pool.length)];
    const d = item.dados || {};
    const carta = { palavra: d.palavra || "", proibidas: Array.isArray(d.proibidas) ? d.proibidas : [] };
    const rodada = Number(p.rodada || 1);
    const explicador = Number(est.explicador || 0);

    const ok = await ctxJogo.enviarSegredo(rodada, "carta", carta);
    if (!ok) return;

    cartaSecreta = carta;
    cartaRodada = rodada;
    await ctxJogo.salvarEstado({
      fase: "jogando",
      explicador,
      buzina: false,
      resultado: null,
      carta_revelada: null,
      usadas: usadas.concat(item.id).slice(-40)
    });
    await ctxJogo.iniciarCronometro(45, aoZerarTempo);
  }

  async function encerrar(resultado, buzina) {
    const p = ctxJogo.partida;
    const est = p.estado || {};
    if (est.fase !== "jogando") return;
    ctxJogo.pararCronometro();
    const rodada = Number(p.rodada || 1);
    const revs = await ctxJogo.revelarRodada(rodada);
    const item = revs.find(r => r.chave === "carta") || revs[0];
    const carta = (item && item.valor) || cartaSecreta;

    const novoPlacar = { ...(p.placar || {}) };
    if (resultado === "acertou") {
      const k = String(1 - Number(est.explicador || 0));
      novoPlacar[k] = (Number(novoPlacar[k]) || 0) + 1;
    }
    await ctxJogo.salvarEstado(
      {
        fase: "revelado",
        buzina: !!buzina,
        resultado,
        carta_revelada: carta,
        cronometro_fim: 0
      },
      { placar: novoPlacar }
    );
  }

  async function aoZerarTempo() {
    if (!ctxJogo || !ctxJogo.partida) return;
    const { eu } = ctxJogo.dadosSala;
    const est = ctxJogo.partida.estado || {};
    if (est.fase === "jogando" && Number(est.explicador || 0) === eu) {
      await encerrar("tempo", false);
    }
  }

  async function proximaRodada() {
    const p = ctxJogo.partida;
    const est = p.estado || {};
    cartaSecreta = null;
    cartaRodada = 0;
    await ctxJogo.salvarEstado(
      {
        fase: "inicio",
        explicador: 1 - Number(est.explicador || 0),
        buzina: false,
        resultado: null,
        carta_revelada: null,
        cronometro_fim: 0
      },
      { rodada: Number(p.rodada || 1) + 1 }
    );
  }

  async function garantirCarta() {
    if (!ctxJogo || !ctxJogo.partida) return;
    const { eu } = ctxJogo.dadosSala;
    const p = ctxJogo.partida;
    const est = p.estado || {};
    const rodada = Number(p.rodada || 1);
    if (est.fase === "jogando" && Number(est.explicador || 0) === eu && cartaRodada !== rodada) {
      cartaSecreta = await ctxJogo.lerMeuSegredo(rodada, "carta");
      cartaRodada = rodada;
    }
  }

  function render() {
    if (!raiz || !ctxJogo || !ctxJogo.partida) return;
    const p = ctxJogo.partida;
    const est = p.estado || {};
    const { eu, nomes } = ctxJogo.dadosSala;
    const explicador = Number(est.explicador || 0);
    const souExplicador = explicador === eu;
    const fase = est.fase || "inicio";

    raiz.textContent = "";
    const card = el("div", "jogos-subcard");
    card.appendChild(el("p", "jogos-rodada-lbl", `Rodada ${p.rodada || 1} · Quem explica: ${nomes[explicador]}`));

    if (fase === "inicio") {
      if (souExplicador) {
        card.appendChild(el("p", "jogos-sub", "Você tem 45 segundos para explicar a palavra sem usar nenhuma das 4 palavras proibidas."));
        const btn = el("button", "primary", "Iniciar 45s");
        btn.type = "button";
        btn.addEventListener("click", sortearEIniciar);
        card.appendChild(btn);
      } else {
        card.appendChild(el("p", "jogos-sub", `Aguardando ${nomes[explicador]} iniciar a rodada. Fique atento às palavras proibidas!`));
      }
      raiz.appendChild(card);
      return;
    }

    if (fase === "jogando") {
      if (souExplicador) {
        const c = cartaSecreta || { palavra: "...", proibidas: [] };
        const box = el("div", "jogos-tabu-carta");
        box.appendChild(el("p", "jogos-destaque", c.palavra));
        const ul = el("ul", "jogos-tabu-proibidas");
        (c.proibidas || []).forEach(w => ul.appendChild(el("li", "", w)));
        box.appendChild(ul);
        card.appendChild(box);

        const acoes = el("div", "jogos-acoes-linha");
        const bAc = el("button", "primary", "Acertou (+1)");
        bAc.type = "button";
        bAc.addEventListener("click", () => encerrar("acertou", false));
        const bPul = el("button", "secondary", "Pular");
        bPul.type = "button";
        bPul.addEventListener("click", () => encerrar("pulou", false));
        acoes.append(bAc, bPul);
        card.appendChild(acoes);
      } else {
        card.appendChild(el("p", "jogos-sub", `Ouça ${nomes[explicador]} explicar. Se escapar uma palavra proibida, toque na Buzina!`));
        const bBuz = el("button", "jogos-buzina-btn", "Buzina! Palavra proibida");
        bBuz.type = "button";
        bBuz.addEventListener("click", () => encerrar("buzina", true));
        card.appendChild(bBuz);
      }
    } else if (fase === "revelado") {
      const msg = est.buzina
        ? "Palavra proibida detectada! Rodada encerrada sem pontos."
        : est.resultado === "acertou"
          ? "Acertaram a palavra!"
          : est.resultado === "tempo"
            ? "Tempo esgotado."
            : "Carta pulada.";
      card.appendChild(el("p", "jogos-destaque", msg));

      if (est.carta_revelada) {
        const box = el("div", "jogos-tabu-carta");
        box.appendChild(el("p", "jogos-rodada-lbl", `Palavra: ${est.carta_revelada.palavra || ""}`));
        const proibs = est.carta_revelada.proibidas || [];
        if (proibs.length) {
          box.appendChild(el("p", "jogos-sub", `Proibidas: ${proibs.join(", ")}`));
        }
        card.appendChild(box);
      }

      const bProx = el("button", "primary", "Próxima rodada");
      bProx.type = "button";
      bProx.addEventListener("click", proximaRodada);
      card.appendChild(bProx);
    }

    raiz.appendChild(card);
  }

  window.JogosHub.registrar("tabu-do-casal", {
    async montar(container, ctx) {
      raiz = container;
      ctxJogo = ctx;
      cartaSecreta = null;
      cartaRodada = 0;
      await garantirCarta();
      render();
    },
    async aoAtualizar() {
      await garantirCarta();
      render();
    },
    desmontar() {
      raiz = null;
      ctxJogo = null;
    }
  });
})();
