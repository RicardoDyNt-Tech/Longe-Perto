// Jogo: Código a dois — Longe & Perto
(function () {
  const TOTAL_CASAL = 7;
  const TOTAL_TURNOS = 6;

  let raiz = null;
  let ctxJogo = null;
  let bancoPalavras = null;
  let mapaGuia = null;
  let mapaRodada = 0;
  let mapaFinal = null;
  let marcando = false;

  function el(tag, cls, txt) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt !== undefined && txt !== null) n.textContent = txt;
    return n;
  }

  async function carregarPalavras(sb) {
    if (bancoPalavras) return bancoPalavras;
    const { data, error } = await sb
      .from("jogos_conteudo")
      .select("id, dados")
      .eq("jogo_id", "codigo-a-dois")
      .eq("ativo", true);
    if (error || !Array.isArray(data)) return [];
    bancoPalavras = data.map(x => (x.dados && x.dados.palavra) || "").filter(Boolean);
    return bancoPalavras;
  }

  function embaralhar(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  async function iniciarGrade() {
    const { sb, eu } = ctxJogo.dadosSala;
    const p = ctxJogo.partida;
    const est = (p && p.estado) || {};
    const todas = await carregarPalavras(sb);
    if (todas.length < 16) {
      ctxJogo.aviso("Banco de palavras insuficiente para montar a grade 4x4.");
      return;
    }
    const palavras = embaralhar(todas).slice(0, 16);
    const indices = embaralhar([...Array(16).keys()]);
    const casal = indices.slice(0, TOTAL_CASAL);
    const armadilha = indices[TOTAL_CASAL];
    const rodada = est.fase ? Number(p.rodada || 1) + 1 : Number(p.rodada || 1);
    const guia = est.fase ? 1 - Number(est.guia || 0) : eu;

    const ok = await ctxJogo.enviarSegredo(rodada, "mapa", { casal, armadilha });
    if (!ok) return;

    mapaGuia = { casal, armadilha };
    mapaRodada = rodada;
    mapaFinal = null;

    await ctxJogo.salvarEstado(
      {
        fase: "jogando",
        guia,
        palavras,
        reveladas: {},
        turnos_restantes: TOTAL_TURNOS,
        pista_palavra: "",
        pista_num: "",
        vitoria: null,
        motivo_fim: null
      },
      { rodada }
    );
  }

  async function salvarPista(palavra, numero) {
    await ctxJogo.salvarEstado({
      pista_palavra: String(palavra || "").trim().slice(0, 30),
      pista_num: String(numero || "").trim().slice(0, 3)
    });
  }

  async function encerrarTurno() {
    const p = ctxJogo.partida;
    const est = p.estado || {};
    if (est.fase !== "jogando") return;
    const rest = Math.max(0, Number(est.turnos_restantes || 1) - 1);
    if (rest <= 0) {
      await finalizarDerrota("turnos");
      return;
    }
    await ctxJogo.salvarEstado({
      turnos_restantes: rest,
      pista_palavra: "",
      pista_num: ""
    });
  }

  async function finalizarDerrota(motivo) {
    const p = ctxJogo.partida;
    const rodada = Number(p.rodada || 1);
    const revs = await ctxJogo.revelarRodada(rodada);
    const item = revs.find(r => r.chave === "mapa") || revs[0];
    mapaFinal = (item && item.valor) || null;
    await ctxJogo.salvarEstado({
      fase: "fim",
      vitoria: false,
      motivo_fim: motivo,
      mapa_revelado: mapaFinal
    });
  }

  async function marcarCarta(idx) {
    if (marcando || !ctxJogo || !ctxJogo.partida) return;
    const { sb, sala, eu } = ctxJogo.dadosSala;
    const p = ctxJogo.partida;
    const est = p.estado || {};
    const guia = Number(est.guia || 0);
    if (est.fase !== "jogando" || eu === guia) return;

    const reveladas = { ...(est.reveladas || {}) };
    if (reveladas[String(idx)]) return;

    marcando = true;
    try {
      const rodada = Number(p.rodada || 1);
      const { data, error } = await sb.rpc("jogo_codigo_marcar", {
        p_sala_codigo: sala,
        p_partida_id: p.id,
        p_rodada: rodada,
        p_guia: String(guia),
        p_indice: idx
      });
      if (error || !data) {
        ctxJogo.aviso((error && error.message) || "Erro ao verificar carta.");
        return;
      }

      const tipo = data.tipo || "neutro";
      reveladas[String(idx)] = tipo;

      if (tipo === "armadilha") {
        await ctxJogo.salvarEstado({ reveladas });
        await finalizarDerrota("armadilha");
        return;
      }

      const acertos = Object.values(reveladas).filter(v => v === "casal").length;
      if (acertos >= TOTAL_CASAL) {
        const revs = await ctxJogo.revelarRodada(rodada);
        const item = revs.find(r => r.chave === "mapa") || revs[0];
        mapaFinal = (item && item.valor) || null;
        const novoPlacar = { ...(p.placar || {}) };
        novoPlacar["0"] = (Number(novoPlacar["0"]) || 0) + 1;
        novoPlacar["1"] = (Number(novoPlacar["1"]) || 0) + 1;
        await ctxJogo.salvarEstado(
          { fase: "fim", reveladas, vitoria: true, motivo_fim: "vitoria", mapa_revelado: mapaFinal },
          { placar: novoPlacar }
        );
        return;
      }

      if (tipo === "neutro") {
        const rest = Math.max(0, Number(est.turnos_restantes || 1) - 1);
        if (rest <= 0) {
          await ctxJogo.salvarEstado({ reveladas, turnos_restantes: 0 });
          await finalizarDerrota("turnos");
          return;
        }
        await ctxJogo.salvarEstado({
          reveladas,
          turnos_restantes: rest,
          pista_palavra: "",
          pista_num: ""
        });
      } else {
        await ctxJogo.salvarEstado({ reveladas });
      }
    } finally {
      marcando = false;
    }
  }

  async function garantirMapaGuia() {
    if (!ctxJogo || !ctxJogo.partida) return;
    const { eu } = ctxJogo.dadosSala;
    const p = ctxJogo.partida;
    const est = p.estado || {};
    const rodada = Number(p.rodada || 1);
    if (est.fase === "jogando" && Number(est.guia || 0) === eu && mapaRodada !== rodada) {
      mapaGuia = await ctxJogo.lerMeuSegredo(rodada, "mapa");
      mapaRodada = rodada;
    }
  }

  function tipoNoMapa(mapa, idx) {
    if (!mapa) return null;
    if (Number(mapa.armadilha) === idx) return "armadilha";
    if (Array.isArray(mapa.casal) && mapa.casal.map(Number).includes(idx)) return "casal";
    return "neutro";
  }

  function render() {
    if (!raiz || !ctxJogo || !ctxJogo.partida) return;
    const p = ctxJogo.partida;
    const est = p.estado || {};
    const { eu, nomes } = ctxJogo.dadosSala;
    const fase = est.fase || "inicio";
    const guia = Number(est.guia || 0);
    const souGuia = guia === eu;

    raiz.textContent = "";
    const card = el("div", "jogos-subcard");

    if (fase === "inicio") {
      card.appendChild(el("p", "jogos-rodada-lbl", "Código a dois · Grade cooperativa 4x4"));
      card.appendChild(el("p", "jogos-sub", "Encontrem as 7 palavras secretas do casal em até 6 turnos, fugindo da armadilha."));
      const btn = el("button", "primary", "Iniciar grade (eu sou o Guia)");
      btn.type = "button";
      btn.addEventListener("click", iniciarGrade);
      card.appendChild(btn);
      raiz.appendChild(card);
      return;
    }

    const reveladas = est.reveladas || {};
    const acertos = Object.values(reveladas).filter(v => v === "casal").length;
    card.appendChild(el("p", "jogos-rodada-lbl", `Guia: ${nomes[guia]} · Acertos: ${acertos}/${TOTAL_CASAL} · Turnos restantes: ${est.turnos_restantes ?? 0}`));

    if (fase === "jogando") {
      if (est.pista_palavra) {
        card.appendChild(el("div", "jogos-sintonia-medidor", `Pista atual: ${est.pista_palavra}${est.pista_num ? " · " + est.pista_num : ""}`));
      }
      if (souGuia) {
        const form = el("form", "jogos-pista-form");
        const inpP = document.createElement("input");
        inpP.type = "text";
        inpP.placeholder = "Palavra-chave (opcional)";
        inpP.maxLength = 30;
        inpP.value = est.pista_palavra || "";
        const inpN = document.createElement("input");
        inpN.type = "number";
        inpN.min = "1";
        inpN.max = "7";
        inpN.placeholder = "Nº";
        inpN.value = est.pista_num || "";
        const bEnv = el("button", "secondary", "Fixar");
        bEnv.type = "submit";
        form.append(inpP, inpN, bEnv);
        form.addEventListener("submit", ev => {
          ev.preventDefault();
          salvarPista(inpP.value, inpN.value);
        });
        card.appendChild(form);
        card.appendChild(el("p", "jogos-sub", "Seu mapa secreto está marcado nas bordas. Dê uma pista de 1 palavra na chamada."));
      } else {
        card.appendChild(el("p", "jogos-sub", `Ouça a pista de ${nomes[guia]} e toque nas palavras do casal.`));
      }
    } else if (fase === "fim") {
      const msg = est.vitoria
        ? "Vitória cooperativa! Vocês encontraram todas as 7 palavras."
        : est.motivo_fim === "armadilha"
          ? "Armadilha acionada! A rodada terminou."
          : "Turnos esgotados antes de achar todas as palavras.";
      card.appendChild(el("p", "jogos-destaque", msg));
    }

    const palavras = Array.isArray(est.palavras) ? est.palavras : [];
    const mapaVisivel = fase === "fim" ? (est.mapa_revelado || mapaFinal) : (souGuia ? mapaGuia : null);
    const grid = el("div", "jogos-grade-4");

    palavras.forEach((pal, idx) => {
      const btn = el("button", "jogos-cel-4", pal);
      btn.type = "button";
      const rev = reveladas[String(idx)];
      if (rev) {
        btn.classList.add("revelada", `tipo-${rev}`);
      } else if (mapaVisivel) {
        const t = tipoNoMapa(mapaVisivel, idx);
        if (t) btn.classList.add(`guia-${t}`);
      }
      btn.disabled = fase !== "jogando" || souGuia || !!rev;
      btn.addEventListener("click", () => marcarCarta(idx));
      grid.appendChild(btn);
    });
    card.appendChild(grid);

    if (fase === "jogando" && !souGuia) {
      const bEnc = el("button", "secondary", "Encerrar turno");
      bEnc.type = "button";
      bEnc.addEventListener("click", encerrarTurno);
      card.appendChild(bEnc);
    }

    if (fase === "fim") {
      const bNova = el("button", "primary", "Nova grade (trocar Guia)");
      bNova.type = "button";
      bNova.addEventListener("click", iniciarGrade);
      card.appendChild(bNova);
    }

    raiz.appendChild(card);
  }

  window.JogosHub.registrar("codigo-a-dois", {
    async montar(container, ctx) {
      raiz = container;
      ctxJogo = ctx;
      mapaGuia = null;
      mapaRodada = 0;
      mapaFinal = null;
      await garantirMapaGuia();
      render();
    },
    async aoAtualizar() {
      await garantirMapaGuia();
      render();
    },
    desmontar() {
      raiz = null;
      ctxJogo = null;
    }
  });
})();
