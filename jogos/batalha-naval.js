// Jogo: Batalha Naval — Longe & Perto
(function () {
  const NAVIOS_DEF = [
    { id: "n3", nome: "Navio 3 casas", tam: 3 },
    { id: "n2a", nome: "Navio 2 casas (A)", tam: 2 },
    { id: "n2b", nome: "Navio 2 casas (B)", tam: 2 },
    { id: "n1", nome: "Submarino 1 casa", tam: 1 }
  ];

  let raiz = null;
  let ctxJogo = null;
  let bancoSugestoes = null;
  let aba = "atacar";
  let navioSelIdx = 0;
  let orientacao = "H";
  let frotaLocal = null;
  let frotaRodada = 0;
  let disparando = false;

  function el(tag, cls, txt) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt !== undefined && txt !== null) n.textContent = txt;
    return n;
  }

  function criarFrotaVazia() {
    return NAVIOS_DEF.map(n => ({ id: n.id, nome: n.nome, tam: n.tam, celulas: [], recompensa: "" }));
  }

  async function carregarSugestoes(sb) {
    if (bancoSugestoes) return bancoSugestoes;
    const { data, error } = await sb
      .from("jogos_conteudo")
      .select("id, modo, ousado, dados")
      .eq("jogo_id", "batalha-naval")
      .eq("ativo", true);
    if (error || !Array.isArray(data)) return [];
    bancoSugestoes = data;
    return bancoSugestoes;
  }

  function celulaChave(r, c) {
    return `${r},${c}`;
  }

  function celulasOcupadas(excetoIdx) {
    const set = new Set();
    (frotaLocal || []).forEach((n, idx) => {
      if (idx === excetoIdx) return;
      (n.celulas || []).forEach(c => set.add(c));
    });
    return set;
  }

  function tentarPosicionar(idx, r, c, ori) {
    const navio = frotaLocal[idx];
    if (!navio) return false;
    const ocupadas = celulasOcupadas(idx);
    const novas = [];
    for (let i = 0; i < navio.tam; i++) {
      const nr = ori === "V" ? r + i : r;
      const nc = ori === "H" ? c + i : c;
      if (nr < 0 || nr >= 6 || nc < 0 || nc >= 6) return false;
      const k = celulaChave(nr, nc);
      if (ocupadas.has(k)) return false;
      novas.push(k);
    }
    navio.celulas = novas;
    return true;
  }

  function posicionarAleatorio() {
    const recompensas = (frotaLocal || []).map(n => n.recompensa || "");
    frotaLocal = criarFrotaVazia();
    frotaLocal.forEach((n, idx) => { n.recompensa = recompensas[idx] || ""; });

    for (let idx = 0; idx < frotaLocal.length; idx++) {
      let ok = false;
      for (let t = 0; t < 120 && !ok; t++) {
        const ori = Math.random() < 0.5 ? "H" : "V";
        const r = Math.floor(Math.random() * 6);
        const c = Math.floor(Math.random() * 6);
        ok = tentarPosicionar(idx, r, c, ori);
      }
    }
    render();
  }

  async function sugerirRecompensa(idx) {
    const { sb, juntos, permitidoOusado } = ctxJogo.dadosSala;
    const lista = await carregarSugestoes(sb);
    const modoAtual = juntos ? "juntos" : "longe";
    const pool = lista.filter(x => (x.modo === "ambos" || x.modo === modoAtual) && (!!permitidoOusado || !x.ousado));
    if (!pool.length) {
      ctxJogo.aviso("Nenhuma sugestão disponível.");
      return;
    }
    const item = pool[Math.floor(Math.random() * pool.length)];
    frotaLocal[idx].recompensa = (item.dados && item.dados.texto) || "";
    render();
  }

  async function confirmarFrota() {
    const { eu } = ctxJogo.dadosSala;
    const p = ctxJogo.partida;
    const est = p.estado || {};
    const rodada = Number(p.rodada || 1);

    if (!frotaLocal || frotaLocal.some(n => (n.celulas || []).length !== n.tam)) {
      ctxJogo.aviso("Posicione todos os 4 navios na grade 6x6 antes de continuar.");
      return;
    }

    const payload = {
      navios: frotaLocal.map(n => ({
        id: n.id,
        tam: n.tam,
        celulas: n.celulas.slice(),
        recompensa: String(n.recompensa || "").trim() || "Recompensa combinada na hora"
      }))
    };

    const ok = await ctxJogo.enviarSegredo(rodada, "frota", payload);
    if (!ok) return;

    frotaRodada = rodada;
    const patch = { [`pronto_${eu}`]: true };
    if (est[`pronto_${1 - eu}`]) {
      patch.fase = "batalha";
      patch.vez = 0;
      patch.disparos_0 = est.disparos_0 || {};
      patch.disparos_1 = est.disparos_1 || {};
      patch.recompensas = est.recompensas || [];
      patch.ultimo_afundado = null;
    }
    await ctxJogo.salvarEstado(patch);
  }

  async function disparar(cel) {
    if (disparando || !ctxJogo || !ctxJogo.partida) return;
    const { sb, sala, eu } = ctxJogo.dadosSala;
    const p = ctxJogo.partida;
    const est = p.estado || {};
    if (est.fase !== "batalha" || Number(est.vez || 0) !== eu) return;

    const chaveDisp = `disparos_${eu}`;
    const meusDisparos = { ...(est[chaveDisp] || {}) };
    if (meusDisparos[cel]) return;

    disparando = true;
    try {
      const rodada = Number(p.rodada || 1);
      const { data, error } = await sb.rpc("jogo_batalha_disparar", {
        p_sala_codigo: sala,
        p_partida_id: p.id,
        p_rodada: rodada,
        p_alvo: String(1 - eu),
        p_celula: cel,
        p_disparos_anteriores: Object.keys(meusDisparos)
      });
      if (error || !data) {
        ctxJogo.aviso((error && error.message) || "Erro ao registrar disparo.");
        return;
      }

      const resultado = data.resultado || "agua";
      meusDisparos[cel] = resultado;
      const recompensas = Array.isArray(est.recompensas) ? est.recompensas.slice() : [];
      let ultimoAfundado = est.ultimo_afundado || null;

      if (resultado === "afundou") {
        (Array.isArray(data.celulas) ? data.celulas : [cel]).forEach(c => {
          meusDisparos[c] = "afundou";
        });
        ultimoAfundado = {
          por: eu,
          recompensa: data.recompensa || "Recompensa combinada na hora"
        };
        recompensas.push(ultimoAfundado);
      }

      const patch = {
        [chaveDisp]: meusDisparos,
        recompensas,
        ultimo_afundado: ultimoAfundado,
        vez: resultado === "agua" ? 1 - eu : eu
      };

      let extra = null;
      if (data.vitoria) {
        patch.fase = "fim";
        patch.vencedor = eu;
        const novoPlacar = { ...(p.placar || {}) };
        novoPlacar[String(eu)] = (Number(novoPlacar[String(eu)]) || 0) + 1;
        extra = { placar: novoPlacar };
      }
      await ctxJogo.salvarEstado(patch, extra);
    } finally {
      disparando = false;
    }
  }

  async function novaPartida() {
    const p = ctxJogo.partida;
    frotaLocal = criarFrotaVazia();
    frotaRodada = 0;
    navioSelIdx = 0;
    aba = "atacar";
    await ctxJogo.salvarEstado(
      {
        fase: "preparacao",
        pronto_0: false,
        pronto_1: false,
        vez: 0,
        disparos_0: {},
        disparos_1: {},
        recompensas: [],
        ultimo_afundado: null,
        vencedor: null
      },
      { rodada: Number(p.rodada || 1) + 1 }
    );
  }

  async function carregarMinhaFrota() {
    if (!ctxJogo || !ctxJogo.partida) return;
    const p = ctxJogo.partida;
    const rodada = Number(p.rodada || 1);
    if (frotaRodada === rodada && frotaLocal) return;
    const salvo = await ctxJogo.lerMeuSegredo(rodada, "frota");
    if (salvo && Array.isArray(salvo.navios) && salvo.navios.length) {
      frotaLocal = salvo.navios.map((n, i) => ({
        id: n.id || NAVIOS_DEF[i].id,
        nome: (NAVIOS_DEF[i] && NAVIOS_DEF[i].nome) || "Navio",
        tam: n.tam || (n.celulas || []).length,
        celulas: Array.isArray(n.celulas) ? n.celulas.slice() : [],
        recompensa: n.recompensa || ""
      }));
      frotaRodada = rodada;
    } else if (!frotaLocal) {
      frotaLocal = criarFrotaVazia();
    }
  }

  function renderGrade6x6(modo, mapaDisparos, minhasCelulas, podeClicar, aoClicar) {
    const grid = el("div", "jogos-grade-6");
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        const k = celulaChave(r, c);
        const btn = el("button", "jogos-cel-6");
        btn.type = "button";
        const estadoDisp = mapaDisparos && mapaDisparos[k];
        const temMeuNavio = minhasCelulas && minhasCelulas.has(k);

        if (estadoDisp === "afundou") {
          btn.classList.add("afundou");
          btn.textContent = "X";
        } else if (estadoDisp === "acerto") {
          btn.classList.add("acerto");
          btn.textContent = "!";
        } else if (estadoDisp === "agua") {
          btn.classList.add("agua");
          btn.textContent = "·";
        } else if (temMeuNavio) {
          btn.classList.add("navio");
        }

        btn.setAttribute("aria-label", `Linha ${r + 1}, Coluna ${c + 1}`);
        btn.disabled = !podeClicar || (modo === "atacar" && !!estadoDisp);
        if (podeClicar && typeof aoClicar === "function") {
          btn.addEventListener("click", () => aoClicar(r, c, k));
        }
        grid.appendChild(btn);
      }
    }
    return grid;
  }

  function render() {
    if (!raiz || !ctxJogo || !ctxJogo.partida) return;
    const p = ctxJogo.partida;
    const est = p.estado || {};
    const { eu, nomes } = ctxJogo.dadosSala;
    const fase = est.fase || "preparacao";

    if (!frotaLocal) frotaLocal = criarFrotaVazia();
    raiz.textContent = "";

    const card = el("div", "jogos-subcard");

    if (fase === "preparacao") {
      const euPronto = !!est[`pronto_${eu}`];
      card.appendChild(el("p", "jogos-rodada-lbl", `Preparação secreta · ${nomes[0]}: ${est.pronto_0 ? "pronto" : "posicionando"} · ${nomes[1]}: ${est.pronto_1 ? "pronto" : "posicionando"}`));

      const minhasCelulas = celulasOcupadas(-1);
      if (euPronto) {
        card.appendChild(el("p", "jogos-sub", `Sua frota está escondida em segredo. Aguardando ${nomes[1 - eu]} finalizar.`));
        card.appendChild(renderGrade6x6("prep", null, minhasCelulas, false));
      } else {
        card.appendChild(el("p", "jogos-sub", "Selecione um navio abaixo e toque na grade 6x6 para posicioná-lo."));
        const selWrap = el("div", "jogos-filtros");
        frotaLocal.forEach((n, idx) => {
          const ok = (n.celulas || []).length === n.tam;
          const b = el("button", "jogos-chip", `${n.tam} casas${ok ? " (ok)" : ""}`);
          b.type = "button";
          b.setAttribute("aria-pressed", navioSelIdx === idx ? "true" : "false");
          b.addEventListener("click", () => { navioSelIdx = idx; render(); });
          selWrap.appendChild(b);
        });
        card.appendChild(selWrap);

        const ctrls = el("div", "jogos-acoes-linha");
        const bGir = el("button", "secondary", `Direção: ${orientacao === "H" ? "Horizontal" : "Vertical"}`);
        bGir.type = "button";
        bGir.addEventListener("click", () => { orientacao = orientacao === "H" ? "V" : "H"; render(); });
        const bAle = el("button", "secondary", "Posicionar aleatório");
        bAle.type = "button";
        bAle.addEventListener("click", posicionarAleatorio);
        ctrls.append(bGir, bAle);
        card.appendChild(ctrls);

        card.appendChild(renderGrade6x6("prep", null, minhasCelulas, true, (r, c) => {
          if (!tentarPosicionar(navioSelIdx, r, c, orientacao)) {
            ctxJogo.aviso("Não cabe nessa posição. Tente outra célula ou gire o navio.");
            return;
          }
          const proxVazio = frotaLocal.findIndex(n => (n.celulas || []).length !== n.tam);
          if (proxVazio >= 0) navioSelIdx = proxVazio;
          render();
        }));

        const recBox = el("div", "jogos-acoes-col");
        recBox.appendChild(el("p", "jogos-rodada-lbl", "Recompensa ou prenda ao afundar cada navio"));
        frotaLocal.forEach((n, idx) => {
          const linha = el("div", "jogos-batalha-rec-linha");
          const inp = document.createElement("input");
          inp.type = "text";
          inp.placeholder = `${n.nome}: recompensa secreta`;
          inp.maxLength = 100;
          inp.value = n.recompensa || "";
          inp.addEventListener("input", () => { frotaLocal[idx].recompensa = inp.value; });
          const bSug = el("button", "secondary", "Sugerir");
          bSug.type = "button";
          bSug.addEventListener("click", () => sugerirRecompensa(idx));
          linha.append(inp, bSug);
          recBox.appendChild(linha);
        });
        card.appendChild(recBox);

        const bPronto = el("button", "primary", "Frota pronta");
        bPronto.type = "button";
        bPronto.addEventListener("click", confirmarFrota);
        card.appendChild(bPronto);
      }
      raiz.appendChild(card);
      return;
    }

    if (fase === "batalha") {
      const vez = Number(est.vez || 0);
      const minhaVez = vez === eu;
      card.appendChild(el("p", "jogos-rodada-lbl", minhaVez ? "Sua vez de disparar · Acertou, atira de novo" : `Vez de ${nomes[vez]} disparar`));

      if (est.ultimo_afundado) {
        const dest = el("div", "jogos-recompensa-destaque");
        dest.appendChild(el("p", "jogos-rodada-lbl", `Navio afundado por ${nomes[est.ultimo_afundado.por]}!`));
        dest.appendChild(el("p", "jogos-destaque", est.ultimo_afundado.recompensa || ""));
        card.appendChild(dest);
      }

      const abas = el("div", "jogos-filtros");
      [
        ["atacar", "Atacar (mar do outro)"],
        ["frota", "Minha frota"]
      ].forEach(([val, rot]) => {
        const b = el("button", "jogos-chip", rot);
        b.type = "button";
        b.setAttribute("aria-pressed", aba === val ? "true" : "false");
        b.addEventListener("click", () => { aba = val; render(); });
        abas.appendChild(b);
      });
      card.appendChild(abas);

      if (aba === "atacar") {
        const meusDisparos = est[`disparos_${eu}`] || {};
        card.appendChild(renderGrade6x6("atacar", meusDisparos, null, minhaVez, (_, __, k) => disparar(k)));
      } else {
        const disparosOutro = est[`disparos_${1 - eu}`] || {};
        const minhasCelulas = celulasOcupadas(-1);
        card.appendChild(renderGrade6x6("frota", disparosOutro, minhasCelulas, false));
      }

      const recs = Array.isArray(est.recompensas) ? est.recompensas : [];
      if (recs.length) {
        const det = document.createElement("details");
        det.className = "jogos-detalhes";
        det.appendChild(el("summary", "", `Recompensas destravadas (${recs.length})`));
        const ul = el("ul", "jogos-lista-conquistas");
        recs.forEach(r => ul.appendChild(el("li", "", `${nomes[r.por]}: ${r.recompensa}`)));
        det.appendChild(ul);
        card.appendChild(det);
      }

      raiz.appendChild(card);
      return;
    }

    if (fase === "fim") {
      const venc = Number(est.vencedor || 0);
      card.appendChild(el("p", "jogos-rodada-lbl", "Fim da batalha"));
      card.appendChild(el("p", "jogos-destaque", `${nomes[venc]} afundou toda a frota!`));
      const recs = Array.isArray(est.recompensas) ? est.recompensas : [];
      if (recs.length) {
        const ul = el("ul", "jogos-lista-conquistas");
        recs.forEach(r => ul.appendChild(el("li", "", `${nomes[r.por]}: ${r.recompensa}`)));
        card.appendChild(ul);
      }
      const bNova = el("button", "primary", "Nova partida");
      bNova.type = "button";
      bNova.addEventListener("click", novaPartida);
      card.appendChild(bNova);
      raiz.appendChild(card);
    }
  }

  window.JogosHub.registrar("batalha-naval", {
    async montar(container, ctx) {
      raiz = container;
      ctxJogo = ctx;
      aba = "atacar";
      navioSelIdx = 0;
      frotaLocal = null;
      frotaRodada = 0;
      await carregarMinhaFrota();
      render();
    },
    async aoAtualizar() {
      await carregarMinhaFrota();
      render();
    },
    desmontar() {
      raiz = null;
      ctxJogo = null;
    }
  });
})();
