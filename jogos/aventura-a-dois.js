// Jogo: Aventura a dois — Longe & Perto
(function () {
  let raiz = null;
  let ctxJogo = null;
  let catalogo = null;
  let historiaCache = {};
  let carregandoHistoria = false;

  function el(tag, cls, txt) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt !== undefined && txt !== null) n.textContent = txt;
    return n;
  }

  async function carregarCatalogo(sb) {
    if (catalogo) return catalogo;
    const { data, error } = await sb
      .from("jogos_conteudo")
      .select("id, dados")
      .eq("jogo_id", "aventura-a-dois")
      .eq("ativo", true);
    if (error || !Array.isArray(data)) return [];
    catalogo = data.map(x => x.dados || {}).filter(d => d.campanha_id);
    return catalogo;
  }

  async function carregarHistoria(sb, campanhaId) {
    if (!campanhaId) return null;
    if (historiaCache[campanhaId]) return historiaCache[campanhaId];
    const { data, error } = await sb.rpc("jogo_aventura_carregar", { p_campanha_id: campanhaId });
    if (error || !data) {
      ctxJogo.aviso((error && error.message) || "Não foi possível carregar a história.");
      return null;
    }
    historiaCache[campanhaId] = data;
    return data;
  }

  async function iniciarHistoria(campanhaId) {
    const { sb } = ctxJogo.dadosSala;
    const hist = await carregarHistoria(sb, campanhaId);
    if (!hist) return;
    const est = (ctxJogo.partida && ctxJogo.partida.estado) || {};
    await ctxJogo.salvarEstado(
      {
        fase: "jogando",
        campanha_id: campanhaId,
        no_atual: hist.inicio || "n1",
        flags: [],
        voto_0: null,
        voto_1: null,
        historico: [],
        finais_descobertos: est.finais_descobertos || {}
      },
      { rodada: 1 }
    );
  }

  async function votarOpcao(op) {
    const { eu, sb } = ctxJogo.dadosSala;
    const p = ctxJogo.partida;
    const est = p.estado || {};
    const votoOutro = est[`voto_${1 - eu}`];

    if (votoOutro && votoOutro === op.id) {
      const hist = await carregarHistoria(sb, est.campanha_id);
      if (!hist || !hist.nos) return;
      const proxNo = hist.nos[op.prox];
      if (!proxNo) return;

      const flags = Array.isArray(est.flags) ? est.flags.slice() : [];
      if (op.dar_flag && !flags.includes(op.dar_flag)) flags.push(op.dar_flag);

      const noAtualObj = hist.nos[est.no_atual] || {};
      const historico = (Array.isArray(est.historico) ? est.historico : []).concat({
        cena: noAtualObj.titulo || est.no_atual,
        escolha: op.texto
      });

      const patch = {
        no_atual: op.prox,
        flags,
        voto_0: null,
        voto_1: null,
        historico
      };

      let extra = { rodada: historico.length + 1 };
      if (proxNo.final) {
        patch.fase = "final";
        const finais = { ...(est.finais_descobertos || {}) };
        const listaFin = Array.isArray(finais[est.campanha_id]) ? finais[est.campanha_id].slice() : [];
        const fNum = Number(proxNo.final_num || 1);
        if (!listaFin.includes(fNum)) {
          listaFin.push(fNum);
          const novoPlacar = { ...(p.placar || {}) };
          novoPlacar["0"] = (Number(novoPlacar["0"]) || 0) + 1;
          novoPlacar["1"] = (Number(novoPlacar["1"]) || 0) + 1;
          extra.placar = novoPlacar;
        }
        finais[est.campanha_id] = listaFin;
        patch.finais_descobertos = finais;
      }

      await ctxJogo.salvarEstado(patch, extra);
    } else {
      await ctxJogo.salvarEstado({ [`voto_${eu}`]: op.id });
    }
  }

  async function renderLobby() {
    const { sb } = ctxJogo.dadosSala;
    const lista = await carregarCatalogo(sb);
    if (!raiz) return;
    const est = (ctxJogo.partida && ctxJogo.partida.estado) || {};
    const finais = est.finais_descobertos || {};

    raiz.textContent = "";
    const card = el("div", "jogos-subcard");
    card.appendChild(el("p", "jogos-rodada-lbl", "Escolha uma história interativa"));
    card.appendChild(el("p", "jogos-sub", "Vocês leem juntos na chamada e precisam concordar em cada decisão para avançar."));

    const col = el("div", "jogos-acoes-col");
    lista.forEach(item => {
      const desc = Array.isArray(finais[item.campanha_id]) ? finais[item.campanha_id].length : 0;
      const box = el("div", "jogos-cenario-box");
      box.appendChild(el("p", "jogos-destaque", item.titulo || ""));
      box.appendChild(el("p", "jogos-sub", `${item.tema || ""} · ${item.duracao || ""} · ${desc} de ${item.total_finais || 3} finais descobertos`));
      box.appendChild(el("p", "jogos-sub", item.sinopse || ""));
      const b = el("button", "primary", "Começar história");
      b.type = "button";
      b.addEventListener("click", () => iniciarHistoria(item.campanha_id));
      box.appendChild(b);
      col.appendChild(box);
    });
    card.appendChild(col);
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

    if (carregandoHistoria) return;
    carregandoHistoria = true;
    const hist = await carregarHistoria(ctxJogo.dadosSala.sb, est.campanha_id);
    carregandoHistoria = false;
    if (!hist || !raiz) return;

    const no = (hist.nos && hist.nos[est.no_atual]) || null;
    if (!no) {
      await renderLobby();
      return;
    }

    const { eu, nomes } = ctxJogo.dadosSala;
    const flags = Array.isArray(est.flags) ? est.flags : [];
    const historico = Array.isArray(est.historico) ? est.historico : [];

    raiz.textContent = "";
    const card = el("div", "jogos-subcard");
    card.appendChild(el("p", "jogos-rodada-lbl", `${hist.titulo || "Aventura"} · Cena ${historico.length + 1}`));
    card.appendChild(el("h3", "jogos-destaque", no.titulo || ""));
    card.appendChild(el("p", "jogos-narrativa", no.texto || ""));

    if (no.final || fase === "final") {
      const finBox = el("div", "jogos-recompensa-destaque");
      finBox.appendChild(el("p", "jogos-rodada-lbl", "Final alcançado"));
      const desc = (est.finais_descobertos && est.finais_descobertos[est.campanha_id]) || [];
      finBox.appendChild(el("p", "jogos-sub", `Finais descobertos nesta história: ${desc.length}`));
      card.appendChild(finBox);

      const acoes = el("div", "jogos-acoes-linha");
      const bDeNovo = el("button", "primary", "Jogar de novo (outro caminho)");
      bDeNovo.type = "button";
      bDeNovo.addEventListener("click", () => iniciarHistoria(est.campanha_id));
      const bTrocar = el("button", "secondary", "Trocar história");
      bTrocar.type = "button";
      bTrocar.addEventListener("click", () => ctxJogo.salvarEstado({ fase: "lobby" }));
      acoes.append(bDeNovo, bTrocar);
      card.appendChild(acoes);
    } else {
      const opcoes = (Array.isArray(no.opcoes) ? no.opcoes : []).filter(o => !o.requer_flag || flags.includes(o.requer_flag));
      const opsEl = el("div", "jogos-acoes-col");
      opcoes.forEach(op => {
        const meuVoto = est[`voto_${eu}`] === op.id;
        const votoOutro = est[`voto_${1 - eu}`] === op.id;
        const b = el("button", meuVoto ? "primary jogos-opcao-musica" : "secondary jogos-opcao-musica");
        b.type = "button";
        b.appendChild(el("strong", "", op.texto || ""));
        const quem = [];
        if (meuVoto) quem.push(nomes[eu]);
        if (votoOutro) quem.push(nomes[1 - eu]);
        if (quem.length) b.appendChild(el("span", "jogos-sub", `Voto de: ${quem.join(" e ")}`));
        b.addEventListener("click", () => votarOpcao(op));
        opsEl.appendChild(b);
      });
      card.appendChild(opsEl);

      if (est.voto_0 && est.voto_1 && est.voto_0 !== est.voto_1) {
        card.appendChild(el("p", "jogos-sub", "Vocês escolheram caminhos diferentes — negociem na chamada até concordarem."));
      } else if (est[`voto_${eu}`] && !est[`voto_${1 - eu}`]) {
        card.appendChild(el("p", "jogos-sub", `Aguardando ${nomes[1 - eu]} confirmar a escolha.`));
      }
    }

    if (historico.length) {
      const det = document.createElement("details");
      det.className = "jogos-detalhes";
      det.appendChild(el("summary", "", `Caminho percorrido (${historico.length})`));
      const ul = el("ul", "jogos-lista-conquistas");
      historico.forEach(h => ul.appendChild(el("li", "", `${h.cena}: ${h.escolha}`)));
      det.appendChild(ul);
      card.appendChild(det);
    }

    if (fase !== "final") {
      const bTrocar = el("button", "linkbtn", "Trocar história");
      bTrocar.type = "button";
      bTrocar.addEventListener("click", () => ctxJogo.salvarEstado({ fase: "lobby" }));
      card.appendChild(bTrocar);
    }

    raiz.appendChild(card);
  }

  window.JogosHub.registrar("aventura-a-dois", {
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
