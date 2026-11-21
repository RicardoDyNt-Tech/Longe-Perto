// Jogo: Leilão às cegas — Longe & Perto
(function () {
  let raiz = null;
  let ctxJogo = null;
  let banco = null;
  let cartasSala = [];
  let meuLance = null;
  let meuLanceRodada = 0;
  let statusLances = [];
  let lancesRevelados = [];
  let mostrandoFormCarta = false;

  function el(tag, cls, txt) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt !== undefined && txt !== null) n.textContent = txt;
    return n;
  }

  async function carregarBaralho(sb, sala) {
    if (!banco) {
      const { data } = await sb
        .from("jogos_conteudo")
        .select("id, modo, ousado, dados")
        .eq("jogo_id", "leilao-as-cegas")
        .eq("ativo", true);
      banco = Array.isArray(data) ? data : [];
    }
    const { data: proprias } = await sb
      .from("jogos_cartas_sala")
      .select("id, dados")
      .eq("sala_codigo", sala)
      .eq("jogo_id", "leilao-as-cegas");
    cartasSala = Array.isArray(proprias) ? proprias.map(c => ({ id: "sala-" + c.id, modo: "ambos", ousado: false, dados: c.dados, propria: true })) : [];
    return banco.concat(cartasSala);
  }

  async function iniciarPartida(fichasIniciais) {
    const fichas = Number(fichasIniciais) || 100;
    meuLance = null;
    meuLanceRodada = 0;
    statusLances = [];
    lancesRevelados = [];
    await sortearProximaCarta({
      fichas_iniciais: fichas,
      saldos: { "0": fichas, "1": fichas },
      conquistas: { "0": [], "1": [] },
      usadas: [],
      lance_rodada: 1
    }, { "0": 0, "1": 0 }, 1);
  }

  async function sortearProximaCarta(baseEstado, placarOpcional, rodadaOpcional) {
    const { sb, sala, juntos, permitidoOusado } = ctxJogo.dadosSala;
    const p = ctxJogo.partida;
    const est = baseEstado || (p && p.estado) || {};
    const modoAtual = juntos ? "juntos" : "longe";
    const todas = await carregarBaralho(sb, sala);
    const pool = todas.filter(c => (c.modo === "ambos" || c.modo === modoAtual) && (!!permitidoOusado || !c.ousado));
    const usadas = Array.isArray(est.usadas) ? est.usadas : [];
    let disp = pool.filter(c => !usadas.includes(c.id));
    if (!disp.length) disp = pool;
    if (!disp.length) {
      ctxJogo.aviso("Nenhuma carta disponível para este modo.");
      return;
    }
    const carta = disp[Math.floor(Math.random() * disp.length)];
    const d = carta.dados || {};
    const proxLanceRodada = Number(est.lance_rodada || 1) + 1;

    meuLance = null;
    meuLanceRodada = 0;
    statusLances = [];
    lancesRevelados = [];

    await ctxJogo.salvarEstado(
      {
        ...est,
        fase: "lance",
        carta: { id: carta.id, titulo: d.titulo || "Privilégio", descricao: d.descricao || "", propria: !!carta.propria },
        usadas: usadas.concat(carta.id).slice(-40),
        lance_rodada: proxLanceRodada,
        vencedor_rodada: null,
        valor_vencedor: null,
        empate: false
      },
      {
        ...(placarOpcional ? { placar: placarOpcional } : {}),
        ...(rodadaOpcional ? { rodada: rodadaOpcional } : {})
      }
    );
  }

  async function confirmarLance(valor) {
    const p = ctxJogo.partida;
    const est = p.estado || {};
    const { eu } = ctxJogo.dadosSala;
    const saldo = Number((est.saldos && est.saldos[String(eu)]) ?? 100);
    const lance = Math.max(0, Math.min(saldo, Math.floor(Number(valor) || 0)));
    const lr = Number(est.lance_rodada || 1);

    const ok = await ctxJogo.enviarSegredo(lr, "lance", { valor: lance });
    if (!ok) return;
    meuLance = lance;
    meuLanceRodada = lr;
    await ctxJogo.salvarEstado({ ping_lance: Date.now() });
    await sincronizar();
  }

  async function reabrirDesempate() {
    const est = ctxJogo.partida.estado || {};
    meuLance = null;
    meuLanceRodada = 0;
    statusLances = [];
    lancesRevelados = [];
    await ctxJogo.salvarEstado({
      fase: "lance",
      empate: false,
      lance_rodada: Number(est.lance_rodada || 1) + 1
    });
  }

  async function adicionarCartaPropria(titulo, descricao) {
    const { sb, sala } = ctxJogo.dadosSala;
    const t = String(titulo || "").trim();
    const d = String(descricao || "").trim();
    if (t.length < 2) {
      ctxJogo.aviso("Escreva um título para a carta.");
      return false;
    }
    const { error } = await sb
      .from("jogos_cartas_sala")
      .insert({ sala_codigo: sala, jogo_id: "leilao-as-cegas", dados: { titulo: t, descricao: d } });
    if (error) {
      ctxJogo.aviso(error.message || "Não foi possível salvar a carta.");
      return false;
    }
    mostrandoFormCarta = false;
    ctxJogo.aviso("Carta adicionada ao baralho da sala!");
    render();
    return true;
  }

  async function sincronizar() {
    if (!ctxJogo || !ctxJogo.partida) return;
    const p = ctxJogo.partida;
    const est = p.estado || {};
    const lr = Number(est.lance_rodada || 1);

    if (est.fase === "lance") {
      if (meuLanceRodada !== lr) {
        const salvo = await ctxJogo.lerMeuSegredo(lr, "lance");
        meuLance = salvo && typeof salvo.valor === "number" ? salvo.valor : null;
        meuLanceRodada = lr;
      }
      statusLances = await ctxJogo.statusSegredos(lr);
      if (statusLances.some(s => s.jogador === "0") && statusLances.some(s => s.jogador === "1")) {
        const revs = await ctxJogo.revelarRodada(lr);
        const l0 = revs.find(r => r.jogador === "0");
        const l1 = revs.find(r => r.jogador === "1");
        if (l0 && l1 && l0.valor && l1.valor) {
          lancesRevelados = revs;
          const v0 = Number(l0.valor.valor || 0);
          const v1 = Number(l1.valor.valor || 0);
          if (v0 === v1) {
            await ctxJogo.salvarEstado({ fase: "revelado", empate: true, vencedor_rodada: null, valor_vencedor: v0 });
          } else {
            const venc = v0 > v1 ? "0" : "1";
            const pago = Math.max(v0, v1);
            const saldos = { ...(est.saldos || { "0": 100, "1": 100 }) };
            saldos[venc] = Math.max(0, Number(saldos[venc] || 0) - pago);
            const conquistas = {
              "0": Array.isArray(est.conquistas && est.conquistas["0"]) ? est.conquistas["0"].slice() : [],
              "1": Array.isArray(est.conquistas && est.conquistas["1"]) ? est.conquistas["1"].slice() : []
            };
            if (est.carta) conquistas[venc].push(est.carta);
            const novoPlacar = { ...(p.placar || {}) };
            novoPlacar[venc] = (Number(novoPlacar[venc]) || 0) + 1;
            await ctxJogo.salvarEstado(
              { fase: "revelado", empate: false, vencedor_rodada: venc, valor_vencedor: pago, saldos, conquistas },
              { placar: novoPlacar }
            );
          }
          return;
        }
      }
    } else if (est.fase === "revelado") {
      lancesRevelados = await ctxJogo.revelarRodada(lr);
    }
    render();
  }

  function renderResumo(est, nomes) {
    const det = document.createElement("details");
    det.className = "jogos-detalhes";
    const sum = el("summary", "", "Saldos e cartas conquistadas");
    det.appendChild(sum);

    const box = el("div", "jogos-detalhes-corpo");
    const saldos = est.saldos || { "0": 100, "1": 100 };
    const conquistas = est.conquistas || { "0": [], "1": [] };
    [0, 1].forEach(idx => {
      const k = String(idx);
      const lista = Array.isArray(conquistas[k]) ? conquistas[k] : [];
      box.appendChild(el("p", "jogos-rodada-lbl", `${nomes[idx]}: ${saldos[k] ?? 0} fichas (${lista.length} ${lista.length === 1 ? "carta" : "cartas"})`));
      if (lista.length) {
        const ul = el("ul", "jogos-lista-conquistas");
        lista.forEach(c => ul.appendChild(el("li", "", c.titulo || "")));
        box.appendChild(ul);
      }
    });
    det.appendChild(box);
    return det;
  }

  function render() {
    if (!raiz || !ctxJogo || !ctxJogo.partida) return;
    const p = ctxJogo.partida;
    const est = p.estado || {};
    const { eu, nomes } = ctxJogo.dadosSala;
    const fase = est.fase || "config";

    raiz.textContent = "";
    const card = el("div", "jogos-subcard");

    if (fase === "config") {
      card.appendChild(el("p", "jogos-rodada-lbl", "Leilão às cegas · Fichas iniciais"));
      card.appendChild(el("p", "jogos-sub", "Cada um recebe um orçamento secreto de fichas para disputar cartas de privilégios."));
      const row = el("div", "jogos-acoes-linha");
      [80, 100, 150].forEach(f => {
        const b = el("button", f === 100 ? "primary" : "secondary", `${f} fichas`);
        b.type = "button";
        b.addEventListener("click", () => iniciarPartida(f));
        row.appendChild(b);
      });
      card.appendChild(row);
      raiz.appendChild(card);
      return;
    }

    const saldos = est.saldos || { "0": 100, "1": 100 };
    const meuSaldo = Number(saldos[String(eu)] ?? 0);
    card.appendChild(el("p", "jogos-rodada-lbl", `Rodada ${p.rodada || 1} · Seu saldo: ${meuSaldo} fichas`));

    if (est.carta) {
      const cartaBox = el("div", "jogos-carta-leilao");
      cartaBox.appendChild(el("p", "jogos-destaque", est.carta.titulo || ""));
      if (est.carta.descricao) cartaBox.appendChild(el("p", "jogos-sub", est.carta.descricao));
      if (est.carta.propria) cartaBox.appendChild(el("span", "jogos-selo", "Carta da sala"));
      card.appendChild(cartaBox);
    }

    if (fase === "lance") {
      const j0Ok = statusLances.some(s => s.jogador === "0");
      const j1Ok = statusLances.some(s => s.jogador === "1");
      card.appendChild(el("p", "jogos-sub", `${nomes[0]}: ${j0Ok ? "confirmou" : "pensando"} · ${nomes[1]}: ${j1Ok ? "confirmou" : "pensando"}`));

      if (meuLance !== null) {
        card.appendChild(el("p", "jogos-sub", `Seu lance secreto: ${meuLance} fichas. Aguardando ${nomes[1 - eu]}.`));
      } else {
        let valorAtual = Math.min(meuSaldo, 10);
        const inp = document.createElement("input");
        inp.type = "number";
        inp.min = "0";
        inp.max = String(meuSaldo);
        inp.value = String(valorAtual);

        const rapidos = el("div", "jogos-acoes-linha");
        [
          ["Zerar", () => { inp.value = "0"; }],
          ["+5", () => { inp.value = String(Math.min(meuSaldo, (Number(inp.value) || 0) + 5)); }],
          ["+10", () => { inp.value = String(Math.min(meuSaldo, (Number(inp.value) || 0) + 10)); }],
          ["Tudo", () => { inp.value = String(meuSaldo); }]
        ].forEach(([rot, fn]) => {
          const b = el("button", "jogos-chip", rot);
          b.type = "button";
          b.addEventListener("click", fn);
          rapidos.appendChild(b);
        });

        const btnConf = el("button", "primary", "Confirmar lance secreto");
        btnConf.type = "button";
        btnConf.addEventListener("click", () => confirmarLance(inp.value));

        card.append(inp, rapidos, btnConf);
      }
    } else if (fase === "revelado") {
      const l0 = lancesRevelados.find(r => r.jogador === "0");
      const l1 = lancesRevelados.find(r => r.jogador === "1");
      const v0 = l0 && l0.valor ? l0.valor.valor : 0;
      const v1 = l1 && l1.valor ? l1.valor.valor : 0;
      card.appendChild(el("p", "jogos-sub", `Lances revelados: ${nomes[0]} (${v0}) · ${nomes[1]} (${v1})`));

      if (est.empate) {
        card.appendChild(el("p", "jogos-destaque", "Empate! Ninguém gastou fichas."));
        const row = el("div", "jogos-acoes-linha");
        const bDes = el("button", "primary", "Novo lance (desempate)");
        bDes.type = "button";
        bDes.addEventListener("click", reabrirDesempate);
        const bVol = el("button", "secondary", "Próxima carta");
        bVol.type = "button";
        bVol.addEventListener("click", () => sortearProximaCarta(est, null, Number(p.rodada || 1) + 1));
        row.append(bDes, bVol);
        card.appendChild(row);
      } else {
        const venc = Number(est.vencedor_rodada || 0);
        card.appendChild(el("p", "jogos-destaque", `${nomes[venc]} levou a carta por ${est.valor_vencedor} fichas!`));
        const bProx = el("button", "primary", "Próxima carta");
        bProx.type = "button";
        bProx.addEventListener("click", () => sortearProximaCarta(est, null, Number(p.rodada || 1) + 1));
        card.appendChild(bProx);
      }
    }

    card.appendChild(renderResumo(est, nomes));

    const acoesRodape = el("div", "jogos-acoes-linha");
    const bAdd = el("button", "linkbtn", mostrandoFormCarta ? "Fechar formulário" : "Adicionar carta nossa");
    bAdd.type = "button";
    bAdd.addEventListener("click", () => { mostrandoFormCarta = !mostrandoFormCarta; render(); });
    const bNova = el("button", "linkbtn", "Reiniciar fichas");
    bNova.type = "button";
    bNova.addEventListener("click", () => ctxJogo.salvarEstado({ fase: "config" }));
    acoesRodape.append(bAdd, bNova);
    card.appendChild(acoesRodape);

    if (mostrandoFormCarta) {
      const form = el("form", "jogos-form-chave");
      const inpT = document.createElement("input");
      inpT.type = "text";
      inpT.placeholder = "Título do privilégio ou desejo";
      inpT.maxLength = 60;
      const inpD = document.createElement("input");
      inpD.type = "text";
      inpD.placeholder = "Descrição curta (opcional)";
      inpD.maxLength = 140;
      const bSalv = el("button", "primary", "Salvar carta na sala");
      bSalv.type = "submit";
      form.append(inpT, inpD, bSalv);
      form.addEventListener("submit", ev => {
        ev.preventDefault();
        adicionarCartaPropria(inpT.value, inpD.value);
      });
      card.appendChild(form);
    }

    raiz.appendChild(card);
  }

  window.JogosHub.registrar("leilao-as-cegas", {
    async montar(container, ctx) {
      raiz = container;
      ctxJogo = ctx;
      meuLance = null;
      meuLanceRodada = 0;
      statusLances = [];
      lancesRevelados = [];
      await sincronizar();
    },
    async aoAtualizar() {
      await sincronizar();
    },
    desmontar() {
      mostrandoFormCarta = false;
      raiz = null;
      ctxJogo = null;
    }
  });
})();
