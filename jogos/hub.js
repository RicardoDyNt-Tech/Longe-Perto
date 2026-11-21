// Motor modular do Hub de Jogos — Longe & Perto
(function () {
  const modulos = new Map();
  let cfg = {};
  let canal = null;
  let partidaAtual = null;
  let jogoAtual = null;
  let containerPalco = null;
  let timerId = null;
  let timerFimDisparado = 0;
  let callbackZerar = null;
  let refsShell = null;

  function el(tag, cls, txt) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt !== undefined && txt !== null) n.textContent = txt;
    return n;
  }

  function ctxDados() {
    const sb = typeof cfg.getSb === "function" ? cfg.getSb() : null;
    const sala = typeof cfg.getSala === "function" ? cfg.getSala() : null;
    const eu = typeof cfg.getEu === "function" ? cfg.getEu() : 0;
    const nomes = typeof cfg.getNomes === "function" ? cfg.getNomes() : ["Jogador 1", "Jogador 2"];
    const juntos = typeof cfg.isJuntos === "function" ? !!cfg.isJuntos() : false;
    const online = typeof cfg.isParceiroOnline === "function" ? !!cfg.isParceiroOnline() : false;
    const permitidoOusado = typeof cfg.permitidoOusado === "function" ? !!cfg.permitidoOusado() : false;
    return { sb, sala, eu, jogador: String(eu), nomes, juntos, online, permitidoOusado };
  }

  function notificar(msg) {
    if (typeof cfg.aviso === "function") cfg.aviso(msg);
  }

  function formatarPlacar(placar, nomes) {
    if (!placar || typeof placar !== "object") return "0 - 0";
    const p0 = Number(placar["0"] ?? placar.j0 ?? 0) || 0;
    const p1 = Number(placar["1"] ?? placar.j1 ?? 0) || 0;
    const n0 = (nomes && nomes[0]) || "J1";
    const n1 = (nomes && nomes[1]) || "J2";
    return `${n0} ${p0} x ${p1} ${n1}`;
  }

  function formatarSegundos(seg) {
    const s = Math.max(0, Math.ceil(seg));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  }

  function pararCronometro() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function atualizarTimerUI() {
    if (!refsShell || !refsShell.timerWrap || !refsShell.timerTexto) return;
    const fim = partidaAtual && partidaAtual.estado ? Number(partidaAtual.estado.cronometro_fim || 0) : 0;
    if (!fim) {
      refsShell.timerWrap.hidden = true;
      pararCronometro();
      return;
    }
    const rest = Math.max(0, Math.ceil((fim - Date.now()) / 1000));
    refsShell.timerWrap.hidden = false;
    refsShell.timerTexto.textContent = formatarSegundos(rest);
    if (rest <= 0) {
      pararCronometro();
      if (timerFimDisparado !== fim) {
        timerFimDisparado = fim;
        if (typeof callbackZerar === "function") {
          try { callbackZerar(partidaAtual); } catch (e) { }
        }
      }
    }
  }

  function sincronizarCronometroLocal() {
    pararCronometro();
    const fim = partidaAtual && partidaAtual.estado ? Number(partidaAtual.estado.cronometro_fim || 0) : 0;
    if (!fim) {
      if (refsShell && refsShell.timerWrap) refsShell.timerWrap.hidden = true;
      return;
    }
    atualizarTimerUI();
    if (fim > Date.now()) {
      timerId = setInterval(atualizarTimerUI, 250);
    }
  }

  function atualizarShell() {
    if (!refsShell || !partidaAtual) return;
    const { nomes, online } = ctxDados();
    refsShell.placar.textContent = formatarPlacar(partidaAtual.placar, nomes);
    refsShell.presenca.textContent = online ? `${nomes[1]} online` : `${nomes[1]} offline`;
    refsShell.presenca.classList.toggle("online", online);
    sincronizarCronometroLocal();
  }

  async function salvarEstado(patchEstado, patchExtra) {
    const { sb, sala } = ctxDados();
    if (!sb || !sala || !partidaAtual) return null;
    const novoEstado = { ...(partidaAtual.estado || {}), ...(patchEstado || {}) };
    const payload = {
      estado: novoEstado,
      atualizado_em: new Date().toISOString(),
      ...(patchExtra || {})
    };
    const { data, error } = await sb
      .from("jogos_partidas")
      .update(payload)
      .eq("id", partidaAtual.id)
      .eq("sala_codigo", sala)
      .select("*")
      .single();
    if (error) {
      notificar(error.message || "Erro ao salvar estado do jogo.");
      return null;
    }
    if (data) {
      partidaAtual = data;
      atualizarShell();
    }
    return data;
  }

  async function iniciarCronometro(segundos, aoZerar) {
    callbackZerar = typeof aoZerar === "function" ? aoZerar : null;
    timerFimDisparado = 0;
    const fim = Date.now() + Math.max(1, Number(segundos) || 0) * 1000;
    return salvarEstado({ cronometro_fim: fim });
  }

  function exigirPartida() {
    const { sb, sala, jogador } = ctxDados();
    if (!sb || !sala || !partidaAtual) {
      throw new Error("Nenhuma partida ativa no momento.");
    }
    return { sb, sala, jogador, partidaId: partidaAtual.id };
  }

  async function enviarSegredo(rodada, chave, valor) {
    const { sb, sala, jogador, partidaId } = exigirPartida();
    const { error } = await sb.rpc("jogo_enviar_segredo", {
      p_sala_codigo: sala,
      p_partida_id: partidaId,
      p_rodada: Number(rodada),
      p_jogador: jogador,
      p_chave: chave || "principal",
      p_valor: valor === undefined ? null : valor
    });
    if (error) {
      notificar(error.message || "Não foi possível enviar segredo.");
      return false;
    }
    return true;
  }

  async function lerMeuSegredo(rodada, chave) {
    const { sb, sala, jogador, partidaId } = exigirPartida();
    const { data, error } = await sb.rpc("jogo_ler_meu_segredo", {
      p_sala_codigo: sala,
      p_partida_id: partidaId,
      p_rodada: Number(rodada),
      p_jogador: jogador,
      p_chave: chave || "principal"
    });
    if (error) {
      notificar(error.message || "Não foi possível ler seu segredo.");
      return null;
    }
    return data ?? null;
  }

  async function statusSegredos(rodada) {
    const { sb, sala, partidaId } = exigirPartida();
    const { data, error } = await sb.rpc("jogo_status_segredos", {
      p_sala_codigo: sala,
      p_partida_id: partidaId,
      p_rodada: Number(rodada)
    });
    if (error) {
      notificar(error.message || "Não foi possível consultar segredos.");
      return [];
    }
    return Array.isArray(data) ? data : [];
  }

  async function revelarRodada(rodada) {
    const { sb, sala, partidaId } = exigirPartida();
    const { data, error } = await sb.rpc("jogo_revelar_rodada", {
      p_sala_codigo: sala,
      p_partida_id: partidaId,
      p_rodada: Number(rodada)
    });
    if (error) {
      notificar(error.message || "Não foi possível revelar a rodada.");
      return [];
    }
    return Array.isArray(data) ? data : [];
  }

  function montarShell(jogo) {
    if (!containerPalco) return null;
    containerPalco.textContent = "";

    const topo = el("div", "jogos-topo");
    const btnVoltar = el("button", "linkbtn voltar");
    btnVoltar.type = "button";
    if (typeof cfg.icone === "function") {
      btnVoltar.appendChild(cfg.icone("chevron-left", 16));
    }
    btnVoltar.appendChild(el("span", "", "Voltar"));
    btnVoltar.addEventListener("click", () => sairPartida());

    const titulo = el("h2", "jogos-topo-titulo", jogo.titulo);
    const meta = el("div", "jogos-topo-meta");
    const presenca = el("span", "jogos-presenca");
    const placar = el("span", "jogos-placar");
    meta.append(presenca, placar);

    topo.append(btnVoltar, titulo, meta);

    const timerWrap = el("div", "jogos-timer");
    timerWrap.hidden = true;
    if (typeof cfg.icone === "function") {
      timerWrap.appendChild(cfg.icone("timer", 14));
    }
    const timerTexto = el("span", "jogos-timer-txt", "0:00");
    timerWrap.appendChild(timerTexto);

    const corpo = el("div", "jogos-palco-corpo");
    containerPalco.append(topo, timerWrap, corpo);

    refsShell = { topo, presenca, placar, timerWrap, timerTexto, corpo };
    atualizarShell();
    return corpo;
  }

  function criarContextoJogo() {
    return {
      get partida() { return partidaAtual; },
      get jogo() { return jogoAtual; },
      get dadosSala() { return ctxDados(); },
      salvarEstado,
      iniciarCronometro,
      pararCronometro,
      enviarSegredo,
      lerMeuSegredo,
      statusSegredos,
      revelarRodada,
      sair: sairPartida,
      aviso: notificar
    };
  }

  async function limparCanal() {
    const { sb } = ctxDados();
    if (canal && sb) {
      try { await sb.removeChannel(canal); } catch (e) { }
    }
    canal = null;
  }

  async function abrirPartida(jogoId, palcoEl) {
    const { sb, sala } = ctxDados();
    const lista = Array.isArray(window.JOGOS_CATALOGO) ? window.JOGOS_CATALOGO : [];
    const jogo = lista.find(j => j.id === jogoId);
    const modulo = modulos.get(jogoId);
    if (!jogo || !modulo) {
      notificar("Este jogo ainda não está disponível.");
      return false;
    }
    if (!sb || !sala) {
      notificar("Entre em uma sala primeiro.");
      return false;
    }

    await sairPartida(true);
    containerPalco = palcoEl || document.getElementById("jogos-palco");
    jogoAtual = jogo;

    let { data: row, error } = await sb
      .from("jogos_partidas")
      .select("*")
      .eq("sala_codigo", sala)
      .eq("jogo_id", jogoId)
      .maybeSingle();

    if (error) {
      notificar(error.message || "Erro ao carregar partida.");
      return false;
    }

    if (!row) {
      const { data: criada, error: errIns } = await sb
        .from("jogos_partidas")
        .upsert(
          { sala_codigo: sala, jogo_id: jogoId, status: "ativa", rodada: 1, placar: {}, estado: {} },
          { onConflict: "sala_codigo,jogo_id" }
        )
        .select("*")
        .single();
      if (errIns) {
        notificar(errIns.message || "Erro ao iniciar partida.");
        return false;
      }
      row = criada;
    }

    partidaAtual = row;
    const corpo = montarShell(jogo);
    const ctx = criarContextoJogo();

    canal = sb
      .channel(`jogos-${sala}-${jogoId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "jogos_partidas",
          filter: `sala_codigo=eq.${sala}`
        },
        payload => {
          const nova = payload && payload.new;
          if (!nova || nova.jogo_id !== jogoId) return;
          partidaAtual = nova;
          atualizarShell();
          if (typeof modulo.aoAtualizar === "function") {
            modulo.aoAtualizar(partidaAtual, ctx);
          }
        }
      )
      .subscribe();

    if (typeof cfg.aoAbrir === "function") cfg.aoAbrir(jogo);
    if (typeof modulo.montar === "function") {
      modulo.montar(corpo, ctx);
    }
    return true;
  }

  async function sairPartida(silencioso) {
    pararCronometro();
    callbackZerar = null;
    timerFimDisparado = 0;
    if (jogoAtual) {
      const modulo = modulos.get(jogoAtual.id);
      if (modulo && typeof modulo.desmontar === "function") {
        try { modulo.desmontar(); } catch (e) { }
      }
    }
    await limparCanal();
    partidaAtual = null;
    jogoAtual = null;
    refsShell = null;
    if (containerPalco) containerPalco.textContent = "";
    if (!silencioso && typeof cfg.aoSair === "function") cfg.aoSair();
  }

  window.JogosHub = {
    configurar(opcoes) {
      cfg = { ...cfg, ...(opcoes || {}) };
    },
    registrar(jogoId, modulo) {
      if (jogoId && modulo) modulos.set(jogoId, modulo);
    },
    obterModulo(jogoId) {
      return modulos.get(jogoId) || null;
    },
    abrirPartida,
    salvarEstado,
    sairPartida,
    enviarSegredo,
    lerMeuSegredo,
    statusSegredos,
    revelarRodada,
    iniciarCronometro,
    pararCronometro,
    atualizarPresenca() {
      if (partidaAtual) atualizarShell();
    },
    get partidaAtual() {
      return partidaAtual;
    }
  };
})();
