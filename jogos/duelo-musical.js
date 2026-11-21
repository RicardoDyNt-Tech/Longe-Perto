// Jogo: Duelo musical — Longe & Perto
(function () {
  const RE_SPOTIFY = /^https:\/\/open\.spotify\.com\/(intl-[a-z-]+\/)?track\/([A-Za-z0-9]+)/;
  let raiz = null;
  let ctxJogo = null;
  let poolMusicas = null;
  let cenarios = null;
  let trioLocal = [];
  let trioRodada = 0;
  let trocouTrioRodada = 0;
  let segredoLocal = null;
  let segredoRodada = 0;
  let revelados = [];
  let reveladosRodada = 0;
  let statusAtual = [];

  function el(tag, cls, txt) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt !== undefined && txt !== null) n.textContent = txt;
    return n;
  }

  function idFaixa(url) {
    const m = RE_SPOTIFY.exec((url || "").trim());
    return m ? m[2] : null;
  }

  async function carregarMusicas(sb, sala) {
    if (poolMusicas) return poolMusicas;
    const PAGINA = 1000;
    let todas = [];
    for (let de = 0; ; de += PAGINA) {
      const { data, error } = await sb
        .from("musicas")
        .select("id, titulo, artista, url, playlist")
        .or("sala.is.null,sala.eq." + sala)
        .eq("ativa", true)
        .order("id", { ascending: true })
        .range(de, de + PAGINA - 1);
      if (error || !data) break;
      todas = todas.concat(data);
      if (data.length < PAGINA) break;
    }
    poolMusicas = todas.filter(m => idFaixa(m.url));
    return poolMusicas;
  }

  async function carregarCenarios(sb) {
    if (cenarios) return cenarios;
    const { data, error } = await sb
      .from("jogos_conteudo")
      .select("id, dados")
      .eq("jogo_id", "duelo-musical")
      .eq("ativo", true);
    if (error || !Array.isArray(data)) return [];
    cenarios = data;
    return cenarios;
  }

  function criarPlayerSpotify(faixa) {
    const box = el("div", "jogos-musica-box");
    const info = el("div", "jogos-musica-info");
    info.appendChild(el("strong", "", faixa.titulo || "Faixa"));
    info.appendChild(el("span", "jogos-sub", faixa.artista || ""));
    box.appendChild(info);

    const id = idFaixa(faixa.url);
    if (id) {
      const f = document.createElement("iframe");
      f.src = "https://open.spotify.com/embed/track/" + encodeURIComponent(id);
      f.width = "100%";
      f.height = "80";
      f.loading = "lazy";
      f.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
      f.title = `Player do Spotify: ${faixa.titulo || "faixa"}`;
      f.className = "jogos-spotify-frame";
      box.appendChild(f);
    }

    if (faixa.url) {
      const a = el("a", "linkbtn", "Abrir no Spotify");
      a.href = faixa.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      box.appendChild(a);
    }
    return box;
  }

  function sortearTrio(lista) {
    const copia = lista.slice();
    const out = [];
    while (out.length < 3 && copia.length) {
      const i = Math.floor(Math.random() * copia.length);
      out.push(copia.splice(i, 1)[0]);
    }
    return out;
  }

  async function iniciarSubmodo(submodo) {
    const { sb, sala } = ctxJogo.dadosSala;
    const p = ctxJogo.partida;
    const est = (p && p.estado) || {};
    const musicas = await carregarMusicas(sb, sala);
    if (!musicas.length) {
      ctxJogo.aviso("Nenhuma música disponível no banco.");
      return;
    }
    const rodada = Number(p.rodada || 1);
    segredoLocal = null;
    revelados = [];
    trioLocal = [];
    if (submodo === "adivinhe") {
      const faixa = musicas[Math.floor(Math.random() * musicas.length)];
      const vez = Number(est.vez || 0);
      await ctxJogo.enviarSegredo(rodada, "faixa", faixa);
      segredoLocal = faixa;
      segredoRodada = rodada;
      await ctxJogo.salvarEstado({
        submodo: "adivinhe",
        fase: "tocando",
        vez,
        faixa_revelada: null,
        acertou: null
      });
    } else {
      const listaCen = await carregarCenarios(sb);
      const item = listaCen.length ? listaCen[Math.floor(Math.random() * listaCen.length)] : null;
      const cenario = (item && item.dados && item.dados.cenario) || "Música que define hoje";
      trioLocal = sortearTrio(musicas);
      trioRodada = rodada;
      await ctxJogo.salvarEstado({
        submodo: "batalha",
        fase: "escolhendo",
        cenario,
        ping_segredo: Date.now(),
        voto_dado: false
      });
    }
  }

  async function resolverAdivinhe(acertou) {
    const p = ctxJogo.partida;
    const est = p.estado || {};
    const rodada = Number(p.rodada || 1);
    const revs = await ctxJogo.revelarRodada(rodada);
    const item = revs.find(r => r.chave === "faixa") || revs[0];
    const faixa = (item && item.valor) || segredoLocal;
    const novoPlacar = { ...(p.placar || {}) };
    if (acertou) {
      const adv = String(1 - Number(est.vez || 0));
      novoPlacar[adv] = (Number(novoPlacar[adv]) || 0) + 1;
    }
    await ctxJogo.salvarEstado(
      { fase: "revelado", faixa_revelada: faixa, acertou: !!acertou },
      { placar: novoPlacar }
    );
  }

  async function escolherFaixaBatalha(faixa) {
    const p = ctxJogo.partida;
    const rodada = Number(p.rodada || 1);
    const ok = await ctxJogo.enviarSegredo(rodada, "escolha", faixa);
    if (!ok) return;
    segredoLocal = faixa;
    segredoRodada = rodada;
    await ctxJogo.salvarEstado({ ping_segredo: Date.now() });
    await atualizarBatalha();
  }

  async function revelarBatalha() {
    const p = ctxJogo.partida;
    const rodada = Number(p.rodada || 1);
    revelados = await ctxJogo.revelarRodada(rodada);
    reveladosRodada = rodada;
    await ctxJogo.salvarEstado({ fase: "revelado" });
  }

  async function pontuarBatalha(vencedorIdx) {
    const p = ctxJogo.partida;
    const novoPlacar = { ...(p.placar || {}) };
    if (vencedorIdx === 0 || vencedorIdx === 1) {
      const k = String(vencedorIdx);
      novoPlacar[k] = (Number(novoPlacar[k]) || 0) + 1;
    }
    await proximaRodada(novoPlacar);
  }

  async function proximaRodada(placarOpcional) {
    const p = ctxJogo.partida;
    const est = p.estado || {};
    const proxRodada = Number(p.rodada || 1) + 1;
    segredoLocal = null;
    revelados = [];
    trioLocal = [];
    if (est.submodo === "adivinhe") {
      const { sb, sala } = ctxJogo.dadosSala;
      const musicas = await carregarMusicas(sb, sala);
      const faixa = musicas[Math.floor(Math.random() * musicas.length)];
      const proxVez = 1 - Number(est.vez || 0);
      await ctxJogo.salvarEstado(
        { submodo: "adivinhe", fase: "tocando", vez: proxVez, faixa_revelada: null, acertou: null },
        { rodada: proxRodada, ...(placarOpcional ? { placar: placarOpcional } : {}) }
      );
      if (ctxJogo.dadosSala.eu === proxVez) {
        await ctxJogo.enviarSegredo(proxRodada, "faixa", faixa);
        segredoLocal = faixa;
        segredoRodada = proxRodada;
      }
      render();
    } else {
      await ctxJogo.salvarEstado(
        { submodo: null, fase: "inicio", cenario: null, faixa_revelada: null },
        { rodada: proxRodada, ...(placarOpcional ? { placar: placarOpcional } : {}) }
      );
    }
  }

  async function atualizarBatalha() {
    if (!ctxJogo || !ctxJogo.partida) return;
    const { sb, sala } = ctxJogo.dadosSala;
    const p = ctxJogo.partida;
    const est = p.estado || {};
    const rodada = Number(p.rodada || 1);

    if (est.submodo === "batalha") {
      if (trioRodada !== rodada) {
        const musicas = await carregarMusicas(sb, sala);
        trioLocal = sortearTrio(musicas);
        trioRodada = rodada;
      }
      if (segredoRodada !== rodada) {
        segredoLocal = await ctxJogo.lerMeuSegredo(rodada, "escolha");
        segredoRodada = rodada;
      }
      statusAtual = await ctxJogo.statusSegredos(rodada);
      if (est.fase === "escolhendo" && statusAtual.some(s => s.jogador === "0") && statusAtual.some(s => s.jogador === "1")) {
        await revelarBatalha();
        return;
      }
      if (est.fase === "revelado" && reveladosRodada !== rodada) {
        revelados = await ctxJogo.revelarRodada(rodada);
        reveladosRodada = rodada;
      }
    } else if (est.submodo === "adivinhe" && est.fase === "tocando") {
      const { eu } = ctxJogo.dadosSala;
      if (Number(est.vez || 0) === eu && segredoRodada !== rodada) {
        segredoLocal = await ctxJogo.lerMeuSegredo(rodada, "faixa");
        if (!segredoLocal) {
          const musicas = await carregarMusicas(sb, sala);
          if (musicas.length) {
            const faixa = musicas[Math.floor(Math.random() * musicas.length)];
            await ctxJogo.enviarSegredo(rodada, "faixa", faixa);
            segredoLocal = faixa;
          }
        }
        segredoRodada = rodada;
      }
    }
    render();
  }

  function render() {
    if (!raiz || !ctxJogo || !ctxJogo.partida) return;
    const p = ctxJogo.partida;
    const est = p.estado || {};
    const { eu, nomes } = ctxJogo.dadosSala;
    const rodada = Number(p.rodada || 1);

    raiz.textContent = "";

    if (!est.submodo || est.fase === "inicio") {
      const card = el("div", "jogos-subcard");
      card.appendChild(el("p", "jogos-rodada-lbl", "Escolha o modo do duelo"));
      card.appendChild(el("p", "jogos-sub", "As faixas vêm direto das playlists da sala no Spotify."));

      const acoes = el("div", "jogos-acoes-col");
      const b1 = el("button", "primary", "Adivinhe a faixa");
      b1.type = "button";
      b1.addEventListener("click", () => iniciarSubmodo("adivinhe"));

      const b2 = el("button", "secondary", "Batalha de cenários");
      b2.type = "button";
      b2.addEventListener("click", () => iniciarSubmodo("batalha"));

      acoes.append(b1, b2);
      card.appendChild(acoes);
      raiz.appendChild(card);
      return;
    }

    if (est.submodo === "adivinhe") {
      const vez = Number(est.vez || 0);
      const card = el("div", "jogos-subcard");
      card.appendChild(el("p", "jogos-rodada-lbl", `Rodada ${rodada} · ${nomes[vez]} toca, ${nomes[1 - vez]} adivinha`));

      if (est.fase === "tocando") {
        if (vez === eu) {
          card.appendChild(el("p", "jogos-sub", "Toque a faixa na chamada sem falar o nome:"));
          if (segredoLocal) card.appendChild(criarPlayerSpotify(segredoLocal));
          const acoes = el("div", "jogos-acoes-linha");
          const bAc = el("button", "primary", "Acertou (+1)");
          bAc.type = "button";
          bAc.addEventListener("click", () => resolverAdivinhe(true));
          const bEr = el("button", "secondary", "Não acertou");
          bEr.type = "button";
          bEr.addEventListener("click", () => resolverAdivinhe(false));
          acoes.append(bAc, bEr);
          card.appendChild(acoes);
        } else {
          card.appendChild(el("p", "jogos-sub", `Ouça ${nomes[vez]} tocando na chamada e tente acertar a música.`));
        }
      } else if (est.fase === "revelado") {
        card.appendChild(el("p", "jogos-destaque", est.acertou ? "Acertaram a faixa!" : "Não foi dessa vez."));
        if (est.faixa_revelada) card.appendChild(criarPlayerSpotify(est.faixa_revelada));
        const bProx = el("button", "primary", "Próxima rodada");
        bProx.type = "button";
        bProx.addEventListener("click", () => proximaRodada());
        card.appendChild(bProx);
      }
      raiz.appendChild(card);
      return;
    }

    if (est.submodo === "batalha") {
      const card = el("div", "jogos-subcard");
      card.appendChild(el("p", "jogos-rodada-lbl", `Rodada ${rodada} · Batalha de cenários`));
      card.appendChild(el("p", "jogos-destaque", est.cenario || ""));

      if (est.fase === "escolhendo") {
        const j0Ok = statusAtual.some(s => s.jogador === "0");
        const j1Ok = statusAtual.some(s => s.jogador === "1");
        card.appendChild(el("p", "jogos-sub", `${nomes[0]}: ${j0Ok ? "escolheu" : "escolhendo"} · ${nomes[1]}: ${j1Ok ? "escolheu" : "escolhendo"}`));

        if (segredoLocal) {
          card.appendChild(el("p", "jogos-sub", `Sua escolha secreta: ${segredoLocal.titulo} — ${segredoLocal.artista}`));
        } else {
          const listaEl = el("div", "jogos-acoes-col");
          trioLocal.forEach(f => {
            const b = el("button", "secondary jogos-opcao-musica");
            b.type = "button";
            b.appendChild(el("strong", "", f.titulo || "Faixa"));
            b.appendChild(el("span", "jogos-sub", f.artista || ""));
            b.addEventListener("click", () => escolherFaixaBatalha(f));
            listaEl.appendChild(b);
          });
          card.appendChild(listaEl);

          if (trocouTrioRodada !== rodada) {
            const bTrocar = el("button", "linkbtn", "Trocar trio (1x)");
            bTrocar.type = "button";
            bTrocar.addEventListener("click", async () => {
              const { sb, sala } = ctxJogo.dadosSala;
              trocouTrioRodada = rodada;
              trioLocal = sortearTrio(await carregarMusicas(sb, sala));
              render();
            });
            card.appendChild(bTrocar);
          }
        }
      } else if (est.fase === "revelado") {
        revelados.forEach(r => {
          const jIdx = Number(r.jogador);
          const wrap = el("div", "jogos-revelacao-item");
          wrap.appendChild(el("p", "jogos-rodada-lbl", `Escolha de ${nomes[jIdx] || "Jogador"}`));
          if (r.valor) wrap.appendChild(criarPlayerSpotify(r.valor));
          card.appendChild(wrap);
        });
        const acoes = el("div", "jogos-acoes-linha");
        [0, 1].forEach(idx => {
          const b = el("button", "primary", `Ponto: ${nomes[idx]}`);
          b.type = "button";
          b.addEventListener("click", () => pontuarBatalha(idx));
          acoes.appendChild(b);
        });
        const bEmp = el("button", "secondary", "Empate");
        bEmp.type = "button";
        bEmp.addEventListener("click", () => pontuarBatalha(null));
        acoes.appendChild(bEmp);
        card.appendChild(acoes);
      }

      const bTrocarModo = el("button", "linkbtn", "Trocar submodo");
      bTrocarModo.type = "button";
      bTrocarModo.addEventListener("click", () => ctxJogo.salvarEstado({ submodo: null, fase: "inicio" }));
      card.appendChild(bTrocarModo);
      raiz.appendChild(card);
    }
  }

  window.JogosHub.registrar("duelo-musical", {
    async montar(container, ctx) {
      raiz = container;
      ctxJogo = ctx;
      segredoLocal = null;
      segredoRodada = 0;
      revelados = [];
      reveladosRodada = 0;
      trioLocal = [];
      trioRodada = 0;
      await atualizarBatalha();
    },
    async aoAtualizar() {
      await atualizarBatalha();
    },
    desmontar() {
      raiz = null;
      ctxJogo = null;
    }
  });
})();
