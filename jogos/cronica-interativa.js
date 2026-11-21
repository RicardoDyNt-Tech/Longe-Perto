// Jogo: Crônica Interativa (RPG leve com Mestre IA) — Longe & Perto
(function () {
  const ATRIBUTOS = [
    { chave: "coragem", rotulo: "Coragem" },
    { chave: "astucia", rotulo: "Astúcia" },
    { chave: "sintonia", rotulo: "Sintonia" }
  ];

  let raiz = null;
  let ctxJogo = null;
  let cenarios = null;
  let cenarioSelId = null;
  let arquetipoSelId = null;
  let carregandoIa = false;
  let erroIa = null;
  let atributoRolagem = "coragem";

  function el(tag, cls, txt) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt !== undefined && txt !== null) n.textContent = txt;
    return n;
  }

  function clampEnergia(n) {
    return Math.max(0, Math.min(10, Math.round(Number(n) || 0)));
  }

  function faixaRolagem(total) {
    if (total >= 13) return "critico";
    if (total >= 9) return "sucesso";
    if (total >= 6) return "parcial";
    return "falha";
  }

  function rotuloFaixa(f) {
    if (f === "critico") return "Sucesso crítico";
    if (f === "sucesso") return "Sucesso";
    if (f === "parcial") return "Sucesso parcial";
    return "Falha";
  }

  async function carregarCenarios(sb) {
    if (cenarios) return cenarios;
    const { data, error } = await sb
      .from("jogos_conteudo")
      .select("id, dados")
      .eq("jogo_id", "cronica-interativa")
      .eq("ativo", true);
    if (error || !Array.isArray(data)) return [];
    cenarios = data.map(x => x.dados || {}).filter(d => d.cenario_id);
    if (!cenarioSelId && cenarios.length) cenarioSelId = cenarios[0].cenario_id;
    return cenarios;
  }

  function obterCenario(id) {
    if (!cenarios || !id) return null;
    return cenarios.find(c => c.cenario_id === id) || null;
  }

  async function selecionarCenario(cenarioId) {
    cenarioSelId = cenarioId;
    const cen = obterCenario(cenarioId);
    const arqs = (cen && cen.arquetipos) || [];
    arquetipoSelId = arqs[0] ? arqs[0].id : null;
    await ctxJogo.salvarEstado({
      fase: "lobby",
      cenario_id: cenarioId,
      ficha_0: null,
      ficha_1: null
    });
  }

  async function confirmarFicha() {
    const { eu, nomes } = ctxJogo.dadosSala;
    const p = ctxJogo.partida;
    const est = p.estado || {};
    const cen = obterCenario(est.cenario_id || cenarioSelId);
    if (!cen) return;
    const arqs = Array.isArray(cen.arquetipos) ? cen.arquetipos : [];
    const arq = arqs.find(a => a.id === arquetipoSelId) || arqs[0];
    if (!arq) return;

    const minhaFicha = {
      nome: nomes[eu] || `Jogador ${eu + 1}`,
      arquetipo: arq.nome,
      atributos: { ...(arq.atributos || { coragem: 2, astucia: 2, sintonia: 2 }) },
      energia: 10,
      inventario: arq.item ? [arq.item] : []
    };

    const patch = {
      cenario_id: cen.cenario_id,
      [`ficha_${eu}`]: minhaFicha
    };

    const outraFicha = est[`ficha_${1 - eu}`];
    if (outraFicha) {
      patch.fase = "acao";
      patch.ato = 1;
      patch.turno = 1;
      patch.narracao = cen.abertura || "";
      patch.opcoes_sugeridas = [
        "Explorar os arredores com cautela",
        "Conversar e traçar um plano juntos",
        "Investigar o primeiro sinal misterioso"
      ];
      patch.resumo_historia = `Início em ${cen.titulo}: ${cen.abertura || ""}`.slice(0, 400);
      patch.voto_0 = null;
      patch.voto_1 = null;
      patch.acao_escolhida = null;
      patch.rolagem = null;
      patch.fim_historia = false;
      patch.historico = [];
    }

    await ctxJogo.salvarEstado(patch, { rodada: 1 });
  }

  async function votarAcao(textoAcao) {
    const acao = String(textoAcao || "").trim().slice(0, 200);
    if (!acao) return;
    const { eu } = ctxJogo.dadosSala;
    const est = (ctxJogo.partida && ctxJogo.partida.estado) || {};
    const votoOutro = est[`voto_${1 - eu}`];

    if (votoOutro && votoOutro === acao) {
      await ctxJogo.salvarEstado({
        fase: "rolagem",
        acao_escolhida: acao,
        voto_0: null,
        voto_1: null,
        rolagem: null
      });
    } else {
      await ctxJogo.salvarEstado({ [`voto_${eu}`]: acao });
    }
  }

  async function rolarDado(attrChave) {
    const { eu } = ctxJogo.dadosSala;
    const est = (ctxJogo.partida && ctxJogo.partida.estado) || {};
    const ficha = est[`ficha_${eu}`];
    const bonus = Number((ficha && ficha.atributos && ficha.atributos[attrChave]) || 1);
    const dado = 1 + Math.floor(Math.random() * 12);
    const total = dado + bonus;
    const rolagem = {
      por: eu,
      dado,
      atributo: attrChave,
      bonus,
      total,
      faixa: faixaRolagem(total)
    };
    await ctxJogo.salvarEstado({ rolagem });
    await chamarMestreIa(rolagem);
  }

  async function chamarMestreIa(rolagemObj) {
    if (carregandoIa || !ctxJogo || !ctxJogo.partida) return;
    const { sb, sala, permitidoIa } = ctxJogo.dadosSala;
    if (!permitidoIa) {
      ctxJogo.aviso("A IA está desativada nas Configurações da sala.");
      return;
    }

    const p = ctxJogo.partida;
    const est = p.estado || {};
    const cen = obterCenario(est.cenario_id);
    if (!cen) return;

    const ato = Number(est.ato || 1);
    const turno = Number(est.turno || 1);
    const rol = rolagemObj || est.rolagem;
    if (!rol || !est.acao_escolhida) return;

    carregandoIa = true;
    erroIa = null;
    render();

    try {
      const { data, error } = await sb.functions.invoke("mestre-cronica", {
        body: {
          sala_codigo: sala,
          cenario: {
            titulo: cen.titulo,
            tema: cen.tema,
            ato_descricao: Array.isArray(cen.atos) ? (cen.atos[ato - 1] || "") : ""
          },
          ato,
          turno,
          resumo_historia: est.resumo_historia || "",
          jogadores: [est.ficha_0, est.ficha_1].filter(Boolean),
          acao_casal: est.acao_escolhida,
          rolagem: rol
        }
      });

      if (error || !data || data.erro) {
        erroIa = (data && data.mensagem) || (error && error.message) || "Não foi possível falar com o Mestre agora.";
        return;
      }

      const f0 = { ...(est.ficha_0 || { energia: 10, inventario: [] }) };
      const f1 = { ...(est.ficha_1 || { energia: 10, inventario: [] }) };
      const mud = data.mudancas || {};
      const en = Array.isArray(mud.energia) ? mud.energia : [0, 0];
      f0.energia = clampEnergia((f0.energia ?? 10) + (Number(en[0]) || 0));
      f1.energia = clampEnergia((f1.energia ?? 10) + (Number(en[1]) || 0));

      const ganhos = Array.isArray(mud.itens_ganhos) ? mud.itens_ganhos : [];
      const usados = Array.isArray(mud.itens_usados) ? mud.itens_usados : [];
      [f0, f1].forEach((f, idx) => {
        let inv = Array.isArray(f.inventario) ? f.inventario.filter(x => !usados.includes(x)) : [];
        if (ganhos[idx] && inv.length < 4 && !inv.includes(ganhos[idx])) {
          inv.push(ganhos[idx]);
        }
        f.inventario = inv.slice(0, 4);
      });

      const proxAto = data.avancar_ato && ato < 3 ? ato + 1 : ato;
      const historico = (Array.isArray(est.historico) ? est.historico : []).concat({
        turno,
        acao: est.acao_escolhida,
        faixa: rotuloFaixa(rol.faixa)
      }).slice(-12);

      const terminou = !!data.fim_historia || (f0.energia <= 0 && f1.energia <= 0);
      const extra = { rodada: turno + 1 };
      if (terminou) {
        const novoPlacar = { ...(p.placar || {}) };
        novoPlacar["0"] = (Number(novoPlacar["0"]) || 0) + 1;
        novoPlacar["1"] = (Number(novoPlacar["1"]) || 0) + 1;
        extra.placar = novoPlacar;
      }

      await ctxJogo.salvarEstado(
        {
          fase: terminou ? "fim" : "acao",
          ato: proxAto,
          turno: turno + 1,
          ficha_0: f0,
          ficha_1: f1,
          narracao: data.narracao || est.narracao,
          opcoes_sugeridas: Array.isArray(data.opcoes_sugeridas) ? data.opcoes_sugeridas : [],
          resumo_historia: data.resumo_atualizado || est.resumo_historia,
          restantes_hoje: typeof data.restantes_hoje === "number" ? data.restantes_hoje : est.restantes_hoje,
          fim_historia: terminou,
          voto_0: null,
          voto_1: null,
          acao_escolhida: null,
          rolagem: null,
          historico
        },
        extra
      );
    } catch (_) {
      erroIa = "Erro de conexão ao falar com o Mestre. Tente novamente.";
    } finally {
      carregandoIa = false;
      render();
    }
  }

  async function renderLobby() {
    const lista = await carregarCenarios(ctxJogo.dadosSala.sb);
    if (!raiz) return;
    const { eu, nomes } = ctxJogo.dadosSala;
    const est = (ctxJogo.partida && ctxJogo.partida.estado) || {};
    const ativoId = est.cenario_id || cenarioSelId || (lista[0] && lista[0].cenario_id);
    const sel = obterCenario(ativoId) || lista[0];

    raiz.textContent = "";
    const card = el("div", "jogos-subcard");
    card.appendChild(el("p", "jogos-rodada-lbl", "Crônica Interativa · Escolha o cenário e seu arquétipo"));

    const col = el("div", "jogos-acoes-col");
    lista.forEach(c => {
      const b = el("button", sel && sel.cenario_id === c.cenario_id ? "primary jogos-opcao-musica" : "secondary jogos-opcao-musica");
      b.type = "button";
      b.appendChild(el("strong", "", c.titulo || ""));
      b.appendChild(el("span", "jogos-sub", `${c.tema || ""} — ${c.sinopse || ""}`));
      b.addEventListener("click", () => selecionarCenario(c.cenario_id));
      col.appendChild(b);
    });
    card.appendChild(col);

    if (sel && Array.isArray(sel.arquetipos)) {
      if (!arquetipoSelId || !sel.arquetipos.some(a => a.id === arquetipoSelId)) {
        arquetipoSelId = sel.arquetipos[0].id;
      }
      const boxArq = el("div", "jogos-cenario-box");
      boxArq.appendChild(el("p", "jogos-rodada-lbl", `Seu arquétipo (${nomes[eu]})`));
      const minhaConfirmada = !!est[`ficha_${eu}`];
      const outraConfirmada = !!est[`ficha_${1 - eu}`];
      boxArq.appendChild(el("p", "jogos-sub", `${nomes[0]}: ${est.ficha_0 ? est.ficha_0.arquetipo : "escolhendo"} · ${nomes[1]}: ${est.ficha_1 ? est.ficha_1.arquetipo : "escolhendo"}`));

      if (!minhaConfirmada) {
        const listA = el("div", "jogos-acoes-col");
        sel.arquetipos.forEach(a => {
          const at = a.atributos || {};
          const b = el("button", arquetipoSelId === a.id ? "primary jogos-opcao-musica" : "secondary jogos-opcao-musica");
          b.type = "button";
          b.appendChild(el("strong", "", a.nome));
          b.appendChild(el("span", "jogos-sub", `Coragem ${at.coragem} · Astúcia ${at.astucia} · Sintonia ${at.sintonia} · Item: ${a.item}`));
          b.addEventListener("click", () => { arquetipoSelId = a.id; renderLobby(); });
          listA.appendChild(b);
        });
        boxArq.appendChild(listA);
        const bConf = el("button", "primary", outraConfirmada ? "Confirmar ficha e começar" : "Confirmar minha ficha");
        bConf.type = "button";
        bConf.addEventListener("click", confirmarFicha);
        boxArq.appendChild(bConf);
      } else {
        boxArq.appendChild(el("p", "jogos-sub", `Ficha confirmada! Aguardando ${nomes[1 - eu]} escolher o arquétipo.`));
      }
      card.appendChild(boxArq);
    }

    raiz.appendChild(card);
  }

  async function render() {
    if (!raiz || !ctxJogo || !ctxJogo.partida) return;
    const { eu, nomes, permitidoIa } = ctxJogo.dadosSala;

    if (!permitidoIa) {
      raiz.textContent = "";
      const card = el("div", "jogos-subcard");
      card.appendChild(el("p", "jogos-rodada-lbl", "Crônica Interativa"));
      card.appendChild(el("p", "jogos-destaque", "IA desativada nas Configurações"));
      card.appendChild(el("p", "jogos-sub", "Este modo usa o Mestre IA para narrar a história. Peça ao dono da sala para ativar Ideias da IA nas Configurações."));
      raiz.appendChild(card);
      return;
    }

    await carregarCenarios(ctxJogo.dadosSala.sb);
    const est = ctxJogo.partida.estado || {};
    const fase = est.fase || "lobby";

    if (fase === "lobby" || !est.cenario_id || !est.ficha_0 || !est.ficha_1) {
      await renderLobby();
      return;
    }

    const cen = obterCenario(est.cenario_id) || {};
    const f0 = est.ficha_0;
    const f1 = est.ficha_1;
    const minhaFicha = eu === 0 ? f0 : f1;

    raiz.textContent = "";
    const card = el("div", "jogos-subcard");

    const topoInfo = el("div", "jogos-fuga-topo-info");
    topoInfo.appendChild(el("span", "jogos-rodada-lbl", `${cen.titulo || "Crônica"} · Ato ${est.ato || 1} de 3 · Turno ${est.turno || 1}`));
    if (typeof est.restantes_hoje === "number") {
      topoInfo.appendChild(el("span", "jogos-selo", `${est.restantes_hoje} gerações hoje`));
    }
    card.appendChild(topoInfo);

    // Painel compacto de energia dos 2 jogadores
    const painelEn = el("div", "jogos-exp-painel");
    const barras = el("div", "jogos-exp-barras");
    [f0, f1].forEach((f, idx) => {
      const en = clampEnergia(f.energia ?? 10);
      const item = el("div", "jogos-exp-barra-item");
      if (en <= 3) item.classList.add("critico");
      const cab = el("div", "jogos-exp-barra-cab");
      cab.appendChild(el("span", "", `${nomes[idx]} (${f.arquetipo})`));
      cab.appendChild(el("span", "", `Energia ${en}/10`));
      const tr = el("div", "jogos-exp-trilha");
      const fl = el("div", "jogos-exp-fill");
      fl.style.width = `${en * 10}%`;
      tr.appendChild(fl);
      item.append(cab, tr);
      barras.appendChild(item);
    });
    painelEn.appendChild(barras);
    card.appendChild(painelEn);

    // Gaveta Ficha e Inventário
    const det = document.createElement("details");
    det.className = "jogos-detalhes";
    det.appendChild(el("summary", "", `Ficha e Inventário (${minhaFicha.arquetipo})`));
    const detCorpo = el("div", "jogos-detalhes-corpo");
    const at = minhaFicha.atributos || {};
    detCorpo.appendChild(el("p", "jogos-sub", `Coragem ${at.coragem || 0} · Astúcia ${at.astucia || 0} · Sintonia ${at.sintonia || 0}`));
    const inv = Array.isArray(minhaFicha.inventario) ? minhaFicha.inventario : [];
    detCorpo.appendChild(el("p", "jogos-sub", `Inventário (${inv.length}/4): ${inv.length ? inv.join(", ") : "vazio"}`));
    det.appendChild(detCorpo);
    card.appendChild(det);

    // Narração atual
    const narBox = el("div", "jogos-cenario-box");
    narBox.appendChild(el("p", "jogos-narrativa", est.narracao || ""));
    card.appendChild(narBox);

    if (carregandoIa) {
      card.appendChild(el("p", "jogos-sub", "O Mestre está escrevendo a próxima cena..."));
      raiz.appendChild(card);
      return;
    }

    if (erroIa) {
      card.appendChild(el("p", "jogos-fuga-erro", erroIa));
      const bRetry = el("button", "primary", "Tentar novamente");
      bRetry.type = "button";
      bRetry.addEventListener("click", () => chamarMestreIa(est.rolagem));
      card.appendChild(bRetry);
    }

    if (fase === "acao") {
      const ops = Array.isArray(est.opcoes_sugeridas) ? est.opcoes_sugeridas : [];
      const opsEl = el("div", "jogos-acoes-col");
      ops.forEach(opTxt => {
        const meuVoto = est[`voto_${eu}`] === opTxt;
        const votoOutro = est[`voto_${1 - eu}`] === opTxt;
        const b = el("button", meuVoto ? "primary jogos-opcao-musica" : "secondary jogos-opcao-musica");
        b.type = "button";
        b.appendChild(el("strong", "", opTxt));
        const quem = [];
        if (meuVoto) quem.push(nomes[eu]);
        if (votoOutro) quem.push(nomes[1 - eu]);
        if (quem.length) b.appendChild(el("span", "jogos-sub", `Escolha de: ${quem.join(" e ")}`));
        b.addEventListener("click", () => votarAcao(opTxt));
        opsEl.appendChild(b);
      });
      card.appendChild(opsEl);

      const formLivre = el("form", "jogos-batalha-rec-linha");
      const inpLivre = document.createElement("input");
      inpLivre.type = "text";
      inpLivre.placeholder = "Ou descrevam outra ação...";
      inpLivre.maxLength = 180;
      const bLivre = el("button", "secondary", "Propor");
      bLivre.type = "submit";
      formLivre.append(inpLivre, bLivre);
      formLivre.addEventListener("submit", ev => {
        ev.preventDefault();
        if (inpLivre.value.trim()) votarAcao(inpLivre.value.trim());
      });
      card.appendChild(formLivre);

      if (est.voto_0 && est.voto_1 && est.voto_0 !== est.voto_1) {
        card.appendChild(el("p", "jogos-sub", "Vocês propuseram ações diferentes — escolham a mesma opção para seguir."));
      } else if (est[`voto_${eu}`] && !est[`voto_${1 - eu}`]) {
        card.appendChild(el("p", "jogos-sub", `Aguardando ${nomes[1 - eu]} confirmar: "${est[`voto_${eu}`]}"`));
      }
    } else if (fase === "rolagem") {
      card.appendChild(el("p", "jogos-rodada-lbl", "Ação acordada"));
      card.appendChild(el("p", "jogos-sub", est.acao_escolhida || ""));

      if (est.rolagem) {
        const r = est.rolagem;
        card.appendChild(el("div", "jogos-sintonia-medidor", `Dado: ${r.dado} + ${r.atributo} (${r.bonus}) = ${r.total} · ${rotuloFaixa(r.faixa)}`));
      } else {
        const chips = el("div", "jogos-filtros");
        ATRIBUTOS.forEach(a => {
          const b = el("button", "jogos-chip", `${a.rotulo} (+${(minhaFicha.atributos && minhaFicha.atributos[a.chave]) || 0})`);
          b.type = "button";
          b.setAttribute("aria-pressed", atributoRolagem === a.chave ? "true" : "false");
          b.addEventListener("click", () => { atributoRolagem = a.chave; render(); });
          chips.appendChild(b);
        });
        card.appendChild(chips);
        const bRolar = el("button", "primary", "Rolar dado (1d12)");
        bRolar.type = "button";
        bRolar.addEventListener("click", () => rolarDado(atributoRolagem));
        card.appendChild(bRolar);
      }
    } else if (fase === "fim") {
      card.appendChild(el("p", "jogos-destaque", "Crônica encerrada!"));
      const bNova = el("button", "primary", "Iniciar nova crônica");
      bNova.type = "button";
      bNova.addEventListener("click", () => ctxJogo.salvarEstado({ fase: "lobby", ficha_0: null, ficha_1: null }));
      card.appendChild(bNova);
    }

    if (fase !== "fim") {
      const bReset = el("button", "linkbtn", "Trocar cenário");
      bReset.type = "button";
      bReset.addEventListener("click", () => ctxJogo.salvarEstado({ fase: "lobby", ficha_0: null, ficha_1: null }));
      card.appendChild(bReset);
    }

    raiz.appendChild(card);
  }

  window.JogosHub.registrar("cronica-interativa", {
    async montar(container, ctx) {
      raiz = container;
      ctxJogo = ctx;
      erroIa = null;
      await render();
    },
    async aoAtualizar() {
      await render();
    },
    desmontar() {
      carregandoIa = false;
      erroIa = null;
      raiz = null;
      ctxJogo = null;
    }
  });
})();
