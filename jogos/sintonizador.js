// Jogo: Sintonizador — Longe & Perto
(function () {
  let raiz = null;
  let ctxJogo = null;
  let banco = null;
  let segredoAlvo = null;
  let segredoRodada = 0;
  let timerPonteiro = null;
  let ponteiroLocal = 50;
  let arrastando = false;

  function el(tag, cls, txt) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt !== undefined && txt !== null) n.textContent = txt;
    return n;
  }

  function limparTimer() {
    if (timerPonteiro) {
      clearTimeout(timerPonteiro);
      timerPonteiro = null;
    }
  }

  async function carregarBanco(sb) {
    if (banco) return banco;
    const { data, error } = await sb
      .from("jogos_conteudo")
      .select("id, ousado, dados")
      .eq("jogo_id", "sintonizador")
      .eq("ativo", true);
    if (error || !Array.isArray(data)) return [];
    banco = data;
    return banco;
  }

  function calcularPontos(dist) {
    if (dist <= 5) return { pts: 4, rotulo: "Na mosca!" };
    if (dist <= 12) return { pts: 3, rotulo: "Muito perto!" };
    if (dist <= 20) return { pts: 2, rotulo: "Perto!" };
    if (dist <= 30) return { pts: 1, rotulo: "Quase!" };
    return { pts: 0, rotulo: "Passou longe" };
  }

  async function sortearRodada() {
    const { sb, permitidoOusado } = ctxJogo.dadosSala;
    const p = ctxJogo.partida;
    const est = (p && p.estado) || {};
    const lista = (await carregarBanco(sb)).filter(x => !!permitidoOusado || !x.ousado);
    if (!lista.length) {
      ctxJogo.aviso("Nenhum par de extremos disponível.");
      return;
    }
    const usados = Array.isArray(est.usados) ? est.usados : [];
    let pool = lista.filter(x => !usados.includes(x.id));
    if (!pool.length) pool = lista;
    const item = pool[Math.floor(Math.random() * pool.length)];
    const d = item.dados || {};
    const alvo = 5 + Math.floor(Math.random() * 91);
    const rodada = Number(p.rodada || 1);
    const guia = Number(est.guia || 0);

    const ok = await ctxJogo.enviarSegredo(rodada, "alvo", { alvo });
    if (!ok) return;

    segredoAlvo = alvo;
    segredoRodada = rodada;
    ponteiroLocal = 50;
    await ctxJogo.salvarEstado({
      fase: "palpite",
      guia,
      esquerda: d.esquerda || "Mínimo",
      direita: d.direita || "Máximo",
      ponteiro: 50,
      alvo_revelado: null,
      pontos_rodada: null,
      rotulo_rodada: null,
      usados: usados.concat(item.id).slice(-35)
    });
  }

  function agendarSyncPonteiro(val) {
    ponteiroLocal = Number(val);
    if (timerPonteiro) return;
    timerPonteiro = setTimeout(async () => {
      timerPonteiro = null;
      if (ctxJogo && ctxJogo.partida && (ctxJogo.partida.estado || {}).fase === "palpite") {
        await ctxJogo.salvarEstado({ ponteiro: ponteiroLocal });
      }
    }, 200);
  }

  async function travarPalpite() {
    limparTimer();
    const p = ctxJogo.partida;
    const est = p.estado || {};
    const rodada = Number(p.rodada || 1);
    const revs = await ctxJogo.revelarRodada(rodada);
    const item = revs.find(r => r.chave === "alvo") || revs[0];
    const alvo = item && item.valor ? Number(item.valor.alvo) : 50;
    const dist = Math.abs(Number(ponteiroLocal) - alvo);
    const { pts, rotulo } = calcularPontos(dist);

    const novoPlacar = { ...(p.placar || {}) };
    if (pts > 0) {
      const sint = String(1 - Number(est.guia || 0));
      novoPlacar[sint] = (Number(novoPlacar[sint]) || 0) + pts;
    }

    await ctxJogo.salvarEstado(
      {
        fase: "revelado",
        ponteiro: ponteiroLocal,
        alvo_revelado: alvo,
        pontos_rodada: pts,
        rotulo_rodada: rotulo
      },
      { placar: novoPlacar }
    );
  }

  async function proximaRodada() {
    const p = ctxJogo.partida;
    const est = p.estado || {};
    segredoAlvo = null;
    segredoRodada = 0;
    ponteiroLocal = 50;
    await ctxJogo.salvarEstado(
      {
        fase: "inicio",
        guia: 1 - Number(est.guia || 0),
        esquerda: null,
        direita: null,
        ponteiro: 50,
        alvo_revelado: null,
        pontos_rodada: null,
        rotulo_rodada: null
      },
      { rodada: Number(p.rodada || 1) + 1 }
    );
  }

  async function garantirAlvoGuia() {
    if (!ctxJogo || !ctxJogo.partida) return;
    const { eu } = ctxJogo.dadosSala;
    const p = ctxJogo.partida;
    const est = p.estado || {};
    const rodada = Number(p.rodada || 1);
    if (est.fase === "palpite" && Number(est.guia || 0) === eu && segredoRodada !== rodada) {
      const val = await ctxJogo.lerMeuSegredo(rodada, "alvo");
      segredoAlvo = val && typeof val.alvo === "number" ? val.alvo : null;
      segredoRodada = rodada;
    }
  }

  function renderBarra(est, souGuia, fase) {
    const wrap = el("div", "jogos-espectro-wrap");
    const ext = el("div", "jogos-espectro-extremos");
    ext.appendChild(el("span", "", est.esquerda || ""));
    ext.appendChild(el("span", "", est.direita || ""));
    wrap.appendChild(ext);

    const pista = el("div", "jogos-espectro-pista");
    const alvoMostrar = fase === "revelado" ? est.alvo_revelado : (souGuia ? segredoAlvo : null);
    if (typeof alvoMostrar === "number") {
      const zona = el("div", "jogos-espectro-zona");
      const esq = Math.max(0, Math.min(90, alvoMostrar - 5));
      zona.style.left = `${esq}%`;
      zona.style.width = "10%";
      pista.appendChild(zona);

      const pinoAlvo = el("div", "jogos-espectro-alvo");
      pinoAlvo.style.left = `${alvoMostrar}%`;
      pista.appendChild(pinoAlvo);
    }

    const valPonteiro = !souGuia && fase === "palpite" ? ponteiroLocal : Number(est.ponteiro ?? 50);
    const pino = el("div", "jogos-espectro-ponteiro");
    pino.style.left = `${valPonteiro}%`;
    pista.appendChild(pino);
    wrap.appendChild(pista);

    if (!souGuia && fase === "palpite") {
      const range = document.createElement("input");
      range.type = "range";
      range.className = "jogos-espectro-range";
      range.min = "0";
      range.max = "100";
      range.value = String(ponteiroLocal);
      range.setAttribute("aria-label", "Posição no espectro");
      range.addEventListener("input", () => {
        arrastando = true;
        pino.style.left = `${range.value}%`;
        agendarSyncPonteiro(range.value);
      });
      range.addEventListener("change", () => {
        arrastando = false;
        agendarSyncPonteiro(range.value);
      });
      wrap.appendChild(range);
    }

    return wrap;
  }

  function render() {
    if (!raiz || !ctxJogo || !ctxJogo.partida) return;
    const p = ctxJogo.partida;
    const est = p.estado || {};
    const { eu, nomes } = ctxJogo.dadosSala;
    const guia = Number(est.guia || 0);
    const souGuia = guia === eu;
    const fase = est.fase || "inicio";

    if (!arrastando && typeof est.ponteiro === "number") {
      ponteiroLocal = est.ponteiro;
    }

    raiz.textContent = "";
    const card = el("div", "jogos-subcard");
    card.appendChild(el("p", "jogos-rodada-lbl", `Rodada ${p.rodada || 1} · Guia: ${nomes[guia]}`));

    if (fase === "inicio") {
      if (souGuia) {
        card.appendChild(el("p", "jogos-sub", "Você é o Guia. Sorteie o espectro e dê uma pista falada na chamada para o outro acertar o alvo."));
        const btn = el("button", "primary", "Sortear espectro e alvo");
        btn.type = "button";
        btn.addEventListener("click", sortearRodada);
        card.appendChild(btn);
      } else {
        card.appendChild(el("p", "jogos-sub", `Aguardando ${nomes[guia]} sortear o alvo da rodada.`));
      }
      raiz.appendChild(card);
      return;
    }

    if (fase === "palpite") {
      card.appendChild(el("p", "jogos-sub", souGuia
        ? `Alvo secreto: ${typeof segredoAlvo === "number" ? segredoAlvo : "..."}%. Dê uma pista para ${nomes[1 - guia]} posicionar o ponteiro.`
        : `Ouça a pista de ${nomes[guia]}, arraste o ponteiro e trave seu palpite.`));
      card.appendChild(renderBarra(est, souGuia, fase));

      if (!souGuia) {
        const btn = el("button", "primary", "Travar palpite");
        btn.type = "button";
        btn.addEventListener("click", travarPalpite);
        card.appendChild(btn);
      }
    } else if (fase === "revelado") {
      card.appendChild(el("p", "jogos-destaque", `${est.rotulo_rodada || ""} (+${est.pontos_rodada || 0} pts)`));
      card.appendChild(el("p", "jogos-sub", `Alvo: ${est.alvo_revelado}% · Palpite: ${est.ponteiro}%`));
      card.appendChild(renderBarra(est, souGuia, fase));
      const btnProx = el("button", "primary", "Próxima rodada");
      btnProx.type = "button";
      btnProx.addEventListener("click", proximaRodada);
      card.appendChild(btnProx);
    }

    raiz.appendChild(card);
  }

  window.JogosHub.registrar("sintonizador", {
    async montar(container, ctx) {
      raiz = container;
      ctxJogo = ctx;
      segredoAlvo = null;
      segredoRodada = 0;
      await garantirAlvoGuia();
      render();
    },
    async aoAtualizar() {
      await garantirAlvoGuia();
      if (!arrastando) render();
    },
    desmontar() {
      limparTimer();
      arrastando = false;
      raiz = null;
      ctxJogo = null;
    }
  });
})();
