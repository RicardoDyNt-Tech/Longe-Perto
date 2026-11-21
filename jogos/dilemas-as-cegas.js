// Jogo: Dilemas às cegas — Longe & Perto
(function () {
  const CLIMAS = [
    ["todos", "Todos"],
    ["leve", "Leve"],
    ["profundo", "Profundo"],
    ["absurdo", "Absurdo"],
    ["ousado", "Ousado"]
  ];

  let raiz = null;
  let ctxJogo = null;
  let banco = null;
  let clima = "todos";
  let meuVoto = null;
  let meuVotoRodada = 0;
  let statusVotos = [];
  let votosRevelados = [];

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
      .select("id, categoria, ousado, dados")
      .eq("jogo_id", "dilemas-as-cegas")
      .eq("ativo", true);
    if (error || !Array.isArray(data)) return [];
    banco = data;
    return banco;
  }

  async function sortearDilema() {
    const { sb, permitidoOusado } = ctxJogo.dadosSala;
    const p = ctxJogo.partida;
    const est = (p && p.estado) || {};
    const lista = await carregarBanco(sb);
    const podeOusado = !!permitidoOusado;
    if (clima === "ousado" && !podeOusado) clima = "todos";

    let pool = lista.filter(x => podeOusado || !x.ousado);
    if (clima !== "todos") {
      pool = pool.filter(x => x.categoria === clima);
    }
    const usados = Array.isArray(est.usados) ? est.usados : [];
    let naoUsados = pool.filter(x => !usados.includes(x.id));
    if (!naoUsados.length) naoUsados = pool;
    if (!naoUsados.length) {
      ctxJogo.aviso("Nenhum dilema disponível para esse clima.");
      return;
    }

    const item = naoUsados[Math.floor(Math.random() * naoUsados.length)];
    const d = item.dados || {};
    const nextRodada = est.fase ? Number(p.rodada || 1) + 1 : Number(p.rodada || 1);

    meuVoto = null;
    meuVotoRodada = 0;
    statusVotos = [];
    votosRevelados = [];

    await ctxJogo.salvarEstado(
      {
        fase: "votando",
        clima,
        opcao_a: d.opcao_a || "Opção A",
        opcao_b: d.opcao_b || "Opção B",
        sintonias: Number(est.sintonias || 0),
        total_rodadas: Number(est.total_rodadas || 0),
        em_sintonia: null,
        usados: usados.concat(item.id).slice(-50)
      },
      { rodada: nextRodada }
    );
  }

  async function votar(escolha) {
    const p = ctxJogo.partida;
    const rodada = Number(p.rodada || 1);
    const ok = await ctxJogo.enviarSegredo(rodada, "voto", { escolha });
    if (!ok) return;
    meuVoto = escolha;
    meuVotoRodada = rodada;
    await ctxJogo.salvarEstado({ ping_voto: Date.now() });
    await sincronizar();
  }

  async function sincronizar() {
    if (!ctxJogo || !ctxJogo.partida) return;
    const p = ctxJogo.partida;
    const est = p.estado || {};
    const rodada = Number(p.rodada || 1);

    if (est.fase === "votando") {
      if (meuVotoRodada !== rodada) {
        const salvo = await ctxJogo.lerMeuSegredo(rodada, "voto");
        meuVoto = salvo && salvo.escolha ? salvo.escolha : null;
        meuVotoRodada = rodada;
      }
      statusVotos = await ctxJogo.statusSegredos(rodada);
      if (statusVotos.some(s => s.jogador === "0") && statusVotos.some(s => s.jogador === "1")) {
        const revs = await ctxJogo.revelarRodada(rodada);
        const v0 = revs.find(r => r.jogador === "0");
        const v1 = revs.find(r => r.jogador === "1");
        if (v0 && v1 && v0.valor && v1.valor) {
          votosRevelados = revs;
          const iguais = v0.valor.escolha === v1.valor.escolha;
          const sintonias = Number(est.sintonias || 0) + (iguais ? 1 : 0);
          const total = Number(est.total_rodadas || 0) + 1;
          const novoPlacar = { ...(p.placar || {}) };
          if (iguais) {
            novoPlacar["0"] = (Number(novoPlacar["0"]) || 0) + 1;
            novoPlacar["1"] = (Number(novoPlacar["1"]) || 0) + 1;
          }
          await ctxJogo.salvarEstado(
            { fase: "revelado", sintonias, total_rodadas: total, em_sintonia: iguais },
            { placar: novoPlacar }
          );
          return;
        }
      }
    } else if (est.fase === "revelado") {
      votosRevelados = await ctxJogo.revelarRodada(rodada);
    }
    render();
  }

  function render() {
    if (!raiz || !ctxJogo || !ctxJogo.partida) return;
    const p = ctxJogo.partida;
    const est = p.estado || {};
    const { nomes, permitidoOusado } = ctxJogo.dadosSala;
    const fase = est.fase || "inicio";

    raiz.textContent = "";
    const card = el("div", "jogos-subcard");

    const sintonias = Number(est.sintonias || 0);
    const total = Number(est.total_rodadas || 0);
    if (total > 0) {
      const pct = Math.round((sintonias / total) * 100);
      card.appendChild(el("div", "jogos-sintonia-medidor", `Sintonia: ${sintonias} de ${total} rodadas (${pct}%)`));
    }

    const chips = el("div", "jogos-filtros");
    CLIMAS.filter(([v]) => v !== "ousado" || !!permitidoOusado).forEach(([v, rot]) => {
      const b = el("button", "jogos-chip", rot);
      b.type = "button";
      b.setAttribute("aria-pressed", clima === v ? "true" : "false");
      b.addEventListener("click", () => { clima = v; render(); });
      chips.appendChild(b);
    });
    card.appendChild(chips);

    if (fase === "inicio") {
      card.appendChild(el("p", "jogos-sub", "Cada um escolhe em segredo entre A ou B. Só depois da resposta de ambos é que o resultado aparece."));
      const btn = el("button", "primary", "Sortear dilema");
      btn.type = "button";
      btn.addEventListener("click", sortearDilema);
      card.appendChild(btn);
      raiz.appendChild(card);
      return;
    }

    card.appendChild(el("p", "jogos-rodada-lbl", `Dilema ${p.rodada || 1}`));

    if (fase === "votando") {
      const j0Ok = statusVotos.some(s => s.jogador === "0");
      const j1Ok = statusVotos.some(s => s.jogador === "1");
      card.appendChild(el("p", "jogos-sub", `${nomes[0]}: ${j0Ok ? "respondeu" : "escolhendo"} · ${nomes[1]}: ${j1Ok ? "respondeu" : "escolhendo"}`));

      const grid = el("div", "jogos-duelo-grid");
      [
        ["A", est.opcao_a || "Opção A"],
        ["B", est.opcao_b || "Opção B"]
      ].forEach(([cod, txt]) => {
        const b = el("button", meuVoto === cod ? "primary jogos-duelo-btn" : "secondary jogos-duelo-btn", `${cod}: ${txt}`);
        b.type = "button";
        b.disabled = meuVoto !== null;
        b.addEventListener("click", () => votar(cod));
        grid.appendChild(b);
      });
      card.appendChild(grid);

      if (meuVoto) {
        card.appendChild(el("p", "jogos-sub", "Aguardando resposta do outro."));
      }
    } else if (fase === "revelado") {
      card.appendChild(el("p", "jogos-destaque", est.em_sintonia ? "Sintonia total!" : "Divergência!"));

      const v0 = votosRevelados.find(r => r.jogador === "0");
      const v1 = votosRevelados.find(r => r.jogador === "1");
      const e0 = v0 && v0.valor ? v0.valor.escolha : "?";
      const e1 = v1 && v1.valor ? v1.valor.escolha : "?";
      const texto = e => (e === "A" ? est.opcao_a : e === "B" ? est.opcao_b : "");

      const comp = el("div", "jogos-duelo-grid");
      [
        [nomes[0], e0],
        [nomes[1], e1]
      ].forEach(([nome, esc]) => {
        const item = el("div", "jogos-revelacao-item");
        item.appendChild(el("p", "jogos-rodada-lbl", `${nome} escolheu ${esc}`));
        item.appendChild(el("p", "jogos-sub", texto(esc)));
        comp.appendChild(item);
      });
      card.appendChild(comp);

      const btnProx = el("button", "primary", "Próximo dilema");
      btnProx.type = "button";
      btnProx.addEventListener("click", sortearDilema);
      card.appendChild(btnProx);
    }

    raiz.appendChild(card);
  }

  window.JogosHub.registrar("dilemas-as-cegas", {
    async montar(container, ctx) {
      raiz = container;
      ctxJogo = ctx;
      meuVoto = null;
      meuVotoRodada = 0;
      statusVotos = [];
      votosRevelados = [];
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
