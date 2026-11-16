import re

with open("app.js", "r", encoding="utf-8") as f:
    text = f.read()

# 1. som
text = text.replace(
    'innerHTML = `<svg class="i" aria-hidden="true"><use href="#i-${somLigado ? "som" : "mudo"}"/></svg><span>${somLigado ? "Som e vibração ligados" : "Som e vibração desligados"}</span>`',
    'innerHTML = `<svg class="icone icone-20" aria-hidden="true"><use href="icones.svg#${somLigado ? "volume-2" : "volume-x"}"/></svg><span>${somLigado ? "Som e vibração ligados" : "Som e vibração desligados"}</span>`'
)

# 2. estrelas na massagem (estrelas desenhadas em SVG)
old_massagem_btn = 'const b = el("button", "", "★".repeat(v)); b.type = "button"; b.setAttribute("aria-label", `${v} ${v === 1 ? "estrela" : "estrelas"}`);'
new_massagem_btn = 'const b = el("button", "estrela-btn"); b.type = "button"; b.setAttribute("aria-label", `${v} ${v === 1 ? "estrela" : "estrelas"}`); for (let k = 0; k < v; k++) { b.appendChild(icone("star", 20, "icone-estrela-cheia")); }'
text = text.replace(old_massagem_btn, new_massagem_btn)

# 3. estrela de favorito no album
old_fav = 'const fav = el("button", "estrela" + (m.favorito ? " on" : ""), m.favorito ? "★" : "☆");'
new_fav = 'const fav = el("button", "estrela" + (m.favorito ? " on" : "")); fav.appendChild(icone("star", 18, m.favorito ? "icone-estrela-cheia" : ""));'
text = text.replace(old_fav, new_fav)

# 4. modoBtn
old_modo = 'b.textContent = j ? "💞 Juntos" : "📍 A distância";'
new_modo = 'b.innerHTML = j ? iconeHtml("heart", 16) + " <span>Juntos</span>" : iconeHtml("map-pin", 16) + " <span>A distância</span>";'
text = text.replace(old_modo, new_modo)

# 5. chamadaBtn
old_ch = '$("chamadaBtn").textContent = lig ? "⏹ Encerrar chamada" : "📞 Em chamada agora";'
new_ch = '$("chamadaBtn").innerHTML = lig ? iconeHtml("square", 16) + " <span>Encerrar chamada</span>" : iconeHtml("phone", 16) + " <span>Em chamada agora</span>";'
text = text.replace(old_ch, new_ch)

# 6. secretaBtn
old_sec = '$("secretaBtn").textContent = e.secretaProx === eu ? "🔒 Carta secreta: ligada" : "🔒 Carta secreta";'
new_sec = '$("secretaBtn").innerHTML = e.secretaProx === eu ? iconeHtml("lock", 16) + " <span>Carta secreta: ligada</span>" : iconeHtml("lock", 16) + " <span>Carta secreta</span>";'
text = text.replace(old_sec, new_sec)

with open("app.js", "w", encoding="utf-8") as f:
    f.write(text)

print("app.js atualizado para Fase 2 com sucesso!")
