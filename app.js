// Longe & Perto — sala sincronizada via Supabase Realtime.
// Fonte da verdade: a linha da tabela `salas` (coluna `estado`). Cada ação grava o estado
// inteiro; os dois celulares escutam o UPDATE e redesenham.

(() => {
  const $ = id => document.getElementById(id);
  const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const SEGMENTOS = 8;
  const GIRO_MS = () => matchMedia("(prefers-reduced-motion: reduce)").matches ? 350 : 3300;
  const LEVEL_NAMES = { leve: "Leve", criativo: "Criativo", picante: "Picante", pesado: "Pesado +18" };
  const TIPO_NOMES = { verdade: "Verdade", desafio: "Desafio", prenda: "Prenda" };
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
  let timerLocal = null;    // { id, t0 } — início da contagem medido neste aparelho
  let timerTick = null;
  let timerAcabou = null;   // id do timer que já deu "Tempo!" aqui
  let timerAviso = null;
  let cartas = [];        // cartas padrão + cartas desta sala, vindas da tabela `cartas`
  let cartasOk = false;   // false até a busca terminar (ou se falhar)

  // ---------- util ----------
  const salvarLocal = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const lerLocal = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const mesmoNome = (a, b) => (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase();
  const gerarCodigo = () => Array.from({ length: 5 }, () => ALFABETO[Math.floor(Math.random() * ALFABETO.length)]).join("");
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
    // o cronômetro pertence à carta: saiu a carta (cumpri, pular, liberar, nova carta), sai o timer
    if ((novo.carta && novo.carta.chave) !== (estado.carta && estado.carta.chave)) novo.timer = null;
    aplicar(novo, false);
    const { error } = await sb.from("salas").update({ estado: novo }).eq("codigo", codigo);
    if (error) erro("erroJogo", "Não consegui salvar a jogada. Confira a internet e tente de novo.");
    else erro("erroJogo", "");
  }

  async function carregarCartas(c) {
    cartasOk = false;
    atualizarBotoes();
    const { data, error } = await sb.from("cartas")
      .select("id, sala, tipo, nivel, texto, midia, autor")
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
  }

  async function buscarSala(c) {
    const { data, error } = await sb.from("salas").select("estado").eq("codigo", c).maybeSingle();
    if (error) throw error;
    return data ? data.estado : null;
  }

  // ---------- entrar / criar ----------
  async function criarSala() {
    erro("erroLobby", "");
    const nome = $("nome").value.trim();
    if (!nome) return erro("erroLobby", "Digite seu nome para criar a sala.");
    salvarLocal("lp-nome", nome);
    const inicial = {
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
      const c = gerarCodigo();
      const { error } = await sb.from("salas").insert({ codigo: c, estado: inicial });
      if (!error) return abrirSala(c, 0, inicial);
      if (error.code !== "23505") return erro("erroLobby", "Não consegui criar a sala: " + error.message);
    }
    erro("erroLobby", "Não consegui gerar um código livre. Tente de novo.");
  }

  async function entrarSala(cRaw) {
    erro("erroLobby", "");
    const c = (cRaw || "").trim().toUpperCase();
    const nome = $("nome").value.trim();
    if (!/^[A-Z0-9]{5}$/.test(c)) return erro("erroLobby", "O código tem 5 letras ou números.");
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
    history.replaceState(null, "", "?sala=" + c);
    $("lobby").hidden = true;
    $("jogo").hidden = false;
    $("salaCodigo").textContent = c;
    const convite = `Bora jogar Longe & Perto? Entra na sala ${c}: ${linkSala(c)}`;
    $("convidarWa").href = "https://wa.me/?text=" + encodeURIComponent(convite);

    if (canal) sb.removeChannel(canal);
    canal = sb.channel("sala-" + c)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "salas", filter: `codigo=eq.${c}` },
        payload => { if (payload.new.codigo === c && codigo === c) aplicar(payload.new.estado, false); })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "cartas", filter: `sala=eq.${c}` },
        payload => juntarCarta(payload.new))
      // o Realtime não filtra DELETE; tirar pelo id basta (ids de outras salas não estão na lista)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "cartas" },
        payload => tirarCarta(payload.old && payload.old.id))
      .subscribe(status => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
          erro("erroJogo", "A conexão ao vivo caiu. Recarregue a página se a roleta parar de sincronizar.");
      });

    aplicar(e, true);
    carregarCartas(c);
  }

  function sair() {
    if (canal) { sb.removeChannel(canal); canal = null; }
    codigo = null; estado = null; eu = null;
    cartas = []; cartasOk = false;
    desenharExtras();
    clearTimeout(timerCarta);
    history.replaceState(null, "", location.pathname);
    $("jogo").hidden = true;
    $("lobby").hidden = false;
    $("codigo").value = "";
  }

  // ---------- placar ----------
  const placarVazio = (pontos, pulosMax) =>
    ({ pontos: pontos || 0, verdades: 0, desafios: 0, prendas: 0, liberadas: 0, livresV: pulosMax, livresD: pulosMax });

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
    return e;
  }

  // "zerado" = antes da primeira jogada ou logo depois de "Nova partida"
  const placarZerado = e => e.placar.every(p =>
    p.pontos === 0 && p.verdades === 0 && p.desafios === 0 && p.prendas === 0 && p.liberadas === 0 &&
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
    $("meta").disabled = $("pulosMax").disabled = !zerado;
    $("configDica").textContent = zerado ? "" : "Meta e pulos só mudam com o placar zerado (em Nova partida).";

    const fim = $("fim");
    fim.hidden = e.vencedor === null;
    if (e.vencedor !== null) $("venceu").textContent = `${nomes[e.vencedor]} venceu!`;
  }

  // ---------- render ----------
  function aplicar(e, inicial) {
    if (!e) return;
    estado = normalizar(e);
    mostrarAviso(e.aviso, inicial);
    avisarMinhaVez(e, inicial);
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
        requestAnimationFrame(() => posicionarRoleta(g.alvo, true));
        timerCarta = setTimeout(() => { girando = false; mostrarCarta(estado); atualizarBotoes(); }, GIRO_MS());
      }
    } else if (!girando) {
      mostrarCarta(e);
    }
    atualizarBotoes();
    desenharTimer(e, inicial);
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

  // vibra quando a vez muda para mim (não funciona no iPhone, e tudo bem)
  function avisarMinhaVez(e, inicial) {
    const minha = !!e.jogadores[1] && e.vez === eu && e.vencedor === null;
    if (!inicial && minha && ultimaVez !== eu) vibrar(200);
    ultimaVez = e.jogadores[1] ? e.vez : null;
  }

  const vibrar = padrao => { try { navigator.vibrate?.(padrao); } catch (err) {} };

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
    $("spin").disabled = travado;
    $("pickV").disabled = $("pickD").disabled = travado;

    // Pular: só em verdade/desafio; mostra quantos pulos grátis restam daquele tipo
    const p = estado.placar[estado.vez];
    $("done").hidden = !minhaVez;
    $("skip").hidden = !minhaVez || !c || c.tipo === "prenda";
    if (c && c.tipo !== "prenda") {
      const restam = c.tipo === "verdade" ? p.livresV : p.livresD;
      $("skip").textContent = restam > 0 ? `Pular (${restam} grátis)` : "Pular (paga prenda)";
    }
    // Liberar da prenda: só o adversário de quem está pagando
    $("liberar").hidden = !completa || minhaVez || !c || c.tipo !== "prenda";

    const ag = $("aguardando");
    ag.hidden = minhaVez;
    if (!minhaVez && completa) {
      const quem = estado.jogadores[estado.vez];
      ag.textContent = c && c.tipo === "prenda" ? `Aguardando ${quem} cumprir a prenda.` : `Aguardando ${quem} cumprir ou pular.`;
    }
  }

  function mostrarCarta(e) {
    const c = e && e.carta;
    const card = $("card");
    if (!c) { card.hidden = true; return; }
    const nome = e.jogadores[e.vez] || "";
    card.className = "card " + c.tipo;
    card.hidden = false;
    $("kind").textContent = ehPulo(c) ? (origemDe(c) === "desafio" ? "Prenda por pular o desafio" : "Prenda por pular a verdade")
      : c.motivo === "final" ? "Prenda final"
      : TIPO_NOMES[c.tipo] || c.tipo;
    $("level").textContent = "Nível " + (LEVEL_NAMES[c.nivel] || c.nivel)
      + (c.autor ? ", carta de " + c.autor : "") + ", para " + nome;
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
      const s = tempoDaCarta(c.texto);
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
    num.classList.toggle("fim", r > 0 && s <= 5);
    num.classList.toggle("tempo", r <= 0);
    if (r > 0) { num.textContent = relogio(s); return; }
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
  let audio = null;
  addEventListener("pointerdown", () => {
    if (audio) return;
    try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (err) {}
  }, { once: true });
  function bipe() {
    if (!audio) return;
    try {
      const o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.2, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.35);
      o.connect(g).connect(audio.destination);
      o.start(); o.stop(audio.currentTime + 0.35);
    } catch (err) {}
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
      const carta = sortear(tipo, n.niveis, n.usados || []);
      registrarUso(n, carta);
      n.carta = carta;
      n.giro = { id: Date.now() + "-" + Math.random().toString(36).slice(2, 7), alvo };
    });
  }

  function escolher(tipo) {
    if (!estado || girando || estado.vez !== eu || estado.carta || estado.vencedor !== null) return;
    if (!sortear(tipo, estado.niveis, [])) return erro("erroJogo", "Não consegui carregar as cartas. Recarregue a página.");
    gravar(n => {
      const carta = sortear(tipo, n.niveis, n.usados || []);
      registrarUso(n, carta);
      n.carta = carta;
    });
  }

  // Cumpri: soma pontos/contadores; prenda vale 0. Bater a meta encerra a partida com prenda final.
  function cumprir() {
    if (!estado || estado.vez !== eu || !estado.carta) return;
    gravar(n => {
      const c = n.carta, p = n.placar[n.vez];
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
        if (c.motivo !== "final") n.vez = 1 - n.vez;   // depois da prenda final a partida já acabou
      } else {
        p.pontos += (PONTOS[c.tipo] || {})[c.nivel] || 0;
        if (c.tipo === "verdade") p.verdades++; else p.desafios++;
        if (n.vencedor === null && p.pontos >= n.meta) {
          n.vencedor = n.vez;
          n.vez = 1 - n.vez;                              // quem perdeu cumpre a prenda final
          n.carta = prendaPara(n, "final");
        } else {
          n.vez = 1 - n.vez;
        }
      }
      n.pontos = n.placar.map(x => x.pontos);
    });
  }

  // Pular: com pulos livres do tipo, gasta um, descarta e passa a vez;
  // com o contador em 0, a carta vira prenda para a mesma pessoa, na mesma vez.
  function pular() {
    if (!estado || estado.vez !== eu || !estado.carta || estado.carta.tipo === "prenda") return;
    gravar(n => {
      const q = n.placar[n.vez];
      const campo = n.carta.tipo === "verdade" ? "livresV" : "livresD";
      if (q[campo] > 0) {
        q[campo]--;
        n.carta = null;
      } else {
        n.carta = prendaPara(n, "pulo", n.carta);
      }
      if (!n.carta) n.vez = 1 - n.vez;                 // pulo grátis (ou sem prendas carregadas): passa a vez
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
      n.carta = null;
      if (!final) n.vez = 1 - n.vez;                    // na prenda final a partida já acabou: fica o "Nova partida"
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
    });
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
    desenharRoleta();
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", desenharRoleta);

    const nome = lerLocal("lp-nome");
    if (nome) $("nome").value = nome;
    const salaUrl = new URLSearchParams(location.search).get("sala");
    if (salaUrl) $("codigo").value = salaUrl.toUpperCase();

    if (!configurado() || !window.supabase) {
      erro("erroLobby", !configurado()
        ? "Falta configurar o Supabase no arquivo config.js."
        : "Não foi possível carregar o Supabase. Confira a internet ou desative bloqueadores e recarregue a página.");
      $("criar").disabled = $("entrar").disabled = true;
      return;
    }
    sb = window.supabase.createClient(window.LP_CONFIG.url, window.LP_CONFIG.anonKey);

    $("criar").addEventListener("click", criarSala);
    $("entrar").addEventListener("click", () => entrarSala($("codigo").value));
    $("codigo").addEventListener("keydown", ev => { if (ev.key === "Enter") entrarSala($("codigo").value); });
    $("sair").addEventListener("click", sair);
    $("spin").addEventListener("click", girar);
    $("pickV").addEventListener("click", () => escolher("verdade"));
    $("pickD").addEventListener("click", () => escolher("desafio"));
    $("done").addEventListener("click", cumprir);
    $("skip").addEventListener("click", pular);
    $("liberar").addEventListener("click", liberar);
    $("timerIniciar").addEventListener("click", () => iniciarTimer(Number($("timerIniciar").dataset.seg)));
    $("timerAbrir").addEventListener("click", () => { $("timerOpcoes").hidden = !$("timerOpcoes").hidden; });
    $("timerOpcoes").addEventListener("click", ev => { const s = Number(ev.target.dataset && ev.target.dataset.seg); if (s) iniciarTimer(s); });
    $("timerPausar").addEventListener("click", pausarTimer);
    $("timerCancelar").addEventListener("click", cancelarTimer);
    $("novaPartida").addEventListener("click", novaPartida);
    $("meta").addEventListener("change", mudarMeta);
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
