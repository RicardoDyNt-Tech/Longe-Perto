// Jogo: Cena de improviso — Longe & Perto
(function () {
  let raiz = null;
  let ctxJogo = null;
  let banco = null;
  let meuObjetivo = null;
  let meuObjRodada = 0;
  let mostrarObjetivo = false;
  let revelados = [];
  let revRodada = 0;

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
      .select("id, categoria, dados")
      .eq("jogo_id", "cena-de-improviso")
      .eq("ativo", true);
    if (error || !Array.isArray(data)) return [];
    banco = data;
    return banco;
  }

  async function iniciarCena() {
    const { sb } = ctxJogo.dadosSala;
    const p = ctxJogo.partida;
    const est = (p && p.estado) || {};
    const lista = await carregarBanco(sb);
    const cenarios = lista.filter(x => x.categoria === "cenario");
    if (!cenarios.length) {
      ctxJogo.aviso("Nenhum cenário cadastrado.");
      return;
    }
    const usados = Array.isArray(est.usados) ? est.usados : [];
    let pool = cenarios.filter(x => !usados.includes(x.id));
    if (!pool.length) pool = cenarios;
    const item = pool[Math.floor(Math.random() * pool.length)];
    const d = item.dados || {};

    meuObjetivo = null;
    meuObjRodada = 0;
    mostrarObjetivo = false;
    revelados = [];
    revRodada = 0;

    await ctxJogo.salvarEstado({
      fase: "preparando",
      cenario: { titulo: d.titulo || "Cena", contexto: d.contexto || "" },
      pronto_0: false,
      pronto_1: false,
      avaliou_0: false,
      avaliou_1: false,
      cronometro_fim: 0,
      usados: usados.concat(item.id).slice(-25)
    });
  }

  async function garantirMeuObjetivo() {
    if (!ctxJogo || !ctxJogo.partida) return;
    const { sb } = ctxJogo.dadosSala;
    const p = ctxJogo.partida;
    const est = p.estado || {};
    const rodada = Number(p.rodada || 1);
    if ((est.fase === "preparando" || est.fase === "atuando") && meuObjRodada !== rodada) {
      let salvo = await ctxJogo.lerMeuSegredo(rodada, "objetivo");
      if (!salvo) {
        const lista = await carregarBanco(sb);
        const objetivos = lista.filter(x => x.categoria === "objetivo");
        if (objetivos.length) {
          const item = objetivos[Math.floor(Math.random() * objetivos.length)];
          const objTexto = (item.dados && item.dados.objetivo) || "";
          await ctxJogo.enviarSegredo(rodada, "objetivo", { objetivo: objTexto });
          salvo = { objetivo: objTexto };
        }
      }
      meuObjetivo = salvo && salvo.objetivo ? salvo.objetivo : null;
      meuObjRodada = rodada;
    }
  }

  async function confirmarPronto() {
    const { eu } = ctxJogo.dadosSala;
    const est = (ctxJogo.partida && ctxJogo.partida.estado) || {};
    const patch = { [`pronto_${eu}`]: true };
    const outroPronto = !!est[`pronto_${1 - eu}`];
    if (outroPronto) {
      patch.fase = "atuando";
      await ctxJogo.salvarEstado(patch);
      await ctxJogo.iniciarCronometro(60, aoZerarTempo);
    } else {
      await ctxJogo.salvarEstado(patch);
    }
  }

  async function aoZerarTempo() {
    if (!ctxJogo || !ctxJogo.partida) return;
    const est = ctxJogo.partida.estado || {};
    if (est.fase === "atuando") {
      await encerrarCena();
    }
  }

  async function encerrarCena() {
    const p = ctxJogo.partida;
    const est = p.estado || {};
    if (est.fase !== "atuando") return;
    ctxJogo.pararCronometro();
    const rodada = Number(p.rodada || 1);
    revelados = await ctxJogo.revelarRodada(rodada);
    revRodada = rodada;
    await ctxJogo.salvarEstado({ fase: "revelado", cronometro_fim: 0 });
  }

  async function avaliarOutro(pts) {
    const { eu } = ctxJogo.dadosSala;
    const p = ctxJogo.partida;
    const est = p.estado || {};
    if (est[`avaliou_${eu}`]) return;
    const novoPlacar = { ...(p.placar || {}) };
    const outro = String(1 - eu);
    novoPlacar[outro] = (Number(novoPlacar[outro]) || 0) + Number(pts);
    await ctxJogo.salvarEstado({ [`avaliou_${eu}`]: true }, { placar: novoPlacar });
  }

  async function proximaCena() {
    const p = ctxJogo.partida;
    meuObjetivo = null;
    meuObjRodada = 0;
    mostrarObjetivo = false;
    revelados = [];
    revRodada = 0;
    await ctxJogo.salvarEstado(
      { fase: "inicio", cenario: null, pronto_0: false, pronto_1: false, avaliou_0: false, avaliou_1: false, cronometro_fim: 0 },
      { rodada: Number(p.rodada || 1) + 1 }
    );
  }

  async function sincronizar() {
    if (!ctxJogo || !ctxJogo.partida) return;
    const p = ctxJogo.partida;
    const est = p.estado || {};
    const rodada = Number(p.rodada || 1);
    await garantirMeuObjetivo();
    if (est.fase === "revelado" && revRodada !== rodada) {
      revelados = await ctxJogo.revelarRodada(rodada);
      revRodada = rodada;
    }
    render();
  }

  function render() {
    if (!raiz || !ctxJogo || !ctxJogo.partida) return;
    const p = ctxJogo.partida;
    const est = p.estado || {};
    const { eu, nomes } = ctxJogo.dadosSala;
    const fase = est.fase || "inicio";

    raiz.textContent = "";
    const card = el("div", "jogos-subcard");
    card.appendChild(el("p", "jogos-rodada-lbl", `Cena ${p.rodada || 1}`));

    if (fase === "inicio") {
      card.appendChild(el("p", "jogos-sub", "Vocês recebem o mesmo cenário e objetivos secretos individuais para encaixar em 60 segundos."));
      const btn = el("button", "primary", "Sortear cena e objetivos");
      btn.type = "button";
      btn.addEventListener("click", iniciarCena);
      card.appendChild(btn);
      raiz.appendChild(card);
      return;
    }

    if (est.cenario) {
      const cenBox = el("div", "jogos-cenario-box");
      cenBox.appendChild(el("p", "jogos-destaque", est.cenario.titulo || ""));
      if (est.cenario.contexto) cenBox.appendChild(el("p", "jogos-sub", est.cenario.contexto));
      card.appendChild(cenBox);
    }

    if (fase === "preparando" || fase === "atuando") {
      const gaveta = el("div", "jogos-objetivo-gaveta");
      const btnToggle = el("button", "secondary", mostrarObjetivo ? "Esconder meu objetivo" : "Mostrar meu objetivo secreto");
      btnToggle.type = "button";
      btnToggle.addEventListener("click", () => { mostrarObjetivo = !mostrarObjetivo; render(); });
      gaveta.appendChild(btnToggle);
      if (mostrarObjetivo) {
        gaveta.appendChild(el("p", "jogos-sub", meuObjetivo || "Carregando objetivo..."));
      }
      card.appendChild(gaveta);

      if (fase === "preparando") {
        const euPronto = !!est[`pronto_${eu}`];
        card.appendChild(el("p", "jogos-sub", `${nomes[0]}: ${est.pronto_0 ? "pronto" : "lendo"} · ${nomes[1]}: ${est.pronto_1 ? "pronto" : "lendo"}`));
        const bPronto = el("button", euPronto ? "secondary" : "primary", euPronto ? "Aguardando o outro..." : "Pronto para atuar (60s)");
        bPronto.type = "button";
        bPronto.disabled = euPronto;
        bPronto.addEventListener("click", confirmarPronto);
        card.appendChild(bPronto);
      } else {
        const bEnc = el("button", "primary", "Encerrar cena e revelar");
        bEnc.type = "button";
        bEnc.addEventListener("click", encerrarCena);
        card.appendChild(bEnc);
      }
    } else if (fase === "revelado") {
      const grid = el("div", "jogos-duelo-grid");
      [0, 1].forEach(idx => {
        const item = revelados.find(r => r.jogador === String(idx));
        const box = el("div", "jogos-revelacao-item");
        box.appendChild(el("p", "jogos-rodada-lbl", `Objetivo de ${nomes[idx]}`));
        box.appendChild(el("p", "jogos-sub", (item && item.valor && item.valor.objetivo) || "Não sorteado"));
        grid.appendChild(box);
      });
      card.appendChild(grid);

      if (!est[`avaliou_${eu}`]) {
        card.appendChild(el("p", "jogos-sub", `${nomes[1 - eu]} cumpriu o objetivo secreto?`));
        const acoes = el("div", "jogos-acoes-col");
        [
          [2, "Cumpriu sem ser descoberto (+2)"],
          [1, "Cumpriu mas desconfiei (+1)"],
          [0, "Não cumpriu (0)"]
        ].forEach(([pts, rot]) => {
          const b = el("button", pts > 0 ? "primary" : "secondary", rot);
          b.type = "button";
          b.addEventListener("click", () => avaliarOutro(pts));
          acoes.appendChild(b);
        });
        card.appendChild(acoes);
      } else {
        card.appendChild(el("p", "jogos-sub", "Avaliação registrada."));
      }

      if (est.avaliou_0 && est.avaliou_1) {
        const bProx = el("button", "primary", "Próxima cena");
        bProx.type = "button";
        bProx.addEventListener("click", proximaCena);
        card.appendChild(bProx);
      }
    }

    raiz.appendChild(card);
  }

  window.JogosHub.registrar("cena-de-improviso", {
    async montar(container, ctx) {
      raiz = container;
      ctxJogo = ctx;
      meuObjetivo = null;
      meuObjRodada = 0;
      mostrarObjetivo = false;
      revelados = [];
      revRodada = 0;
      await sincronizar();
    },
    async aoAtualizar() {
      await sincronizar();
    },
    desmontar() {
      raiz = null;
      ctxJogo = null;
    }
  });
})();
