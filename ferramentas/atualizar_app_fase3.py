import re

with open("app.js", "r", encoding="utf-8") as f:
    text = f.read()

# 1. TIPO_FATURA: ícones no lugar de emojis
text = text.replace(
    'const TIPO_FATURA = { vale: "🎟️", prenda: "🧾", promessa: "💞" };',
    'const TIPO_FATURA = { vale: "ticket", prenda: "receipt", promessa: "heart" };'
)
# Onde usa TIPO_FATURA para exibir texto do resgate
text = text.replace(
    '$("resgateTexto").textContent = `${TIPO_FATURA[x.tipo] || "💞"} ${x.carta}`;',
    '$("resgateTexto").innerHTML = iconeHtml(TIPO_FATURA[x.tipo] || "heart", 20) + " " + el("span", "", x.carta).outerHTML;'
)

# 2. RESULTADOS (apostas da cápsula) e RESULTADO_HIST
text = text.replace(
    'const RESULTADOS = { acertou: "✓ Acertou", quase: "≈ Quase", errou: "✗ Errou" };',
    'const RESULTADOS = { acertou: "Acertou", quase: "Quase", errou: "Errou" };'
)
text = text.replace(
    'const RESULTADO_HIST = { cumpriu: "✓ cumpriu", pulou: "⏭ pulou", liberado: "🕊 liberado", revertida: "🔄 revertida", "em jogo": "✨ efeito em jogo", passou: "" };',
    'const RESULTADO_HIST = { cumpriu: "cumpriu", pulou: "pulou", liberado: "liberado", revertida: "revertida", "em jogo": "efeito em jogo", passou: "" };'
)

# 3. Selo da carta e título da carta (morte súbita, cegas, reverso)
text = text.replace(
    '$("selo").textContent = !c.evento ? "" : c.tipo === "missao_dupla" ? "⚡ Evento especial · 🤝 Missão em dupla" : c.tipo === "sequencia" ? "⚡ Evento especial · 🔗 Em etapas" : "⚡ Evento especial";',
    '$("selo").textContent = !c.evento ? "" : c.tipo === "missao_dupla" ? "Evento especial · Missão em dupla" : c.tipo === "sequencia" ? "Evento especial · Em etapas" : "Evento especial";'
)
text = text.replace(
    ': c.reversa ? `🔄 Reverso de ${e.jogadores[c.revertidaPor] || ""} · ${TIPO_NOMES[c.tipo] || c.tipo}`',
    ': c.reversa ? `Reverso de ${e.jogadores[c.revertidaPor] || ""} · ${TIPO_NOMES[c.tipo] || c.tipo}`'
)
text = text.replace(
    ': c.cega ? `🂠 Escolhida às cegas · ${TIPO_NOMES[c.tipo] || c.tipo}`',
    ': c.cega ? `Escolhida às cegas · ${TIPO_NOMES[c.tipo] || c.tipo}`'
)
text = text.replace(
    '+ (e.emMorteSubita && (c.tipo === "verdade" || c.tipo === "desafio") ? " · ⚡ vale o dobro" : "");',
    '+ (e.emMorteSubita && (c.tipo === "verdade" || c.tipo === "desafio") ? " · vale o dobro" : "");'
)

# 4. TEMAS da escolha às cegas (remover emojis do rótulo)
text = text.replace(
    'const TEMAS = { camera: "📸 Câmera", provocacao: "🔥 Provocação", criatividade: "🎨 Criatividade", carinho: "💗 Carinho", conversa: "🗣️ Conversa", diversao: "😂 Diversão" };',
    'const TEMAS = { camera: "Câmera", provocacao: "Provocação", criatividade: "Criatividade", carinho: "Carinho", conversa: "Conversa", diversao: "Diversão" };'
)

# 5. Avisos de morte súbita
text = text.replace('"⚡ Morte súbita! Próxima carta decide"', '"Morte súbita! Próxima carta decide"')
text = text.replace('"⚡ Empate de novo! Mais uma carta para cada um"', '"Empate de novo! Mais uma carta para cada um"')
text = text.replace('`⚡ ${n.jogadores[w]} venceu a morte súbita!`', '`${n.jogadores[w]} venceu a morte súbita!`')

# 6. Conquistas: ícone de linha em itemConquista
old_conq_title = 'box.append(el("b", "", (feitas.some(Boolean) ? (c.selo || "🏆") + " " : "🔒 ") + c.titulo), el("span", "desc", c.descricao));'
new_conq_title = '''const tituloB = el("b", "");
    const icNome = feitas.some(Boolean) ? (c.selo || "trophy") : "lock";
    tituloB.appendChild(icone(icNome, 18));
    tituloB.append(" " + c.titulo);
    box.append(tituloB, el("span", "desc", c.descricao));'''
text = text.replace(old_conq_title, new_conq_title)

# Selos de chamada em ch-selos
old_ch_selos = 'selos.forEach(c => { const f = linhaConquista(c.codigo, null); const x = el("span", "ch-selo" + (f ? " ok" : ""), `${f ? c.selo : "🔒"} ${c.titulo}`); x.title = c.descricao; s.append(x); });'
new_ch_selos = '''selos.forEach(c => {
        const f = linhaConquista(c.codigo, null);
        const x = el("span", "ch-selo" + (f ? " ok" : ""));
        x.appendChild(icone(f ? (c.selo || "trophy") : "lock", 16));
        x.append(" " + c.titulo);
        x.title = c.descricao;
        s.append(x);
      });'''
text = text.replace(old_ch_selos, new_ch_selos)

with open("app.js", "w", encoding="utf-8") as f:
    f.write(text)

print("app.js atualizado para Fase 3 com sucesso!")
