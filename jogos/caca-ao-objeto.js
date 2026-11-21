// Jogo: Caça ao objeto — Longe & Perto
(function () {
  let raiz = null;
  let ctxJogo = null;
  let banco = null;
  let minhaNota = null;
  let minhaNotaRodada = 0;
  let statusNotas = [];
  let notasReveladas = [];
  let notasRevRodada = 0;

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
      .select("id, modo, dados")
      .eq("jogo_id", "caca-ao-objeto")
      .eq("ativo", true);
    if (error || !Array.isArray(data)) return [];
    banco = data;
    return banco;
  }

  async function sortearEValer() {
    const { sb, juntos } = ctxJogo.dadosSala;
    const p = ctxJogo.partida;
    const est = (p && p.estado) || {};
    const modoAtual = juntos ? "juntos" : "longe";
    const lista = await carregarBanco(sb);
    const pool = lista.filter(item => item.modo === "ambos" || item.modo === modoAtual);
    const usados = Array.isArray(est.usados) ? est.usados : [];
    let naoUsados = pool.filter(item => !usados.includes(item.id));
    if (!naoUsados.length) naoUsados = pool;
    if (!naoUsados.length) {
      ctxJogo.aviso("Nenhum comando disponível para este modo.");
      return;
    }

    const item = naoUsados[Math.floor(Math.random() * naoUsados.length)];
    const comando = (item.dados && item.dados.comando) || "";
    minhaNota = null;
    notasReveladas = [];

    await ctxJogo.salvarEstado({
      fase: "corrida",
      comando,
      voltou_0: false,
      voltou_1: false,
      usados: usados.concat(item.id).slice(-30)
    });
    await ctxJogo.iniciarCronometro(60, aoZerarTempo);
  }

  async function aoZerarTempo() {
    if (!ctxJogo || !ctxJogo.partida) return;
    const est = ctxJogo.partida.estado || {};
    if (est.fase === "corrida") {
      await ctxJogo.salvarEstado({ fase: "avaliando", cronometro_fim: 0 });
    }
  }

  async function marcarVoltei() {
    const { eu } = ctxJogo.dadosSala;
    const est = (ctxJogo.partida && ctxJogo.partida.estado) || {};
    const patch = { [`voltou_${eu}`]: true };
    const outroVoltou = !!est[`voltou_${1 - eu}`];
    if (outroVoltou) {
      ctxJogo.pararCronometro();
      patch.fase = "avaliando";
      patch.cronometro_fim = 0;
    }
    await ctxJogo.salvarEstado(patch);
  }

  async function enviarNota(nota) {
    const p = ctxJogo.partida;
    const rodada = Number(p.rodada || 1);
    const ok = await ctxJogo.enviarSegredo(rodada, "nota", { nota: Number(nota) });
    if (!ok) return;
    minhaNota = Number(nota);
    minhaNotaRodada = rodada;
    await ctxJogo.salvarEstado({ ping_nota: Date.now() });
    await sincronizar();
  }

  async function proximaRodada() {
    const p = ctxJogo.partida;
    minhaNota = null;
    minhaNotaRodada = 0;
    statusNotas = [];
    notasReveladas = [];
    notasRevRodada = 0;
    await ctxJogo.salvarEstado(
      { fase: "inicio", comando: null, voltou_0: false, voltou_1: false, cronometro_fim: 0 },
      { rodada: Number(p.rodada || 1) + 1 }
    );
  }

  async function sincronizar() {
    if (!ctxJogo || !ctxJogo.partida) return;
    const p = ctxJogo.partida;
    const est = p.estado || {};
    const rodada = Number(p.rodada || 1);

    if (est.fase === "avaliando") {
      if (minhaNotaRodada !== rodada) {
        const salvo = await ctxJogo.lerMeuSegredo(rodada, "nota");
        minhaNota = salvo && typeof salvo.nota === "number" ? salvo.nota : null;
        minhaNotaRodada = rodada;
      }
      statusNotas = await ctxJogo.statusSegredos(rodada);
      if (statusNotas.some(s => s.jogador === "0") && statusNotas.some(s => s.jogador === "1")) {
        const revs = await ctxJogo.revelarRodada(rodada);
        const n0 = revs.find(r => r.jogador === "0");
        const n1 = revs.find(r => r.jogador === "1");
        if (n0 && n1 && n0.valor && n1.valor) {
          notasReveladas = revs;
          notasRevRodada = rodada;
          // Cada jogador avalia o objeto do outro: nota dada por 0 soma para 1, e vice-versa
          const novoPlacar = { ...(p.placar || {}) };
          novoPlacar["0"] = (Number(novoPlacar["0"]) || 0) + Number(n1.valor.nota || 0);
          novoPlacar["1"] = (Number(novoPlacar["1"]) || 0) + Number(n0.valor.nota || 0);
          await ctxJogo.salvarEstado({ fase: "revelado" }, { placar: novoPlacar });
          return;
        }
      }
    } else if (est.fase === "revelado" && notasRevRodada !== rodada) {
      notasReveladas = await ctxJogo.revelarRodada(rodada);
      notasRevRodada = rodada;
    }
    render();
  }

  function render() {
    if (!raiz || !ctxJogo || !ctxJogo.partida) return;
    const p = ctxJogo.partida;
    const est = p.estado || {};
    const { eu, nomes, juntos } = ctxJogo.dadosSala;
    const fase = est.fase || "inicio";

    raiz.textContent = "";
    const card = el("div", "jogos-subcard");
    card.appendChild(el("p", "jogos-rodada-lbl", `Rodada ${p.rodada || 1} · Modo ${juntos ? "Juntos" : "Longe"}`));

    if (fase === "inicio") {
      card.appendChild(el("p", "jogos-sub", "Ao tocar no botão, o comando aparece e vocês têm 60 segundos para buscar o objeto."));
      const btn = el("button", "primary", "Valendo (60s)");
      btn.type = "button";
      btn.addEventListener("click", sortearEValer);
      card.appendChild(btn);
      raiz.appendChild(card);
      return;
    }

    card.appendChild(el("p", "jogos-destaque", est.comando || ""));

    if (fase === "corrida") {
      const euVoltei = !!est[`voltou_${eu}`];
      const outroVoltou = !!est[`voltou_${1 - eu}`];
      card.appendChild(el("p", "jogos-sub", `${nomes[0]}: ${est.voltou_0 ? "voltou" : "buscando"} · ${nomes[1]}: ${est.voltou_1 ? "voltou" : "buscando"}`));
      const btn = el("button", euVoltei ? "secondary" : "primary", euVoltei ? (outroVoltou ? "Todos voltaram" : "Aguardando o outro...") : "Voltei!");
      btn.type = "button";
      btn.disabled = euVoltei;
      btn.addEventListener("click", marcarVoltei);
      card.appendChild(btn);
    } else if (fase === "avaliando") {
      const j0Ok = statusNotas.some(s => s.jogador === "0");
      const j1Ok = statusNotas.some(s => s.jogador === "1");
      card.appendChild(el("p", "jogos-sub", `Mostrem os objetos e deem uma nota secreta de criatividade para ${nomes[1 - eu]}:`));
      card.appendChild(el("p", "jogos-sub", `${nomes[0]}: ${j0Ok ? "avaliou" : "avaliando"} · ${nomes[1]}: ${j1Ok ? "avaliou" : "avaliando"}`));

      const row = el("div", "jogos-notas-linha");
      [1, 2, 3, 4, 5].forEach(n => {
        const b = el("button", minhaNota === n ? "primary jogos-nota-btn" : "secondary jogos-nota-btn", String(n));
        b.type = "button";
        b.disabled = minhaNota !== null;
        b.addEventListener("click", () => enviarNota(n));
        row.appendChild(b);
      });
      card.appendChild(row);
      if (minhaNota !== null) {
        card.appendChild(el("p", "jogos-sub", `Sua nota secreta enviada: ${minhaNota}/5`));
      }
    } else if (fase === "revelado") {
      const n0 = notasReveladas.find(r => r.jogador === "0");
      const n1 = notasReveladas.find(r => r.jogador === "1");
      const pts0 = n1 && n1.valor ? n1.valor.nota : 0;
      const pts1 = n0 && n0.valor ? n0.valor.nota : 0;
      card.appendChild(el("p", "jogos-sub", `Notas reveladas: ${nomes[0]} recebeu ${pts0}/5 · ${nomes[1]} recebeu ${pts1}/5`));
      const btnProx = el("button", "primary", "Próxima rodada");
      btnProx.type = "button";
      btnProx.addEventListener("click", proximaRodada);
      card.appendChild(btnProx);
    }

    raiz.appendChild(card);
  }

  window.JogosHub.registrar("caca-ao-objeto", {
    async montar(container, ctx) {
      raiz = container;
      ctxJogo = ctx;
      minhaNota = null;
      minhaNotaRodada = 0;
      statusNotas = [];
      notasReveladas = [];
      notasRevRodada = 0;
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
