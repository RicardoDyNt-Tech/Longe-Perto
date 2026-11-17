import re

with open("app.js", "r", encoding="utf-8") as f:
    text = f.read()

# Substituir emojis de interface e botões de jogo por texto limpo ou ícones
text = text.replace(
    '$("passeTitulo").textContent = segredo ? `Agora é a vez de ${nome}, não espie 🙈` : `Passe para ${nome} 💞`;',
    '$("passeTitulo").textContent = segredo ? `Agora é a vez de ${nome}, não espie` : `Passe para ${nome}`;'
)

text = text.replace(
    '$("vendadaAviso").textContent = !v ? "" : leitor ? `🙈 Leia para ${quem} em voz alta (+1 ponto se cumprir sem espiar)` : "De olhos vendados (+1 ponto se cumprir sem espiar)";',
    '$("vendadaAviso").textContent = !v ? "" : leitor ? `Leia para ${quem} em voz alta (+1 ponto se cumprir sem espiar)` : "De olhos vendados (+1 ponto se cumprir sem espiar)";'
)

text = text.replace(
    '$("dadoRolar").textContent = d ? "🎲 Rolar de novo" : "🎲 Rolar o dado";',
    '$("dadoRolar").innerHTML = iconeHtml("dices", 16) + (d ? " <span>Rolar de novo</span>" : " <span>Rolar o dado</span>");'
)

text = text.replace(
    '$("vendadoTexto").textContent = vd ? `🙈 A próxima carta de ${nome(vd.jogador)} vai de olhos vendados (+1 ponto)`',
    '$("vendadoTexto").textContent = vd ? `A próxima carta de ${nome(vd.jogador)} vai de olhos vendados (+1 ponto)`'
)

text = text.replace(
    '$("vendadoLigar").textContent = `🙈 Vendar ${nome(e.vez)} na próxima carta`;',
    '$("vendadoLigar").textContent = `Vendar ${nome(e.vez)} na próxima carta`;'
)

text = text.replace(
    '$("quenteTexto").textContent = `🏆 ${nome(q.vencedor)} venceu o quente ou frio!`;',
    '$("quenteTexto").textContent = `${nome(q.vencedor)} venceu o quente ou frio!`;'
)

text = text.replace(
    '$("dadoRelogio").textContent = r > 0 ? relogioMs(r) : "Tempo! ⏰";',
    '$("dadoRelogio").textContent = r > 0 ? relogioMs(r) : "Tempo!";'
)

text = text.replace(
    '$("massagemRelogio").textContent = m.terminou ? "Terminou" : r > 0 ? relogioMs(r) : "Tempo! ⏰";',
    '$("massagemRelogio").textContent = m.terminou ? "Terminou" : r > 0 ? relogioMs(r) : "Tempo!";'
)

text = text.replace(
    '$("resgateIniciar").textContent = `⏱️ Começar (${x.minutos} min)`;',
    '$("resgateIniciar").innerHTML = iconeHtml("timer", 16) + ` <span>Começar (${x.minutos} min)</span>`;'
)

text = text.replace(
    '$("resgateTimer").textContent = s ? relogioMs(s * 1000) : "Tempo! ⏰";',
    '$("resgateTimer").textContent = s ? relogioMs(s * 1000) : "Tempo!";'
)

text = text.replace(
    'if (w === null) { n.aviso = novoAviso("🔥 Empate na rodada!"); return; }',
    'if (w === null) { n.aviso = novoAviso("Empate na rodada!"); return; }'
)

text = text.replace(
    'n.aviso = novoAviso(`🔥 ${n.jogadores[w]} venceu a rodada (${x.vitorias[0]} × ${x.vitorias[1]})`);',
    'n.aviso = novoAviso(`${n.jogadores[w]} venceu a rodada (${x.vitorias[0]} × ${x.vitorias[1]})`);'
)

with open("app.js", "w", encoding="utf-8") as f:
    f.write(text)

print("app.js strings de jogo limpas com sucesso!")
