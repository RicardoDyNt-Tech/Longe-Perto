import re

with open("index.html", "r", encoding="utf-8") as f:
    text = f.read()

# 1. Substituir botões de voltar ← Início
new_text = re.sub(
    r'<button type="button" class="linkbtn voltar" data-abre="casa">← Início</button>',
    '<button type="button" class="linkbtn voltar" data-abre="casa"><svg class="icone icone-16" aria-hidden="true"><use href="icones.svg#chevron-left"/></svg> Início</button>',
    text
)
# 2. Substituir botões de fechar ✕
new_text = new_text.replace(
    '<button class="linkbtn" id="carinhoResumoFechar" type="button" aria-label="Fechar resumo">✕</button>',
    '<button class="linkbtn" id="carinhoResumoFechar" type="button" aria-label="Fechar resumo"><svg class="icone icone-16" aria-hidden="true"><use href="icones.svg#x"/></svg></button>'
)
new_text = new_text.replace(
    '<button class="linkbtn" id="faixaHumorFechar" type="button" aria-label="Fechar sugestão">✕</button>',
    '<button class="linkbtn" id="faixaHumorFechar" type="button" aria-label="Fechar sugestão"><svg class="icone icone-16" aria-hidden="true"><use href="icones.svg#x"/></svg></button>'
)
# 3. Atualizar barra inferior nav-in
new_text = new_text.replace(
    '<button type="button" data-abre="casa" id="abaCasa"><svg class="ic" aria-hidden="true"><use href="#i-casa"/></svg>Início</button>',
    '<button type="button" data-abre="casa" id="abaCasa"><svg class="icone icone-24 ic" aria-hidden="true"><use href="icones.svg#house"/></svg>Início</button>'
)
new_text = new_text.replace(
    '<button type="button" data-abre="jogo" id="abaJogo"><svg class="ic" aria-hidden="true"><use href="#i-jogo"/></svg>Jogo</button>',
    '<button type="button" data-abre="jogo" id="abaJogo"><svg class="icone icone-24 ic" aria-hidden="true"><use href="icones.svg#dices"/></svg>Jogo</button>'
)
new_text = new_text.replace(
    '<button type="button" data-abre="vHistorico" id="abaHistorico"><svg class="ic" aria-hidden="true"><use href="#i-hist"/></svg>Histórico</button>',
    '<button type="button" data-abre="vHistorico" id="abaHistorico"><svg class="icone icone-24 ic" aria-hidden="true"><use href="icones.svg#history"/></svg>Histórico</button>'
)
new_text = new_text.replace(
    '<button type="button" data-abre="vPerfil" id="abaPerfil"><svg class="ic" aria-hidden="true"><use href="#i-perfil"/></svg>Perfil</button>',
    '<button type="button" data-abre="vPerfil" id="abaPerfil"><svg class="icone icone-24 ic" aria-hidden="true"><use href="icones.svg#user"/></svg>Perfil</button>'
)
new_text = new_text.replace(
    '<button type="button" class="nav-recolher" id="navRecolher" aria-label="Recolher a barra" hidden><svg class="i" aria-hidden="true"><use href="#i-baixo"/></svg></button>',
    '<button type="button" class="nav-recolher" id="navRecolher" aria-label="Recolher a barra" hidden><svg class="icone icone-20" aria-hidden="true"><use href="icones.svg#arrow-down"/></svg></button>'
)
new_text = new_text.replace(
    '<button type="button" class="nav-mostrar" id="navMostrar" hidden><svg class="i" aria-hidden="true"><use href="#i-cima"/></svg> Menu</button>',
    '<button type="button" class="nav-mostrar" id="navMostrar" hidden><svg class="icone icone-16" aria-hidden="true"><use href="icones.svg#arrow-up"/></svg> Menu</button>'
)

# 4. Topo da sala e fechar folha
new_text = new_text.replace(
    '<button class="topo-mais" id="abrirMenuSala" type="button" aria-haspopup="dialog" aria-label="Opções da sala"><svg class="i" aria-hidden="true"><use href="#i-mais"/></svg></button>',
    '<button class="topo-mais" id="abrirMenuSala" type="button" aria-haspopup="dialog" aria-label="Opções da sala"><svg class="icone icone-20" aria-hidden="true"><use href="icones.svg#settings"/></svg></button>'
)
new_text = new_text.replace(
    '<button class="folha-fechar" id="fecharMenuSala" type="button" aria-label="Fechar"><svg class="i" aria-hidden="true"><use href="#i-fechar"/></svg></button>',
    '<button class="folha-fechar" id="fecharMenuSala" type="button" aria-label="Fechar"><svg class="icone icone-20" aria-hidden="true"><use href="icones.svg#x"/></svg></button>'
)

# 5. Marcas da carta (favorita, repetir, aposentada)
new_text = new_text.replace(
    '<button type="button" data-marca="favorita" aria-pressed="false" title="Favoritar" aria-label="Favoritar"><svg class="i" aria-hidden="true"><use href="#i-estrela"/></svg></button>',
    '<button type="button" data-marca="favorita" aria-pressed="false" title="Favoritar" aria-label="Favoritar"><svg class="icone icone-20 icone-estrela" aria-hidden="true"><use href="icones.svg#star"/></svg></button>'
)
new_text = new_text.replace(
    '<button type="button" data-marca="repetir" aria-pressed="false" title="Jogar de novo" aria-label="Jogar de novo"><svg class="i" aria-hidden="true"><use href="#i-repetir"/></svg></button>',
    '<button type="button" data-marca="repetir" aria-pressed="false" title="Jogar de novo" aria-label="Jogar de novo"><svg class="icone icone-20" aria-hidden="true"><use href="icones.svg#refresh-cw"/></svg></button>'
)
new_text = new_text.replace(
    '<button type="button" data-marca="aposentada" aria-pressed="false" title="Aposentar" aria-label="Aposentar"><svg class="i" aria-hidden="true"><use href="#i-aposentar"/></svg></button>',
    '<button type="button" data-marca="aposentada" aria-pressed="false" title="Aposentar" aria-label="Aposentar"><svg class="icone icone-20" aria-hidden="true"><use href="icones.svg#ban"/></svg></button>'
)

# 6. Avaliação de estrelas na massagem/desafio
new_text = new_text.replace(
    '<button type="button" data-n="1" aria-label="1 estrela">★</button>',
    '<button type="button" data-n="1" aria-label="1 estrela"><svg class="icone icone-20 icone-estrela-cheia" aria-hidden="true"><use href="icones.svg#star"/></svg></button>'
)
new_text = new_text.replace(
    '<button type="button" data-n="2" aria-label="2 estrelas">★★</button>',
    '<button type="button" data-n="2" aria-label="2 estrelas"><svg class="icone icone-20 icone-estrela-cheia" aria-hidden="true"><use href="icones.svg#star"/></svg><svg class="icone icone-20 icone-estrela-cheia" aria-hidden="true"><use href="icones.svg#star"/></svg></button>'
)
new_text = new_text.replace(
    '<button type="button" data-n="3" aria-label="3 estrelas">★★★</button>',
    '<button type="button" data-n="3" aria-label="3 estrelas"><svg class="icone icone-20 icone-estrela-cheia" aria-hidden="true"><use href="icones.svg#star"/></svg><svg class="icone icone-20 icone-estrela-cheia" aria-hidden="true"><use href="icones.svg#star"/></svg><svg class="icone icone-20 icone-estrela-cheia" aria-hidden="true"><use href="icones.svg#star"/></svg></button>'
)

# 7. Cadeado da carta secreta
new_text = new_text.replace(
    '<p class="secreta-dica" id="secretaDica" hidden><span aria-hidden="true">🔒</span> Carta secreta</p>',
    '<p class="secreta-dica" id="secretaDica" hidden><svg class="icone icone-16" aria-hidden="true"><use href="icones.svg#lock"/></svg> Carta secreta</p>'
)

# 8. Modos e opções da sala
new_text = new_text.replace(
    '<button class="modo-btn" id="modoBtn" type="button" hidden aria-pressed="false"><span aria-hidden="true">📍</span> A distância</button>',
    '<button class="modo-btn" id="modoBtn" type="button" hidden aria-pressed="false"><svg class="icone icone-16" aria-hidden="true"><use href="icones.svg#map-pin"/></svg> <span>A distância</span></button>'
)
new_text = new_text.replace(
    '<label class="check um-celular" id="umCelularLinha" hidden><input type="checkbox" id="umCelular"> <span aria-hidden="true">📱</span> Jogar num celular só</label>',
    '<label class="check um-celular" id="umCelularLinha" hidden><input type="checkbox" id="umCelular"> <svg class="icone icone-16" aria-hidden="true"><use href="icones.svg#smartphone"/></svg> <span>Jogar num celular só</span></label>'
)
new_text = new_text.replace(
    '<button class="chamada-btn" id="chamadaBtn" type="button" aria-pressed="false"><span aria-hidden="true">📞</span> Em chamada agora</button>',
    '<button class="chamada-btn" id="chamadaBtn" type="button" aria-pressed="false"><svg class="icone icone-16" aria-hidden="true"><use href="icones.svg#phone"/></svg> <span>Em chamada agora</span></button>'
)

# 9. Botões de ação com ✓
new_text = new_text.replace(
    '<button class="done" id="resgateQuitar" type="button" hidden>Quitado ✓</button>',
    '<button class="done" id="resgateQuitar" type="button" hidden><svg class="icone icone-16" aria-hidden="true"><use href="icones.svg#check"/></svg> Quitado</button>'
)
new_text = new_text.replace(
    '<button class="done" id="cumprirSim" type="button">Cumprimos ✓</button>',
    '<button class="done" id="cumprirSim" type="button"><svg class="icone icone-16" aria-hidden="true"><use href="icones.svg#check"/></svg> Cumprimos</button>'
)
new_text = new_text.replace(
    '<button class="done" id="seqFeito" type="button">Feito ✓</button>',
    '<button class="done" id="seqFeito" type="button"><svg class="icone icone-16" aria-hidden="true"><use href="icones.svg#check"/></svg> Feito</button>'
)
new_text = new_text.replace(
    '<button type="button" data-filtro="favoritos" aria-pressed="false">★ Favoritos</button>',
    '<button type="button" data-filtro="favoritos" aria-pressed="false"><svg class="icone icone-16 icone-estrela-cheia" aria-hidden="true"><use href="icones.svg#star"/></svg> Favoritos</button>'
)
new_text = new_text.replace(
    '<h3 class="casa-h3"><span aria-hidden="true">🚫</span> Aposentadas <span id="baralhoAposQtd"></span></h3>',
    '<h3 class="casa-h3"><svg class="icone icone-16" aria-hidden="true"><use href="icones.svg#ban"/></svg> Aposentadas <span id="baralhoAposQtd"></span></h3>'
)

# 10. Favicon no head
new_text = re.sub(
    r'<link rel="icon" href="data:image/svg\+xml.*?>',
    '<link rel="icon" href="icons/marca.svg" type="image/svg+xml">',
    new_text
)

with open("index.html", "w", encoding="utf-8") as f:
    f.write(new_text)

print("index.html atualizado para Fase 2 com sucesso!")
