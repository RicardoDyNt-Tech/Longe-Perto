// Jogo: Sintonizador — Longe & Perto
(function () {
  let raiz = null;
  let ctxJogo = null;
  let banco = null;
  let cartasSala = [];
  let vistosSet = new Set();
  let salaCarregada = null;
  let segredoAlvo = null;
  let segredoRodada = 0;
  let timerPonteiro = null;
  let ponteiroLocal = 50;
  let arrastando = false;
  let categoriaFiltro = "todos";
  let gavetaAberta = false;
  let gerandoIa = false;
  let restantesIaHoje = null;
  let ultimosGeradosIa = [];

  const CATEGORIAS = [
    { id: "todos", label: "Todos" },
    { id: "cotidiano", label: "Cotidiano" },
    { id: "casal", label: "Casal" },
    { id: "cultura-pop", label: "Cultura pop" },
    { id: "absurdo", label: "Absurdo" },
    { id: "nossos", label: "Nossos" },
    { id: "ousado", label: "Ousado", ousado: true }
  ];

  const DURACOES = [
    { valor: 6, label: "6 rodadas" },
    { valor: 10, label: "10 rodadas" },
    { valor: null, label: "Livre" }
  ];

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

  function calcularPontos(dist) {
    if (dist === 0) return { pts: 5, rotulo: "Alvo exato!" };
    if (dist <= 5) return { pts: 4, rotulo: "Na mosca!" };
    if (dist <= 12) return { pts: 3, rotulo: "Muito perto!" };
    if (dist <= 20) return { pts: 2, rotulo: "Perto!" };
    if (dist <= 30) return { pts: 1, rotulo: "Quase!" };
    return { pts: 0, rotulo: "Passou longe" };
  }

  function classificarSintonia(media) {
    if (media >= 3.8) return "Sintonia fina";
    if (media >= 2.8) return "Na mesma frequência";
    if (media >= 1.8) return "Boa conexão";
    return "Aquecendo o radar";
  }

  function limiteRodadasAtual(p) {
    const est = (p && p.estado) || {};
    if (Object.prototype.hasOwnProperty.call(est, "limite_rodadas")) {
      return est.limite_rodadas === 6 || est.limite_rodadas === 10 ? est.limite_rodadas : null;
    }
    const rodada = Number((p && p.rodada) || 1);
    const fase = est.fase || "inicio";
    if (rodada === 1 && fase === "inicio") return 10;
    return null;
  }

  function normalizarCategoriaItem(item) {
    if (item.origem === "casal" || item.origem === "ia") return item.categoria || "nossos";
    const c = (item.categoria || "geral").toLowerCase();
    if (c === "romantico") return "casal";
    return c;
  }

  async function carregarBanco(sb) {
    if (banco) return banco;
    const { data, error } = await sb
      .from("jogos_conteudo")
      .select("id, categoria, ousado, dados")
      .eq("jogo_id", "sintonizador")
      .eq("ativo", true);
    if (error || !Array.isArray(data)) return [];
    banco = data.map(row => ({
      id: String(row.id),
      categoria: row.categoria || "geral",
      ousado: !!row.ousado,
      dados: row.dados || {},
      origem: "banco"
    }));
    return banco;
  }

  async function carregarDadosSala(forcar) {
    if (!ctxJogo) return;
    const { sb, sala } = ctxJogo.dadosSala;
    if (!sb || !sala) return;
    if (!forcar && salaCarregada === sala && banco) return;

    const [_, resProprias, resVistos] = await Promise.all([
      carregarBanco(sb),
      sb
        .from("jogos_cartas_sala")
        .select("id, dados, criado_em")
        .eq("sala_codigo", sala)
        .eq("jogo_id", "sintonizador")
        .order("criado_em", { ascending: false }),
      sb
        .from("jogos_baralho_visto")
        .select("item_id")
        .eq("sala_codigo", sala)
        .eq("jogo_id", "sintonizador")
    ]);

    cartasSala = Array.isArray(resProprias && resProprias.data)
      ? resProprias.data.map(row => {
          const d = row.dados || {};
          return {
            id: String(row.id),
            categoria: d.categoria || "nossos",
            ousado: !!d.ousado || d.categoria === "ousado",
            dados: {
              esquerda: d.esquerda || "",
              direita: d.direita || "",
              origem: d.origem || "casal"
            },
            origem: d.origem || "casal"
          };
        })
      : [];

    vistosSet = new Set(
      Array.isArray(resVistos && resVistos.data)
        ? resVistos.data.map(r => String(r.item_id))
        : []
    );
    salaCarregada = sala;
  }

  function todosItensDisponiveis() {
    const { permitidoOusado } = ctxJogo ? ctxJogo.dadosSala : { permitidoOusado: false };
    const lista = [...(banco || []), ...cartasSala];
    return lista.filter(item => !!permitidoOusado || !item.ousado);
  }

  function itensNoFiltro(cat) {
    const { permitidoOusado } = ctxJogo ? ctxJogo.dadosSala : { permitidoOusado: false };
    const ativa = cat === "ousado" && !permitidoOusado ? "todos" : cat;
    const disponiveis = todosItensDisponiveis();
    if (ativa === "todos") return disponiveis;
    if (ativa === "nossos") return disponiveis.filter(i => i.origem === "casal" || i.origem === "ia");
    if (ativa === "ousado") return disponiveis.filter(i => i.ousado);
    return disponiveis.filter(i => normalizarCategoriaItem(i) === ativa);
  }

  async function registrarItemVisto(itemId) {
    if (!ctxJogo || !itemId) return;
    const { sb, sala } = ctxJogo.dadosSala;
    const idStr = String(itemId);
    vistosSet.add(idStr);
    if (!sb || !sala) return;
    await sb
      .from("jogos_baralho_visto")
      .upsert(
        {
          sala_codigo: sala,
          jogo_id: "sintonizador",
          item_id: idStr,
          visto_em: new Date().toISOString()
        },
        { onConflict: "sala_codigo,jogo_id,item_id" }
      );
  }

  async function limparVistos(idsAlvo, mostrarAviso) {
    if (!ctxJogo) return;
    const { sb, sala } = ctxJogo.dadosSala;
    if (!sb || !sala) return;
    let q = sb
      .from("jogos_baralho_visto")
      .delete()
      .eq("sala_codigo", sala)
      .eq("jogo_id", "sintonizador");

    if (Array.isArray(idsAlvo) && idsAlvo.length) {
      q = q.in("item_id", idsAlvo);
      idsAlvo.forEach(id => vistosSet.delete(String(id)));
    } else {
      vistosSet.clear();
    }

    const { error } = await q;
    if (error) {
      ctxJogo.aviso("Não foi possível reembaralhar o baralho agora.");
      return;
    }
    if (mostrarAviso) {
      ctxJogo.aviso(mostrarAviso);
    }
    render();
  }

  async function definirLimiteRodadas(novoLimite) {
    if (!ctxJogo || !ctxJogo.partida) return;
    const p = ctxJogo.partida;
    const est = p.estado || {};
    const rodada = Number(p.rodada || 1);
    const fase = est.fase || "inicio";
    if (rodada > 1 || (fase !== "inicio" && fase !== "palpite")) return;
    await ctxJogo.salvarEstado({ limite_rodadas: novoLimite });
  }

  async function sortearRodada() {
    await carregarDadosSala(false);
    const p = ctxJogo.partida;
    const est = (p && p.estado) || {};
    const poolFiltrado = itensNoFiltro(categoriaFiltro);
    if (!poolFiltrado.length) {
      ctxJogo.aviso("Nenhum espectro disponível nesta categoria.");
      return;
    }

    let candidatos = poolFiltrado.filter(item => !vistosSet.has(String(item.id)));
    if (!candidatos.length) {
      const idsLimpar = poolFiltrado.map(item => String(item.id));
      await limparVistos(idsLimpar, "Todos os espectros foram jogados — baralho reembaralhado.");
      candidatos = poolFiltrado;
    }

    const item = candidatos[Math.floor(Math.random() * candidatos.length)];
    const d = item.dados || {};
    const alvo = 5 + Math.floor(Math.random() * 91);
    const rodada = Number(p.rodada || 1);
    const guia = Number(est.guia || 0);
    const limite = limiteRodadasAtual(p);

    const ok = await ctxJogo.enviarSegredo(rodada, "alvo", { alvo });
    if (!ok) return;

    await registrarItemVisto(item.id);

    segredoAlvo = alvo;
    segredoRodada = rodada;
    ponteiroLocal = 50;
    await ctxJogo.salvarEstado({
      fase: "palpite",
      guia,
      limite_rodadas: limite,
      categoria_filtro: categoriaFiltro,
      item_id_atual: String(item.id),
      esquerda: d.esquerda || "Mínimo",
      direita: d.direita || "Máximo",
      ponteiro: 50,
      alvo_revelado: null,
      pontos_rodada: null,
      rotulo_rodada: null
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

    const exatosAtuais = Number(est.acertos_exatos || 0) + (dist === 0 ? 1 : 0);
    const pontosPartidaAtuais = Number(est.pontos_partida || 0) + pts;
    const rodadasConcluidas = Number(est.rodadas_concluidas || 0) + 1;

    await ctxJogo.salvarEstado(
      {
        fase: "revelado",
        ponteiro: ponteiroLocal,
        alvo_revelado: alvo,
        pontos_rodada: pts,
        rotulo_rodada: rotulo,
        acertos_exatos: exatosAtuais,
        pontos_partida: pontosPartidaAtuais,
        rodadas_concluidas: rodadasConcluidas
      },
      { placar: novoPlacar }
    );
  }

  async function proximaRodada() {
    const p = ctxJogo.partida;
    const est = p.estado || {};
    const limite = limiteRodadasAtual(p);
    const rodadaAtual = Number(p.rodada || 1);

    if (limite && rodadaAtual >= limite) {
      await ctxJogo.salvarEstado({ fase: "resumo" });
      return;
    }

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
      { rodada: rodadaAtual + 1 }
    );
  }

  async function jogarOutraPartida() {
    const p = ctxJogo.partida;
    const est = p.estado || {};
    const limite = limiteRodadasAtual(p);
    segredoAlvo = null;
    segredoRodada = 0;
    ponteiroLocal = 50;
    await ctxJogo.salvarEstado(
      {
        fase: "inicio",
        guia: 1 - Number(est.guia || 0),
        limite_rodadas: limite,
        esquerda: null,
        direita: null,
        ponteiro: 50,
        alvo_revelado: null,
        pontos_rodada: null,
        rotulo_rodada: null,
        acertos_exatos: 0,
        pontos_partida: 0,
        rodadas_concluidas: 0
      },
      { rodada: 1, placar: { "0": 0, "1": 0 } }
    );
  }

  async function adicionarEspectroProprio(esquerdaRaw, direitaRaw) {
    if (!ctxJogo) return false;
    const { sb, sala } = ctxJogo.dadosSala;
    const esquerda = String(esquerdaRaw || "").replace(/\s+/g, " ").trim().slice(0, 40);
    const direita = String(direitaRaw || "").replace(/\s+/g, " ").trim().slice(0, 40);
    if (esquerda.length < 2 || direita.length < 2) {
      ctxJogo.aviso("Preencha os dois extremos do espectro.");
      return false;
    }
    if (esquerda.toLowerCase() === direita.toLowerCase()) {
      ctxJogo.aviso("Os dois extremos precisam ser diferentes.");
      return false;
    }
    const { data, error } = await sb
      .from("jogos_cartas_sala")
      .insert({
        sala_codigo: sala,
        jogo_id: "sintonizador",
        dados: { esquerda, direita, origem: "casal" }
      })
      .select("id, dados")
      .single();

    if (error || !data) {
      ctxJogo.aviso((error && error.message) || "Não foi possível salvar o espectro.");
      return false;
    }

    cartasSala.unshift({
      id: String(data.id),
      categoria: "nossos",
      ousado: false,
      dados: { esquerda, direita, origem: "casal" },
      origem: "casal"
    });
    ctxJogo.aviso("Espectro adicionado ao baralho da sala.");
    render();
    return true;
  }

  async function removerEspectroProprio(id) {
    if (!ctxJogo || !id) return;
    const { sb, sala } = ctxJogo.dadosSala;
    const { error } = await sb
      .from("jogos_cartas_sala")
      .delete()
      .eq("id", id)
      .eq("sala_codigo", sala)
      .eq("jogo_id", "sintonizador");

    if (error) {
      ctxJogo.aviso("Não foi possível remover o espectro.");
      return;
    }
    cartasSala = cartasSala.filter(c => String(c.id) !== String(id));
    vistosSet.delete(String(id));
    ctxJogo.aviso("Espectro removido.");
    render();
  }

  async function gerarComIa() {
    if (!ctxJogo || gerandoIa) return;
    const { sb, sala, permitidoIa, permitidoOusado } = ctxJogo.dadosSala;
    if (!permitidoIa) {
      ctxJogo.aviso("A geração com IA está desativada nas Configurações.");
      return;
    }

    gerandoIa = true;
    render();

    try {
      const catParaIa = categoriaFiltro === "todos" || categoriaFiltro === "nossos"
        ? "geral"
        : (categoriaFiltro === "ousado" && !permitidoOusado ? "geral" : categoriaFiltro);

      const todos = todosItensDisponiveis();
      const evitar = todos
        .filter(i => vistosSet.has(String(i.id)) || i.origem === "ia" || i.origem === "casal")
        .slice(0, 15)
        .map(i => `${i.dados.esquerda} / ${i.dados.direita}`);

      const { data, error } = await sb.functions.invoke("gerar-espectros", {
        body: {
          sala_codigo: sala,
          categoria: catParaIa,
          permitir_ousado: !!permitidoOusado,
          quantidade: 5,
          evitar
        }
      });

      if (error) {
        let msg = "Não foi possível gerar espectros agora.";
        let statusHttp = 0;
        try {
          if (error.context && typeof error.context.status === "number") {
            statusHttp = error.context.status;
          }
          if (error.context && typeof error.context.json === "function") {
            const bodyErr = await error.context.json();
            if (bodyErr && bodyErr.mensagem) msg = bodyErr.mensagem;
            if (bodyErr && typeof bodyErr.restantes_hoje === "number") {
              restantesIaHoje = bodyErr.restantes_hoje;
            }
          }
        } catch (_) {}
        if (statusHttp === 429) {
          restantesIaHoje = 0;
          if (msg === "Não foi possível gerar espectros agora.") {
            msg = "Limite diário de gerações de IA atingido. Tente novamente amanhã.";
          }
        }
        ctxJogo.aviso(msg);
        return;
      }

      if (!data || !Array.isArray(data.pares) || !data.pares.length) {
        ctxJogo.aviso((data && data.mensagem) || "A IA não retornou novos espectros.");
        return;
      }

      if (typeof data.restantes_hoje === "number") {
        restantesIaHoje = data.restantes_hoje;
      }

      const linhasInsert = data.pares.map(par => ({
        sala_codigo: sala,
        jogo_id: "sintonizador",
        dados: {
          esquerda: String(par.esquerda || "").trim().slice(0, 40),
          direita: String(par.direita || "").trim().slice(0, 40),
          categoria: par.categoria || catParaIa,
          ousado: par.categoria === "ousado" && !!permitidoOusado,
          origem: "ia"
        }
      })).filter(r => r.dados.esquerda && r.dados.direita);

      if (linhasInsert.length) {
        const { data: inseridos, error: errIns } = await sb
          .from("jogos_cartas_sala")
          .insert(linhasInsert)
          .select("id, dados");

        if (!errIns && Array.isArray(inseridos)) {
          const novos = inseridos.map(row => ({
            id: String(row.id),
            categoria: (row.dados && row.dados.categoria) || "nossos",
            ousado: !!(row.dados && row.dados.ousado),
            dados: row.dados || {},
            origem: "ia"
          }));
          cartasSala = [...novos, ...cartasSala];
          ultimosGeradosIa = novos.map(n => n.dados);
          ctxJogo.aviso(`${novos.length} novos espectros salvos no baralho da sala.`);
        } else {
          ctxJogo.aviso("Espectros gerados, mas houve erro ao salvar na sala.");
        }
      }
    } catch (_) {
      ctxJogo.aviso("Falha de conexão ao gerar espectros com IA.");
    } finally {
      gerandoIa = false;
      render();
    }
  }

  async function garantirAlvoGuia() {
    if (!ctxJogo || !ctxJogo.partida) return;
    const { eu } = ctxJogo.dadosSala;
    const p = ctxJogo.partida;
    const est = p.estado || {};
    const rodada = Number(p.rodada || 1);
    if (est.item_id_atual) {
      vistosSet.add(String(est.item_id_atual));
    }
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

  function renderSeletorDuracao(p) {
    const limite = limiteRodadasAtual(p);
    const box = el("div", "jogos-sint-bloco");
    box.appendChild(el("p", "jogos-sint-rotulo", "Duração da partida"));
    const seg = el("div", "jogos-sint-duracao");
    seg.setAttribute("role", "group");
    seg.setAttribute("aria-label", "Duração da partida");

    DURACOES.forEach(op => {
      const btn = el("button", "jogos-chip jogos-sint-dur-btn", op.label);
      btn.type = "button";
      const ativo = limite === op.valor;
      btn.setAttribute("aria-pressed", ativo ? "true" : "false");
      btn.addEventListener("click", () => definirLimiteRodadas(op.valor));
      seg.appendChild(btn);
    });

    box.appendChild(seg);
    return box;
  }

  function renderFiltrosEBaralho() {
    const { permitidoOusado } = ctxJogo.dadosSala;
    if (categoriaFiltro === "ousado" && !permitidoOusado) {
      categoriaFiltro = "todos";
    }

    const wrap = el("div", "jogos-sint-bloco");
    const chips = el("div", "jogos-filtros jogos-sint-cats");
    CATEGORIAS.forEach(cat => {
      if (cat.ousado && !permitidoOusado) return;
      const btn = el("button", "jogos-chip", cat.label);
      btn.type = "button";
      btn.setAttribute("aria-pressed", categoriaFiltro === cat.id ? "true" : "false");
      btn.addEventListener("click", () => {
        categoriaFiltro = cat.id;
        render();
      });
      chips.appendChild(btn);
    });
    wrap.appendChild(chips);

    const pool = itensNoFiltro(categoriaFiltro);
    const total = pool.length;
    const restantes = pool.filter(i => !vistosSet.has(String(i.id))).length;

    const statusBar = el("div", "jogos-sint-baralho");
    statusBar.appendChild(
      el(
        "span",
        "jogos-sint-contador",
        total > 0 ? `Restam ${restantes} de ${total} sem repetir` : "Nenhum espectro nesta categoria"
      )
    );

    if (vistosSet.size > 0) {
      const btnRe = el("button", "linkbtn jogos-sint-reembaralhar", "Reembaralhar baralho");
      btnRe.type = "button";
      btnRe.addEventListener("click", () => limparVistos(null, "Baralho reembaralhado."));
      statusBar.appendChild(btnRe);
    }

    wrap.appendChild(statusBar);
    return wrap;
  }

  function renderGavetaNossos() {
    const { permitidoIa } = ctxJogo.dadosSala;
    const det = el("details", "jogos-detalhes jogos-sint-gaveta");
    det.open = gavetaAberta;
    det.addEventListener("toggle", () => {
      gavetaAberta = det.open;
    });

    const sum = el("summary", "", `Nossos espectros (${cartasSala.length})`);
    det.appendChild(sum);

    const corpo = el("div", "jogos-detalhes-corpo jogos-sint-gaveta-corpo");

    const form = el("form", "jogos-sint-form");
    const inEsq = document.createElement("input");
    inEsq.type = "text";
    inEsq.maxLength = 40;
    inEsq.placeholder = "Extremo esquerdo (ex.: Café fraco)";
    inEsq.setAttribute("aria-label", "Extremo esquerdo");

    const inDir = document.createElement("input");
    inDir.type = "text";
    inDir.maxLength = 40;
    inDir.placeholder = "Extremo direito (ex.: Café forte)";
    inDir.setAttribute("aria-label", "Extremo direito");

    const btnAdd = el("button", "secondary", "Adicionar");
    btnAdd.type = "submit";

    form.append(inEsq, inDir, btnAdd);
    form.addEventListener("submit", async ev => {
      ev.preventDefault();
      btnAdd.disabled = true;
      const ok = await adicionarEspectroProprio(inEsq.value, inDir.value);
      btnAdd.disabled = false;
      if (ok) {
        inEsq.value = "";
        inDir.value = "";
      }
    });
    corpo.appendChild(form);

    if (permitidoIa) {
      const iaBox = el("div", "jogos-sint-ia");
      const btnIa = el(
        "button",
        "secondary",
        gerandoIa ? "Gerando novos espectros..." : "Gerar 5 com IA"
      );
      btnIa.type = "button";
      btnIa.disabled = gerandoIa || restantesIaHoje === 0;
      btnIa.addEventListener("click", gerarComIa);
      iaBox.appendChild(btnIa);

      if (typeof restantesIaHoje === "number") {
        iaBox.appendChild(
          el("p", "jogos-sint-ia-cota", `Restam ${restantesIaHoje} gerações hoje`)
        );
      }

      if (ultimosGeradosIa.length) {
        const boxRec = el("div", "jogos-sint-ia-rec");
        boxRec.appendChild(el("p", "jogos-sint-rotulo", "Recém-gerados pela IA"));
        ultimosGeradosIa.forEach(par => {
          boxRec.appendChild(el("p", "jogos-sub", `${par.esquerda} — ${par.direita}`));
        });
        iaBox.appendChild(boxRec);
      }

      corpo.appendChild(iaBox);
    }

    if (cartasSala.length) {
      const lista = el("div", "jogos-sint-lista");
      cartasSala.forEach(item => {
        const linha = el("div", "jogos-sint-item");
        const txt = el("div", "jogos-sint-item-txt");
        txt.appendChild(el("span", "jogos-sint-item-par", `${item.dados.esquerda} — ${item.dados.direita}`));
        txt.appendChild(el("span", "jogos-selo", item.origem === "ia" ? "IA" : "Casal"));
        const btnRem = el("button", "linkbtn jogos-sint-rem", "Remover");
        btnRem.type = "button";
        btnRem.addEventListener("click", () => removerEspectroProprio(item.id));
        linha.append(txt, btnRem);
        lista.appendChild(linha);
      });
      corpo.appendChild(lista);
    } else {
      corpo.appendChild(el("p", "jogos-sub", "Vocês ainda não criaram espectros próprios nesta sala."));
    }

    det.appendChild(corpo);
    return det;
  }

  function renderResumo(p, est) {
    const card = el("div", "jogos-subcard jogos-sint-resumo");
    const limite = limiteRodadasAtual(p);
    const totalRodadas = Math.max(1, Number(est.rodadas_concluidas || limite || p.rodada || 1));
    const placar = p.placar || {};
    const somaPlacar = (Number(placar["0"] || 0) || 0) + (Number(placar["1"] || 0) || 0);
    const totalPts = typeof est.pontos_partida === "number" && est.pontos_partida > 0
      ? est.pontos_partida
      : somaPlacar;
    const media = totalPts / totalRodadas;
    const mediaFmt = media.toFixed(1).replace(".", ",");
    const exatos = Number(est.acertos_exatos || 0);

    card.appendChild(el("p", "jogos-rodada-lbl", "Resumo da sintonia"));
    card.appendChild(el("p", "jogos-destaque", classificarSintonia(media)));
    card.appendChild(el("p", "jogos-sub", `${totalPts} pontos em ${totalRodadas} rodadas`));

    const metricas = el("div", "jogos-sint-metricas");
    const mMedia = el("div", "jogos-sint-metrica");
    mMedia.appendChild(el("span", "jogos-sint-metrica-val", `${mediaFmt} pts/rodada`));
    mMedia.appendChild(el("span", "jogos-sint-metrica-lbl", "Média por rodada"));

    const mExatos = el("div", "jogos-sint-metrica");
    mExatos.appendChild(el("span", "jogos-sint-metrica-val", String(exatos)));
    mExatos.appendChild(el("span", "jogos-sint-metrica-lbl", "Acertos exatos (+5)"));

    metricas.append(mMedia, mExatos);
    card.appendChild(metricas);

    const btnOutra = el("button", "primary", "Jogar outra");
    btnOutra.type = "button";
    btnOutra.addEventListener("click", jogarOutraPartida);
    card.appendChild(btnOutra);

    return card;
  }

  function render() {
    if (!raiz || !ctxJogo || !ctxJogo.partida) return;
    const p = ctxJogo.partida;
    const est = p.estado || {};
    const { eu, nomes } = ctxJogo.dadosSala;
    const guia = Number(est.guia || 0);
    const souGuia = guia === eu;
    const fase = est.fase || "inicio";
    const rodada = Number(p.rodada || 1);
    const limite = limiteRodadasAtual(p);

    if (!arrastando && typeof est.ponteiro === "number") {
      ponteiroLocal = est.ponteiro;
    }

    raiz.textContent = "";

    if (fase === "resumo") {
      raiz.appendChild(renderResumo(p, est));
      return;
    }

    const card = el("div", "jogos-subcard");
    const rotuloRodada = limite
      ? `Rodada ${rodada} de ${limite} · Guia: ${nomes[guia]}`
      : `Rodada ${rodada} · Guia: ${nomes[guia]}`;
    card.appendChild(el("p", "jogos-rodada-lbl", rotuloRodada));

    if (rodada === 1 && (fase === "inicio" || fase === "palpite")) {
      card.appendChild(renderSeletorDuracao(p));
    }

    if (fase === "inicio") {
      card.appendChild(renderFiltrosEBaralho());
      if (souGuia) {
        card.appendChild(el("p", "jogos-sub", "Você é o Guia. Sorteie o espectro e dê uma pista falada na chamada para o outro acertar o alvo."));
        const btn = el("button", "primary", "Sortear espectro e alvo");
        btn.type = "button";
        btn.addEventListener("click", sortearRodada);
        card.appendChild(btn);
      } else {
        card.appendChild(el("p", "jogos-sub", `Aguardando ${nomes[guia]} sortear o alvo da rodada.`));
      }
      card.appendChild(renderGavetaNossos());
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
      const ultimaRodada = !!(limite && rodada >= limite);
      const btnProx = el("button", "primary", ultimaRodada ? "Ver resumo da partida" : "Próxima rodada");
      btnProx.type = "button";
      btnProx.addEventListener("click", proximaRodada);
      card.appendChild(btnProx);
    }

    card.appendChild(renderGavetaNossos());
    raiz.appendChild(card);
  }

  window.JogosHub.registrar("sintonizador", {
    async montar(container, ctx) {
      raiz = container;
      ctxJogo = ctx;
      segredoAlvo = null;
      segredoRodada = 0;
      ultimosGeradosIa = [];
      await Promise.all([carregarDadosSala(true), garantirAlvoGuia()]);
      render();
    },
    async aoAtualizar() {
      await garantirAlvoGuia();
      if (!arrastando) render();
    },
    desmontar() {
      limparTimer();
      arrastando = false;
      gerandoIa = false;
      raiz = null;
      ctxJogo = null;
    }
  });
})();
