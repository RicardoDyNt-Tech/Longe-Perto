// Longe & Perto — camada nativa do app Android (Capacitor).
// Fora do APK (no navegador) não faz nada. Dentro do APK, cada recurso confere se o plugin
// existe naquele aparelho (o site pode ser mais novo que o APK instalado).
(function () {
  const C = window.Capacitor;
  if (!C || typeof C.isNativePlatform !== "function" || !C.isNativePlatform()) return;
  const plugin = nome => (typeof C.isPluginAvailable === "function" && C.isPluginAvailable(nome) && C.Plugins && C.Plugins[nome]) || null;
  const $ = id => document.getElementById(id);
  document.documentElement.dataset.app = "android";

  // ---------- botão voltar: fecha o que estiver aberto antes de sair ----------
  function voltar() {
    const dialogos = [...document.querySelectorAll("dialog[open]")];
    if (dialogos.length) { dialogos[dialogos.length - 1].close(); return; }
    // telas por cima de tudo
    const telas = [["nossoAno", "naFechar"], ["companhia", "compSair"]];
    for (const [tela, botao] of telas) if ($(tela) && !$(tela).hidden) { $(botao).click(); return; }
    if ($("callCard") && !$("callCard").hidden) { $("callCard").hidden = true; return; }
    if ($("descongelar") && !$("descongelar").hidden) return;   // o descongelar se fecha pelos botões dele
    // uma tela da Casa aberta: o "← Início" dela
    const vistaAberta = [...document.querySelectorAll(".casa-vista:not(.aba-vista)")].find(v => !v.hidden);
    const voltarBtn = vistaAberta && vistaAberta.querySelector(".voltar");
    if (voltarBtn) { voltarBtn.click(); return; }
    // outra aba (Jogo, Histórico, Perfil): volta para o Início
    const aba = $("abaCasa"), atual = document.querySelector('#navBaixo [aria-current="page"]');
    if (aba && !aba.hidden && $("jogo") && !$("jogo").hidden && atual && atual !== aba) { aba.click(); return; }
    // nada aberto: o app vai para segundo plano (sem fechar a sala)
    const App = plugin("App");
    if (App) App.minimizeApp();
  }

  // ---------- links externos (Spotify, WhatsApp, imagens): abrem fora do app ----------
  // Navegar para um endereço fora do allowNavigation faz o Android abrir o app certo ou o navegador.
  document.addEventListener("click", ev => {
    const a = ev.target.closest && ev.target.closest("a[href]");
    if (!a) return;
    let url;
    try { url = new URL(a.href, location.href); } catch (err) { return; }
    if (url.origin === location.origin || !/^(https?|whatsapp|intent|spotify):$/.test(url.protocol)) return;
    ev.preventDefault();
    location.href = url.href;
  }, true);

  // ---------- barra de status: ícones claros ou escuros conforme o fundo ----------
  function corDoFundo() {
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(getComputedStyle(document.body).backgroundColor || "");
    if (!m) return true;
    const [r, g, b] = m.slice(1).map(Number);
    return (0.299 * r + 0.587 * g + 0.114 * b) < 140;   // escuro?
  }
  let estiloAtual = null;
  function ajustarBarra() {
    const SB = plugin("StatusBar");
    if (!SB || !document.body) return;
    const estilo = corDoFundo() ? "DARK" : "LIGHT";   // DARK = ícones claros, para fundo escuro
    if (estilo === estiloAtual) return;
    estiloAtual = estilo;
    SB.setStyle({ style: estilo }).catch(() => {});
  }

  // ---------- primeira vez no app: entrar na mesma sala do navegador ----------
  function boasVindas() {
    const lobby = $("lobby");
    let salas = [];
    try { salas = JSON.parse(localStorage.getItem("lp-salas")) || []; } catch (err) {}
    if (!lobby || salas.length || localStorage.getItem("lp-app-boasvindas")) return;
    const box = document.createElement("div");
    box.className = "app-boasvindas";
    const t = document.createElement("p"); t.className = "app-bv-titulo"; t.textContent = "📱 Já joga no navegador?";
    const p1 = document.createElement("p"); p1.textContent = "O app é como um navegador novo: entre na mesma sala digitando o código (ou o nome) da sala logo abaixo, ou colando o link de convite.";
    const p2 = document.createElement("p"); p2.textContent = "Quem é dono da sala: depois de entrar, abra as Configurações e use \"👑 Entrar como dono\".";
    const ok = document.createElement("button"); ok.type = "button"; ok.className = "secondary"; ok.textContent = "Entendi";
    ok.addEventListener("click", () => { try { localStorage.setItem("lp-app-boasvindas", "1"); } catch (err) {} box.remove(); });
    box.append(t, p1, p2, ok);
    lobby.prepend(box);
  }
  // colar o link de convite no campo do código também funciona (o campo tem limite de 30 letras, então lê o que foi colado)
  document.addEventListener("paste", ev => {
    if (!ev.target || ev.target.id !== "codigo" || !ev.clipboardData) return;
    const m = /[?&]sala=([^&#\s]+)/.exec(ev.clipboardData.getData("text") || "");
    if (!m) return;
    ev.preventDefault();
    ev.target.value = decodeURIComponent(m[1]).slice(0, 30);
    ev.target.dispatchEvent(new Event("input", { bubbles: true }));
  });

  // ---------- voltar depois de 30 min em segundo plano: recarrega o site (versão nova, se houver) ----------
  let saiuEm = 0;
  function estadoDoApp(s) {
    if (!s.isActive) { saiuEm = Date.now(); return; }
    if (saiuEm && Date.now() - saiuEm > 30 * 60000) location.reload();
    saiuEm = 0;
  }

  function iniciar() {
    const App = plugin("App");
    if (App) {
      App.addListener("backButton", voltar);
      App.addListener("appStateChange", estadoDoApp);
    }
    boasVindas();
    ajustarBarra();
    new MutationObserver(ajustarBarra).observe(document.body, { attributes: true, attributeFilter: ["data-modo", "class", "style"] });
    if (window.matchMedia) matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { estiloAtual = null; ajustarBarra(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar); else iniciar();
})();
