// Jogo: Sala de Fuga a dois — Longe & Perto
(function () {
  const SIMBOLOS_NOMES = {
    circulo: "Círculo",
    triangulo: "Triângulo",
    quadrado: "Quadrado",
    losango: "Losango"
  };

  let raiz = null;
  let ctxJogo = null;
  let catalogo = null;
  let salaSelId = null;
  let painelInicial = 0;
  let alternarPapeis = true;
  let etapaDados = null;
  let etapaChaveCarregada = "";
  let paginaManual = 0;
  let validando = false;
  let timerDecorrido = null;

  // Estados locais dos 4 tipos de painel
  let cofreDigitos = "";
  let chavesEstado = [false, false, false, false];
  let relogioHora = 12;
  let relogioMin = 0;
  let simbolosSeq = [];

  function el(tag, cls, txt) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt !== undefined && txt !== null) n.textContent = txt;
    return n;
  }

  function limparTimerDecorrido() {
    if (timerDecorrido) {
      clearInterval(timerDecorrido);
      timerDecorrido = null;
    }
  }

  function fmtTempo(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }

  function resetarControlesPainel() {
    cofreDigitos = "";
    chavesEstado = [false, false, false, false];
    relogioHora = 12;
    relogioMin = 0;
    simbolosSeq = [];
    paginaManual = 0;
  }

  async function carregarCatalogo(sb) {
    if (catalogo) return catalogo;
    const { data, error } = await sb
      .from("jogos_conteudo")
      .select("id, dados")
      .eq("jogo_id", "sala-de-fuga")
      .eq("ativo", true);
    if (error || !Array.isArray(data)) return [];
    catalogo = data.map(x => x.dados || {}).filter(d => d.campanha_id);
    if (!salaSelId && catalogo.length) salaSelId = catalogo[0].campanha_id;
    return catalogo;
  }

  function criarSvgSimbolo(tipo) {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 32 32");
    svg.setAttribute("class", "jogos-fuga-svg");
    svg.setAttribute("aria-hidden", "true");
    let forma;
    if (tipo === "circulo") {
      forma = document.createElementNS(ns, "circle");
      forma.setAttribute("cx", "16");
      forma.setAttribute("cy", "16");
      forma.setAttribute("r", "10");
    } else if (tipo === "triangulo") {
      forma = document.createElementNS(ns, "polygon");
      forma.setAttribute("points", "16,5 27,26 5,26");
    } else if (tipo === "quadrado") {
      forma = document.createElementNS(ns, "rect");
      forma.setAttribute("x", "6");
      forma.setAttribute("y", "6");
      forma.setAttribute("width", "20");
      forma.setAttribute("height", "20");
      forma.setAttribute("rx", "2");
    } else {
      forma = document.createElementNS(ns, "polygon");
      forma.setAttribute("points", "16,4 28,16 16,28 4,16");
    }
    svg.appendChild(forma);
    return svg;
  }

  function criarSvgRelogio(hora, minuto) {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 120 120");
    svg.setAttribute("class", "jogos-relogio-svg");
    svg.setAttribute("aria-hidden", "true");

    const circ = document.createElementNS(ns, "circle");
    circ.setAttribute("cx", "60");
    circ.setAttribute("cy", "60");
    circ.setAttribute("r", "52");
    svg.appendChild(circ);

    for (let i = 0; i < 12; i++) {
      const ang = (i * 30 - 90) * Math.PI / 180;
      const tick = document.createElementNS(ns, "line");
      tick.setAttribute("x1", String(60 + Math.cos(ang) * 44));
      tick.setAttribute("y1", String(60 + Math.sin(ang) * 44));
      tick.setAttribute("x2", String(60 + Math.cos(ang) * 49));
      tick.setAttribute("y2", String(60 + Math.sin(ang) * 49));
      svg.appendChild(tick);
    }

    const angH = (((hora % 12) + minuto / 60) * 30 - 90) * Math.PI / 180;
    const pH = document.createElementNS(ns, "line");
    pH.setAttribute("class", "ponteiro-hora");
    pH.setAttribute("x1", "60");
    pH.setAttribute("y1", "60");
    pH.setAttribute("x2", String(60 + Math.cos(angH) * 28));
    pH.setAttribute("y2", String(60 + Math.sin(angH) * 28));
    svg.appendChild(pH);

    const angM = (minuto * 6 - 90) * Math.PI / 180;
    const pM = document.createElementNS(ns, "line");
    pM.setAttribute("class", "ponteiro-min");
    pM.setAttribute("x1", "60");
    pM.setAttribute("y1", "60");
    pM.setAttribute("x2", String(60 + Math.cos(angM) * 40));
    pM.setAttribute("y2", String(60 + Math.sin(angM) * 40));
    svg.appendChild(pM);

    const centro = document.createElementNS(ns, "circle");
    centro.setAttribute("cx", "60");
    centro.setAttribute("cy", "60");
    centro.setAttribute("r", "3");
    svg.appendChild(centro);
    return svg;
  }

  async function iniciarSala() {
    const lista = await carregarCatalogo(ctxJogo.dadosSala.sb);
    const sel = lista.find(s => s.campanha_id === salaSelId) || lista[0];
    if (!sel) return;
    resetarControlesPainel();
    etapaDados = null;
    etapaChaveCarregada = "";
    await ctxJogo.salvarEstado(
      {
        fase: "jogando",
        campanha_id: sel.campanha_id,
        titulo_sala: sel.titulo || "Sala de Fuga",
        etapa: 1,
        painel_jogador: painelInicial,
        alternar_papeis: alternarPapeis,
        tentativas: 0,
        inicio_ms: Date.now(),
        fim_ms: null,
        ultima_msg: null,
        feedback_erro: null
      },
      { rodada: 1 }
    );
  }

  function meuPapelAtual(est, eu) {
    return Number(est.painel_jogador || 0) === eu ? "painel" : "manual";
  }

  async function carregarEtapaAtual() {
    if (!ctxJogo || !ctxJogo.partida) return;
    const { sb, sala, eu } = ctxJogo.dadosSala;
    const p = ctxJogo.partida;
    const est = p.estado || {};
    if (est.fase !== "jogando" || !est.campanha_id) return;

    const papel = meuPapelAtual(est, eu);
    const chave = `${est.campanha_id}|${est.etapa}|${papel}`;
    if (etapaChaveCarregada === chave && etapaDados) return;

    const { data, error } = await sb.rpc("jogo_fuga_obter_etapa", {
      p_sala_codigo: sala,
      p_partida_id: p.id,
      p_campanha_id: est.campanha_id,
      p_etapa: Number(est.etapa || 1),
      p_papel: papel
    });
    if (error || !data) {
      ctxJogo.aviso((error && error.message) || "Erro ao carregar etapa da sala.");
      return;
    }
    etapaDados = data;
    etapaChaveCarregada = chave;
    resetarControlesPainel();
  }

  async function testarTrava(tipo) {
    if (validando || !ctxJogo || !ctxJogo.partida) return;
    const { sb, sala } = ctxJogo.dadosSala;
    const p = ctxJogo.partida;
    const est = p.estado || {};

    let resposta = {};
    if (tipo === "cofre") {
      if (cofreDigitos.length < 4) {
        ctxJogo.aviso("Digite os 4 dígitos antes de testar.");
        return;
      }
      resposta = { codigo: cofreDigitos };
    } else if (tipo === "interruptores") {
      resposta = { chaves: chavesEstado.slice() };
    } else if (tipo === "relogio") {
      resposta = { hora: relogioHora, minuto: relogioMin };
    } else if (tipo === "simbolos") {
      if (simbolosSeq.length < 4) {
        ctxJogo.aviso("Selecione 4 símbolos na ordem antes de testar.");
        return;
      }
      resposta = { sequencia: simbolosSeq.slice() };
    }

    validando = true;
    try {
      const { data, error } = await sb.rpc("jogo_fuga_validar_trava", {
        p_sala_codigo: sala,
        p_partida_id: p.id,
        p_campanha_id: est.campanha_id,
        p_etapa: Number(est.etapa || 1),
        p_resposta: resposta
      });
      if (error || !data) {
        ctxJogo.aviso((error && error.message) || "Erro ao validar trava.");
        return;
      }

      if (!data.correto) {
        await ctxJogo.salvarEstado({
          tentativas: Number(est.tentativas || 0) + 1,
          feedback_erro: data.mensagem || "Combinação incorreta."
        });
        return;
      }

      if (data.concluido) {
        const novoPlacar = { ...(p.placar || {}) };
        novoPlacar["0"] = (Number(novoPlacar["0"]) || 0) + 1;
        novoPlacar["1"] = (Number(novoPlacar["1"]) || 0) + 1;
        await ctxJogo.salvarEstado(
          {
            fase: "concluido",
            fim_ms: Date.now(),
            ultima_msg: data.mensagem || "Sala concluída!",
            feedback_erro: null
          },
          { placar: novoPlacar }
        );
        return;
      }

      const proxPainel = est.alternar_papeis ? 1 - Number(est.painel_jogador || 0) : Number(est.painel_jogador || 0);
      etapaDados = null;
      etapaChaveCarregada = "";
      await ctxJogo.salvarEstado(
        {
          etapa: Number(data.proxima_etapa || (Number(est.etapa || 1) + 1)),
          painel_jogador: proxPainel,
          ultima_msg: data.mensagem || "Trava liberada!",
          feedback_erro: null
        },
        { rodada: Number(data.proxima_etapa || 1) }
      );
    } finally {
      validando = false;
    }
  }

  function renderPainelConteudo(cont) {
    const box = el("div", "jogos-fuga-painel");
    const tipo = cont.tipo || "cofre";
    if (cont.instrucao) box.appendChild(el("p", "jogos-sub", cont.instrucao));
    if (cont.rotulo_etiqueta) box.appendChild(el("span", "jogos-selo", cont.rotulo_etiqueta));
    if (cont.indicador) box.appendChild(el("span", "jogos-selo", cont.indicador));
    if (cont.referencia) box.appendChild(el("span", "jogos-selo", cont.referencia));
    if (cont.dica_painel) box.appendChild(el("p", "jogos-sub", cont.dica_painel));

    if (tipo === "cofre") {
      const visor = el("div", "jogos-fuga-visor", cofreDigitos.padEnd(4, "_").split("").join(" "));
      box.appendChild(visor);
      const tec = el("div", "jogos-fuga-teclado");
      ["1", "2", "3", "4", "5", "6", "7", "8", "9", "Limpar", "0", "Apagar"].forEach(k => {
        const b = el("button", "secondary jogos-fuga-tecla", k);
        b.type = "button";
        b.addEventListener("click", () => {
          if (k === "Limpar") cofreDigitos = "";
          else if (k === "Apagar") cofreDigitos = cofreDigitos.slice(0, -1);
          else if (cofreDigitos.length < 4) cofreDigitos += k;
          render();
        });
        tec.appendChild(b);
      });
      box.appendChild(tec);
    } else if (tipo === "interruptores") {
      const nomesChaves = Array.isArray(cont.chaves) ? cont.chaves : ["Chave 1", "Chave 2", "Chave 3", "Chave 4"];
      const grid = el("div", "jogos-duelo-grid");
      nomesChaves.forEach((rot, idx) => {
        const ligado = !!chavesEstado[idx];
        const b = el("button", ligado ? "primary jogos-duelo-btn" : "secondary jogos-duelo-btn", `${rot}: ${ligado ? "LIGADO" : "DESLIGADO"}`);
        b.type = "button";
        b.setAttribute("aria-pressed", ligado ? "true" : "false");
        b.addEventListener("click", () => {
          chavesEstado[idx] = !chavesEstado[idx];
          render();
        });
        grid.appendChild(b);
      });
      box.appendChild(grid);
    } else if (tipo === "relogio") {
      const wrapR = el("div", "jogos-relogio-wrap");
      wrapR.appendChild(criarSvgRelogio(relogioHora, relogioMin));
      wrapR.appendChild(el("div", "jogos-fuga-visor", `${String(relogioHora).padStart(2, "0")}:${String(relogioMin).padStart(2, "0")}`));
      const ctrls = el("div", "jogos-acoes-linha");
      [
        ["-1h", () => { relogioHora = relogioHora <= 1 ? 12 : relogioHora - 1; }],
        ["+1h", () => { relogioHora = relogioHora >= 12 ? 1 : relogioHora + 1; }],
        ["-5m", () => { relogioMin = (relogioMin + 55) % 60; }],
        ["+5m", () => { relogioMin = (relogioMin + 5) % 60; }]
      ].forEach(([rot, fn]) => {
        const b = el("button", "secondary", rot);
        b.type = "button";
        b.addEventListener("click", () => { fn(); render(); });
        ctrls.appendChild(b);
      });
      wrapR.appendChild(ctrls);
      box.appendChild(wrapR);
    } else if (tipo === "simbolos") {
      const seqTxt = simbolosSeq.length ? simbolosSeq.map(s => SIMBOLOS_NOMES[s] || s).join(" -> ") : "Toque nos 4 símbolos na ordem";
      box.appendChild(el("div", "jogos-sintonia-medidor", seqTxt));
      const syms = Array.isArray(cont.simbolos) ? cont.simbolos : ["circulo", "triangulo", "quadrado", "losango"];
      const grid = el("div", "jogos-grade-4");
      syms.forEach(s => {
        const b = el("button", "secondary jogos-fuga-simb-btn");
        b.type = "button";
        b.setAttribute("aria-label", SIMBOLOS_NOMES[s] || s);
        b.appendChild(criarSvgSimbolo(s));
        b.appendChild(el("span", "", SIMBOLOS_NOMES[s] || s));
        b.disabled = simbolosSeq.length >= 4;
        b.addEventListener("click", () => {
          if (simbolosSeq.length < 4) {
            simbolosSeq.push(s);
            render();
          }
        });
        grid.appendChild(b);
      });
      box.appendChild(grid);
      const bLimpar = el("button", "linkbtn", "Limpar sequência");
      bLimpar.type = "button";
      bLimpar.addEventListener("click", () => { simbolosSeq = []; render(); });
      box.appendChild(bLimpar);
    }

    const bTestar = el("button", "primary", "Testar trava");
    bTestar.type = "button";
    bTestar.addEventListener("click", () => testarTrava(tipo));
    box.appendChild(bTestar);
    return box;
  }

  function renderManualConteudo(cont) {
    const box = el("div", "jogos-fuga-manual");
    const paginas = Array.isArray(cont.paginas) ? cont.paginas : [];
    if (!paginas.length) {
      box.appendChild(el("p", "jogos-sub", "Sem páginas de manual para esta etapa."));
      return box;
    }
    const idx = Math.max(0, Math.min(paginas.length - 1, paginaManual));
    const pag = paginas[idx];
    box.appendChild(el("p", "jogos-rodada-lbl", `Página ${idx + 1} de ${paginas.length} · ${pag.titulo || ""}`));
    box.appendChild(el("p", "jogos-narrativa", pag.texto || ""));

    if (paginas.length > 1) {
      const nav = el("div", "jogos-acoes-linha");
      const bAnt = el("button", "secondary", "Página anterior");
      bAnt.type = "button";
      bAnt.disabled = idx === 0;
      bAnt.addEventListener("click", () => { paginaManual = Math.max(0, idx - 1); render(); });
      const bProx = el("button", "secondary", "Próxima página");
      bProx.type = "button";
      bProx.disabled = idx >= paginas.length - 1;
      bProx.addEventListener("click", () => { paginaManual = Math.min(paginas.length - 1, idx + 1); render(); });
      nav.append(bAnt, bProx);
      box.appendChild(nav);
    }
    return box;
  }

  async function renderLobby() {
    limparTimerDecorrido();
    const lista = await carregarCatalogo(ctxJogo.dadosSala.sb);
    if (!raiz) return;
    const { nomes } = ctxJogo.dadosSala;

    raiz.textContent = "";
    const card = el("div", "jogos-subcard");
    card.appendChild(el("p", "jogos-rodada-lbl", "Escolha uma sala de fuga"));

    const col = el("div", "jogos-acoes-col");
    lista.forEach(item => {
      const b = el("button", salaSelId === item.campanha_id ? "primary jogos-opcao-musica" : "secondary jogos-opcao-musica");
      b.type = "button";
      b.appendChild(el("strong", "", `${item.titulo || ""} (${item.total_etapas || 5} travas)`));
      b.appendChild(el("span", "jogos-sub", item.sinopse || ""));
      b.addEventListener("click", () => { salaSelId = item.campanha_id; renderLobby(); });
      col.appendChild(b);
    });
    card.appendChild(col);

    const papBox = el("div", "jogos-cenario-box");
    papBox.appendChild(el("p", "jogos-rodada-lbl", "Papéis iniciais"));
    papBox.appendChild(el("p", "jogos-sub", `Painel interativo: ${nomes[painelInicial]} · Manual técnico: ${nomes[1 - painelInicial]}`));
    const ctrls = el("div", "jogos-acoes-linha");
    const bTrocar = el("button", "secondary", "Trocar quem começa no Painel");
    bTrocar.type = "button";
    bTrocar.addEventListener("click", () => { painelInicial = 1 - painelInicial; renderLobby(); });
    const bAlt = el("button", "jogos-chip", alternarPapeis ? "Alternar papéis a cada trava" : "Manter papéis fixos");
    bAlt.type = "button";
    bAlt.setAttribute("aria-pressed", alternarPapeis ? "true" : "false");
    bAlt.addEventListener("click", () => { alternarPapeis = !alternarPapeis; renderLobby(); });
    ctrls.append(bTrocar, bAlt);
    papBox.appendChild(ctrls);
    card.appendChild(papBox);

    const bIni = el("button", "primary", "Entrar na sala");
    bIni.type = "button";
    bIni.addEventListener("click", iniciarSala);
    card.appendChild(bIni);
    raiz.appendChild(card);
  }

  async function render() {
    if (!raiz || !ctxJogo || !ctxJogo.partida) return;
    const est = ctxJogo.partida.estado || {};
    const fase = est.fase || "lobby";

    if (fase === "lobby" || !est.campanha_id) {
      await renderLobby();
      return;
    }

    if (fase === "concluido") {
      limparTimerDecorrido();
      raiz.textContent = "";
      const card = el("div", "jogos-subcard");
      card.appendChild(el("p", "jogos-rodada-lbl", est.titulo_sala || "Sala de Fuga"));
      card.appendChild(el("p", "jogos-destaque", "Sala concluída!"));
      if (est.ultima_msg) card.appendChild(el("p", "jogos-sub", est.ultima_msg));
      const dur = est.inicio_ms && est.fim_ms ? fmtTempo(est.fim_ms - est.inicio_ms) : "00:00";
      card.appendChild(el("p", "jogos-sub", `Tempo total: ${dur} · Tentativas incorretas: ${est.tentativas || 0}`));
      const bOutra = el("button", "primary", "Escolher outra sala");
      bOutra.type = "button";
      bOutra.addEventListener("click", () => ctxJogo.salvarEstado({ fase: "lobby" }));
      card.appendChild(bOutra);
      raiz.appendChild(card);
      return;
    }

    await carregarEtapaAtual();
    if (!etapaDados || !raiz) return;

    const { eu } = ctxJogo.dadosSala;
    const papel = meuPapelAtual(est, eu);

    raiz.textContent = "";
    const card = el("div", "jogos-subcard");

    const topoLinha = el("div", "jogos-fuga-topo-info");
    topoLinha.appendChild(el("span", "jogos-rodada-lbl", `Trava ${etapaDados.etapa} de ${etapaDados.total_etapas} · Seu papel: ${papel === "painel" ? "Painel" : "Manual"}`));
    const cronoEl = el("span", "jogos-selo", fmtTempo(Date.now() - Number(est.inicio_ms || Date.now())));
    topoLinha.appendChild(cronoEl);
    card.appendChild(topoLinha);

    limparTimerDecorrido();
    timerDecorrido = setInterval(() => {
      if (cronoEl.isConnected && est.inicio_ms) {
        cronoEl.textContent = fmtTempo(Date.now() - Number(est.inicio_ms));
      }
    }, 1000);

    if (est.ultima_msg) {
      const okBox = el("div", "jogos-recompensa-destaque");
      okBox.appendChild(el("p", "jogos-sub", est.ultima_msg));
      card.appendChild(okBox);
    }

    card.appendChild(el("h3", "jogos-destaque", etapaDados.titulo || ""));
    card.appendChild(el("p", "jogos-sub", etapaDados.contexto || ""));

    if (est.feedback_erro) {
      card.appendChild(el("p", "jogos-fuga-erro", `${est.feedback_erro} (Tentativas: ${est.tentativas || 0})`));
    }

    if (papel === "painel") {
      card.appendChild(renderPainelConteudo(etapaDados.conteudo || {}));
    } else {
      card.appendChild(renderManualConteudo(etapaDados.conteudo || {}));
    }

    const bTrocar = el("button", "linkbtn", "Sair desta sala");
    bTrocar.type = "button";
    bTrocar.addEventListener("click", () => ctxJogo.salvarEstado({ fase: "lobby" }));
    card.appendChild(bTrocar);

    raiz.appendChild(card);
  }

  window.JogosHub.registrar("sala-de-fuga", {
    async montar(container, ctx) {
      raiz = container;
      ctxJogo = ctx;
      etapaDados = null;
      etapaChaveCarregada = "";
      await render();
    },
    async aoAtualizar() {
      await render();
    },
    desmontar() {
      limparTimerDecorrido();
      raiz = null;
      ctxJogo = null;
    }
  });
})();
