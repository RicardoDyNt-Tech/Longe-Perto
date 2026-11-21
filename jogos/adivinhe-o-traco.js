// Jogo: Adivinhe o traço — Longe & Perto
(function () {
  const CORES = [
    { nome: "Preto", valor: "#1b1a17" },
    { nome: "Terracota", valor: "#c2410c" },
    { nome: "Azul", valor: "#1d4ed8" },
    { nome: "Verde", valor: "#15803d" }
  ];

  let raiz = null;
  let ctxJogo = null;
  let banco = null;
  let segredoLocal = null;
  let segredoRodada = 0;
  let tracosLocais = [];
  let tracoAtual = null;
  let desenhando = false;
  let corAtual = CORES[0].valor;
  let borracha = false;
  let espessura = 10;
  let canvasEl = null;
  let tamCanvas = { w: 300, h: 400 };
  let timerSync = null;
  let syncPendente = false;

  function el(tag, cls, txt) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt !== undefined && txt !== null) n.textContent = txt;
    return n;
  }

  function limparTimerSync() {
    if (timerSync) {
      clearTimeout(timerSync);
      timerSync = null;
    }
    syncPendente = false;
  }

  async function carregarBanco(sb) {
    if (banco) return banco;
    const { data, error } = await sb
      .from("jogos_conteudo")
      .select("id, categoria, dados")
      .eq("jogo_id", "adivinhe-o-traco")
      .eq("ativo", true);
    if (error || !Array.isArray(data)) return [];
    banco = data;
    return banco;
  }

  function pintarTraco(ctx, t, w, h) {
    const pts = Array.isArray(t && t.pts) ? t.pts : [];
    if (!pts.length) return;
    ctx.save();
    ctx.globalCompositeOperation = t.cor === "apagar" ? "destination-out" : "source-over";
    ctx.strokeStyle = ctx.fillStyle = t.cor === "apagar" ? "#000" : (t.cor || CORES[0].valor);
    ctx.lineWidth = (Number(t.esp) || 10) * w / 1000;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const px = p => p[0] * w / 1000;
    const py = p => p[1] * h / 1000;
    if (pts.length === 1) {
      ctx.beginPath();
      ctx.arc(px(pts[0]), py(pts[0]), ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    if (pts.length === 2) {
      ctx.beginPath();
      ctx.moveTo(px(pts[0]), py(pts[0]));
      ctx.lineTo(px(pts[1]), py(pts[1]));
      ctx.stroke();
      ctx.restore();
      return;
    }
    ctx.beginPath();
    ctx.moveTo(px(pts[0]), py(pts[0]));
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (px(pts[i]) + px(pts[i + 1])) / 2;
      const my = (py(pts[i]) + py(pts[i + 1])) / 2;
      ctx.quadraticCurveTo(px(pts[i]), py(pts[i]), mx, my);
    }
    const ult = pts[pts.length - 1];
    ctx.lineTo(px(ult), py(ult));
    ctx.stroke();
    ctx.restore();
  }

  function prepararCanvas(cv, ts) {
    if (!cv) return;
    const maxW = Math.min(360, (cv.parentElement && cv.parentElement.clientWidth) || 300);
    const ratio = window.devicePixelRatio || 1;
    const w = Math.max(180, Math.floor(maxW));
    const h = Math.round(w * 4 / 3);
    cv.style.width = w + "px";
    cv.style.height = h + "px";
    cv.width = Math.round(w * ratio);
    cv.height = Math.round(h * ratio);
    tamCanvas = { w, h };
    const ctx = cv.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, w, h);
    (ts || []).forEach(t => pintarTraco(ctx, t, w, h));
  }

  function pontoNormalizado(ev) {
    const r = canvasEl.getBoundingClientRect();
    const x = Math.max(0, Math.min(1000, Math.round(((ev.clientX - r.left) / r.width) * 1000)));
    const y = Math.max(0, Math.min(1000, Math.round(((ev.clientY - r.top) / r.height) * 1000)));
    return [x, y];
  }

  function agendarSyncTracos() {
    syncPendente = true;
    if (timerSync) return;
    timerSync = setTimeout(async () => {
      timerSync = null;
      if (!syncPendente || !ctxJogo) return;
      syncPendente = false;
      await ctxJogo.salvarEstado({ tracos: tracosLocais });
    }, 350);
  }

  async function flushTracos() {
    limparTimerSync();
    if (ctxJogo) {
      await ctxJogo.salvarEstado({ tracos: tracosLocais });
    }
  }

  async function sortearEIniciar() {
    const { sb } = ctxJogo.dadosSala;
    const p = ctxJogo.partida;
    const est = (p && p.estado) || {};
    const lista = await carregarBanco(sb);
    if (!lista.length) {
      ctxJogo.aviso("Nenhuma palavra cadastrada para Adivinhe o traço.");
      return;
    }
    const usados = Array.isArray(est.usados) ? est.usados : [];
    let pool = lista.filter(x => !usados.includes(x.id));
    if (!pool.length) pool = lista;
    const item = pool[Math.floor(Math.random() * pool.length)];
    const palavra = (item.dados && item.dados.palavra) || "Mistério";
    const dica = (item.dados && item.dados.dica) || "";
    const rodada = Number(p.rodada || 1);

    const ok = await ctxJogo.enviarSegredo(rodada, "palavra", { palavra, dica });
    if (!ok) return;

    segredoLocal = { palavra, dica };
    segredoRodada = rodada;
    tracosLocais = [];
    await ctxJogo.salvarEstado({
      fase: "desenhando",
      desenhista: Number(est.desenhista || 0),
      dica,
      letras: `${palavra.replace(/\s+/g, "").length} letras`,
      tracos: [],
      resultado: null,
      palavra_revelada: null,
      usados: usados.concat(item.id).slice(-40)
    });
    await ctxJogo.iniciarCronometro(60, aoZerarTempo);
  }

  async function revelar(resultado) {
    if (!ctxJogo || !ctxJogo.partida) return;
    const p = ctxJogo.partida;
    const est = p.estado || {};
    if (est.fase !== "desenhando") return;
    ctxJogo.pararCronometro();
    await flushTracos();

    const rodada = Number(p.rodada || 1);
    const revs = await ctxJogo.revelarRodada(rodada);
    const item = revs.find(r => r.chave === "palavra") || revs[0];
    const palavra = (item && item.valor && item.valor.palavra) || (segredoLocal && segredoLocal.palavra) || "";

    let novoPlacar = { ...(p.placar || {}) };
    if (resultado === "acertou") {
      const adivinhador = String(1 - Number(est.desenhista || 0));
      novoPlacar[adivinhador] = (Number(novoPlacar[adivinhador]) || 0) + 1;
    }
    await ctxJogo.salvarEstado(
      {
        fase: "revelado",
        resultado,
        palavra_revelada: palavra,
        cronometro_fim: 0
      },
      { placar: novoPlacar }
    );
  }

  async function aoZerarTempo() {
    if (!ctxJogo || !ctxJogo.partida) return;
    const { eu } = ctxJogo.dadosSala;
    const est = ctxJogo.partida.estado || {};
    if (est.fase === "desenhando" && Number(est.desenhista || 0) === eu) {
      await revelar("tempo");
    }
  }

  async function proximaRodada() {
    if (!ctxJogo || !ctxJogo.partida) return;
    const p = ctxJogo.partida;
    const est = p.estado || {};
    const proxDesenhista = 1 - Number(est.desenhista || 0);
    segredoLocal = null;
    tracosLocais = [];
    await ctxJogo.salvarEstado(
      {
        fase: "pronto",
        desenhista: proxDesenhista,
        dica: null,
        letras: null,
        tracos: [],
        resultado: null,
        palavra_revelada: null,
        cronometro_fim: 0
      },
      { rodada: Number(p.rodada || 1) + 1 }
    );
  }

  async function garantirSegredoDesenhista() {
    if (!ctxJogo || !ctxJogo.partida) return;
    const { eu } = ctxJogo.dadosSala;
    const p = ctxJogo.partida;
    const est = p.estado || {};
    const rodada = Number(p.rodada || 1);
    if (est.fase === "desenhando" && Number(est.desenhista || 0) === eu && segredoRodada !== rodada) {
      segredoRodada = rodada;
      const val = await ctxJogo.lerMeuSegredo(rodada, "palavra");
      if (val) {
        segredoLocal = val;
        render();
      }
    }
  }

  function render() {
    if (!raiz || !ctxJogo || !ctxJogo.partida) return;
    const p = ctxJogo.partida;
    const est = p.estado || {};
    const { eu, nomes } = ctxJogo.dadosSala;
    const desenhista = Number(est.desenhista || 0);
    const souDesenhista = desenhista === eu;
    const fase = est.fase || "pronto";

    raiz.textContent = "";

    const infoCard = el("div", "jogos-subcard");
    infoCard.appendChild(el("p", "jogos-rodada-lbl", `Rodada ${p.rodada || 1} · Quem desenha: ${nomes[desenhista]}`));

    if (fase === "pronto") {
      if (souDesenhista) {
        infoCard.appendChild(el("p", "jogos-sub", "Sua vez de desenhar. Sorteie a palavra e você terá 60 segundos."));
        const btn = el("button", "primary", "Sortear palavra e começar");
        btn.type = "button";
        btn.addEventListener("click", sortearEIniciar);
        infoCard.appendChild(btn);
      } else {
        infoCard.appendChild(el("p", "jogos-sub", `Aguardando ${nomes[desenhista]} sortear a palavra e iniciar o desenho.`));
      }
      raiz.appendChild(infoCard);
      return;
    }

    if (fase === "desenhando") {
      if (souDesenhista) {
        const pal = (segredoLocal && segredoLocal.palavra) || "...";
        infoCard.appendChild(el("p", "jogos-destaque", pal));
        if (segredoLocal && segredoLocal.dica) {
          infoCard.appendChild(el("p", "jogos-sub", `Dica compartilhada: ${segredoLocal.dica}`));
        }
      } else {
        infoCard.appendChild(el("p", "jogos-destaque", est.letras || "Adivinhe o desenho"));
        if (est.dica) {
          infoCard.appendChild(el("p", "jogos-sub", `Dica: ${est.dica}`));
        }
      }
    } else if (fase === "revelado") {
      const msg = est.resultado === "acertou"
        ? `Acertaram! A palavra era: ${est.palavra_revelada || ""}`
        : est.resultado === "tempo"
          ? `Tempo esgotado. A palavra era: ${est.palavra_revelada || ""}`
          : `Rodada pulada. A palavra era: ${est.palavra_revelada || ""}`;
      infoCard.appendChild(el("p", "jogos-destaque", msg));
      const btnProx = el("button", "primary", "Próxima rodada");
      btnProx.type = "button";
      btnProx.addEventListener("click", proximaRodada);
      infoCard.appendChild(btnProx);
    }

    raiz.appendChild(infoCard);

    if (fase === "desenhando") {
      tracosLocais = Array.isArray(est.tracos) ? est.tracos.map(t => ({ ...t, pts: (t.pts || []).slice() })) : [];
    }

    const wrapCanvas = el("div", "jogos-canvas-wrap");
    canvasEl = document.createElement("canvas");
    canvasEl.className = "jogos-canvas";
    if (!souDesenhista || fase !== "desenhando") {
      canvasEl.classList.add("somente-leitura");
    }
    wrapCanvas.appendChild(canvasEl);
    raiz.appendChild(wrapCanvas);

    requestAnimationFrame(() => prepararCanvas(canvasEl, tracosLocais));

    if (souDesenhista && fase === "desenhando") {
      const ferr = el("div", "jogos-canvas-ferr");
      CORES.forEach(c => {
        const b = el("button", "jogos-cor-btn");
        b.type = "button";
        b.setAttribute("aria-label", c.nome);
        b.style.backgroundColor = c.valor;
        b.setAttribute("aria-pressed", !borracha && corAtual === c.valor ? "true" : "false");
        b.addEventListener("click", () => {
          borracha = false;
          corAtual = c.valor;
          render();
        });
        ferr.appendChild(b);
      });

      const btnBorr = el("button", "jogos-chip", "Borracha");
      btnBorr.type = "button";
      btnBorr.setAttribute("aria-pressed", borracha ? "true" : "false");
      btnBorr.addEventListener("click", () => { borracha = !borracha; render(); });

      const btnDesf = el("button", "jogos-chip", "Desfazer");
      btnDesf.type = "button";
      btnDesf.addEventListener("click", async () => {
        if (!tracosLocais.length) return;
        tracosLocais.pop();
        prepararCanvas(canvasEl, tracosLocais);
        await flushTracos();
      });

      const btnLimp = el("button", "jogos-chip", "Limpar");
      btnLimp.type = "button";
      btnLimp.addEventListener("click", async () => {
        tracosLocais = [];
        prepararCanvas(canvasEl, tracosLocais);
        await flushTracos();
      });

      ferr.append(btnBorr, btnDesf, btnLimp);
      raiz.appendChild(ferr);

      const acoes = el("div", "jogos-acoes-linha");
      const btnAc = el("button", "primary", "Acertou (+1)");
      btnAc.type = "button";
      btnAc.addEventListener("click", () => revelar("acertou"));
      const btnPul = el("button", "secondary", "Pular");
      btnPul.type = "button";
      btnPul.addEventListener("click", () => revelar("pulou"));
      acoes.append(btnAc, btnPul);
      raiz.appendChild(acoes);

      canvasEl.addEventListener("pointerdown", ev => {
        ev.preventDefault();
        try { canvasEl.setPointerCapture(ev.pointerId); } catch (e) { }
        desenhando = true;
        tracoAtual = { cor: borracha ? "apagar" : corAtual, esp: borracha ? 26 : espessura, pts: [pontoNormalizado(ev)] };
        tracosLocais.push(tracoAtual);
        pintarTraco(canvasEl.getContext("2d"), tracoAtual, tamCanvas.w, tamCanvas.h);
        agendarSyncTracos();
      });
      canvasEl.addEventListener("pointermove", ev => {
        if (!desenhando || !tracoAtual) return;
        const pt = pontoNormalizado(ev);
        const ult = tracoAtual.pts[tracoAtual.pts.length - 1];
        if (ult && Math.abs(pt[0] - ult[0]) + Math.abs(pt[1] - ult[1]) < 4) return;
        tracoAtual.pts.push(pt);
        prepararCanvas(canvasEl, tracosLocais);
        agendarSyncTracos();
      });
      const terminar = async () => {
        if (!desenhando) return;
        desenhando = false;
        tracoAtual = null;
        await flushTracos();
      };
      canvasEl.addEventListener("pointerup", terminar);
      canvasEl.addEventListener("pointercancel", terminar);
    }
  }

  window.JogosHub.registrar("adivinhe-o-traco", {
    async montar(container, ctx) {
      raiz = container;
      ctxJogo = ctx;
      segredoLocal = null;
      segredoRodada = 0;
      await garantirSegredoDesenhista();
      render();
    },
    async aoAtualizar() {
      await garantirSegredoDesenhista();
      if (!desenhando) render();
    },
    desmontar() {
      limparTimerSync();
      desenhando = false;
      tracoAtual = null;
      canvasEl = null;
      raiz = null;
      ctxJogo = null;
    }
  });
})();
