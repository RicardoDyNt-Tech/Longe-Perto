// Jogo: Batalha Naval 10x10 — Longe & Perto
(function () {
  const TAM = 10;
  const COLUNAS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
  const NAVIOS_DEF = [
    { id: "porta-avioes", nome: "Porta-aviões", tam: 5 },
    { id: "encouracado", nome: "Encouraçado", tam: 4 },
    { id: "cruzador", nome: "Cruzador", tam: 3 },
    { id: "submarino", nome: "Submarino", tam: 3 },
    { id: "contratorpedeiro", nome: "Contratorpedeiro", tam: 2 }
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

  function filtrarSugestoes(lista) {
    const { juntos, permitidoOusado } = ctxJogo.dadosSala;
    const modoAtual = juntos ? "juntos" : "longe";
    return (lista || []).filter(x => (x.modo === "ambos" || x.modo === modoAtual) && (!!permitidoOusado || !x.ousado));
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
      if (nr < 0 || nr >= TAM || nc < 0 || nc >= TAM) return false;
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
      for (let t = 0; t < 200 && !ok; t++) {
        const ori = Math.random() < 0.5 ? "H" : "V";
        const r = Math.floor(Math.random() * TAM);
        const c = Math.floor(Math.random() * TAM);
        ok = tentarPosicionar(idx, r, c, ori);
      }
    }
    render();
  }

  async function sugerirRecompensa(idx) {
    const lista = await carregarSugestoes(ctxJogo.dadosSala.sb);
    const pool = filtrarSugestoes(lista);
    if (!pool.length) {
      ctxJogo.aviso("Nenhuma sugestão disponível.");
      return;
    }
    const item = pool[Math.floor(Math.random() * pool.length)];
    frotaLocal[idx].recompensa = (item.dados && item.dados.texto) || "";
    render();
  }

  async function sugerirTodas() {
    const lista = await carregarSugestoes(ctxJogo.dadosSala.sb);
    const pool = filtrarSugestoes(lista).slice();
    if (!pool.length) {
      ctxJogo.aviso("Nenhuma sugestão disponível.");
      return;
    }
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    frotaLocal.forEach((n, idx) => {
      const item = pool[idx % pool.length];
      n.recompensa = (item && item.dados && item.dados.texto) || "";
    });
    render();
  }

  async function confirmarFrota() {
    const { eu } = ctxJogo.dadosSala;
    const p = ctxJogo.partida;
    const est = p.estado || {};
    const rodada = Number(p.rodada || 1);

    if (!frotaLocal || frotaLocal.some(n => (n.celulas || []).length !== n.tam)) {
      ctxJogo.aviso("Posicione todos os 5 navios na grade 10x10 antes de continuar.");
      return;
    }

    const payload = {
      navios: frotaLocal.map(n => ({
        id: n.id,
        nome: n.nome,
        tam: n.tam,
        celulas: n.celulas.slice(),
        recompensa: String(n.recompensa || "").trim() || "Recompensa combinada na hora"
      }))
    };

    const ok = await ctxJogo.enviarSegredo(rodada, "frota", payload);
    if (!ok) return;

    frotaRodada = rodada;
    const patch = { tamanho: TAM, [`pronto_${eu}`]: true };
    if (est[`pronto_${1 - eu}`]) {
      patch.fase = "batalha";
      patch.vez = 0;
      patch.disparos_0 = est.disparos_0 || {};
      patch.disparos_1 = est.disparos_1 || {};
      patch.afundados_0 = Number(est.afundados_0 || 0);
      patch.afundados_1 = Number(est.afundados_1 || 0);
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
      const chaveAfund = `afundados_${1 - eu}`;
      let totalAfundadosAlvo = Number(est[chaveAfund] || 0);

      if (resultado === "afundou") {
        (Array.isArray(data.celulas) ? data.celulas : [cel]).forEach(c => {
          meusDisparos[c] = "afundou";
        });
        totalAfundadosAlvo += 1;
        ultimoAfundado = {
          por: eu,
          recompensa: data.recompensa || "Recompensa combinada na hora"
        };
        recompensas.push(ultimoAfundado);
      }

      const patch = {
        tamanho: TAM,
        [chaveDisp]: meusDisparos,
        [chaveAfund]: totalAfundadosAlvo,
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
        tamanho: TAM,
        fase: "preparacao",
        pronto_0: false,
        pronto_1: false,
        vez: 0,
        disparos_0: {},
        disparos_1: {},
        afundados_0: 0,
        afundados_1: 0,
        recompensas: [],
        ultimo_afundado: null,
        vencedor: null
      },
      { rodada: Number(p.rodada || 1) + 1 }
    );
  }

  async function garantirCompatibilidade10x10() {
    if (!ctxJogo || !ctxJogo.partida) return;
    const est = ctxJogo.partida.estado || {};
    if (est.fase && Number(est.tamanho) !== TAM) {
      await novaPartida();
    }
  }

  async function carregarMinhaFrota() {
    if (!ctxJogo || !ctxJogo.partida) return;
    const p = ctxJogo.partida;
    const est = p.estado || {};
    if (est.fase && Number(est.tamanho) !== TAM) return;
    const rodada = Number(p.rodada || 1);
    if (frotaRodada === rodada && frotaLocal) return;
    const salvo = await ctxJogo.lerMeuSegredo(rodada, "frota");
    if (salvo && Array.isArray(salvo.navios) && salvo.navios.length === NAVIOS_DEF.length) {
      frotaLocal = salvo.navios.map((n, i) => ({
        id: n.id || NAVIOS_DEF[i].id,
        nome: n.nome || (NAVIOS_DEF[i] && NAVIOS_DEF[i].nome) || "Navio",
        tam: n.tam || (n.celulas || []).length,
        celulas: Array.isArray(n.celulas) ? n.celulas.slice() : [],
        recompensa: n.recompensa || ""
      }));
      frotaRodada = rodada;
    } else if (!frotaLocal) {
      frotaLocal = criarFrotaVazia();
    }
  }

  function renderGrade10x10(modo, mapaDisparos, minhasCelulas, podeClicar, aoClicar) {
    const grid = el("div", "jogos-grade-10");
    grid.appendChild(el("span", "jogos-coord-10", ""));
    COLUNAS.forEach(col => grid.appendChild(el("span", "jogos-coord-10", col)));

    for (let r = 0; r < TAM; r++) {
      grid.appendChild(el("span", "jogos-coord-10", String(r + 1)));
      for (let c = 0; c < TAM; c++) {
        const k = celulaChave(r, c);
        const btn = el("button", "jogos-cel-10");
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

        btn.setAttribute("aria-label", `${COLUNAS[c]}${r + 1}`);
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
      card.appendChild(el("p", "jogos-rodada-lbl", `Frota 10x10 · ${nomes[0]}: ${est.pronto_0 ? "pronto" : "posicionando"} · ${nomes[1]}: ${est.pronto_1 ? "pronto" : "posicionando"}`));

      const minhasCelulas = celulasOcupadas(-1);
      if (euPronto) {
        card.appendChild(el("p", "jogos-sub", `Sua frota de 5 navios está escondida em segredo. Aguardando ${nomes[1 - eu]} finalizar.`));
        card.appendChild(renderGrade10x10("prep", null, minhasCelulas, false));
      } else {
        card.appendChild(el("p", "jogos-sub", "Escolha um navio, gire se precisar e toque na célula inicial na grade 10x10."));
        const selWrap = el("div", "jogos-filtros");
        frotaLocal.forEach((n, idx) => {
          const ok = (n.celulas || []).length === n.tam;
          const b = el("button", "jogos-chip", `${n.nome} (${n.tam})${ok ? " ok" : ""}`);
          b.type = "button";
          b.setAttribute("aria-pressed", navioSelIdx === idx ? "true" : "false");
          b.addEventListener("click", () => { navioSelIdx = idx; render(); });
          selWrap.appendChild(b);
        });
        card.appendChild(selWrap);

        const ctrls = el("div", "jogos-acoes-linha");
        const bGir = el("button", "secondary", `Girar: ${orientacao === "H" ? "Horizontal" : "Vertical"}`);
        bGir.type = "button";
        bGir.addEventListener("click", () => { orientacao = orientacao === "H" ? "V" : "H"; render(); });
        const bAle = el("button", "secondary", "Posicionar aleatório");
        bAle.type = "button";
        bAle.addEventListener("click", posicionarAleatorio);
        ctrls.append(bGir, bAle);
        card.appendChild(ctrls);

        card.appendChild(renderGrade10x10("prep", null, minhasCelulas, true, (r, c) => {
          if (!tentarPosicionar(navioSelIdx, r, c, orientacao)) {
            ctxJogo.aviso("Não cabe nessa posição. Tente outra célula ou gire o navio.");
            return;
          }
          const proxVazio = frotaLocal.findIndex(n => (n.celulas || []).length !== n.tam);
          if (proxVazio >= 0) navioSelIdx = proxVazio;
          render();
        }));

        const recBox = el("div", "jogos-acoes-col");
        const recTopo = el("div", "jogos-fuga-topo-info");
        recTopo.appendChild(el("p", "jogos-rodada-lbl", "Recompensa ou prenda de cada navio"));
        const bSugTodas = el("button", "linkbtn", "Sugerir todas");
        bSugTodas.type = "button";
        bSugTodas.addEventListener("click", sugerirTodas);
        recTopo.appendChild(bSugTodas);
        recBox.appendChild(recTopo);

        frotaLocal.forEach((n, idx) => {
          const linha = el("div", "jogos-batalha-rec-linha");
          const inp = document.createElement("input");
          inp.type = "text";
          inp.placeholder = `${n.nome} (${n.tam}): recompensa secreta`;
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
      const totalNavios = NAVIOS_DEF.length;
      const restam0 = Math.max(0, totalNavios - Number(est.afundados_0 || 0));
      const restam1 = Math.max(0, totalNavios - Number(est.afundados_1 || 0));

      card.appendChild(el("p", "jogos-rodada-lbl", minhaVez ? "Sua vez de disparar · Acertou, atira de novo" : `Vez de ${nomes[vez]} disparar`));
      card.appendChild(el("p", "jogos-sub", `Restam: ${nomes[0]} (${restam0}/${totalNavios}) · ${nomes[1]} (${restam1}/${totalNavios})`));

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
        card.appendChild(renderGrade10x10("atacar", meusDisparos, null, minhaVez, (_, __, k) => disparar(k)));
      } else {
        const disparosOutro = est[`disparos_${1 - eu}`] || {};
        const minhasCelulas = celulasOcupadas(-1);
        card.appendChild(renderGrade10x10("frota", disparosOutro, minhasCelulas, false));
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
      await garantirCompatibilidade10x10();
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
