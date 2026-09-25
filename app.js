// Longe & Perto — sala sincronizada via Supabase Realtime.
// Fonte da verdade: a linha da tabela `salas` (coluna `estado`). Cada ação grava o estado
// inteiro; os dois celulares escutam o UPDATE e redesenham.

(() => {
  const $ = id => document.getElementById(id);
  const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const SEGMENTOS = 8;
  const GIRO_MS = () => matchMedia("(prefers-reduced-motion: reduce)").matches ? 350 : 3300;
  const LEVEL_NAMES = { leve: "Leve", criativo: "Criativo", picante: "Picante", pesado: "Pesado +18" };
  const TIPO_NOMES = {
    verdade: "Verdade", desafio: "Desafio", prenda: "Prenda",
    efeito: "Efeito contínuo", duelo: "Duelo", sintonia: "Sintonia", missao_dupla: "Missão em dupla", missao_secreta: "Missão secreta"
  };
  // Eventos especiais: chance de um giro virar evento e peso de cada tipo
  const CHANCE_EVENTO = { desligado: 0, raro: 0.10, normal: 0.20, frequente: 0.35 };
  const PESOS_EVENTO = [["efeito", 35], ["duelo", 30], ["sintonia", 20], ["missao_dupla", 15]];
  const PARA_OS_DOIS = ["duelo", "missao_dupla"];
  const OS_DOIS_JOGAM = ["duelo", "missao_dupla", "sintonia"];   // eventos em que os dois agem ao mesmo tempo
  const PONTOS_EFEITO = { leve: 1, criativo: 1, picante: 2, pesado: 3 };   // quem aguenta o efeito até o fim
  const MAX_EFEITOS = 2;                                                     // por pessoa
  const PONTOS_MISSAO = { leve: 2, criativo: 2, picante: 3, pesado: 4 };    // missão secreta confirmada
  // tipos de evento com tratamento próprio (as fases seguintes registram aqui); os demais usam "Concluir evento"
  const EVENTOS_TRATADOS = new Set();
  const ORDEM_NIVEIS = ["leve", "criativo", "picante", "pesado"];
  const PONTOS = {
    verdade: { leve: 1, criativo: 1, picante: 2, pesado: 3 },
    desafio: { leve: 2, criativo: 2, picante: 3, pesado: 4 }
  };
  const METAS = [10, 20, 30];
  const PULOS_OPCOES = [0, 1, 2, 3, 5, 10];
  const DEVOLVE = { leve: 1, criativo: 1, picante: 2, pesado: 3 };   // pulos devolvidos ao cumprir prenda por pulo

  let sb = null;
  let codigo = null;    // sala atual
  let eu = null;        // 0 ou 1
  let estado = null;    // último estado conhecido
  let canal = null;
  let ultimoGiro = null;
  let rotacao = 0;
  let girando = false;
  let timerCarta = null;
  let ultimoAviso = null;
  let ultimaVez = null;     // para vibrar quando a vez passa a ser minha
  let ultimoVencedor = null; // para recarregar o histórico quando a partida acaba
  let timerLocal = null;    // { id, t0 } — início da contagem medido neste aparelho
  let timerTick = null;
  let timerAcabou = null;   // id do timer que já deu "Tempo!" aqui
  const efeitosAbertos = new Set();   // efeitos com o texto completo aberto neste aparelho
  let missaoAberta = false;           // "🤫 Minha missão" aberta neste aparelho
  let vista = "jogo";                 // "casa", "jogo" ou uma vista da Casa (vEnvelopes, vCofre...)
  let presentes = new Set();          // jogadores com o app aberto agora (Presence do Realtime)
  let presencaPronta = false;
  let timerAviso = null;
  let cartas = [];        // cartas padrão + cartas desta sala, vindas da tabela `cartas`
  let cartasOk = false;   // false até a busca terminar (ou se falhar)
  let cofre = [];         // itens do cofre do reencontro desta sala
  let musicas = [];       // músicas padrão + músicas desta sala (tabela `musicas`)

  // ---------- util ----------
  const salvarLocal = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const lerLocal = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const mesmoNome = (a, b) => (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase();
  const gerarCodigo = () => Array.from({ length: 5 }, () => ALFABETO[Math.floor(Math.random() * ALFABETO.length)]).join("");
  const SUFIXO = "abcdefghijkmnpqrstuvwxyz23456789";
  const gerarSufixo = () => Array.from({ length: 4 }, () => SUFIXO[Math.floor(Math.random() * SUFIXO.length)]).join("");

  // "Rica e Carol" -> "rica-e-carol" (minúsculas, sem acento, espaço vira hífen)
  const normalizarNomeSala = s => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 25).replace(/-+$/, "");

  // código digitado ou do link: 5 letras/números (maiúsculas) ou nome de sala fixa (minúsculas com hífens)
  function lerCodigo(raw) {
    const s = (raw || "").trim();
    if (/^[A-Za-z0-9]{5}$/.test(s)) return s.toUpperCase();
    const f = s.toLowerCase();
    return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(f) && f.length >= 5 && f.length <= 30 ? f : null;
  }
  const linkSala = c => location.origin + location.pathname + "?sala=" + c;
  const erro = (onde, msg) => { $(onde).textContent = msg || ""; };

  function configurado() {
    const c = window.LP_CONFIG || {};
    return c.url && c.anonKey && !c.url.includes("SEU-PROJETO") && !c.anonKey.includes("SUA-CHAVE");
  }

  // ---------- roleta ----------
  function desenharRoleta() {
    const css = getComputedStyle(document.documentElement);
    const cV = css.getPropertyValue("--verdade").trim();
    const cD = css.getPropertyValue("--desafio").trim();
    const onC = css.getPropertyValue("--on-color").trim();
    const bg = css.getPropertyValue("--bg").trim();
    const r = 96, passo = 360 / SEGMENTOS;
    let html = "";
    for (let i = 0; i < SEGMENTOS; i++) {
      const a0 = (i * passo - 90) * Math.PI / 180, a1 = ((i + 1) * passo - 90) * Math.PI / 180;
      html += `<path d="M0 0 L${(r * Math.cos(a0)).toFixed(2)} ${(r * Math.sin(a0)).toFixed(2)} A${r} ${r} 0 0 1 ${(r * Math.cos(a1)).toFixed(2)} ${(r * Math.sin(a1)).toFixed(2)} Z" fill="${i % 2 === 0 ? cV : cD}" stroke="${bg}" stroke-width="2"/>`;
      html += `<text transform="rotate(${(i + 0.5) * passo}) translate(0,-62)" text-anchor="middle" dominant-baseline="middle" fill="${onC}" font-size="11" font-weight="800" font-family="Bricolage Grotesque, system-ui, sans-serif">${i % 2 === 0 ? "Verdade" : "Desafio"}</text>`;
    }
    $("wheel").innerHTML = html;
  }

  function posicionarRoleta(graus, animar) {
    const w = $("wheel");
    w.classList.toggle("anim", !!animar);
    w.style.transform = `rotate(${graus}deg)`;
    rotacao = graus;
  }

  // ---------- sorteio ----------
  // chaves antigas em `usados` (de antes das cartas irem para o banco) não batem com nenhum id e são ignoradas
  function sortear(tipo, niveis, usados) {
    const lista = niveis.length ? niveis : ["leve"];
    const pool = cartas.filter(c => c.tipo === tipo && lista.includes(c.nivel)).map(c => ({ ...c, chave: c.id }));
    if (!pool.length) cartas.filter(c => c.tipo === tipo && c.nivel === "leve").forEach(c => pool.push({ ...c, chave: c.id }));
    if (!pool.length) return null;
    const usadosSet = new Set(usados);
    let livres = pool.filter(p => !usadosSet.has(p.chave));
    let reset = false;
    if (!livres.length) { livres = pool; reset = true; }
    const p = livres[Math.floor(Math.random() * livres.length)];
    const carta = { tipo, nivel: p.nivel, texto: p.texto, chave: p.chave, reset, doPool: pool.map(x => x.chave) };
    if (p.id) carta.id = p.id;
    if (p.midia) carta.midia = p.midia;
    if (p.autor) carta.autor = p.autor;
    if (p.rodadas) carta.rodadas = p.rodadas;
    if (p.segundos) carta.segundos = p.segundos;
    return carta;
  }

  // prenda do nível pedido; se não houver prenda nesse nível, desce um nível até encontrar
  function sortearPrenda(nivel, usados) {
    for (let i = ORDEM_NIVEIS.indexOf(nivel); i >= 0; i--) {
      const n = ORDEM_NIVEIS[i];
      if (cartas.some(c => c.tipo === "prenda" && c.nivel === n)) return sortear("prenda", [n], usados);
    }
    return null;
  }

  function registrarUso(novo, carta) {
    let usados = novo.usados || [];
    if (carta.reset) { const tirar = new Set(carta.doPool); usados = usados.filter(k => !tirar.has(k)); }
    usados.push(carta.chave);
    novo.usados = usados.slice(-400);
    delete carta.reset; delete carta.doPool;
  }

  // ---------- banco ----------
  async function gravar(mudar) {
    if (!estado) return;
    const novo = structuredClone(estado);
    mudar(novo);
    // começou uma vez nova (sem carta na mesa): conta as rodadas dos efeitos e traz a prenda pendente
    const novaVez = novo.vez !== estado.vez || (estado.carta && estado.carta.novaVez && !novo.carta);
    if (novaVez && novo.vencedor == null && !novo.carta && novo.jogadores[1]) inicioDaVez(novo);
    // o cronômetro pertence à carta: saiu a carta (cumpri, pular, liberar, nova carta), sai o timer
    if ((novo.carta && novo.carta.chave) !== (estado.carta && estado.carta.chave)) novo.timer = null;
    if (!novo.carta) novo.musica = null;
    const venceuAgora = estado.vencedor == null && novo.vencedor != null;
    aplicar(novo, false, true);   // local: jogada feita neste aparelho
    const sala = codigo;
    const { error } = await sb.from("salas").update({ estado: novo }).eq("codigo", sala);
    if (error) erro("erroJogo", "Não consegui salvar a jogada. Confira a internet e tente de novo.");
    else {
      erro("erroJogo", "");
      // histórico: grava só o aparelho que fez a jogada da vitória (uma linha por partida)
      if (venceuAgora) registrarPartida(sala, novo);
    }
  }

  // Para jogadas que os dois podem fazer ao mesmo tempo (votos, respostas): relê a sala antes de gravar,
  // para uma não apagar a outra.
  async function gravarFresco(mudar) {
    if (!estado || !codigo) return;
    try { const e = await buscarSala(codigo); if (e) estado = normalizar(e); } catch (err) {}
    return gravar(mudar);
  }

  // Jogadas simultâneas: se os dois gravam no mesmo instante, a última gravação pode apagar a outra.
  // Cada aparelho guarda a própria jogada como pendente e, se um estado chegar sem ela, grava de novo.
  const pendentes = new Map();   // nome -> { obsoleto(e), presente(e), refazer(), t }
  function pendente(nome, obsoleto, presente, refazer) {
    const antes = pendentes.get(nome);
    if (antes) clearTimeout(antes.t);
    pendentes.set(nome, { obsoleto, presente, refazer, t: null });
  }
  function conferirPendentes(e) {
    pendentes.forEach((p, nome) => {
      if (p.obsoleto(e)) { clearTimeout(p.t); pendentes.delete(nome); return; }
      if (p.presente(e) || p.t) return;
      p.t = setTimeout(() => {
        p.t = null;
        if (estado && !p.obsoleto(estado) && !p.presente(estado)) p.refazer();
      }, 250 + Math.random() * 450);
    });
  }

  async function carregarCartas(c) {
    cartasOk = false;
    atualizarBotoes();
    const { data, error } = await sb.from("cartas")
      .select("id, sala, tipo, nivel, texto, midia, autor, rodadas, segundos")
      .or("sala.is.null,sala.eq." + c)
      .eq("ativa", true);
    if (c !== codigo) return;   // saiu da sala enquanto carregava
    if (error || !data || !data.length) {
      cartas = [];
      erro("erroJogo", "Não consegui carregar as cartas. Recarregue a página.");
    } else {
      cartas = data;
      cartasOk = true;
    }
    atualizarBotoes();
    desenharExtras();
    desenharDiario();
  }

  async function buscarSala(c) {
    const { data, error } = await sb.from("salas").select("estado").eq("codigo", c).maybeSingle();
    if (error) throw error;
    return data ? data.estado : null;
  }

  // ---------- entrar / criar ----------
  async function criarSala(fixa) {
    erro("erroLobby", "");
    const nome = $("nome").value.trim();
    if (!nome) return erro("erroLobby", "Digite seu nome para criar a sala.");
    const base = fixa ? normalizarNomeSala($("nomeSala").value) : "";
    if (fixa && !base) return erro("erroLobby", "Digite um nome para a sala fixa (letras ou números).");
    salvarLocal("lp-nome", nome);
    const inicial = {
      fixa: !!fixa,
      jogadores: [nome, null],
      niveis: ["leve", "criativo"],
      vez: 0,
      pontos: [0, 0],
      placar: [placarVazio(0, 3), placarVazio(0, 3)],
      meta: 20,
      pulosMax: 3,
      aviso: null,
      vencedor: null,
      giro: null,
      carta: null,
      usados: []
    };
    for (let t = 0; t < 4; t++) {
      const c = fixa ? base + "-" + gerarSufixo() : gerarCodigo();
      const { error } = await sb.from("salas").insert({ codigo: c, estado: inicial });
      if (!error) return abrirSala(c, 0, inicial);
      if (error.code !== "23505") return erro("erroLobby", "Não consegui criar a sala: " + error.message);
    }
    erro("erroLobby", "Não consegui gerar um código livre. Tente de novo.");
  }

  async function entrarSala(cRaw) {
    erro("erroLobby", "");
    const c = lerCodigo(cRaw);
    const nome = $("nome").value.trim();
    if (!c) return erro("erroLobby", "Use o código de 5 letras ou números, ou o nome completo da sala fixa (com o final).");
    if (!nome) return erro("erroLobby", "Digite seu nome para entrar.");
    salvarLocal("lp-nome", nome);
    let e;
    try { e = await buscarSala(c); } catch (err) { return erro("erroLobby", "Não consegui acessar a sala: " + err.message); }
    if (!e) return erro("erroLobby", "Sala não encontrada. Confira o código.");

    let idx = e.jogadores.findIndex(j => j && mesmoNome(j, nome));
    if (idx === -1) {
      if (e.jogadores[1]) return erro("erroLobby", `Essa sala já tem ${e.jogadores[0]} e ${e.jogadores[1]}. Use um desses nomes para voltar.`);
      idx = 1;
      e.jogadores[1] = nome;
      const { error } = await sb.from("salas").update({ estado: e }).eq("codigo", c);
      if (error) return erro("erroLobby", "Não consegui entrar: " + error.message);
    }
    abrirSala(c, idx, e);
  }

  function abrirSala(c, idx, e) {
    codigo = c; eu = idx; ultimoGiro = null; ultimaVez = null;
    salvarLocal("lp-ultima-sala", { codigo: c });
    lembrarSala(c, e.jogadores[idx], !!e.fixa);
    $("salaCodigo").classList.toggle("fixa", !!e.fixa);
    $("dicaFixa").hidden = !e.fixa;
    ultimoVencedor = e.vencedor === undefined ? null : e.vencedor;
    carregarHistorico(c);
    history.replaceState(null, "", "?sala=" + c);
    $("lobby").hidden = true;
    $("jogo").hidden = false;
    $("salaCodigo").textContent = c;
    const convite = `Bora jogar Longe & Perto? Entra na sala ${c}: ${linkSala(c)}`;
    $("convidarWa").href = "https://wa.me/?text=" + encodeURIComponent(convite);

    if (canal) sb.removeChannel(canal);
    presentes = new Set(); presencaPronta = false;
    canal = sb.channel("sala-" + c, { config: { presence: { key: String(idx) } } })
      .on("presence", { event: "sync" }, () => sincronizarPresenca(c))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "salas", filter: `codigo=eq.${c}` },
        payload => { if (payload.new.codigo === c && codigo === c) aplicar(payload.new.estado, false); })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "cartas", filter: `sala=eq.${c}` },
        payload => juntarCarta(payload.new))
      // o Realtime não filtra DELETE; tirar pelo id basta (ids de outras salas não estão na lista)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "cartas" },
        payload => tirarCarta(payload.old && payload.old.id))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "cofre", filter: `sala=eq.${c}` },
        payload => juntarCofre(payload.new))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "cofre", filter: `sala=eq.${c}` },
        payload => juntarCofre(payload.new))
      // DELETE não é filtrável no Realtime: tira pelo id (itens de outras salas não estão na lista)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "cofre" },
        payload => tirarCofre(payload.old && payload.old.id))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "musicas", filter: `sala=eq.${c}` },
        payload => juntarMusica(payload.new))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "musicas" },
        payload => tirarMusica(payload.old && payload.old.id))
      ;
    canal = comTabelasV5(canal, c)
      .subscribe(status => {
        if (status === "SUBSCRIBED" && canal) canal.track({ jogador: idx, online_em: new Date().toISOString() }).catch(() => {});
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
          erro("erroJogo", "A conexão ao vivo caiu. Recarregue a página se a roleta parar de sincronizar.");
      });

    // sala fixa: Casa do casal (cofre e desafio do dia moram lá); sala comum: cofre no jogo
    const fixa = !!e.fixa;
    if (fixa) $("lugarCofre").appendChild($("cofre")); else $("musicas").before($("cofre"));
    $("cofre").open = fixa;
    $("casaConvite").hidden = fixa;
    $("casaGrade").hidden = !fixa;
    aplicar(e, true);
    mostrarVista(fixa ? "casa" : "jogo");
    carregarCartas(c);
    carregarCofre(c);
    carregarMusicas(c);
    Object.keys(TABELAS_V5).forEach(t => { dados[t] = []; });
    if (fixa) carregarV5(c);
  }

  // ---------- reencontro e cofre ----------
  // "hoje" no fuso do casal, como AAAA-MM-DD
  const hojeISO = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bahia" }).format(d);
  const diasAte = iso => {
    const [a, m, d] = iso.split("-").map(Number), [ha, hm, hd] = hojeISO().split("-").map(Number);
    return Math.round((Date.UTC(a, m - 1, d) - Date.UTC(ha, hm - 1, hd)) / 86400000);
  };
  const dataBR = iso => iso.split("-").reverse().join("/");
  let editandoData = false;

  function desenharReencontro(e) {
    const r = e.reencontro;
    const dias = r ? diasAte(r) : null;
    const txt = !r ? "Quando é o reencontro? 💞"
      : dias > 1 ? `Faltam ${dias} dias para o reencontro 💞`
      : dias === 1 ? "Falta 1 dia para o reencontro 💞"
      : dias === 0 ? "É hoje! 💞"
      : `O reencontro foi em ${dataBR(r)}. Marcar uma nova data?`;
    $("reencontroTxt").textContent = txt;
    const mostrarForm = !r || dias < 0 || editandoData;
    $("reencontroForm").hidden = !mostrarForm;
    $("reencontroMudar").hidden = mostrarForm;
    if (mostrarForm && document.activeElement !== $("reencontroData")) $("reencontroData").value = r && dias >= 0 ? r : "";
  }

  function salvarReencontro() {
    const v = $("reencontroData").value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return;
    editandoData = false;
    gravar(n => { n.reencontro = v; });
  }

  async function carregarCofre(c) {
    const { data, error } = await sb.from("cofre")
      .select("id, sala, carta, nota, autor, feito, criada_em")
      .eq("sala", c)
      .order("criada_em", { ascending: true });
    if (c !== codigo) return;
    cofre = error || !data ? [] : data;
    desenharCofre();
  }

  function juntarCofre(x) {
    if (!x || !x.id || x.sala !== codigo) return;
    const i = cofre.findIndex(y => y.id === x.id);
    if (i >= 0) cofre[i] = Object.assign(cofre[i], x); else cofre.push(x);
    cofre.sort((a, b) => (a.criada_em > b.criada_em ? 1 : -1));
    desenharCofre();
  }

  function tirarCofre(id) {
    if (!id || !cofre.some(x => x.id === id)) return;
    cofre = cofre.filter(x => x.id !== id);
    desenharCofre();
  }

  function desenharCofre() {
    const filtro = (document.querySelector('input[name="filtroCofre"]:checked') || {}).value || "todos";
    if (estado) desenharCasa(estado);
    const pend = cofre.filter(x => !x.feito).length;
    $("cofreQtd").textContent = cofre.length ? `(${pend} ${pend === 1 ? "pendente" : "pendentes"} de ${cofre.length})` : "";
    $("cofreDica").hidden = !estado || !!estado.fixa;
    const itens = cofre.filter(x => filtro === "todos" || (filtro === "feitos") === !!x.feito);
    $("cofreVazio").hidden = cofre.length > 0;
    const ul = $("listaCofre");
    ul.textContent = "";
    itens.forEach(x => {
      const li = document.createElement("li");
      if (x.feito) li.className = "feito";
      const info = document.createElement("div");
      info.className = "info";
      const t = document.createElement("span");
      t.className = "t";
      t.textContent = x.carta;
      info.appendChild(t);
      if (x.nota) {
        const nota = document.createElement("span");
        nota.className = "nota";
        nota.textContent = "↳ " + x.nota;
        info.appendChild(nota);
      }
      const autor = document.createElement("span");
      autor.className = "autor";
      autor.textContent = `por ${x.autor} · ${new Date(x.criada_em).toLocaleDateString("pt-BR")}`;
      info.appendChild(autor);
      const acoes = document.createElement("div");
      acoes.className = "acoes";
      const lab = document.createElement("label");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!x.feito;
      cb.addEventListener("change", () => marcarCofre(x, cb.checked));
      lab.append(cb, document.createTextNode("Feito ✓"));
      const apagar = document.createElement("button");
      apagar.type = "button";
      apagar.textContent = "Apagar";
      apagar.addEventListener("click", () => apagarCofre(x));
      acoes.append(lab, apagar);
      li.append(info, acoes);
      ul.appendChild(li);
    });
  }

  function abrirGuardar() {
    if (!estado || !estado.carta) return;
    $("cofreCarta").textContent = estado.carta.texto;
    $("cofreNota").value = "";
    erro("erroCofre", "");
    $("dlgCofre").showModal();
  }

  async function salvarCofre(ev) {
    ev.preventDefault();
    const carta = ($("cofreCarta").textContent || "").trim().slice(0, 280);
    if (!codigo || carta.length < 3) return;
    const nota = $("cofreNota").value.trim().slice(0, 500) || null;
    $("salvarCofre").disabled = true;
    const { data, error } = await sb.from("cofre")
      .insert({ sala: codigo, carta, nota, autor: (estado.jogadores[eu] || "").trim().slice(0, 20) })
      .select("id, sala, carta, nota, autor, feito, criada_em").single();
    $("salvarCofre").disabled = false;
    if (error) {
      return erro("erroCofre", /limite/.test(error.message || "")
        ? "O cofre desta sala chegou a 300 itens. Apague algum para guardar outro."
        : "Não consegui guardar. Confira a internet e tente de novo.");
    }
    juntarCofre(data);
    $("dlgCofre").close();
  }

  async function marcarCofre(x, feito) {
    const { error } = await sb.from("cofre").update({ feito }).eq("id", x.id);
    if (error) { erro("erroJogo", "Não consegui marcar. Confira a internet e tente de novo."); return desenharCofre(); }
    juntarCofre({ ...x, feito });
  }

  async function apagarCofre(x) {
    if (!confirm(`Apagar do cofre?\n\n"${x.carta}"`)) return;
    const { error } = await sb.from("cofre").delete().eq("id", x.id);
    if (error) return erro("erroJogo", "Não consegui apagar. Confira a internet e tente de novo.");
    tirarCofre(x.id);
  }

  // ---------- desafio do dia (só em sala fixa) ----------
  // Sorteio determinístico: mesma sala + mesmo dia + mesmo jogador = mesmo desafio nos dois aparelhos, sem gravar nada.
  function fnv1a(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  }

  function desafioDoDia(dia, jogador) {
    // só as cartas padrão, em ordem fixa, para os dois aparelhos terem exatamente a mesma lista
    const pool = cartas.filter(c => !c.sala && c.tipo === "desafio" && c.nivel === estado.nivelDiario)
      .sort((a, b) => (a.id < b.id ? -1 : 1));
    if (!pool.length) return null;
    return pool[fnv1a(`${codigo}|${dia}|${jogador}`) % pool.length];
  }

  const diaAnterior = iso => { const [a, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(a, m - 1, d - 1)).toISOString().slice(0, 10); };
  const cumpriuNoDia = (dia, jogador) => !!(estado.diario[dia] && estado.diario[dia][jogador]);

  // dias seguidos até hoje (ou até ontem, se hoje ainda não cumpriu)
  function sequencia(jogador) {
    let dia = hojeISO();
    if (!cumpriuNoDia(dia, jogador)) dia = diaAnterior(dia);
    let n = 0;
    while (cumpriuNoDia(dia, jogador) && n < 60) { n++; dia = diaAnterior(dia); }
    return n;
  }

  const textoSeq = n => n ? `🔥 ${n} ${n === 1 ? "dia seguido" : "dias seguidos"}` : "Ainda sem sequência";

  function desenharDiario() {
    const box = $("diario");
    if (!estado || !estado.fixa) { box.hidden = true; return; }
    box.hidden = false;
    const hoje = hojeISO();
    const nomes = estado.jogadores;
    $("nivelDiario").value = estado.nivelDiario;
    const meu = cartasOk ? desafioDoDia(hoje, eu) : null;
    $("diarioMeuTitulo").textContent = `Desafio do dia de ${nomes[eu]}`;
    $("diarioMeuTexto").textContent = !cartasOk ? "Carregando…" : meu ? meu.texto : "Sem desafios neste nível.";
    $("diarioMeuSeq").textContent = textoSeq(sequencia(eu));
    const feito = cumpriuNoDia(hoje, eu);
    $("diarioCumpri").textContent = feito ? "Cumprido hoje ✓" : "Cumpri hoje";
    $("diarioCumpri").disabled = feito || !meu;
    $("diarioWa").href = "https://wa.me/?text=" + encodeURIComponent(meu ? `Meu desafio do dia: ${meu.texto}` : "");
    const outro = 1 - eu;
    $("diarioOutro").hidden = !nomes[outro];
    if (nomes[outro]) {
      const dele = cartasOk ? desafioDoDia(hoje, outro) : null;
      $("diarioOutroTitulo").textContent = `Desafio do dia de ${nomes[outro]}` + (cumpriuNoDia(hoje, outro) ? " · cumprido ✓" : "");
      $("diarioOutroTexto").textContent = !cartasOk ? "Carregando…" : dele ? dele.texto : "Sem desafios neste nível.";
      $("diarioOutroSeq").textContent = textoSeq(sequencia(outro));
    }
  }

  function cumpriHoje() {
    if (!estado || !estado.fixa) return;
    const hoje = hojeISO();
    gravar(n => {
      n.diario[hoje] = Object.assign({}, n.diario[hoje], { [eu]: true });
      // guarda só os últimos 60 dias
      Object.keys(n.diario).sort().slice(0, -60).forEach(d => { delete n.diario[d]; });
    });
  }

  // ---------- trilha da rodada (Spotify, só links e player embutido) ----------
  const RE_SPOTIFY = /^https:\/\/open\.spotify\.com\/(intl-[a-z-]+\/)?track\/([A-Za-z0-9]+)/;
  const idFaixa = url => { const m = RE_SPOTIFY.exec((url || "").trim()); return m ? m[2] : null; };
  let tocandoUrl = null;   // player carregado neste aparelho (nunca automático)

  // o Supabase devolve no máximo 1.000 linhas por consulta: busca em páginas
  async function carregarMusicas(c) {
    const PAGINA = 1000;
    let todas = [];
    for (let de = 0; ; de += PAGINA) {
      const { data, error } = await sb.from("musicas")
        .select("id, sala, nivel, titulo, artista, url, autor, playlist")
        .or("sala.is.null,sala.eq." + c)
        .eq("ativa", true)
        .order("id", { ascending: true })
        .range(de, de + PAGINA - 1);
      if (c !== codigo) return;
      if (error || !data) break;
      todas = todas.concat(data);
      if (data.length < PAGINA) break;
    }
    musicas = todas;
    desenharMusicas();
  }

  // música do nível da carta; sem música nesse nível, desce até achar; sem nenhuma, null
  function sortearMusica(nivel, evitarUrl) {
    for (let i = Math.max(0, ORDEM_NIVEIS.indexOf(nivel)); i >= 0; i--) {
      let pool = musicas.filter(m => m.nivel === ORDEM_NIVEIS[i]);
      if (pool.length > 1 && evitarUrl) pool = pool.filter(m => m.url !== evitarUrl);
      if (pool.length) {
        const m = pool[Math.floor(Math.random() * pool.length)];
        return m.playlist ? { titulo: m.titulo, artista: m.artista, url: m.url, playlist: m.playlist } : { titulo: m.titulo, artista: m.artista, url: m.url };
      }
    }
    return null;
  }

  function desenharTrilha(e) {
    const m = e.musica, c = e.carta;
    const box = $("trilha");
    const visivel = !!(m && c && !$("card").hidden);
    box.hidden = !visivel;
    if (!visivel) return;
    $("trilhaTitulo").textContent = /m[úu]sica que eu escolher/i.test(c.texto || "") ? "Sugestão para este desafio" : "Trilha da rodada";
    $("trilhaNome").textContent = m.titulo;
    $("trilhaArtista").textContent = m.artista;
    $("trilhaAbrir").href = m.url;
    $("trilhaOutra").disabled = musicas.length < 2;
    if (tocandoUrl !== m.url) { $("trilhaPlayer").textContent = ""; $("trilhaPlayer").hidden = true; $("trilhaTocar").hidden = false; tocandoUrl = null; }
  }

  function tocarAqui() {
    const m = estado && estado.musica;
    const id = m && idFaixa(m.url);
    if (!id) return;
    const f = document.createElement("iframe");
    f.src = "https://open.spotify.com/embed/track/" + encodeURIComponent(id);
    f.width = "100%";
    f.height = "80";
    f.loading = "lazy";
    f.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
    f.title = "Player do Spotify";
    $("trilhaPlayer").textContent = "";
    $("trilhaPlayer").appendChild(f);
    $("trilhaPlayer").hidden = false;
    $("trilhaTocar").hidden = true;
    tocandoUrl = m.url;
  }

  function outraMusica() {
    if (!estado || !estado.carta) return;
    gravar(n => { n.musica = sortearMusica(n.carta.nivel, n.musica && n.musica.url) || n.musica; });
  }

  function juntarMusica(m) {
    if (!m || !m.id || m.sala !== codigo || m.ativa === false || musicas.some(x => x.id === m.id)) return;
    musicas.push({ id: m.id, sala: m.sala, nivel: m.nivel, titulo: m.titulo, artista: m.artista, url: m.url, autor: m.autor, playlist: m.playlist || null });
    desenharMusicas();
  }

  function tirarMusica(id) {
    if (!id || !musicas.some(x => x.id === id)) return;
    musicas = musicas.filter(x => x.id !== id);
    desenharMusicas();
  }

  function desenharMusicas() {
    if (estado) desenharTrilha(estado);   // "Outra música" depende de quantas músicas existem
    const nossas = musicas.filter(m => m.sala);
    $("musicasQtd").textContent = nossas.length ? `(${nossas.length})` : "";
    $("musicasVazio").hidden = nossas.length > 0;
    const ul = $("listaMusicas");
    ul.textContent = "";
    nossas.slice().reverse().forEach(m => {
      const li = document.createElement("li");
      const info = document.createElement("div");
      info.className = "info";
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = LEVEL_NAMES[m.nivel] || m.nivel;
      const t = document.createElement("span");
      t.textContent = `${m.titulo} — ${m.artista}`;
      const autor = document.createElement("span");
      autor.className = "autor";
      autor.textContent = "por " + m.autor;
      info.append(tag, t, autor);
      const apagar = document.createElement("button");
      apagar.type = "button";
      apagar.textContent = "Apagar";
      apagar.addEventListener("click", () => apagarMusica(m));
      li.append(info, apagar);
      ul.appendChild(li);
    });
  }

  function abrirMusica() {
    if (!estado) return;
    $("formMusica").reset();
    erro("erroMusica", "");
    $("dlgMusica").showModal();
    $("linkMusica").focus();
  }

  async function salvarMusica(ev) {
    ev.preventDefault();
    if (!estado || !codigo) return;
    const id = idFaixa($("linkMusica").value);
    if (!id) return erro("erroMusica", "Cole o link de uma música do Spotify (open.spotify.com/track/…).");
    const titulo = $("tituloMusica").value.trim().slice(0, 200);
    const artista = $("artistaMusica").value.trim().slice(0, 200);
    if (!titulo || !artista) return erro("erroMusica", "Preencha o título e o artista.");
    $("salvarMusica").disabled = true;
    const { data, error } = await sb.from("musicas")
      .insert({ sala: codigo, nivel: $("nivelMusica").value, titulo, artista, url: "https://open.spotify.com/track/" + id, autor: (estado.jogadores[eu] || "").trim().slice(0, 20) })
      .select("id, sala, nivel, titulo, artista, url, autor").single();
    $("salvarMusica").disabled = false;
    if (error) {
      return erro("erroMusica", /limite/.test(error.message || "")
        ? "A sala chegou a 300 músicas. Apague alguma para adicionar outra."
        : "Não consegui salvar a música. Confira o link e a internet.");
    }
    juntarMusica(data);
    $("dlgMusica").close();
  }

  async function apagarMusica(m) {
    if (!confirm(`Apagar esta música?\n\n${m.titulo} — ${m.artista}`)) return;
    const { error } = await sb.from("musicas").delete().eq("id", m.id);
    if (error) return erro("erroJogo", "Não consegui apagar a música. Confira a internet e tente de novo.");
    tirarMusica(m.id);
  }

  // ---------- Casa do casal e presença ----------
  const VISTAS_CASA = ["vDiario", "vCofre", "vEnvelopes", "vSemana", "vCapsulas", "vAlbum", "vConquistas", "vBaralho"];

  function mostrarVista(nome) {
    vista = nome;
    const naCasa = nome !== "jogo";
    $("telaCasa").hidden = !naCasa;
    $("telaJogo").hidden = naCasa;
    document.body.classList.toggle("vista-casa", naCasa);
    $("casaGrade").hidden = !(estado && estado.fixa) || nome !== "casa";
    VISTAS_CASA.forEach(v => { if ($(v)) $(v).hidden = v !== nome; });
    $("abaCasa").setAttribute("aria-current", naCasa ? "page" : "false");
    $("abaJogo").setAttribute("aria-current", naCasa ? "false" : "page");
    if (estado) desenharCasa(estado);
    window.scrollTo(0, 0);
  }

  // cartões da Casa: um resumo de cada canto
  function desenharCasa(e) {
    if (!e.fixa) return;
    const outro = e.jogadores[1 - eu];
    const hoje = hojeISO();
    $("cardDiarioSub").textContent = cumpriuNoDia(hoje, eu) ? "Cumprido hoje ✓" : "Seu desafio de hoje";
    const pend = cofre.filter(x => !x.feito).length;
    $("cardCofreSub").textContent = cofre.length ? `${pend} ${pend === 1 ? "pendente" : "pendentes"}` : "Guardem cartas para o reencontro";
    $("cardJogoSub").textContent = e.vencedor !== null ? "Partida encerrada" : e.carta ? "Carta na mesa" : outro && e.vez === eu ? "Sua vez" : "Roleta, cartas e placar";
    desenharCasaExtras(e);
  }
  // as fases seguintes acrescentam cartões (envelopes, semana, cápsulas…)
  const extrasDaCasa = [];
  function desenharCasaExtras(e) { extrasDaCasa.forEach(f => f(e)); }

  // Presence: cada aparelho anuncia { jogador, online_em } no canal da sala
  function sincronizarPresenca(c) {
    if (!canal || c !== codigo) return;
    const st = canal.presenceState() || {};
    const agora = new Set();
    Object.values(st).forEach(lista => (lista || []).forEach(p => { if (p && (p.jogador === 0 || p.jogador === 1)) agora.add(p.jogador); }));
    const outro = 1 - eu;
    const chegou = !presentes.has(outro) && agora.has(outro);
    presentes = agora;
    if (chegou && presencaPronta) vibrar([60, 40, 60]);   // a outra pessoa entrou na sala
    presencaPronta = true;
    desenharPresenca();
    presencaMudou.forEach(f => f());
  }
  const presencaMudou = [];   // envelopes e desafio surpresa escutam aqui
  const ambosPresentes = () => presentes.has(0) && presentes.has(1);

  function desenharPresenca() {
    const el = $("presenca");
    const nome = estado && estado.jogadores[1 - eu];
    el.hidden = !nome;
    if (!nome) return;
    const on = presentes.has(1 - eu);
    el.textContent = on ? `💚 ${nome} está aqui agora` : `${nome} está fora`;
    el.classList.toggle("on", on);
  }

  // ---------- tabelas da v5 (só em sala fixa): carga, Realtime e redesenho ----------
  const TABELAS_V5 = { envelopes: "criada_em", capsulas: "criada_em", apostas: "criada_em", observacoes: "confirmada_em", momentos: "criada_em", conquistas: "desbloqueada_em" };
  const dados = {};
  Object.keys(TABELAS_V5).forEach(t => { dados[t] = []; });
  const aoMudar = {};                 // tabela -> [fn(evento, linha, antes)]
  const aoDesenhar = {};              // tabela -> [fn()]
  const escutar = (t, f) => (aoMudar[t] = aoMudar[t] || []).push(f);
  const redesenhar = (t, f) => (aoDesenhar[t] = aoDesenhar[t] || []).push(f);
  const redesenharV5 = t => { (aoDesenhar[t] || []).forEach(f => f()); if (estado) desenharCasa(estado); };

  function comTabelasV5(ch, c) {
    Object.keys(TABELAS_V5).forEach(t => {
      ch = ch
        .on("postgres_changes", { event: "*", schema: "public", table: t, filter: `sala=eq.${c}` },
          p => linhaV5(t, p.eventType, p.eventType === "DELETE" ? p.old : p.new))
        // DELETE não é filtrável no Realtime: tira pelo id (linhas de outras salas não estão na lista)
        .on("postgres_changes", { event: "DELETE", schema: "public", table: t }, p => linhaV5(t, "DELETE", p.old));
    });
    return ch;
  }

  async function carregarTabela(t, c) {
    const { data, error } = await sb.from(t).select("*").eq("sala", c).order(TABELAS_V5[t], { ascending: true });
    if (c !== codigo) return;
    dados[t] = error || !data ? [] : data;
    redesenharV5(t);
  }

  function carregarV5(c) { Object.keys(TABELAS_V5).forEach(t => carregarTabela(t, c)); }

  function linhaV5(t, ev, row) {
    if (!row || !row.id) return;
    const i = dados[t].findIndex(x => x.id === row.id);
    const antes = i >= 0 ? { ...dados[t][i] } : null;
    if (ev === "DELETE") {
      if (i < 0) return;
      dados[t].splice(i, 1);
    } else {
      if (row.sala !== codigo) return;
      if (i >= 0) dados[t][i] = { ...dados[t][i], ...row }; else dados[t].push(row);
    }
    (aoMudar[t] || []).forEach(f => f(ev, row, antes));
    redesenharV5(t);
  }

  const nomeDe = i => (estado && estado.jogadores[i]) || "";
  const dataCurta = iso => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  function el(tag, classe, texto) { const x = document.createElement(tag); if (classe) x.className = classe; if (texto !== undefined) x.textContent = texto; return x; }

  // ---------- envelopes ----------
  const envelopesAnimados = new Set();
  const surpresasEmAndamento = new Set();

  function contarEnvelopes() { return dados.envelopes.filter(x => !x.aberto_em).length; }

  function desenharEnvelopes() {
    if (!estado || !estado.fixa) return;
    const outro = 1 - eu, nOutro = nomeDe(outro);
    const fechados = dados.envelopes.filter(x => !x.aberto_em);
    const abertos = dados.envelopes.filter(x => x.aberto_em).sort((a, b) => (a.aberto_em < b.aberto_em ? 1 : -1));
    $("envVazio").hidden = fechados.length > 0;
    const ul = $("listaEnvFechados");
    ul.textContent = "";
    fechados.forEach(x => {
      const li = el("li");
      const info = el("div", "info");
      const meu = x.de === eu;
      const nivel = x.nivel ? ` · ${LEVEL_NAMES[x.nivel]}` : "";
      if (meu) {
        info.append(el("span", "tag", x.tipo === "mensagem" ? `💌 Mensagem para ${nOutro}` : `🎲 Desafio surpresa para ${nOutro}${nivel}`),
          el("span", "t", x.texto), el("span", "autor", `escrito em ${dataCurta(x.criada_em)} · só você vê o texto`));
      } else {
        info.append(el("span", "tag", x.tipo === "mensagem" ? `💌 1 envelope de ${nomeDe(x.de)}` : `🎲 1 desafio surpresa de ${nomeDe(x.de)}`),
          el("span", "autor", x.tipo === "mensagem" ? `chegou em ${dataCurta(x.criada_em)}`
            : "Vai aparecer como a sua primeira carta na próxima partida com vocês dois aqui."));
      }
      const acoes = el("div", "acoes");
      if (x.tipo === "mensagem") {
        const juntos = ambosPresentes();
        const b = el("button", "secondary abrir-env", juntos ? "Abrir juntos" : `Espere ${nOutro} entrar para abrir`);
        b.type = "button";
        b.disabled = !juntos;
        b.addEventListener("click", () => abrirEnvelope(x));
        acoes.appendChild(b);
      }
      if (meu) {
        const ap = el("button", "linkbtn", "Apagar");
        ap.type = "button";
        ap.addEventListener("click", () => apagarEnvelope(x));
        acoes.appendChild(ap);
      }
      li.append(info, acoes);
      ul.appendChild(li);
    });
    $("envAbertosQtd").textContent = abertos.length ? `(${abertos.length})` : "";
    const ua = $("listaEnvAbertos");
    ua.textContent = "";
    abertos.forEach(x => {
      const li = el("li");
      const info = el("div", "info");
      info.append(el("span", "tag", (x.tipo === "mensagem" ? `💌 De ${nomeDe(x.de)}` : `🎲 Desafio surpresa de ${nomeDe(x.de)}`) + ` · aberto em ${dataCurta(x.aberto_em)}`),
        el("span", "t", x.texto));
      li.appendChild(info);
      ua.appendChild(li);
    });
  }

  function abrirNovoEnvelope() {
    if (!estado || !estado.fixa) return;
    $("formEnvelope").reset();
    $("envNivelLinha").hidden = true;
    erro("erroEnvelope", "");
    $("envContador").textContent = "0/500";
    $("dlgEnvelope").showModal();
  }

  async function salvarEnvelope(ev) {
    ev.preventDefault();
    const tipo = document.querySelector('input[name="envTipo"]:checked').value;
    const texto = $("envTexto").value.trim().slice(0, 500);
    if (texto.length < 3) return erro("erroEnvelope", "Escreva pelo menos 3 letras.");
    const linha = { sala: codigo, tipo, de: eu, texto, nivel: tipo === "desafio" ? $("envNivel").value : null };
    $("salvarEnvelope").disabled = true;
    const { data, error } = await sb.from("envelopes").insert(linha).select("*").single();
    $("salvarEnvelope").disabled = false;
    if (error) return erro("erroEnvelope", "Não consegui guardar o envelope. Confira a internet e tente de novo.");
    linhaV5("envelopes", "INSERT", data);
    $("dlgEnvelope").close();
  }

  async function apagarEnvelope(x) {
    if (x.aberto_em || x.de !== eu || !confirm("Apagar este envelope? Ele ainda não foi aberto.")) return;
    const { error } = await sb.from("envelopes").delete().eq("id", x.id);
    if (error) return erro("erroJogo", "Não consegui apagar o envelope. Confira a internet e tente de novo.");
    linhaV5("envelopes", "DELETE", { id: x.id });
  }

  // "Abrir juntos": só com os dois na sala; quem tocar abre para os dois
  async function abrirEnvelope(x) {
    if (!ambosPresentes() || x.aberto_em) return;
    const agora = new Date().toISOString();
    const { data, error } = await sb.from("envelopes").update({ aberto_em: agora }).eq("id", x.id).select("*").single();
    if (error) return erro("erroJogo", "Não consegui abrir o envelope. Confira a internet e tente de novo.");
    linhaV5("envelopes", "UPDATE", data || { ...x, aberto_em: agora });
    depoisDeAcao();
  }

  // envelope de mensagem que acabou de abrir: animação nos dois aparelhos
  escutar("envelopes", (ev, row, antes) => {
    if (ev !== "UPDATE" || row.tipo !== "mensagem" || !row.aberto_em || (antes && antes.aberto_em) || envelopesAnimados.has(row.id)) return;
    envelopesAnimados.add(row.id);
    $("envAbrindoDe").textContent = `💌 De ${nomeDe(row.de)} para ${nomeDe(1 - row.de)}`;
    $("envAbrindoTexto").textContent = row.texto;
    const ov = $("envAbrindo");
    ov.hidden = false;
    ov.classList.remove("anima"); void ov.offsetWidth; ov.classList.add("anima");
    vibrar([80, 40, 80]);
  });

  // Desafio surpresa: vira a primeira carta da próxima vez de quem recebe (quando a vez chega), com os dois presentes
  async function talvezSurpresa() {
    const e = estado;
    if (!e || !e.fixa || !e.jogadores[1] || e.vez !== eu || e.carta || e.vencedor !== null || girando || !ambosPresentes()) return;
    const env = dados.envelopes.filter(x => x.tipo === "desafio" && !x.aberto_em && x.de === 1 - eu && !surpresasEmAndamento.has(x.id))
      .sort((a, b) => (a.criada_em < b.criada_em ? -1 : 1))[0];
    if (!env) return;
    surpresasEmAndamento.add(env.id);
    const agora = new Date().toISOString();
    const { error } = await sb.from("envelopes").update({ aberto_em: agora }).eq("id", env.id);
    if (error) { surpresasEmAndamento.delete(env.id); return; }
    linhaV5("envelopes", "UPDATE", { ...env, aberto_em: agora });
    gravar(n => {
      if (n.carta || n.vez !== eu || n.vencedor != null) return;
      if (!n.secretas.length) n.secretas = sortearSecretas(n);
      n.carta = { tipo: "desafio", nivel: env.nivel || "leve", texto: env.texto, chave: "env-" + env.id, surpresa: true, surpresaDe: env.de };
      n.musica = sortearMusica(n.carta.nivel);
    });
    depoisDeAcao();
  }
  presencaMudou.push(desenharEnvelopes);
  redesenhar("envelopes", desenharEnvelopes);
  extrasDaCasa.push(() => {
    const n = contarEnvelopes();
    $("cardEnvSub").textContent = n ? `${n} esperando` : "Nenhum esperando";
    $("cardEnv").classList.toggle("destaque", dados.envelopes.some(x => !x.aberto_em && x.de !== eu && x.tipo === "mensagem"));
  });

  // ---------- cápsula do tempo ----------
  // Pergunta respondida agora (escondida até dos dois) e de novo na data; aí os 4 quadros aparecem juntos.
  const somarDias = (iso, n) => { const [a, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10); };
  const somarMeses = (iso, n) => { const [a, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(a, m - 1 + n, d)).toISOString().slice(0, 10); };
  const cheio = arr => Array.isArray(arr) && arr[0] != null && arr[1] != null;
  const faseCapsula = x => !cheio(x.respostas) ? "respondendo" : diasAte(x.abre_em) > 0 ? "selada" : !cheio(x.respostas_depois) ? "pronta" : "aberta";
  let perguntaAtual = -1;

  function outraPergunta() {
    const pool = cartas.filter(c => c.tipo === "capsula");
    if (!pool.length) return;
    let i = Math.floor(Math.random() * pool.length);
    if (pool.length > 1 && i === perguntaAtual) i = (i + 1) % pool.length;
    perguntaAtual = i;
    $("capPergunta").value = pool[i].texto;
  }

  function abrirNovaCapsula() {
    if (!estado || !estado.fixa) return;
    erro("erroCapsula", "");
    outraPergunta();
    const hoje = hojeISO();
    $("capData").min = somarDias(hoje, 7);
    $("capData").max = somarDias(hoje, 730);
    $("capData").value = somarMeses(hoje, 1);
    $("dlgCapsula").showModal();
  }

  async function salvarCapsula(ev) {
    ev.preventDefault();
    const pergunta = $("capPergunta").value.replace(/\s+/g, " ").trim().slice(0, 280);
    const data = $("capData").value, hoje = hojeISO();
    if (pergunta.length < 3) return erro("erroCapsula", "Escreva a pergunta (pelo menos 3 letras).");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || data < somarDias(hoje, 7) || data > somarDias(hoje, 730))
      return erro("erroCapsula", "Escolha uma data entre 7 dias e 2 anos a partir de hoje.");
    $("salvarCapsula").disabled = true;
    const { data: linha, error } = await sb.from("capsulas")
      .insert({ sala: codigo, pergunta, abre_em: data, respostas: [null, null], respostas_depois: [null, null] }).select("*").single();
    $("salvarCapsula").disabled = false;
    if (error) return erro("erroCapsula", "Não consegui criar a cápsula. Confira a internet e tente de novo.");
    linhaV5("capsulas", "INSERT", linha);
    $("dlgCapsula").close();
  }

  // grava a minha resposta no array (lê a linha antes e confere depois, para não apagar a do outro)
  async function responderCapsula(x, campo, txt) {
    for (let tentativa = 0; tentativa < 4; tentativa++) {
      const { data: atual } = await sb.from("capsulas").select("*").eq("id", x.id).maybeSingle();
      if (!atual) return;
      const arr = Array.isArray(atual[campo]) ? atual[campo].slice() : [null, null];
      if (arr[eu] != null) { linhaV5("capsulas", "UPDATE", atual); break; }
      arr[eu] = txt;
      const { error } = await sb.from("capsulas").update({ [campo]: arr }).eq("id", x.id);
      if (error) return erro("erroJogo", "Não consegui guardar a resposta. Confira a internet e tente de novo.");
      await new Promise(r => setTimeout(r, 250 + Math.random() * 300));
      const { data: depois } = await sb.from("capsulas").select("*").eq("id", x.id).maybeSingle();
      if (depois && Array.isArray(depois[campo]) && depois[campo][eu] === txt) { linhaV5("capsulas", "UPDATE", depois); break; }
    }
    depoisDeAcao();
  }

  const rascunhos = {};   // o que está sendo digitado sobrevive quando a lista é redesenhada
  function campoResposta(x, campo, rotulo) {
    const box = el("div", "cap-responder");
    const ta = el("textarea");
    const chave = x.id + ":" + campo;
    ta.maxLength = 280; ta.rows = 2; ta.setAttribute("aria-label", rotulo); ta.placeholder = rotulo;
    ta.value = rascunhos[chave] || "";
    ta.addEventListener("input", () => { rascunhos[chave] = ta.value; });
    const b = el("button", "secondary", "Guardar resposta");
    b.type = "button";
    b.addEventListener("click", () => {
      const t = ta.value.replace(/\s+/g, " ").trim().slice(0, 280);
      if (!t) return;
      b.disabled = true;
      delete rascunhos[chave];
      responderCapsula(x, campo, t);
    });
    box.append(ta, b);
    return box;
  }

  function desenharCapsulas() {
    if (!estado || !estado.fixa) return;
    const outro = 1 - eu, nOutro = nomeDe(outro);
    const grupos = { pronta: $("capProntas"), respondendo: $("capRespondendo"), selada: $("capSeladas"), aberta: $("capAbertas") };
    Object.values(grupos).forEach(u => { u.textContent = ""; });
    const contagem = { pronta: 0, respondendo: 0, selada: 0, aberta: 0 };
    dados.capsulas.slice().sort((a, b) => (a.abre_em < b.abre_em ? -1 : 1)).forEach(x => {
      const fase = faseCapsula(x);
      contagem[fase]++;
      const li = el("li", "cap-item");
      const info = el("div", "info");
      info.appendChild(el("span", "t", `“${x.pergunta}”`));
      const dias = diasAte(x.abre_em);
      if (fase === "respondendo") {
        info.appendChild(el("span", "autor", `abre em ${dataBR(x.abre_em)} · as respostas ficam escondidas até lá`));
        const r = x.respostas || [null, null];
        if (r[eu] == null) info.appendChild(campoResposta(x, "respostas", "Sua resposta de hoje"));
        else info.appendChild(el("span", "cap-status", "Você respondeu ✓"));
        info.appendChild(el("span", "cap-status", r[outro] == null ? `Esperando ${nOutro} responder` : `${nOutro} respondeu ✓`));
      } else if (fase === "selada") {
        info.appendChild(el("span", "cap-status", `🔒 Selada · abre em ${dias} ${dias === 1 ? "dia" : "dias"} (${dataBR(x.abre_em)})`));
      } else if (fase === "pronta") {
        info.appendChild(el("span", "cap-status", "⏳ Cápsula pronta para abrir: respondam de novo, sem ver a antiga."));
        const d = x.respostas_depois || [null, null];
        if (d[eu] == null) info.appendChild(campoResposta(x, "respostas_depois", "Sua resposta de agora"));
        else info.appendChild(el("span", "cap-status", "Você respondeu de novo ✓"));
        info.appendChild(el("span", "cap-status", d[outro] == null ? `Esperando ${nOutro} responder de novo` : `${nOutro} respondeu de novo ✓`));
      } else {
        info.appendChild(el("span", "autor", `guardada em ${dataCurta(x.criada_em)} · aberta em ${dataBR(x.abre_em)}`));
        const q = el("div", "cap-quadros");
        [[eu, "Você"], [outro, nOutro]].forEach(([i, quem]) => {
          [["antes", x.respostas[i]], ["agora", x.respostas_depois[i]]].forEach(([quando, txt]) => {
            const c = el("div", "cap-quadro");
            c.append(el("span", "quem", `${quem} ${quando}`), el("p", "", txt));
            q.appendChild(c);
          });
        });
        info.appendChild(q);
      }
      li.appendChild(info);
      grupos[fase].appendChild(li);
    });
    Object.entries(contagem).forEach(([f, n]) => { $("capGrupo-" + f).hidden = !n; });
    $("capVazio").hidden = dados.capsulas.length > 0;
  }
  redesenhar("capsulas", desenharCapsulas);
  extrasDaCasa.push(() => {
    const prontas = dados.capsulas.filter(x => faseCapsula(x) === "pronta").length;
    const seladas = dados.capsulas.filter(x => faseCapsula(x) === "selada").length;
    const resp = dados.capsulas.filter(x => faseCapsula(x) === "respondendo" && (x.respostas || [])[eu] == null).length;
    $("cardCapSub").textContent = prontas ? `⏳ ${prontas} pronta${prontas > 1 ? "s" : ""} para abrir`
      : resp ? `${resp} esperando sua resposta` : seladas ? `${seladas} selada${seladas > 1 ? "s" : ""}` : "Perguntas para o futuro";
    $("cardCap").classList.toggle("destaque", prontas > 0 || resp > 0);
  });

  // depois de uma ação das fases 2 a 5 (as conquistas se ligam aqui na fase 7)
  const aposAcao = [];
  function depoisDeAcao() { aposAcao.forEach(f => { try { f(); } catch (err) {} }); }

  // ---------- salas recentes (só neste aparelho) ----------
  const recentes = () => { const r = lerLocal("lp-salas"); return Array.isArray(r) ? r : []; };

  function lembrarSala(c, nome, fixa) {
    const lista = recentes().filter(r => r.codigo !== c);
    lista.unshift({ codigo: c, nome, fixa, quando: Date.now() });
    salvarLocal("lp-salas", lista.slice(0, 8));
  }

  function desenharRecentes() {
    const lista = recentes();
    $("recentes").hidden = !lista.length;
    const ul = $("listaRecentes");
    ul.textContent = "";
    lista.forEach(r => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      const cod = document.createElement("span");
      cod.className = "cod";
      cod.textContent = r.codigo;
      const quem = document.createElement("span");
      quem.className = "quem";
      quem.textContent = "como " + r.nome;
      b.append(cod, quem);
      b.addEventListener("click", () => { $("nome").value = r.nome || $("nome").value; entrarSala(r.codigo); });
      li.appendChild(b);
      ul.appendChild(li);
    });
  }

  // ---------- histórico de partidas ----------
  function registrarPartida(sala, e) {
    sb.from("partidas")
      .insert({ sala, jogadores: e.jogadores, placar: e.placar, vencedor: e.vencedor, meta: e.meta })
      .then(({ error }) => { if (!error && sala === codigo) carregarHistorico(sala); });
  }

  async function carregarHistorico(c) {
    const { data, error } = await sb.from("partidas")
      .select("jogadores, placar, vencedor, meta, finalizada_em")
      .eq("sala", c)
      .order("finalizada_em", { ascending: false })
      .limit(1000);
    if (c !== codigo || error || !data) return;
    const nomes = estado ? estado.jogadores : [];
    const vitorias = [0, 1].map(i => data.filter(p => mesmoNome((p.jogadores || [])[p.vencedor], nomes[i])).length);
    $("histQtd").textContent = data.length ? `(${data.length})` : "";
    $("histResumo").textContent = data.length
      ? `${nomes[0] || "Pessoa 1"}: ${vitorias[0]} ${vitorias[0] === 1 ? "vitória" : "vitórias"} · ${nomes[1] || "Pessoa 2"}: ${vitorias[1]} ${vitorias[1] === 1 ? "vitória" : "vitórias"} · ${data.length} ${data.length === 1 ? "partida" : "partidas"}`
      : "Nenhuma partida terminada ainda.";
    const ul = $("listaHist");
    ul.textContent = "";
    data.slice(0, 10).forEach(p => {
      const li = document.createElement("li");
      const d = new Date(p.finalizada_em);
      const data_ = document.createElement("span");
      data_.className = "data";
      data_.textContent = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) + ` · meta ${p.meta}`;
      const pts = (p.placar || []).map(x => x && x.pontos);
      const res = document.createElement("span");
      res.textContent = `${p.jogadores[0]} ${pts[0]} × ${pts[1]} ${p.jogadores[1]} — venceu ${p.jogadores[p.vencedor]}`;
      li.append(data_, res);
      ul.appendChild(li);
    });
  }

  function sair() {
    if (canal) { sb.removeChannel(canal); canal = null; }
    codigo = null; estado = null; eu = null; ultimoVencedor = null; ultimaRevelada = null;
    presentes = new Set(); presencaPronta = false;
    mostrarVista("jogo");
    missaoAberta = false;
    cartas = []; cartasOk = false; cofre = []; musicas = []; tocandoUrl = null;
    pendentes.forEach(p => clearTimeout(p.t)); pendentes.clear();
    desenharExtras();
    clearTimeout(timerCarta);
    history.replaceState(null, "", location.pathname);
    $("jogo").hidden = true;
    $("lobby").hidden = false;
    desenharRecentes();
    $("codigo").value = "";
  }

  // ---------- placar ----------
  const placarVazio = (pontos, pulosMax) =>
    ({ pontos: pontos || 0, verdades: 0, desafios: 0, prendas: 0, liberadas: 0, estrelas: 0, duelos: 0, sintonias: 0, duplas: 0, reverso: true, livresV: pulosMax, livresD: pulosMax });

  const novoAviso = texto => ({ id: Date.now() + "-" + Math.random().toString(36).slice(2, 7), texto });

  // salas antigas: cria o placar a partir de `pontos` e completa o que faltar.
  // pulosV/pulosD (versão intermediária, pulos usados) viram livres = max(0, pulosMax - pulos).
  function normalizar(e) {
    if (!PULOS_OPCOES.includes(e.pulosMax)) e.pulosMax = 3;
    if (!METAS.includes(e.meta)) e.meta = 20;
    if (!Array.isArray(e.placar)) e.placar = [0, 1].map(i => placarVazio((e.pontos || [])[i], e.pulosMax));
    e.placar = e.placar.map(p => {
      const q = Object.assign(placarVazio(0, e.pulosMax), p);
      if (p.livresV === undefined && typeof p.pulosV === "number") q.livresV = Math.max(0, e.pulosMax - p.pulosV);
      if (p.livresD === undefined && typeof p.pulosD === "number") q.livresD = Math.max(0, e.pulosMax - p.pulosD);
      delete q.pulosV; delete q.pulosD;
      return q;
    });
    if (e.vencedor !== 0 && e.vencedor !== 1) e.vencedor = null;
    if (e.aviso === undefined) e.aviso = null;
    if (e.timer === undefined) e.timer = null;
    if (!e.musica || !idFaixa(e.musica.url)) e.musica = null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.reencontro || "")) e.reencontro = null;
    if (!LEVEL_NAMES[e.nivelDiario]) e.nivelDiario = "leve";
    if (!e.diario || typeof e.diario !== "object" || Array.isArray(e.diario)) e.diario = {};
    if (typeof e.notaAdversario !== "boolean") e.notaAdversario = true;
    if (!(e.eventos in CHANCE_EVENTO)) e.eventos = "normal";
    if (!Array.isArray(e.efeitos)) e.efeitos = [];
    if (!e.prendaPendente || ![0, 1].includes(e.prendaPendente.dono)) e.prendaPendente = null;
    if (!e.duelo || !e.carta || e.duelo.chave !== e.carta.chave) e.duelo = null;
    if (!e.sintonia || !e.carta || e.sintonia.chave !== e.carta.chave) e.sintonia = null;
    if (!e.dupla || !e.carta || e.dupla.chave !== e.carta.chave) e.dupla = null;
    if (!Array.isArray(e.secretas)) e.secretas = [];
    if (!e.avaliacao || !e.carta || e.avaliacao.chave !== e.carta.chave) e.avaliacao = null;
    return e;
  }

  // "zerado" = antes da primeira jogada ou logo depois de "Nova partida"
  const placarZerado = e => e.placar.every(p =>
    p.pontos === 0 && p.verdades === 0 && p.desafios === 0 && p.prendas === 0 && p.liberadas === 0 && p.estrelas === 0 &&
    !p.duelos && !p.sintonias && !p.duplas && p.reverso !== false &&
    p.livresV === e.pulosMax && p.livresD === e.pulosMax);

  function nivelMaisAlto(niveis) {
    const ativos = ORDEM_NIVEIS.filter(n => niveis.includes(n));
    return ativos.length ? ativos[ativos.length - 1] : "leve";
  }

  // Nível da prenda. Final: o mais alto ativo. Por pulo: desafio sobe um nível, verdade fica no mesmo.
  // Nunca acima do mais alto ativo (a descida quando falta prenda fica no sortearPrenda).
  function nivelDaPrenda(n, motivo, pulada) {
    const teto = ORDEM_NIVEIS.indexOf(nivelMaisAlto(n.niveis));
    if (motivo === "final" || !pulada) return ORDEM_NIVEIS[teto];
    const base = Math.max(0, ORDEM_NIVEIS.indexOf(pulada.nivel));
    return ORDEM_NIVEIS[Math.min(base + (pulada.tipo === "desafio" ? 1 : 0), ORDEM_NIVEIS.length - 1, teto)];
  }

  // sorteia a prenda, marca como usada e devolve
  function prendaPara(n, motivo, pulada) {
    const carta = sortearPrenda(nivelDaPrenda(n, motivo, pulada), n.usados || []);
    if (!carta) return null;
    registrarUso(n, carta);
    carta.motivo = motivo;
    if (motivo === "pulo") carta.origem = pulada.tipo;
    return carta;
  }

  // a vez normalmente vai para o outro; algumas cartas dizem com quem ela fica depois (proxVez)
  function passarVez(n, c) {
    n.vez = c && (c.proxVez === 0 || c.proxVez === 1) ? c.proxVez : 1 - n.vez;
  }

  // Confere a meta depois de qualquer ponto. Empate na meta não encerra: o próximo ponto decide.
  function conferirMeta(n) {
    if (n.vencedor != null) return true;
    const [a, b] = n.placar.map(p => p.pontos);
    if (a < n.meta && b < n.meta) return false;
    if (a === b) { n.aviso = novoAviso("Empate na meta! Próximo ponto decide."); return false; }
    n.vencedor = a > b ? 0 : 1;
    n.vez = 1 - n.vencedor;                             // quem perdeu cumpre a prenda final
    n.avaliacao = null;
    n.efeitos = [];                                     // efeitos ativos são descartados, sem pontos
    n.prendaPendente = null;
    n.carta = prendaPara(n, "final");
    return true;
  }

  // Início de uma vez: desconta 1 rodada dos efeitos do dono; quem aguentou até o fim ganha pontos.
  // Depois, se houver prenda pendente ("Quebrou!") para quem começa a vez, ela vem antes do giro.
  function inicioDaVez(n) {
    const dono = n.vez;
    const acabaram = [];
    n.efeitos.forEach(ef => { if (ef.dono === dono) { ef.restantes--; if (ef.restantes <= 0) acabaram.push(ef); } });
    if (acabaram.length) {
      n.efeitos = n.efeitos.filter(ef => !acabaram.includes(ef));
      const pts = acabaram.reduce((s, ef) => s + (PONTOS_EFEITO[ef.nivel] || 1), 0);
      n.placar[dono].pontos += pts;
      n.pontos = n.placar.map(x => x.pontos);
      n.aviso = novoAviso(`${n.jogadores[dono]} aguentou o efeito até o fim! +${pts}`);
      if (conferirMeta(n)) return;
    }
    const pend = n.prendaPendente;
    if (pend && pend.dono === dono && !n.carta) {
      const carta = sortearPrenda(pend.nivel, n.usados || []);
      if (carta) {
        registrarUso(n, carta);
        carta.motivo = "quebra";
        carta.proxVez = dono;                           // resolvida a prenda, a vez continua com o dono
        n.carta = carta;
      }
      n.prendaPendente = null;
    }
  }

  const ehPulo = c => c && c.tipo === "prenda" && /^pulo/.test(c.motivo || "");
  const origemDe = c => c.origem || (c.motivo === "pulo-d" ? "desafio" : "verdade");

  function desenharPlacar(e, nomes) {
    const t = $("score");
    t.textContent = "";
    const thead = t.createTHead().insertRow();
    thead.appendChild(document.createElement("th"));
    nomes.forEach((n, i) => {
      const th = document.createElement("th");
      th.textContent = n;
      th.className = (i === eu ? "me " : "") + (i === e.vez && e.jogadores[1] ? "vez" : "");
      thead.appendChild(th);
    });
    const tb = t.createTBody();
    const linhas = [
      ["Pontos", p => p.pontos, "pontos"],
      ["Verdades", p => p.verdades],
      ["Desafios", p => p.desafios],
      ["Prendas", p => p.prendas],
      ["Liberadas", p => p.liberadas],
      ["Estrelas", p => p.estrelas],
      ["Duelos vencidos", p => p.duelos],
      ["Sintonias certeiras", p => p.sintonias],
      ["Missões em dupla", p => p.duplas],
      ["Reverso", p => p.reverso === false ? "Usado" : "Disponível"],
      ["Pulos grátis de verdade", p => `${p.livresV}/${e.pulosMax}`],
      ["Pulos grátis de desafio", p => `${p.livresD}/${e.pulosMax}`]
    ];
    linhas.forEach(([rotulo, valor, cls]) => {
      const tr = tb.insertRow();
      if (cls) tr.className = cls;
      tr.insertCell().textContent = rotulo;
      e.placar.forEach((p, i) => {
        const td = tr.insertCell();
        if (i === e.vez && e.jogadores[1]) td.className = "vez";
        td.textContent = valor(p);
        if (cls === "pontos") {
          const barra = document.createElement("div");
          barra.className = "barra";
          const i = document.createElement("i");
          i.style.width = Math.min(100, Math.round(p.pontos / e.meta * 100)) + "%";
          barra.appendChild(i);
          td.appendChild(barra);
        }
      });
    });
    $("metaTexto").textContent = `Meta: ${e.meta} pontos`;
    $("meta").value = String(e.meta);
    $("pulosMax").value = String(e.pulosMax);
    const zerado = placarZerado(e);
    $("notaAdv").checked = e.notaAdversario;
    $("eventos").value = e.eventos;
    $("meta").disabled = $("pulosMax").disabled = $("notaAdv").disabled = $("eventos").disabled = !zerado;
    $("configDica").textContent = zerado ? "" : "Meta, pulos, eventos e nota só mudam com o placar zerado (em Nova partida).";

    const fim = $("fim");
    fim.hidden = e.vencedor === null;
    if (e.vencedor !== null) $("venceu").textContent = `${nomes[e.vencedor]} venceu!`;
  }

  // ---------- render ----------
  function aplicar(e, inicial, local) {
    if (!e) return;
    const vezAntes = estado ? estado.vez : null;
    estado = normalizar(e);
    mostrarAviso(e.aviso, inicial);
    avisarMinhaVez(e, inicial || local);
    if (!inicial && e.vencedor !== null && ultimoVencedor === null) {
      setTimeout(() => carregarHistorico(codigo), 1500);
      somVitoria();
      vibrar([300, 100, 300, 100, 500]);
    }
    ultimoVencedor = e.vencedor;
    const nomes = [e.jogadores[0] || "Pessoa 1", e.jogadores[1] || "…"];
    const completa = !!e.jogadores[1];
    const minhaVez = completa && e.vez === eu;

    $("convite").hidden = completa;

    document.querySelectorAll("#niveis input").forEach(i => { i.checked = e.niveis.includes(i.value); });

    const vez = $("vez");
    vez.innerHTML = "";
    if (!completa) vez.textContent = "Esperando a outra pessoa entrar";
    else if (e.vencedor !== null && !e.carta) vez.textContent = "Partida encerrada";
    else if (minhaVez) vez.innerHTML = "Sua vez, <strong></strong>";
    else vez.innerHTML = "Vez de <strong></strong>";
    const s = vez.querySelector("strong");
    if (s) s.textContent = nomes[e.vez];

    desenharPlacar(e, nomes);
    desenharPresenca();
    if (vista !== "jogo") desenharCasa(e);
    desenharEfeitos(e);
    desenharSecretas(e);
    desenharReencontro(e);
    desenharDiario();

    // giro novo? anima nos dois celulares
    const g = e.giro;
    if (g && g.id !== ultimoGiro) {
      ultimoGiro = g.id;
      clearTimeout(timerCarta);
      if (inicial) {
        posicionarRoleta(g.alvo, false);
        girando = false;
        mostrarCarta(e);
      } else {
        girando = true;
        $("card").hidden = true;
        requestAnimationFrame(() => { posicionarRoleta(g.alvo, true); tiquesDaRoleta(); });
        timerCarta = setTimeout(() => { girando = false; mostrarCarta(estado); atualizarBotoes(); desenharTimer(estado, false); desenharTrilha(estado); revelarCarta(estado, false); }, GIRO_MS());
      }
    } else if (!girando) {
      mostrarCarta(e);
    }
    atualizarBotoes();
    desenharTimer(e, inicial);
    desenharTrilha(e);
    revelarCarta(e, inicial);
    if (!local) conferirPendentes(e);
    // começou a minha vez: se houver desafio surpresa para mim (e os dois aqui), ele entra no lugar do giro
    if (!inicial && vezAntes !== null && vezAntes !== e.vez && e.vez === eu) setTimeout(talvezSurpresa, 0);
  }

  function desenharExtras() {
    const extras = cartas.filter(c => c.sala);
    $("extrasQtd").textContent = extras.length ? `(${extras.length})` : "";
    $("extrasVazio").hidden = extras.length > 0;
    const ul = $("listaExtras");
    ul.textContent = "";
    extras.slice().reverse().forEach(x => {
      const li = document.createElement("li");
      const info = document.createElement("div");
      info.className = "info";
      const tag = document.createElement("span");
      tag.className = "tag " + x.tipo;
      tag.textContent = (TIPO_NOMES[x.tipo] || x.tipo) + " · " + (LEVEL_NAMES[x.nivel] || x.nivel) + (x.midia ? " · pede " + MIDIA_NOMES[x.midia] : "");
      const t = document.createElement("span");
      t.textContent = x.texto;
      const autor = document.createElement("span");
      autor.className = "autor";
      autor.textContent = "por " + x.autor;
      info.append(tag, t, autor);
      const apagar = document.createElement("button");
      apagar.type = "button";
      apagar.textContent = "Apagar";
      apagar.addEventListener("click", () => apagarCarta(x));
      li.append(info, apagar);
      ul.appendChild(li);
    });
  }

  // vibra quando a vez muda para mim por jogada do outro aparelho (não funciona no iPhone, e tudo bem)
  function avisarMinhaVez(e, semVibrar) {
    const minha = !!e.jogadores[1] && e.vez === eu && e.vencedor === null;
    if (!semVibrar && minha && ultimaVez !== eu) vibrar(200);
    ultimaVez = e.jogadores[1] ? e.vez : null;
  }

  // som e vibração: um botão só (🔊/🔇), guardado neste aparelho
  let somLigado = lerLocal("lp-som") !== false;
  const vibrar = padrao => { if (!somLigado) return; try { navigator.vibrate?.(padrao); } catch (err) {} };

  // aviso curto nos dois aparelhos (ex.: "Ana liberou Bia da prenda.")
  function mostrarAviso(a, inicial) {
    if (!a || a.id === ultimoAviso) return;
    ultimoAviso = a.id;
    if (inicial) return;                                // ao abrir a sala não repete aviso velho
    const el = $("aviso");
    el.textContent = a.texto;
    el.hidden = false;
    clearTimeout(timerAviso);
    timerAviso = setTimeout(() => { el.hidden = true; }, 4000);
  }

  function atualizarBotoes() {
    if (!estado) return;
    const completa = !!estado.jogadores[1];
    const minhaVez = completa && estado.vez === eu;
    const c = estado.carta;
    const acabou = estado.vencedor !== null;
    const travado = !minhaVez || girando || !!c || !cartasOk || acabou;
    // barra de baixo: sem carta, Girar/Escolher; com carta (depois do giro), as ações da carta
    $("acoesGiro").hidden = !!c;
    $("acoesCarta").hidden = !c || girando;
    $("spin").disabled = travado;
    $("pickV").disabled = $("pickD").disabled = travado;

    // Pular: só em verdade/desafio; mostra quantos pulos grátis restam daquele tipo
    const p = estado.placar[estado.vez];
    const avaliando = !!estado.avaliacao;
    const evento = !!(c && c.evento);
    $("done").hidden = !minhaVez || avaliando || evento;
    $("skip").hidden = !minhaVez || !c || c.tipo === "prenda" || avaliando || evento;
    $("eventoFim").hidden = !evento || !minhaVez || EVENTOS_TRATADOS.has(c.tipo);
    $("reverso").hidden = !podeReverter(estado);
    $("efeitoAcoes").hidden = !(evento && c.tipo === "efeito" && minhaVez);
    desenharDuelo(estado);
    desenharSintonia(estado);
    desenharDupla(estado);
    // Nota do adversário: quem não cumpriu dá as estrelas
    $("avaliar").hidden = !completa || minhaVez || !avaliando;
    if (c && !evento && c.tipo !== "prenda") {
      const restam = c.tipo === "verdade" ? p.livresV : p.livresD;
      $("skip").textContent = restam > 0 ? `Pular (${restam} grátis)` : "Pular (paga prenda)";
    }
    // Liberar da prenda: só o adversário de quem está pagando
    $("liberar").hidden = !completa || minhaVez || !c || c.tipo !== "prenda";

    const ag = $("aguardando");
    ag.hidden = (avaliando ? !minhaVez : minhaVez) || (evento && OS_DOIS_JOGAM.includes(c.tipo));
    if (avaliando) {
      ag.textContent = `Aguardando a nota de ${estado.jogadores[1 - estado.vez]}.`;
    } else if (!minhaVez && completa) {
      const quem = estado.jogadores[estado.vez];
      ag.textContent = c && c.tipo === "prenda" ? `Aguardando ${quem} cumprir a prenda.`
        : evento && c.tipo === "efeito" ? `Aguardando ${quem} aceitar ou recusar o efeito.`
        : evento ? `Aguardando ${quem} concluir o evento.`
        : `Aguardando ${quem} cumprir ou pular.`;
    }
  }

  function mostrarCarta(e) {
    const c = e && e.carta;
    const card = $("card");
    if (!c) { card.hidden = true; return; }
    const nome = PARA_OS_DOIS.includes(c.tipo) ? "os dois" : e.jogadores[e.vez] || "";
    card.className = "card " + c.tipo + (c.evento ? " evento" : "") + (c.reversa ? " reversa" : "");
    card.hidden = false;
    $("selo").hidden = !c.evento;
    $("selo").textContent = !c.evento ? "" : c.tipo === "missao_dupla" ? "⚡ Evento especial · 🤝 Missão em dupla" : "⚡ Evento especial";
    $("kind").textContent = c.recusa ? "Prenda por recusar o efeito"
      : c.motivo === "duelo" ? "Prenda por perder o duelo"
      : c.motivo === "quebra" ? "Prenda por quebrar o efeito"
      : ehPulo(c) ? (origemDe(c) === "desafio" ? "Prenda por pular o desafio" : "Prenda por pular a verdade")
      : c.motivo === "final" ? "Prenda final"
      : c.surpresa ? `🎲 Desafio surpresa de ${e.jogadores[c.surpresaDe] || ""}`
      : c.reversa ? `🔄 Reverso de ${e.jogadores[c.revertidaPor] || ""} · ${TIPO_NOMES[c.tipo] || c.tipo}`
      : TIPO_NOMES[c.tipo] || c.tipo;
    $("level").textContent = "Nível " + (LEVEL_NAMES[c.nivel] || c.nivel)
      + (c.autor ? ", carta de " + c.autor : "") + ", para " + nome
      + (c.tipo === "efeito" && c.rodadas ? ` · dura ${c.rodadas} ${c.rodadas === 1 ? "rodada" : "rodadas"}` : "");
    $("text").textContent = c.texto;
    $("midia").hidden = !c.midia;
    $("wa").href = "https://wa.me/?text=" + encodeURIComponent(`${$("kind").textContent} para ${nome}: ${c.texto}`);
  }

  // ---------- cronômetro ----------
  // Tempo escrito na carta: o primeiro "N segundos" ou "N minutos" do texto.
  function tempoDaCarta(texto) {
    const m = /(\d+)\s*(segundo|minuto)s?/i.exec(texto || "");
    if (!m) return 0;
    return Number(m[1]) * (/^minuto/i.test(m[2]) ? 60 : 1);
  }

  const rotuloTempo = s => s >= 60 && s % 60 === 0 ? `${s / 60}min` : `${s}s`;
  const relogio = s => s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : String(s);

  // segundos que faltam, medidos pelo relógio deste aparelho a partir de quando recebeu o timer
  function restante(t) {
    if (!t) return 0;
    if (t.pausado) return t.segundos;
    const passou = (performance.now() - timerLocal.t0) / 1000;
    return Math.max(0, t.segundos - passou);
  }

  function desenharTimer(e, inicial) {
    const t = e.timer;
    const c = e.carta;
    const temCarta = !!c && !$("card").hidden;
    if (t && (!timerLocal || timerLocal.id !== t.id)) {
      // timer novo: conta a partir de agora; quem abre a sala no meio usa `inicio` como estimativa
      const atraso = inicial && !t.pausado ? Math.max(0, (Date.now() - t.inicio) / 1000) : 0;
      timerLocal = { id: t.id, t0: performance.now() - atraso * 1000 };
    }
    if (!t) timerLocal = null;
    $("timerVivo").hidden = !t;
    $("timerParado").hidden = !!t;
    if (!t && temCarta) {
      const s = c.segundos || tempoDaCarta(c.texto);
      $("timerIniciar").hidden = !s;
      $("timerAbrir").hidden = !!s;
      if (s) { $("timerIniciar").textContent = `Iniciar ${rotuloTempo(s)}`; $("timerIniciar").dataset.seg = s; }
      else $("timerOpcoes").hidden = true;
    }
    clearInterval(timerTick);
    if (t) {
      $("timerPausar").hidden = false;
      $("timerPausar").textContent = t.pausado ? "Continuar" : "Pausar";
      atualizarTimer();
      if (!t.pausado) timerTick = setInterval(atualizarTimer, 200);
    }
  }

  function atualizarTimer() {
    const t = estado && estado.timer;
    if (!t || !timerLocal) { clearInterval(timerTick); return; }
    const r = restante(t);
    const num = $("timerNum");
    const s = Math.ceil(r);
    $("timerBarra").style.width = (t.total ? Math.max(0, r / t.total * 100) : 0) + "%";
    if (t.preparo) {
      // contagem de largada sincronizada: 3, 2, 1, VALENDO! (depois, o tempo da carta, se houver)
      const passou = t.total - r;
      num.classList.remove("fim", "tempo");
      if (passou < t.preparo) { num.textContent = String(Math.ceil(t.preparo - passou)); return; }
      if (t.total <= t.preparo || passou < t.preparo + 0.9) {
        num.textContent = "VALENDO!";
        if (t.total <= t.preparo) { $("timerPausar").hidden = true; clearInterval(timerTick); }
        return;
      }
    }
    num.classList.toggle("fim", r > 0 && s <= 5);
    num.classList.toggle("tempo", r <= 0);
    if (r > 0) {
      num.textContent = relogio(s);
      if (s <= 5 && timerLocal.ultimoS !== s && !t.pausado) { timerLocal.ultimoS = s; somTicTac(s % 2 === 1); vibrar(50); }
      return;
    }
    num.textContent = "Tempo!";
    $("timerPausar").hidden = true;
    clearInterval(timerTick);
    if (timerAcabou !== t.id) {
      timerAcabou = t.id;
      vibrar([200, 100, 200]);
      bipe();
    }
  }

  // bipe curto; o navegador só deixa tocar som depois de um toque na página
  // sons gerados na hora (Web Audio, sem arquivos); o navegador só libera depois de um toque na página
  let audio = null;
  addEventListener("pointerdown", () => {
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") audio.resume();
    } catch (err) {}
  });
  function tom(freq, dur, depois = 0, tipo = "sine", vol = 0.15) {
    if (!audio || !somLigado) return;
    try {
      const t0 = audio.currentTime + depois;
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = tipo;
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.connect(g).connect(audio.destination);
      o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (err) {}
  }
  const bipe = () => tom(880, 0.35, 0, "sine", 0.2);
  const somTique = () => tom(1400, 0.03, 0, "square", 0.05);
  const somTicTac = alto => tom(alto ? 1000 : 750, 0.06, 0, "square", 0.08);
  const somEvento = () => [523, 659, 784].forEach(f => tom(f, 0.45, 0, "triangle", 0.12));
  const somVitoria = () => [[523, 0], [659, 0.16], [1047, 0.32]].forEach(([f, d]) => tom(f, d === 0.32 ? 0.6 : 0.18, d, "triangle", 0.16));

  // tiques da roleta: um a cada fatia que passa pelo ponteiro (espaçam sozinhos quando ela desacelera)
  function tiquesDaRoleta() {
    const w = $("wheel"), passo = 360 / SEGMENTOS;
    let ultimo = null;
    (function quadro() {
      if (!girando) return;
      const m = getComputedStyle(w).transform;
      if (m && m.startsWith("matrix(")) {
        const [a, b] = m.slice(7, -1).split(",").map(Number);
        const ang = (Math.atan2(b, a) * 180 / Math.PI + 360) % 360;
        const fatia = Math.floor(ang / passo);
        if (ultimo !== null && fatia !== ultimo) somTique();
        ultimo = fatia;
      }
      requestAnimationFrame(quadro);
    })();
  }

  function trocarSom() {
    somLigado = !somLigado;
    salvarLocal("lp-som", somLigado);
    desenharAjustes();
  }

  // ---------- câmera do WhatsApp (PiP) ----------
  const CAMERAS = ["direita", "esquerda", "nenhuma"];
  let camera = CAMERAS.includes(lerLocal("lp-camera")) ? lerLocal("lp-camera") : "direita";
  function desenharAjustes() {
    document.body.classList.toggle("cam-direita", camera === "direita");
    document.body.classList.toggle("cam-esquerda", camera === "esquerda");
    $("camera").value = camera;
    $("som").textContent = somLigado ? "🔊" : "🔇";
    $("som").setAttribute("aria-pressed", String(somLigado));
    $("som").setAttribute("aria-label", somLigado ? "Som e vibração ligados" : "Som e vibração desligados");
  }
  function mudarCamera() {
    camera = CAMERAS.includes($("camera").value) ? $("camera").value : "direita";
    salvarLocal("lp-camera", camera);
    desenharAjustes();
  }

  // carta nova na mesa: centraliza na tela e dá o retorno de som/vibração
  let ultimaRevelada = null;
  function revelarCarta(e, inicial) {
    const c = e.carta;
    if (!c || $("card").hidden || c.chave === ultimaRevelada) return;
    ultimaRevelada = c.chave;
    if (inicial) return;
    const suave = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    try { $("card").scrollIntoView({ block: "center", behavior: suave ? "smooth" : "auto" }); } catch (err) {}
    if (c.evento) { somEvento(); vibrar([100, 50, 100]); }
    else if (c.nivel === "pesado") vibrar([80, 60, 80, 60, 200]);
  }

  const idTimer = () => Date.now() + "-" + Math.random().toString(36).slice(2, 7);

  function iniciarTimer(seg) {
    if (!estado || !estado.carta || !seg) return;
    gravar(n => { n.timer = { id: idTimer(), total: seg, segundos: seg, inicio: Date.now(), pausado: false }; });
  }

  function pausarTimer() {
    const t = estado && estado.timer;
    if (!t || restante(t) <= 0) return;
    const r = Math.round(restante(t) * 10) / 10;
    gravar(n => {
      if (!n.timer) return;
      n.timer = t.pausado
        ? { ...t, id: idTimer(), inicio: Date.now(), pausado: false }       // continuar do ponto em que parou
        : { ...t, id: idTimer(), segundos: r, inicio: Date.now(), pausado: true };
    });
  }

  function cancelarTimer() {
    if (!estado || !estado.timer) return;
    gravar(n => { n.timer = null; });
  }

  // ---------- ações ----------
  function girar() {
    if (!estado || girando || estado.vez !== eu || estado.carta || estado.vencedor !== null) return;
    const k = Math.floor(Math.random() * SEGMENTOS);
    const passo = 360 / SEGMENTOS;
    const alvoSeg = k * passo + passo / 2;
    const atual = ((rotacao % 360) + 360) % 360;
    let delta = (360 - alvoSeg) - atual;
    if (delta <= 0) delta += 360;
    const alvo = rotacao + 360 * 5 + delta;
    const tipo = k % 2 === 0 ? "verdade" : "desafio";
    if (!sortear(tipo, estado.niveis, [])) return erro("erroJogo", "Não consegui carregar as cartas. Recarregue a página.");
    gravar(n => {
      if (!n.secretas.length) n.secretas = sortearSecretas(n);   // começo da partida: missões secretas
      let carta = sortear(tipo, n.niveis, n.usados || []);
      // com a chance configurada, o giro vira um evento especial (a roleta continua mostrando Verdade/Desafio)
      if (Math.random() < CHANCE_EVENTO[n.eventos]) carta = sortearEvento(n) || carta;
      registrarUso(n, carta);
      n.carta = carta;
      n.musica = sortearMusica(carta.nivel);
      n.giro = { id: Date.now() + "-" + Math.random().toString(36).slice(2, 7), alvo };
    });
  }

  function escolher(tipo) {
    if (!estado || girando || estado.vez !== eu || estado.carta || estado.vencedor !== null) return;
    if (!sortear(tipo, estado.niveis, [])) return erro("erroJogo", "Não consegui carregar as cartas. Recarregue a página.");
    gravar(n => {
      if (!n.secretas.length) n.secretas = sortearSecretas(n);   // começo da partida: missões secretas
      const carta = sortear(tipo, n.niveis, n.usados || []);
      registrarUso(n, carta);
      n.carta = carta;
      n.musica = sortearMusica(carta.nivel);
    });
  }

  // ---------- eventos especiais ----------
  // Tipo pelos pesos; nível entre os ativos que têm carta daquele tipo; sem carta, tenta outro tipo.
  function sortearEvento(n) {
    let tipos = PESOS_EVENTO.filter(([t]) => t !== "efeito" || (n.efeitos || []).filter(x => x.dono === n.vez).length < 2);
    while (tipos.length) {
      const total = tipos.reduce((s, [, w]) => s + w, 0);
      let r = Math.random() * total, tipo = tipos[tipos.length - 1][0];
      for (const [t, w] of tipos) { if ((r -= w) < 0) { tipo = t; break; } }
      const niveis = n.niveis.filter(nv => cartas.some(c => c.tipo === tipo && c.nivel === nv));
      if (niveis.length) {
        const carta = sortear(tipo, [niveis[Math.floor(Math.random() * niveis.length)]], n.usados || []);
        if (carta) { carta.evento = true; carta.de = n.vez; return carta; }
      }
      tipos = tipos.filter(([t]) => t !== tipo);
    }
    return null;
  }

  // ---------- efeito contínuo ----------
  EVENTOS_TRATADOS.add("efeito");

  function aceitarEfeito() {
    if (!estado || estado.vez !== eu || !estado.carta || estado.carta.tipo !== "efeito") return;
    gravar(n => {
      const c = n.carta;
      if (!c || c.tipo !== "efeito") return;
      const rodadas = c.rodadas || 2;
      n.efeitos.push({ id: (c.id || c.chave) + "-" + Date.now().toString(36), dono: n.vez, texto: c.texto, nivel: c.nivel, restantes: rodadas });
      n.aviso = novoAviso(`${n.jogadores[n.vez]} aceitou o efeito por ${rodadas} ${rodadas === 1 ? "rodada" : "rodadas"}.`);
      n.carta = null;
      passarVez(n, c);
    });
  }

  // Recusar = prenda do mesmo nível, como um pulo sem pulos livres (devolve pulos de desafio ao ser cumprida)
  function recusarEfeito() {
    if (!estado || estado.vez !== eu || !estado.carta || estado.carta.tipo !== "efeito") return;
    gravar(n => {
      const c = n.carta;
      if (!c || c.tipo !== "efeito") return;
      const prenda = sortearPrenda(c.nivel, n.usados || []);
      if (!prenda) { n.carta = null; passarVez(n, c); return; }
      registrarUso(n, prenda);
      prenda.motivo = "pulo";
      prenda.origem = "desafio";
      prenda.recusa = true;
      n.carta = prenda;
    });
  }

  // O adversário diz que o dono quebrou o efeito: acaba sem pontos e fica uma prenda para a próxima vez do dono
  function quebrouEfeito(id) {
    const ef = estado && estado.efeitos.find(x => x.id === id);
    if (!ef || ef.dono === eu) return;
    gravar(n => {
      const e2 = n.efeitos.find(x => x.id === id);
      if (!e2) return;
      n.efeitos = n.efeitos.filter(x => x.id !== id);
      const antes = n.prendaPendente && n.prendaPendente.dono === e2.dono ? n.prendaPendente.nivel : null;
      const nivel = antes && ORDEM_NIVEIS.indexOf(antes) > ORDEM_NIVEIS.indexOf(e2.nivel) ? antes : e2.nivel;
      n.prendaPendente = { dono: e2.dono, nivel };
      n.aviso = novoAviso(`${n.jogadores[1 - e2.dono]} disse que ${n.jogadores[e2.dono]} quebrou o efeito.`);
    });
  }

  const resumo = (t, max) => t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;

  function desenharEfeitos(e) {
    const barra = $("efeitosBarra");
    barra.textContent = "";
    barra.hidden = !e.efeitos.length;
    e.efeitos.forEach(ef => {
      const item = document.createElement("div");
      item.className = "efeito-item";
      const txt = document.createElement("button");
      txt.type = "button";
      txt.className = "ef-texto";
      const aberto = efeitosAbertos.has(ef.id);
      const quem = document.createElement("b");
      quem.textContent = `✨ ${e.jogadores[ef.dono]}: `;
      const corpo = document.createTextNode(aberto ? ef.texto : resumo(ef.texto, 48));
      const rest = document.createElement("span");
      rest.className = "ef-rest";
      rest.textContent = ` · ${ef.restantes} ${ef.restantes === 1 ? "rodada" : "rodadas"}`;
      txt.append(quem, corpo, rest);
      txt.setAttribute("aria-expanded", String(aberto));
      txt.addEventListener("click", () => { aberto ? efeitosAbertos.delete(ef.id) : efeitosAbertos.add(ef.id); desenharEfeitos(estado); });
      item.appendChild(txt);
      if (ef.dono !== eu) {
        const q = document.createElement("button");
        q.type = "button";
        q.className = "quebrou";
        q.textContent = "Quebrou!";
        q.addEventListener("click", () => quebrouEfeito(ef.id));
        item.appendChild(q);
      }
      barra.appendChild(item);
    });
  }

  // ---------- duelo na câmera ----------
  EVENTOS_TRATADOS.add("duelo");

  function comecarDuelo() {
    if (!estado || !estado.carta || estado.carta.tipo !== "duelo") return;
    gravarFresco(n => {
      const c = n.carta;
      if (!c || c.tipo !== "duelo" || (n.duelo && n.duelo.iniciado)) return;
      const total = 3 + (c.segundos || 0);
      n.duelo = { chave: c.chave, cartaId: c.id || c.chave, iniciado: true, votos: [null, null], rodada: 1 };
      n.timer = { id: idTimer(), total, segundos: total, inicio: Date.now(), pausado: false, preparo: 3 };
    });
  }

  // voto: "eu" (eu ganhei), "outro" ou "empate" -> gravado como índice do vencedor ou "empate"
  function votarDuelo(v) {
    if (!estado || !estado.duelo) return;
    const voto = v === "eu" ? eu : v === "outro" ? 1 - eu : "empate";
    const { chave, rodada } = estado.duelo;
    pendente("duelo", e => !e.duelo || e.duelo.chave !== chave || e.duelo.rodada !== rodada,
      e => e.duelo.votos[eu] === voto, () => gravarVotoDuelo(voto, chave, rodada));
    gravarVotoDuelo(voto, chave, rodada);
  }

  function gravarVotoDuelo(voto, chave, rodada) {
    gravarFresco(n => {
      const d = n.duelo, c = n.carta;
      if (!d || !c || c.tipo !== "duelo" || d.chave !== chave || d.rodada !== rodada) return;   // voto de outra rodada
      d.votos[eu] = voto;
      if (d.votos[0] === null || d.votos[1] === null) return;
      if (d.votos[0] !== d.votos[1]) {
        d.votos = [null, null];
        d.rodada = (d.rodada || 1) + 1;
        n.aviso = novoAviso("Vocês discordaram, escolham de novo.");
        return;
      }
      const girou = c.de === 0 || c.de === 1 ? c.de : n.vez;
      const res = d.votos[0];
      n.duelo = null;
      n.carta = null;
      if (res === "empate") {
        n.aviso = novoAviso("Empate no duelo!");
        n.vez = 1 - girou;
        return;
      }
      const venc = res, perd = 1 - res;
      n.placar[venc].pontos += 2;
      n.placar[venc].duelos = (n.placar[venc].duelos || 0) + 1;
      n.pontos = n.placar.map(x => x.pontos);
      n.aviso = novoAviso(`${n.jogadores[venc]} venceu o duelo! +2`);
      if (conferirMeta(n)) return;
      // o perdedor paga uma prenda na hora; depois a vez segue a partir de quem girou
      const prenda = sortearPrenda(c.nivel, n.usados || []);
      if (prenda) {
        registrarUso(n, prenda);
        prenda.motivo = "duelo";
        prenda.proxVez = 1 - girou;
        prenda.novaVez = true;
        n.carta = prenda;
        n.vez = perd;
      } else {
        n.vez = 1 - girou;
      }
    });
  }

  function desenharDuelo(e) {
    const c = e.carta, d = e.duelo;
    const ativo = !!(c && c.tipo === "duelo" && e.jogadores[1]);
    $("dueloAcoes").hidden = !ativo;
    if (!ativo) return;
    const iniciado = !!(d && d.iniciado);
    $("dueloComecar").hidden = iniciado;
    $("dueloVotos").hidden = !iniciado;
    $("dueloOutro").textContent = `${e.jogadores[1 - eu]} ganhou`;
    const meu = d ? d.votos[eu] : null, dele = d ? d.votos[1 - eu] : null;
    const rotulo = v => v === "empate" ? "Empate" : v === eu ? "Eu ganhei" : `${e.jogadores[1 - eu]} ganhou`;
    document.querySelectorAll("#dueloVotos button").forEach(b => {
      const v = b.dataset.v === "eu" ? eu : b.dataset.v === "outro" ? 1 - eu : "empate";
      b.classList.toggle("meu", meu !== null && meu === v);
    });
    $("dueloStatus").textContent = !iniciado ? "Qualquer um dos dois pode começar."
      : meu === null ? (dele === null ? "Quem ganhou? Os dois escolhem." : `${e.jogadores[1 - eu]} já escolheu. Sua vez de escolher.`)
      : dele === null ? `Você escolheu "${rotulo(meu)}". Esperando ${e.jogadores[1 - eu]}…` : "";
  }

  // ---------- modo sintonia ----------
  // O alvo (quem girou) responde sobre si; o outro tenta adivinhar. Nada aparece antes das duas respostas.
  EVENTOS_TRATADOS.add("sintonia");
  const PONTOS_SINTONIA = { acertou: 2, quase: 1, errou: 0 };
  let sintoniaCarta = null;   // para limpar o rascunho quando muda a carta

  const alvoDe = (e, c) => (c.de === 0 || c.de === 1 ? c.de : e.vez);

  function enviarSintonia() {
    const txt = $("sintoniaTexto").value.replace(/\s+/g, " ").trim().slice(0, 140);
    if (!estado || !estado.carta || estado.carta.tipo !== "sintonia") return;
    if (!txt) return erro("erroJogo", "Escreva a sua resposta antes de enviar.");
    erro("erroJogo", "");
    const chave = estado.carta.chave;
    pendente("sintonia", e => !e.carta || e.carta.chave !== chave || !!(e.sintonia && e.sintonia.revelado),
      e => !!(e.sintonia && e.sintonia.respostas[eu] !== null), () => gravarSintonia(txt, chave));
    gravarSintonia(txt, chave);
  }

  function gravarSintonia(txt, chave) {
    gravarFresco(n => {
      const c = n.carta;
      if (!c || c.tipo !== "sintonia" || c.chave !== chave) return;   // resposta de outra carta
      const s = n.sintonia || { chave: c.chave, cartaId: c.id || c.chave, alvo: alvoDe(n, c), respostas: [null, null], revelado: false };
      if (s.revelado) return;
      s.respostas[eu] = txt;
      s.revelado = s.respostas[0] !== null && s.respostas[1] !== null;
      n.sintonia = s;
    });
  }

  function julgarSintonia(j) {
    const s = estado && estado.sintonia;
    if (!s || !s.revelado || s.alvo !== eu || !(j in PONTOS_SINTONIA)) return;
    gravar(n => {
      const s2 = n.sintonia;
      if (!s2 || !s2.revelado) return;
      const alvo = s2.alvo, palpite = 1 - alvo;
      n.placar[palpite].pontos += PONTOS_SINTONIA[j];
      n.placar[alvo].pontos += 1;
      if (j === "acertou") n.placar.forEach(p => { p.sintonias = (p.sintonias || 0) + 1; });
      n.pontos = n.placar.map(x => x.pontos);
      const frase = { acertou: "acertou", quase: "quase acertou", errou: "errou" }[j];
      n.aviso = novoAviso(`${n.jogadores[palpite]} ${frase} a resposta de ${n.jogadores[alvo]}! +${PONTOS_SINTONIA[j]} e +1`);
      n.sintonia = null;
      n.carta = null;
      n.vez = 1 - alvo;
      conferirMeta(n);
    });
  }

  function desenharSintonia(e) {
    const c = e.carta;
    const ativo = !!(c && c.tipo === "sintonia" && e.jogadores[1]);
    $("sintoniaBox").hidden = !ativo;
    if (!ativo) { sintoniaCarta = null; return; }
    if (sintoniaCarta !== c.chave) { sintoniaCarta = c.chave; $("sintoniaTexto").value = ""; }
    const s = e.sintonia;
    const alvo = s ? s.alvo : alvoDe(e, c), outro = 1 - alvo;
    const minha = s ? s.respostas[eu] : null, dele = s ? s.respostas[1 - eu] : null;
    const revelado = !!(s && s.revelado);
    $("sintoniaResponder").hidden = revelado || minha !== null;
    $("sintoniaPapel").textContent = eu === alvo ? "Responda sobre você" : `O que ${e.jogadores[alvo]} vai responder?`;
    $("sintoniaReveal").hidden = !revelado;
    $("sintoniaJulgar").hidden = !revelado || eu !== alvo;
    if (revelado) {
      $("sintoniaQuemA").textContent = `${e.jogadores[alvo]} respondeu`;
      $("sintoniaRespA").textContent = s.respostas[alvo];
      $("sintoniaQuemB").textContent = `${e.jogadores[outro]} achou`;
      $("sintoniaRespB").textContent = s.respostas[outro];
      $("sintoniaStatus").textContent = eu === alvo ? "Julgue o palpite:" : `Aguardando ${e.jogadores[alvo]} julgar.`;
    } else {
      $("sintoniaStatus").textContent = minha !== null ? `Resposta enviada ✓ Esperando ${e.jogadores[1 - eu]}…`
        : dele !== null ? `${e.jogadores[1 - eu]} já respondeu ✓` : "";
    }
  }

  // ---------- missão em dupla (cooperativa) ----------
  EVENTOS_TRATADOS.add("missao_dupla");

  function votarDupla(v) {
    const c = estado && estado.carta;
    if (!c || c.tipo !== "missao_dupla" || !["sim", "nao"].includes(v)) return;
    const chave = c.chave, rodada = estado.dupla ? estado.dupla.rodada : 1;
    pendente("dupla", e => !e.carta || e.carta.chave !== chave || (e.dupla ? e.dupla.rodada : 1) !== rodada,
      e => !!(e.dupla && e.dupla.votos[eu] === v), () => gravarVotoDupla(v, chave, rodada));
    gravarVotoDupla(v, chave, rodada);
  }

  function gravarVotoDupla(v, chave, rodada) {
    gravarFresco(n => {
      const c = n.carta;
      if (!c || c.tipo !== "missao_dupla" || c.chave !== chave) return;
      const d = n.dupla || { chave, cartaId: c.id || chave, votos: [null, null], rodada: 1 };
      if (d.rodada !== rodada) return;                  // voto de outra rodada
      d.votos[eu] = v;
      n.dupla = d;
      if (d.votos[0] === null || d.votos[1] === null) return;
      if (d.votos[0] !== d.votos[1]) {
        d.votos = [null, null];
        d.rodada++;
        n.aviso = novoAviso("Vocês discordaram, votem de novo.");
        return;
      }
      const girou = c.de === 0 || c.de === 1 ? c.de : n.vez;
      n.dupla = null;
      n.carta = null;
      n.vez = 1 - girou;
      if (d.votos[0] === "sim") {
        n.placar.forEach(p => { p.pontos += 2; p.duplas = (p.duplas || 0) + 1; });
        n.pontos = n.placar.map(x => x.pontos);
        n.aviso = novoAviso("Missão em dupla cumprida! +2 para cada um");
        conferirMeta(n);                                // empate na meta não encerra: o próximo ponto decide
      } else {
        n.aviso = novoAviso("Não deu desta vez. Ninguém pontua.");
      }
    });
  }

  function desenharDupla(e) {
    const c = e.carta;
    const ativo = !!(c && c.tipo === "missao_dupla" && e.jogadores[1]);
    $("duplaAcoes").hidden = !ativo;
    if (!ativo) return;
    const d = e.dupla;
    const meu = d ? d.votos[eu] : null, dele = d ? d.votos[1 - eu] : null;
    document.querySelectorAll("#duplaVotos button").forEach(b => b.classList.toggle("meu", meu === b.dataset.v));
    const outro = e.jogadores[1 - eu];
    $("duplaStatus").textContent = meu === null ? (dele === null ? "Quando acabarem, os dois votam." : `${outro} já votou. Falta você.`)
      : dele === null ? `Você votou "${meu === "sim" ? "Conseguimos" : "Não deu"}". Esperando ${outro}…` : "";
  }

  // ---------- missão secreta da partida ----------
  // Duas missões diferentes, dos níveis ativos (se faltar, de qualquer nível). Cada um vê só a sua.
  function sortearSecretas(n) {
    let pool = cartas.filter(c => c.tipo === "missao_secreta" && n.niveis.includes(c.nivel));
    if (pool.length < 2) pool = cartas.filter(c => c.tipo === "missao_secreta");
    if (pool.length < 2) return [];
    const i = Math.floor(Math.random() * pool.length);
    let j = Math.floor(Math.random() * (pool.length - 1));
    if (j >= i) j++;
    return [pool[i], pool[j]].map(c => ({ id: c.id, texto: c.texto, nivel: c.nivel, status: "ativa" }));
  }

  function pedirMissao() {
    const s = estado && estado.secretas[eu];
    if (!s || s.status !== "ativa" || estado.vencedor !== null) return;
    gravarFresco(n => { const m = n.secretas[eu]; if (m && m.status === "ativa" && n.vencedor == null) m.status = "pedida"; });
  }

  function julgarMissao(confirma) {
    const dono = 1 - eu;
    const s = estado && estado.secretas[dono];
    if (!s || s.status !== "pedida") return;
    gravarFresco(n => {
      const m = n.secretas[dono];
      if (!m || m.status !== "pedida") return;
      if (!confirma) {
        m.status = "ativa";
        n.aviso = novoAviso(`${n.jogadores[eu]} disse que a missão de ${n.jogadores[dono]} ainda não foi cumprida.`);
        return;
      }
      m.status = "cumprida";
      const pts = PONTOS_MISSAO[m.nivel] || 2;
      n.placar[dono].pontos += pts;
      n.pontos = n.placar.map(x => x.pontos);
      n.aviso = novoAviso(`${n.jogadores[dono]} cumpriu a missão secreta: ${m.texto} (+${pts})`);
      conferirMeta(n);
    });
  }

  function desenharSecretas(e) {
    const box = $("secretasBox");
    const ms = e.secretas;
    box.hidden = !e.jogadores[1] || ms.length < 2;
    const lista = $("missoesReveladas");
    lista.textContent = "";
    if (box.hidden) return;
    const minha = ms[eu], dele = ms[1 - eu], outro = e.jogadores[1 - eu];
    const acabou = e.vencedor !== null;
    $("minhaMissaoBtn").setAttribute("aria-expanded", String(missaoAberta));
    $("minhaMissao").hidden = !missaoAberta;
    $("mmTexto").textContent = minha.texto;
    $("mmInfo").textContent = `Nível ${LEVEL_NAMES[minha.nivel] || minha.nivel} · vale ${PONTOS_MISSAO[minha.nivel] || 2} pontos · `
      + (minha.status === "cumprida" ? "cumprida ✓" : minha.status === "pedida" ? `esperando ${outro} confirmar` : "ninguém mais vê");
    $("mmCumpri").hidden = minha.status !== "ativa" || acabou;
    $("missaoOutro").textContent = dele.status === "cumprida" ? `${outro} cumpriu a missão: ${dele.texto}` : `${outro} tem uma missão secreta`;
    const pedindo = dele.status === "pedida" && !acabou;
    $("confirmarMissao").hidden = !pedindo;
    if (pedindo) $("cmTexto").textContent = `${outro} diz que cumpriu a missão secreta: “${dele.texto}”`;
    // no fim da partida, as missões não cumpridas são reveladas
    if (acabou) ms.forEach((m, i) => {
      if (m.status === "cumprida") return;
      const li = document.createElement("li");
      li.textContent = `A missão de ${e.jogadores[i]} era: ${m.texto}`;
      lista.appendChild(li);
    });
  }

  // "Concluir evento": saída genérica para tipos de evento sem tratamento próprio
  function concluirEvento() {
    if (!estado || !estado.carta || !estado.carta.evento || estado.vez !== eu) return;
    gravar(n => { if (n.carta && n.carta.evento) { n.carta = null; n.vez = 1 - n.vez; } });
  }

  function mudarEventos() {
    const v = $("eventos").value;
    if (!estado || !(v in CHANCE_EVENTO) || !placarZerado(estado)) return;
    gravar(n => { if (placarZerado(n)) n.eventos = v; });
  }

  // Cumpri: soma pontos/contadores; prenda vale 0. Bater a meta encerra a partida com prenda final.
  function cumprir() {
    if (!estado || estado.vez !== eu || !estado.carta || estado.carta.evento || estado.avaliacao) return;
    gravar(n => {
      const c = n.carta, p = n.placar[n.vez];
      // desafio com "Nota do adversário": a carta fica na tela esperando as estrelas
      if (c.tipo === "desafio" && n.notaAdversario && n.jogadores[1]) {
        n.avaliacao = { chave: c.chave, cartaId: c.id || c.chave, de: n.vez };
        return;
      }
      n.carta = null;
      if (c.tipo === "prenda") {
        p.prendas++;
        if (ehPulo(c)) {
          // devolve pulos ao contador do tipo pulado, sem passar de pulosMax
          const campo = origemDe(c) === "desafio" ? "livresD" : "livresV";
          const antes = p[campo];
          p[campo] = Math.min(n.pulosMax, antes + (DEVOLVE[c.nivel] || 0));
          const volta = p[campo] - antes;
          if (volta > 0) n.aviso = novoAviso(`${n.jogadores[n.vez]} recuperou ${volta} ${volta === 1 ? "pulo" : "pulos"} de ${origemDe(c)}.`);
        }
        if (c.motivo !== "final") passarVez(n, c);     // depois da prenda final a partida já acabou
      } else {
        pontuar(n, c, 0);
      }
      n.pontos = n.placar.map(x => x.pontos);
    });
  }

  // soma pontos da tabela (+ estrelas), conta o tipo e só então confere a meta
  function pontuar(n, c, estrelas) {
    const p = n.placar[n.vez];
    p.pontos += ((PONTOS[c.tipo] || {})[c.nivel] || 0) + estrelas;
    p.estrelas += estrelas;
    if (c.tipo === "verdade") p.verdades++; else p.desafios++;
    passarVez(n, c);
    conferirMeta(n);
  }

  // Nota do adversário: cada estrela vale +1 ponto
  function avaliar(estrelas) {
    if (!estado || !estado.avaliacao || estado.vez === eu || ![1, 2, 3].includes(estrelas)) return;
    gravar(n => {
      if (!n.avaliacao || !n.carta) return;
      const c = n.carta, quem = n.vez;
      n.carta = null;
      n.avaliacao = null;
      n.aviso = novoAviso(`${n.jogadores[quem]} ganhou ${"★".repeat(estrelas)} de ${n.jogadores[1 - quem]}`);
      pontuar(n, c, estrelas);
      n.pontos = n.placar.map(x => x.pontos);
    });
  }

  function mudarNota() {
    const v = $("notaAdv").checked;
    if (!estado || !placarZerado(estado)) return;
    gravar(n => { if (placarZerado(n)) n.notaAdversario = v; });
  }

  // Pular: com pulos livres do tipo, gasta um, descarta e passa a vez;
  // com o contador em 0, a carta vira prenda para a mesma pessoa, na mesma vez.
  function pular() {
    if (!estado || estado.vez !== eu || !estado.carta || estado.carta.tipo === "prenda" || estado.carta.evento || estado.avaliacao) return;
    gravar(n => {
      const c = n.carta;
      const q = n.placar[n.vez];
      const campo = c.tipo === "verdade" ? "livresV" : "livresD";
      if (q[campo] > 0) {
        q[campo]--;
        n.carta = null;
      } else {
        n.carta = prendaPara(n, "pulo", c);
        // prenda de uma carta reversa: resolvida, a vez continua com quem recebeu o reverso
        if (n.carta && c.reversa) { n.carta.proxVez = c.proxVez; n.carta.novaVez = true; }
      }
      if (!n.carta) passarVez(n, c);                    // pulo grátis (ou sem prendas carregadas): passa a vez
    });
  }

  // Reverso: uma vez por partida, quem está na vez passa a verdade/desafio para o outro.
  // O outro resolve com as próprias regras e pontos, e depois a vez continua com ele (joga duas seguidas).
  function podeReverter(e) {
    const c = e && e.carta;
    return !!(c && e.jogadores[1] && e.vez === eu && !c.evento && !c.reversa && !e.avaliacao && e.vencedor === null
      && (c.tipo === "verdade" || c.tipo === "desafio") && e.placar[e.vez].reverso !== false);
  }

  function usarReverso() {
    if (!podeReverter(estado)) return;
    gravar(n => {
      const c = n.carta;
      if (!c || c.reversa || n.placar[n.vez].reverso === false) return;
      const de = n.vez, para = 1 - de;
      n.placar[de].reverso = false;
      c.reversa = true;
      c.revertidaPor = de;
      c.proxVez = para;
      c.novaVez = true;
      n.vez = para;
      n.aviso = novoAviso(`${n.jogadores[de]} usou o Reverso! A carta foi para ${n.jogadores[para]}.`);
    });
  }

  // Liberar da prenda: o adversário perdoa; sem ponto, passa a vez, soma `liberadas`.
  function liberar() {
    if (!estado || estado.vez === eu || !estado.carta || estado.carta.tipo !== "prenda") return;
    gravar(n => {
      if (!n.carta || n.carta.tipo !== "prenda") return;
      const final = n.carta.motivo === "final";
      n.placar[n.vez].liberadas++;
      n.aviso = novoAviso(`${n.jogadores[eu]} liberou ${n.jogadores[n.vez]} da prenda.`);
      const c = n.carta;
      n.carta = null;
      if (!final) passarVez(n, c);                      // na prenda final a partida já acabou: fica o "Nova partida"
    });
  }

  function novaPartida() {
    if (!estado || estado.vencedor === null) return;
    gravar(n => {
      n.vez = 1 - n.vencedor;                           // quem perdeu começa
      n.placar = [placarVazio(0, n.pulosMax), placarVazio(0, n.pulosMax)];
      n.pontos = [0, 0];
      n.vencedor = null;
      n.usados = [];
      n.carta = null;
      n.efeitos = [];
      n.prendaPendente = null;
      n.duelo = null;
      n.sintonia = null;
      n.dupla = null;
      n.secretas = sortearSecretas(n);
    });
    missaoAberta = false;
  }

  function mudarMeta() {
    const m = Number($("meta").value);
    if (!estado || !METAS.includes(m) || !placarZerado(estado)) return;
    gravar(n => { if (placarZerado(n)) n.meta = m; });
  }

  function mudarPulosMax() {
    const m = Number($("pulosMax").value);
    if (!estado || !PULOS_OPCOES.includes(m) || !placarZerado(estado)) return;
    gravar(n => {
      if (!placarZerado(n)) return;
      n.pulosMax = m;
      n.placar.forEach(p => { p.livresV = m; p.livresD = m; });
    });
  }

  // ---------- cartas de vocês ----------
  const MIDIA_NOMES = { foto: "foto", video: "vídeo", audio: "áudio" };

  function juntarCarta(c) {
    if (!c || !c.id || c.sala !== codigo || c.ativa === false) return;
    if (cartas.some(x => x.id === c.id)) return;
    cartas.push({ id: c.id, sala: c.sala, tipo: c.tipo, nivel: c.nivel, texto: c.texto, midia: c.midia, autor: c.autor });
    desenharExtras();
  }

  function tirarCarta(id) {
    if (!id || !cartas.some(x => x.id === id)) return;
    cartas = cartas.filter(x => x.id !== id);
    desenharExtras();
  }

  function contarTexto() {
    $("contadorCarta").textContent = $("textoCarta").value.length + "/280";
  }

  function abrirDialogo() {
    if (!estado) return;
    $("formCarta").reset();
    $("midiaCarta").hidden = true;
    erro("erroCarta", "");
    contarTexto();
    $("dlgCarta").showModal();
    $("textoCarta").focus();
  }

  async function salvarCarta(ev) {
    ev.preventDefault();
    if (!estado || !codigo) return;
    const texto = $("textoCarta").value.replace(/\s+/g, " ").trim();
    if (texto.length < 3) return erro("erroCarta", "Escreva pelo menos 3 letras.");
    const nova = {
      sala: codigo,
      tipo: document.querySelector('input[name="tipoCarta"]:checked').value,
      nivel: $("nivelCarta").value,
      texto: texto.slice(0, 280),
      midia: $("temMidia").checked ? $("midiaCarta").value : null,
      autor: (estado.jogadores[eu] || "").trim().slice(0, 20)
    };
    const btn = $("salvarCarta");
    btn.disabled = true;
    const { data, error } = await sb.from("cartas").insert(nova).select("id, sala, tipo, nivel, texto, midia, autor").single();
    btn.disabled = false;
    if (error) {
      const msg = /limite de cartas/.test(error.message || "")
        ? "A sala chegou a 300 cartas de vocês. Apague alguma para criar outra."
        : "Não consegui salvar a carta. Confira a internet e tente de novo.";
      erro("erroCarta", msg);
      erro("erroJogo", msg);
      return;
    }
    erro("erroJogo", "");
    juntarCarta(data);
    $("dlgCarta").close();
  }

  async function apagarCarta(x) {
    if (!confirm(`Apagar esta carta?\n\n"${x.texto}"`)) return;
    const { error } = await sb.from("cartas").delete().eq("id", x.id);
    if (error) return erro("erroJogo", "Não consegui apagar a carta. Confira a internet e tente de novo.");
    erro("erroJogo", "");
    tirarCarta(x.id);
  }

  function mudarNiveis() {
    const sel = [...document.querySelectorAll("#niveis input:checked")].map(i => i.value);
    gravar(n => { n.niveis = sel.length ? sel : ["leve"]; });
  }

  // ---------- instalar app (PWA) ----------
  let pedidoInstalar = null;
  addEventListener("beforeinstallprompt", ev => {
    ev.preventDefault();
    pedidoInstalar = ev;
    $("instalar").hidden = false;
  });
  addEventListener("appinstalled", () => { pedidoInstalar = null; $("instalar").hidden = true; });

  async function instalar() {
    if (!pedidoInstalar) return;
    pedidoInstalar.prompt();
    try { await pedidoInstalar.userChoice; } catch (err) {}
    pedidoInstalar = null;
    $("instalar").hidden = true;
  }

  // ---------- início ----------
  function iniciar() {
    $("instalar").addEventListener("click", instalar);
    desenharAjustes();
    $("som").addEventListener("click", trocarSom);
    $("novoEnvelope").addEventListener("click", abrirNovoEnvelope);
    $("formEnvelope").addEventListener("submit", salvarEnvelope);
    $("cancelarEnvelope").addEventListener("click", () => $("dlgEnvelope").close());
    $("envTexto").addEventListener("input", () => { $("envContador").textContent = $("envTexto").value.length + "/500"; });
    document.querySelectorAll('input[name="envTipo"]').forEach(r => r.addEventListener("change", () => { $("envNivelLinha").hidden = r.value !== "desafio" || !r.checked; }));
    $("envFechar").addEventListener("click", () => { $("envAbrindo").hidden = true; });
    $("novaCapsula").addEventListener("click", abrirNovaCapsula);
    $("capOutra").addEventListener("click", outraPergunta);
    $("formCapsula").addEventListener("submit", salvarCapsula);
    $("cancelarCapsula").addEventListener("click", () => $("dlgCapsula").close());
    $("capAtalhos").addEventListener("click", ev => { const m = Number(ev.target.dataset && ev.target.dataset.meses); if (m) $("capData").value = somarMeses(hojeISO(), m); });
    // Casa do casal: qualquer elemento com data-abre troca de vista
    document.addEventListener("click", ev => {
      const b = ev.target.closest && ev.target.closest("[data-abre]");
      if (b && $("jogo").contains(b)) mostrarVista(b.dataset.abre);
    });
    addEventListener("pagehide", () => { try { if (canal) canal.untrack(); } catch (err) {} });
    $("camera").addEventListener("change", mudarCamera);
    // reserva o espaço da barra fixa no fim da página
    try { new ResizeObserver(() => document.documentElement.style.setProperty("--barra", $("barraAcoes").offsetHeight + "px")).observe($("barraAcoes")); } catch (err) {}
    desenharRoleta();
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", desenharRoleta);

    const nome = lerLocal("lp-nome");
    if (nome) $("nome").value = nome;
    const salaUrl = new URLSearchParams(location.search).get("sala");
    if (salaUrl) $("codigo").value = lerCodigo(salaUrl) || salaUrl;
    desenharRecentes();

    if (!configurado() || !window.supabase) {
      erro("erroLobby", !configurado()
        ? "Falta configurar o Supabase no arquivo config.js."
        : "Não foi possível carregar o Supabase. Confira a internet ou desative bloqueadores e recarregue a página.");
      $("criar").disabled = $("entrar").disabled = true;
      return;
    }
    sb = window.supabase.createClient(window.LP_CONFIG.url, window.LP_CONFIG.anonKey);

    $("criar").addEventListener("click", () => criarSala(false));
    $("criarFixa").addEventListener("click", () => criarSala(true));
    $("reencontroSalvar").addEventListener("click", salvarReencontro);
    $("reencontroMudar").addEventListener("click", () => { editandoData = true; desenharReencontro(estado); $("reencontroData").focus(); });
    $("guardar").addEventListener("click", abrirGuardar);
    $("abrirMusica").addEventListener("click", abrirMusica);
    $("formMusica").addEventListener("submit", salvarMusica);
    $("cancelarMusica").addEventListener("click", () => $("dlgMusica").close());
    $("trilhaTocar").addEventListener("click", tocarAqui);
    $("trilhaOutra").addEventListener("click", outraMusica);
    $("diarioCumpri").addEventListener("click", cumpriHoje);
    $("nivelDiario").addEventListener("change", () => { const v = $("nivelDiario").value; gravar(n => { n.nivelDiario = v; }); });
    setInterval(desenharDiario, 60000);   // vira o dia sozinho
    $("formCofre").addEventListener("submit", salvarCofre);
    $("cancelarCofre").addEventListener("click", () => $("dlgCofre").close());
    document.querySelectorAll('input[name="filtroCofre"]').forEach(r => r.addEventListener("change", desenharCofre));
    $("entrar").addEventListener("click", () => entrarSala($("codigo").value));
    $("codigo").addEventListener("keydown", ev => { if (ev.key === "Enter") entrarSala($("codigo").value); });
    $("sair").addEventListener("click", sair);
    $("spin").addEventListener("click", girar);
    $("pickV").addEventListener("click", () => escolher("verdade"));
    $("pickD").addEventListener("click", () => escolher("desafio"));
    $("done").addEventListener("click", cumprir);
    $("skip").addEventListener("click", pular);
    $("liberar").addEventListener("click", liberar);
    $("avaliar").addEventListener("click", ev => { const k = Number(ev.target.dataset && ev.target.dataset.n); if (k) avaliar(k); });
    $("notaAdv").addEventListener("change", mudarNota);
    $("timerIniciar").addEventListener("click", () => iniciarTimer(Number($("timerIniciar").dataset.seg)));
    $("timerAbrir").addEventListener("click", () => { $("timerOpcoes").hidden = !$("timerOpcoes").hidden; });
    $("timerOpcoes").addEventListener("click", ev => { const s = Number(ev.target.dataset && ev.target.dataset.seg); if (s) iniciarTimer(s); });
    $("timerPausar").addEventListener("click", pausarTimer);
    $("timerCancelar").addEventListener("click", cancelarTimer);
    $("novaPartida").addEventListener("click", novaPartida);
    $("meta").addEventListener("change", mudarMeta);
    $("eventos").addEventListener("change", mudarEventos);
    $("eventoFim").addEventListener("click", concluirEvento);
    $("reverso").addEventListener("click", usarReverso);
    $("efeitoAceitar").addEventListener("click", aceitarEfeito);
    $("efeitoRecusar").addEventListener("click", recusarEfeito);
    $("dueloComecar").addEventListener("click", comecarDuelo);
    $("sintoniaEnviar").addEventListener("click", enviarSintonia);
    $("minhaMissaoBtn").addEventListener("click", () => { missaoAberta = !missaoAberta; if (estado) desenharSecretas(estado); });
    $("mmCumpri").addEventListener("click", pedirMissao);
    $("cmSim").addEventListener("click", () => julgarMissao(true));
    $("cmNao").addEventListener("click", () => julgarMissao(false));
    $("duplaVotos").addEventListener("click", ev => { const v = ev.target.dataset && ev.target.dataset.v; if (v) votarDupla(v); });
    $("sintoniaJulgar").addEventListener("click", ev => { const j = ev.target.dataset && ev.target.dataset.j; if (j) julgarSintonia(j); });
    $("dueloVotos").addEventListener("click", ev => { const v = ev.target.dataset && ev.target.dataset.v; if (v) votarDuelo(v); });
    $("pulosMax").addEventListener("change", mudarPulosMax);
    $("niveis").addEventListener("change", mudarNiveis);
    $("abrirCarta").addEventListener("click", abrirDialogo);
    $("formCarta").addEventListener("submit", salvarCarta);
    $("cancelarCarta").addEventListener("click", () => $("dlgCarta").close());
    $("textoCarta").addEventListener("input", contarTexto);
    $("temMidia").addEventListener("change", () => { $("midiaCarta").hidden = !$("temMidia").checked; });
    $("copiar").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(linkSala(codigo)); $("copiar").textContent = "Link copiado"; }
      catch (e) { $("copiar").textContent = "Copie da barra de endereço"; }
      setTimeout(() => { $("copiar").textContent = "Copiar link"; }, 2500);
    });

    // voltou para o app depois de um tempo? pega o estado mais novo
    document.addEventListener("visibilitychange", async () => {
      if (document.visibilityState !== "visible" || !codigo) return;
      try { const e = await buscarSala(codigo); if (e) aplicar(e, false); } catch (e) {}
    });

    // link com ?sala= e nome já salvo: entra direto
    if (salaUrl && nome) entrarSala(salaUrl);
  }

  iniciar();
})();
