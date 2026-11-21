// Jogo: Mata-mata de decisões — Longe & Perto
(function () {
  let raiz = null;
  let ctxJogo = null;
  let listasProntas = null;
  let meuVoto = null;
  let meuVotoRodada = 0;
  let statusVotos = [];

  function el(tag, cls, txt) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt !== undefined && txt !== null) n.textContent = txt;
    return n;
  }

  async function carregarListas(sb) {
    if (listasProntas) return listasProntas;
    const { data, error } = await sb
      .from("jogos_conteudo")
      .select("id, categoria, dados")
      .eq("jogo_id", "mata-mata")
      .eq("ativo", true);
    if (error || !Array.isArray(data)) return [];
    listasProntas = data;
    return listasProntas;
  }

  function nomeEtapa(n) {
    if (n === 4) return "Quartas de final";
    if (n === 2) return "Semifinal";
    return "Final";
  }

  async function iniciarChave(titulo, opcoes) {
    const limpas = (opcoes || []).map(x => String(x || "").trim()).filter(Boolean).slice(0, 8);
    if (limpas.length !== 8) {
      ctxJogo.aviso("Preencha todas as 8 opções para começar a chave.");
      return;
    }
    const p = ctxJogo.partida;
    const est = (p && p.estado) || {};
    const proxVotoRodada = Number(est.voto_rodada || 1) + 1;
    meuVoto = null;
    meuVotoRodada = 0;
    statusVotos = [];
    await ctxJogo.salvarEstado({
      fase: "duelo",
      titulo: String(titulo || "Chave de decisões").trim(),
      etapa: limpas,
      vencedores: [],
      duelo_idx: 0,
      voto_rodada: proxVotoRodada,
      empate: false,
      moeda_msg: null,
      campeao: null,
      cronometro_fim: 0
    });
  }

  async function votar(escolhaIdx) {
    const p = ctxJogo.partida;
    const est = p.estado || {};
    const vr = Number(est.voto_rodada || 1);
    const ok = await ctxJogo.enviarSegredo(vr, "voto", { escolha: escolhaIdx });
    if (!ok) return;
    meuVoto = escolhaIdx;
    meuVotoRodada = vr;
    await ctxJogo.salvarEstado({ ping_voto: Date.now() });
    await sincronizarVotos();
  }

  async function avancarVencedor(vencedorTexto, msgExtra) {
    const p = ctxJogo.partida;
    const est = p.estado || {};
    const etapa = Array.isArray(est.etapa) ? est.etapa : [];
    const vencedores = (Array.isArray(est.vencedores) ? est.vencedores : []).concat(vencedorTexto);
    const dueloIdx = Number(est.duelo_idx || 0) + 1;
    const totalDuelos = Math.floor(etapa.length / 2);
    const proxVotoRodada = Number(est.voto_rodada || 1) + 1;

    meuVoto = null;
    meuVotoRodada = 0;
    statusVotos = [];
    ctxJogo.pararCronometro();

    if (dueloIdx < totalDuelos) {
      await ctxJogo.salvarEstado({
        duelo_idx: dueloIdx,
        vencedores,
        voto_rodada: proxVotoRodada,
        empate: false,
        moeda_msg: msgExtra || null,
        cronometro_fim: 0
      });
      return;
    }

    if (vencedores.length === 1) {
      await ctxJogo.salvarEstado({
        fase: "campeao",
        campeao: vencedores[0],
        vencedores: [],
        empate: false,
        moeda_msg: msgExtra || null,
        cronometro_fim: 0
      });
      return;
    }

    await ctxJogo.salvarEstado({
      etapa: vencedores,
      vencedores: [],
      duelo_idx: 0,
      voto_rodada: proxVotoRodada,
      empate: false,
      moeda_msg: msgExtra || null,
      cronometro_fim: 0
    });
  }

  async function defesa30s() {
    const p = ctxJogo.partida;
    const est = p.estado || {};
    const proxVotoRodada = Number(est.voto_rodada || 1) + 1;
    meuVoto = null;
    meuVotoRodada = 0;
    statusVotos = [];
    await ctxJogo.salvarEstado({
      empate: false,
      moeda_msg: "Defesa em andamento: conversem por 30s e votem de novo.",
      voto_rodada: proxVotoRodada
    });
    await ctxJogo.iniciarCronometro(30);
  }

  async function desempateMoeda() {
    const p = ctxJogo.partida;
    const est = p.estado || {};
    const etapa = Array.isArray(est.etapa) ? est.etapa : [];
    const idx = Number(est.duelo_idx || 0) * 2;
    const opA = etapa[idx];
    const opB = etapa[idx + 1];
    const ganhou = Math.random() < 0.5 ? opA : opB;
    await avancarVencedor(ganhou, `Desempate na moeda escolheu: ${ganhou}`);
  }

  async function sincronizarVotos() {
    if (!ctxJogo || !ctxJogo.partida) return;
    const est = ctxJogo.partida.estado || {};
    if (est.fase !== "duelo" || est.empate) {
      render();
      return;
    }
    const vr = Number(est.voto_rodada || 1);
    if (meuVotoRodada !== vr) {
      const salvo = await ctxJogo.lerMeuSegredo(vr, "voto");
      meuVoto = salvo && typeof salvo.escolha === "number" ? salvo.escolha : null;
      meuVotoRodada = vr;
    }
    statusVotos = await ctxJogo.statusSegredos(vr);
    if (statusVotos.some(s => s.jogador === "0") && statusVotos.some(s => s.jogador === "1")) {
      const revs = await ctxJogo.revelarRodada(vr);
      const v0 = revs.find(r => r.jogador === "0");
      const v1 = revs.find(r => r.jogador === "1");
      if (v0 && v1 && v0.valor && v1.valor) {
        const e0 = Number(v0.valor.escolha);
        const e1 = Number(v1.valor.escolha);
        const etapa = Array.isArray(est.etapa) ? est.etapa : [];
        const base = Number(est.duelo_idx || 0) * 2;
        if (e0 === e1) {
          const vencedor = etapa[base + e0];
          await avancarVencedor(vencedor, null);
        } else {
          await ctxJogo.salvarEstado({ empate: true, moeda_msg: null });
        }
        return;
      }
    }
    render();
  }

  async function renderPreparacao() {
    const { sb } = ctxJogo.dadosSala;
    const listas = await carregarListas(sb);
    if (!raiz) return;
    raiz.textContent = "";

    const card = el("div", "jogos-subcard");
    card.appendChild(el("p", "jogos-rodada-lbl", "Escolha uma lista pronta ou crie a sua"));

    if (listas.length) {
      const prontas = el("div", "jogos-acoes-col");
      listas.forEach(item => {
        const d = item.dados || {};
        const b = el("button", "secondary", d.titulo || "Lista");
        b.type = "button";
        b.addEventListener("click", () => iniciarChave(d.titulo, d.opcoes));
        prontas.appendChild(b);
      });
      card.appendChild(prontas);
    }

    const sep = el("p", "jogos-rodada-lbl", "Ou monte 8 opções personalizadas");
    card.appendChild(sep);

    const form = el("form", "jogos-form-chave");
    const inpTitulo = document.createElement("input");
    inpTitulo.type = "text";
    inpTitulo.placeholder = "Título da chave (ex.: Onde jantar sexta)";
    inpTitulo.maxLength = 60;
    form.appendChild(inpTitulo);

    const inputs = [];
    for (let i = 0; i < 8; i++) {
      const inp = document.createElement("input");
      inp.type = "text";
      inp.placeholder = `Opção ${i + 1}`;
      inp.maxLength = 50;
      inputs.push(inp);
      form.appendChild(inp);
    }
    const btnIniciar = el("button", "primary", "Iniciar chave");
    btnIniciar.type = "submit";
    form.appendChild(btnIniciar);
    form.addEventListener("submit", ev => {
      ev.preventDefault();
      iniciarChave(inpTitulo.value || "Nossa decisão", inputs.map(i => i.value));
    });
    card.appendChild(form);
    raiz.appendChild(card);
  }

  function render() {
    if (!raiz || !ctxJogo || !ctxJogo.partida) return;
    const est = ctxJogo.partida.estado || {};
    const { nomes } = ctxJogo.dadosSala;
    const fase = est.fase || "preparacao";

    if (fase === "preparacao") {
      renderPreparacao();
      return;
    }

    raiz.textContent = "";
    const card = el("div", "jogos-subcard");

    if (fase === "campeao") {
      card.appendChild(el("p", "jogos-rodada-lbl", est.titulo || "Resultado da chave"));
      if (est.moeda_msg) card.appendChild(el("p", "jogos-sub", est.moeda_msg));
      card.appendChild(el("p", "jogos-destaque", `Campeã: ${est.campeao || ""}`));
      const btnNova = el("button", "primary", "Nova chave");
      btnNova.type = "button";
      btnNova.addEventListener("click", () => ctxJogo.salvarEstado({ fase: "preparacao", campeao: null, moeda_msg: null }));
      card.appendChild(btnNova);
      raiz.appendChild(card);
      return;
    }

    const etapa = Array.isArray(est.etapa) ? est.etapa : [];
    const totalDuelos = Math.floor(etapa.length / 2);
    const dueloIdx = Number(est.duelo_idx || 0);
    const opA = etapa[dueloIdx * 2] || "";
    const opB = etapa[dueloIdx * 2 + 1] || "";

    card.appendChild(el("p", "jogos-rodada-lbl", `${est.titulo || "Mata-mata"} · ${nomeEtapa(totalDuelos)} (${dueloIdx + 1}/${totalDuelos})`));
    if (est.moeda_msg) card.appendChild(el("p", "jogos-sub", est.moeda_msg));

    if (est.empate) {
      card.appendChild(el("p", "jogos-destaque", `Empate entre "${opA}" e "${opB}"!`));
      card.appendChild(el("p", "jogos-sub", "Cada um defende sua escolha ou decidam na moeda."));
      const acoes = el("div", "jogos-acoes-linha");
      const bDef = el("button", "primary", "Defesa de 30s");
      bDef.type = "button";
      bDef.addEventListener("click", defesa30s);
      const bMoe = el("button", "secondary", "Desempate na moeda");
      bMoe.type = "button";
      bMoe.addEventListener("click", desempateMoeda);
      acoes.append(bDef, bMoe);
      card.appendChild(acoes);
    } else {
      const j0Ok = statusVotos.some(s => s.jogador === "0");
      const j1Ok = statusVotos.some(s => s.jogador === "1");
      card.appendChild(el("p", "jogos-sub", `${nomes[0]}: ${j0Ok ? "votou" : "votando"} · ${nomes[1]}: ${j1Ok ? "votou" : "votando"}`));

      const duelo = el("div", "jogos-duelo-grid");
      [opA, opB].forEach((op, idx) => {
        const b = el("button", meuVoto === idx ? "primary jogos-duelo-btn" : "secondary jogos-duelo-btn", op);
        b.type = "button";
        b.disabled = meuVoto !== null;
        b.addEventListener("click", () => votar(idx));
        duelo.appendChild(b);
      });
      card.appendChild(duelo);

      if (meuVoto !== null) {
        card.appendChild(el("p", "jogos-sub", `Seu voto oculto: ${meuVoto === 0 ? opA : opB}`));
      }
    }

    const vencedores = Array.isArray(est.vencedores) ? est.vencedores : [];
    if (vencedores.length) {
      card.appendChild(el("p", "jogos-sub", `Já classificados: ${vencedores.join(", ")}`));
    }

    const btnReset = el("button", "linkbtn", "Trocar lista");
    btnReset.type = "button";
    btnReset.addEventListener("click", () => ctxJogo.salvarEstado({ fase: "preparacao", cronometro_fim: 0 }));
    card.appendChild(btnReset);

    raiz.appendChild(card);
  }

  window.JogosHub.registrar("mata-mata", {
    async montar(container, ctx) {
      raiz = container;
      ctxJogo = ctx;
      meuVoto = null;
      meuVotoRodada = 0;
      statusVotos = [];
      await sincronizarVotos();
    },
    async aoAtualizar() {
      await sincronizarVotos();
    },
    desmontar() {
      raiz = null;
      ctxJogo = null;
    }
  });
})();
