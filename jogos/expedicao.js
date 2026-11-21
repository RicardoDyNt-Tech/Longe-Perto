// Jogo: Expedição Cooperativa — Longe & Perto
(function () {
  const RECURSOS = [
    { chave: "suprimentos", rotulo: "Suprimentos" },
    { chave: "energia", rotulo: "Energia" },
    { chave: "moral", rotulo: "Moral" }
  ];

  let raiz = null;
  let ctxJogo = null;
  let campanhas = null;
  let campSelId = null;
  let papeisInvertidos = false;

  function el(tag, cls, txt) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt !== undefined && txt !== null) n.textContent = txt;
    return n;
  }

  async function carregarCampanhas(sb) {
    if (campanhas) return campanhas;
    const { data, error } = await sb
      .from("jogos_conteudo")
      .select("id, dados")
      .eq("jogo_id", "expedicao")
      .eq("ativo", true);
    if (error || !Array.isArray(data)) return [];
    campanhas = data;
    if (!campSelId && campanhas.length) campSelId = campanhas[0].id;
    return campanhas;
  }

  function clamp(n) {
    return Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
  }

  function formatarDelta(chave, val) {
    const n = Number(val) || 0;
    const nome = (RECURSOS.find(r => r.chave === chave) || {}).rotulo || chave;
    if (n > 0) return `${nome} +${n}`;
    if (n < 0) return `${nome} ${n}`;
    return `${nome} 0`;
  }

  function classificacaoFinal(rec) {
    const media = Math.round(((rec.suprimentos || 0) + (rec.energia || 0) + (rec.moral || 0)) / 3);
    if (media >= 70) return { media, titulo: "Expedição lendária" };
    if (media >= 45) return { media, titulo: "Jornada equilibrada" };
    return { media, titulo: "Chegada no limite" };
  }

  function obterCampanhaAtiva(est) {
    if (!campanhas || !est || !est.campanha_id) return null;
    return campanhas.find(c => c.id === est.campanha_id) || null;
  }

  async function iniciarExpedicao() {
    const lista = await carregarCampanhas(ctxJogo.dadosSala.sb);
    const camp = lista.find(c => c.id === campSelId) || lista[0];
    if (!camp) {
      ctxJogo.aviso("Nenhuma campanha disponível.");
      return;
    }
    const d = camp.dados || {};
    const ini = d.recursos_iniciais || { suprimentos: 65, energia: 65, moral: 65 };
    const papeisMap = papeisInvertidos ? { "0": 1, "1": 0 } : { "0": 0, "1": 1 };

    await ctxJogo.salvarEstado(
      {
        fase: "turno",
        campanha_id: camp.id,
        dia_idx: 0,
        papeis_map: papeisMap,
        recursos: {
          suprimentos: clamp(ini.suprimentos),
          energia: clamp(ini.energia),
          moral: clamp(ini.moral)
        },
        voto_0: null,
        voto_1: null,
        ultimo_desfecho: null,
        motivo_derrota: null,
        historico: []
      },
      { rodada: 1 }
    );
  }

  async function marcarOpcao(opId) {
    const { eu } = ctxJogo.dadosSala;
    await ctxJogo.salvarEstado({ [`voto_${eu}`]: opId });
  }

  async function confirmarDecisao() {
    const p = ctxJogo.partida;
    const est = p.estado || {};
    const camp = obterCampanhaAtiva(est);
    if (!camp) return;
    const dias = (camp.dados && camp.dados.dias) || [];
    const diaIdx = Number(est.dia_idx || 0);
    const diaObj = dias[diaIdx];
    if (!diaObj) return;

    if (!est.voto_0 || est.voto_0 !== est.voto_1) return;
    const op = (diaObj.opcoes || []).find(o => o.id === est.voto_0);
    if (!op) return;

    const recAntes = est.recursos || { suprimentos: 65, energia: 65, moral: 65 };
    const ef = op.efeitos || {};
    const recDepois = {
      suprimentos: clamp(recAntes.suprimentos + (Number(ef.suprimentos) || 0)),
      energia: clamp(recAntes.energia + (Number(ef.energia) || 0)),
      moral: clamp(recAntes.moral + (Number(ef.moral) || 0))
    };

    const historico = (Array.isArray(est.historico) ? est.historico : []).concat({
      dia: diaObj.dia || (diaIdx + 1),
      titulo: diaObj.titulo || "",
      escolha: op.titulo || ""
    });

    const zerado = RECURSOS.find(r => recDepois[r.chave] <= 0);
    const desfecho = {
      dia: diaObj.dia || (diaIdx + 1),
      escolha: op.titulo || "",
      texto: op.desfecho || "",
      efeitos: ef
    };

    if (zerado) {
      await ctxJogo.salvarEstado({
        fase: "derrota",
        recursos: recDepois,
        ultimo_desfecho: desfecho,
        motivo_derrota: zerado.rotulo,
        historico,
        voto_0: null,
        voto_1: null
      });
      return;
    }

    await ctxJogo.salvarEstado({
      fase: "desfecho",
      recursos: recDepois,
      ultimo_desfecho: desfecho,
      historico,
      voto_0: null,
      voto_1: null
    });
  }

  async function avancarDia() {
    const p = ctxJogo.partida;
    const est = p.estado || {};
    const camp = obterCampanhaAtiva(est);
    if (!camp) return;
    const dias = (camp.dados && camp.dados.dias) || [];
    const proxIdx = Number(est.dia_idx || 0) + 1;

    if (proxIdx >= dias.length) {
      const novoPlacar = { ...(p.placar || {}) };
      novoPlacar["0"] = (Number(novoPlacar["0"]) || 0) + 1;
      novoPlacar["1"] = (Number(novoPlacar["1"]) || 0) + 1;
      await ctxJogo.salvarEstado(
        { fase: "vitoria", ultimo_desfecho: null },
        { placar: novoPlacar }
      );
      return;
    }

    await ctxJogo.salvarEstado(
      { fase: "turno", dia_idx: proxIdx, voto_0: null, voto_1: null, ultimo_desfecho: null },
      { rodada: proxIdx + 1 }
    );
  }

  function renderBarras(rec, diaAtual, totalDias) {
    const box = el("div", "jogos-exp-painel");
    box.appendChild(el("p", "jogos-rodada-lbl", `Dia ${diaAtual} de ${totalDias}`));
    const lista = el("div", "jogos-exp-barras");
    RECURSOS.forEach(r => {
      const val = clamp(rec[r.chave]);
      const item = el("div", "jogos-exp-barra-item");
      if (val < 25) item.classList.add("critico");
      const cab = el("div", "jogos-exp-barra-cab");
      cab.appendChild(el("span", "", r.rotulo));
      cab.appendChild(el("span", "", `${val}/100`));
      const trilha = el("div", "jogos-exp-trilha");
      const fill = el("div", "jogos-exp-fill");
      fill.style.width = `${val}%`;
      trilha.appendChild(fill);
      item.append(cab, trilha);
      lista.appendChild(item);
    });
    box.appendChild(lista);
    return box;
  }

  async function renderLobby() {
    const lista = await carregarCampanhas(ctxJogo.dadosSala.sb);
    if (!raiz) return;
    const { nomes } = ctxJogo.dadosSala;
    raiz.textContent = "";

    const card = el("div", "jogos-subcard");
    card.appendChild(el("p", "jogos-rodada-lbl", "Escolha a expedição"));

    if (!lista.length) {
      card.appendChild(el("p", "jogos-sub", "Nenhuma campanha encontrada."));
      raiz.appendChild(card);
      return;
    }

    const campsEl = el("div", "jogos-acoes-col");
    lista.forEach(c => {
      const d = c.dados || {};
      const nDias = Array.isArray(d.dias) ? d.dias.length : 0;
      const b = el("button", campSelId === c.id ? "primary jogos-opcao-musica" : "secondary jogos-opcao-musica");
      b.type = "button";
      b.appendChild(el("strong", "", `${d.titulo || "Campanha"} (${nDias} dias)`));
      b.appendChild(el("span", "jogos-sub", d.subtitulo || ""));
      b.addEventListener("click", () => { campSelId = c.id; renderLobby(); });
      campsEl.appendChild(b);
    });
    card.appendChild(campsEl);

    const sel = lista.find(c => c.id === campSelId) || lista[0];
    const papeis = (sel && sel.dados && sel.dados.papeis) || [];
    if (papeis.length >= 2) {
      const p0 = papeisInvertidos ? papeis[1] : papeis[0];
      const p1 = papeisInvertidos ? papeis[0] : papeis[1];
      const boxP = el("div", "jogos-cenario-box");
      boxP.appendChild(el("p", "jogos-rodada-lbl", "Distribuição de papéis"));
      boxP.appendChild(el("p", "jogos-sub", `${nomes[0]}: ${p0.nome} — ${p0.descricao}`));
      boxP.appendChild(el("p", "jogos-sub", `${nomes[1]}: ${p1.nome} — ${p1.descricao}`));
      const bTrocar = el("button", "secondary", "Trocar papéis");
      bTrocar.type = "button";
      bTrocar.addEventListener("click", () => { papeisInvertidos = !papeisInvertidos; renderLobby(); });
      boxP.appendChild(bTrocar);
      card.appendChild(boxP);
    }

    const bIni = el("button", "primary", "Iniciar expedição");
    bIni.type = "button";
    bIni.addEventListener("click", iniciarExpedicao);
    card.appendChild(bIni);
    raiz.appendChild(card);
  }

  async function render() {
    if (!raiz || !ctxJogo || !ctxJogo.partida) return;
    const est = ctxJogo.partida.estado || {};
    const fase = est.fase || "lobby";

    if (fase === "lobby") {
      await renderLobby();
      return;
    }

    await carregarCampanhas(ctxJogo.dadosSala.sb);
    const camp = obterCampanhaAtiva(est);
    if (!camp) {
      await renderLobby();
      return;
    }

    const d = camp.dados || {};
    const dias = Array.isArray(d.dias) ? d.dias : [];
    const diaIdx = Math.min(dias.length - 1, Math.max(0, Number(est.dia_idx || 0)));
    const diaObj = dias[diaIdx] || {};
    const rec = est.recursos || { suprimentos: 65, energia: 65, moral: 65 };
    const { eu, nomes } = ctxJogo.dadosSala;
    const meuPapelIdx = est.papeis_map ? Number(est.papeis_map[String(eu)] ?? eu) : eu;
    const meuPapel = (d.papeis && d.papeis[meuPapelIdx]) || { nome: `Papel ${meuPapelIdx + 1}` };

    raiz.textContent = "";
    const card = el("div", "jogos-subcard");
    card.appendChild(el("p", "jogos-rodada-lbl", d.titulo || "Expedição"));
    card.appendChild(renderBarras(rec, Math.min(dias.length, diaIdx + 1), dias.length));

    if (fase === "turno") {
      const evBox = el("div", "jogos-cenario-box");
      evBox.appendChild(el("p", "jogos-destaque", diaObj.titulo || `Dia ${diaIdx + 1}`));
      evBox.appendChild(el("p", "jogos-sub", diaObj.evento || ""));
      card.appendChild(evBox);

      const dicaTexto = diaObj.dicas && diaObj.dicas[String(meuPapelIdx)];
      if (dicaTexto) {
        const dicaBox = el("div", "jogos-exp-dica");
        dicaBox.appendChild(el("p", "jogos-rodada-lbl", `Informação do seu papel (${meuPapel.nome})`));
        dicaBox.appendChild(el("p", "jogos-sub", dicaTexto));
        card.appendChild(dicaBox);
      }

      const opcoes = Array.isArray(diaObj.opcoes) ? diaObj.opcoes : [];
      const opsEl = el("div", "jogos-acoes-col");
      opcoes.forEach(op => {
        const meuVoto = est[`voto_${eu}`] === op.id;
        const votoOutro = est[`voto_${1 - eu}`] === op.id;
        const b = el("button", meuVoto ? "primary jogos-opcao-musica" : "secondary jogos-opcao-musica");
        b.type = "button";
        b.appendChild(el("strong", "", op.titulo || ""));
        const quem = [];
        if (meuVoto) quem.push(nomes[eu]);
        if (votoOutro) quem.push(nomes[1 - eu]);
        if (quem.length) b.appendChild(el("span", "jogos-sub", `Escolhido por: ${quem.join(" e ")}`));
        b.addEventListener("click", () => marcarOpcao(op.id));
        opsEl.appendChild(b);
      });
      card.appendChild(opsEl);

      if (est.voto_0 && est.voto_1) {
        if (est.voto_0 === est.voto_1) {
          const bConf = el("button", "primary", "Confirmar decisão");
          bConf.type = "button";
          bConf.addEventListener("click", confirmarDecisao);
          card.appendChild(bConf);
        } else {
          card.appendChild(el("p", "jogos-sub", "Vocês escolheram caminhos diferentes — negociem na chamada."));
        }
      }
    } else if (fase === "desfecho") {
      const df = est.ultimo_desfecho || {};
      card.appendChild(el("p", "jogos-destaque", `Desfecho do Dia ${df.dia || diaIdx + 1}`));
      card.appendChild(el("p", "jogos-sub", df.texto || ""));
      const ef = df.efeitos || {};
      const chips = el("div", "jogos-filtros");
      RECURSOS.forEach(r => {
        chips.appendChild(el("span", "jogos-selo", formatarDelta(r.chave, ef[r.chave])));
      });
      card.appendChild(chips);
      const bProx = el("button", "primary", diaIdx + 1 >= dias.length ? "Ver resultado final" : "Avançar para o próximo dia");
      bProx.type = "button";
      bProx.addEventListener("click", avancarDia);
      card.appendChild(bProx);
    } else if (fase === "derrota" || fase === "vitoria") {
      if (fase === "derrota") {
        card.appendChild(el("p", "jogos-destaque", `Expedição interrompida: ${est.motivo_derrota || "Recurso"} chegou a zero.`));
        if (est.ultimo_desfecho && est.ultimo_desfecho.texto) {
          card.appendChild(el("p", "jogos-sub", est.ultimo_desfecho.texto));
        }
      } else {
        const cl = classificacaoFinal(rec);
        card.appendChild(el("p", "jogos-destaque", `Expedição concluída · ${cl.titulo} (média ${cl.media}/100)`));
      }

      const hist = Array.isArray(est.historico) ? est.historico : [];
      if (hist.length) {
        const det = document.createElement("details");
        det.className = "jogos-detalhes";
        det.appendChild(el("summary", "", `Resumo dos ${hist.length} dias vividos`));
        const ul = el("ul", "jogos-lista-conquistas");
        hist.forEach(h => ul.appendChild(el("li", "", `Dia ${h.dia} (${h.titulo}): ${h.escolha}`)));
        det.appendChild(ul);
        card.appendChild(det);
      }

      const bOutra = el("button", "primary", "Escolher outra campanha");
      bOutra.type = "button";
      bOutra.addEventListener("click", () => ctxJogo.salvarEstado({ fase: "lobby" }));
      card.appendChild(bOutra);
    }

    raiz.appendChild(card);
  }

  window.JogosHub.registrar("expedicao", {
    async montar(container, ctx) {
      raiz = container;
      ctxJogo = ctx;
      await render();
    },
    async aoAtualizar() {
      await render();
    },
    desmontar() {
      raiz = null;
      ctxJogo = null;
    }
  });
})();
