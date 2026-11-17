with open("index.html", "r", encoding="utf-8") as f:
    text = f.read()

text = text.replace(
    '<button class="primary" id="dadoRolar" type="button"><span aria-hidden="true">🎲</span> Rolar o dado</button>',
    '<button class="primary" id="dadoRolar" type="button"><svg class="icone icone-16" aria-hidden="true"><use href="icones.svg#dices"/></svg> <span>Rolar o dado</span></button>'
)
text = text.replace(
    '<button class="secondary secreta-btn" id="secretaBtn" type="button" aria-pressed="false" hidden><span aria-hidden="true">🔒</span> Carta secreta</button>',
    '<button class="secondary secreta-btn" id="secretaBtn" type="button" aria-pressed="false" hidden><svg class="icone icone-16" aria-hidden="true"><use href="icones.svg#lock"/></svg> <span>Carta secreta</span></button>'
)
text = text.replace(
    '<button class="secondary reverso" id="reverso" type="button" hidden><span aria-hidden="true">🔄</span> Reverso</button>',
    '<button class="secondary reverso" id="reverso" type="button" hidden><svg class="icone icone-16" aria-hidden="true"><use href="icones.svg#refresh-cw"/></svg> <span>Reverso</span></button>'
)
text = text.replace(
    '<button class="secondary" id="deixarReencontro" type="button" hidden><span aria-hidden="true">🧾</span> Deixar para o reencontro</button>',
    '<button class="secondary" id="deixarReencontro" type="button" hidden><svg class="icone icone-16" aria-hidden="true"><use href="icones.svg#receipt"/></svg> <span>Deixar para o reencontro</span></button>'
)
text = text.replace(
    '<button class="secondary" id="silencioBtn" type="button" hidden><span aria-hidden="true">🤫</span> Valendo silêncio</button>',
    '<button class="secondary" id="silencioBtn" type="button" hidden><svg class="icone icone-16" aria-hidden="true"><use href="icones.svg#eye-off"/></svg> <span>Valendo silêncio</span></button>'
)

with open("index.html", "w", encoding="utf-8") as f:
    f.write(text)

print("index.html botões de ação do jogo atualizados!")
