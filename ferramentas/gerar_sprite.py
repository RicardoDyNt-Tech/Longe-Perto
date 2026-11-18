import urllib.request
import re

icons = [
    'alarm-clock', 'angry', 'arrow-down', 'arrow-up', 'arrow-up-right', 'baby', 'ban', 'bath', 'battery-low', 'bed',
    'book-open', 'bot', 'briefcase', 'cake', 'calendar', 'calendar-heart', 'camera', 'check', 'chevron-left', 'chevron-right',
    'clapperboard', 'cloud-moon', 'cloud-sun', 'coffee', 'crown', 'dices', 'door-open', 'drama', 'droplets', 'eye',
    'eye-off', 'feather', 'film', 'flame', 'flask-conical', 'flower-2', 'frame', 'frown', 'gem', 'gift',
    'graduation-cap', 'guitar', 'hand-heart', 'handshake', 'heart', 'heart-handshake', 'history', 'hourglass', 'house',
    'ice-cream-cone', 'key-round', 'lamp', 'laugh', 'leaf', 'lightbulb', 'link', 'lock', 'mail', 'map', 'map-pin',
    'martini', 'meh', 'message-circle', 'message-circle-heart', 'mic', 'moon', 'moon-star', 'music', 'music-2', 'palette',
    'party-popper', 'paw-print', 'pencil', 'phone', 'plane', 'popcorn', 'receipt', 'refresh-cw', 'ribbon', 'sandwich',
    'scroll-text', 'search', 'settings', 'shirt', 'shopping-basket', 'shower-head', 'skip-forward', 'smartphone', 'smile',
    'snowflake', 'sofa', 'sparkles', 'square', 'square-stack', 'star', 'sun', 'sunrise', 'sunset', 'target',
    'thermometer', 'ticket', 'timer', 'tree-palm', 'trophy', 'tv', 'user', 'users', 'utensils', 'utensils-crossed',
    'volume-2', 'volume-x', 'wine', 'x', 'zap',
    # Investigacao (casos + UI)
    'alert-circle', 'anchor', 'anvil', 'award', 'bike', 'bird', 'building', 'bus', 'castle', 'clock',
    'compass', 'container', 'copy', 'cpu', 'croissant', 'cross', 'door-closed', 'egg', 'file-text', 'fish',
    'flame-kindling', 'flask-round', 'flower', 'folder', 'footprints', 'headphones', 'help-circle', 'hospital', 'mountain', 'newspaper',
    'orbit', 'phone-off', 'pickaxe', 'pin', 'play', 'plus', 'radio', 'rocket', 'rotate-ccw', 'sailboat',
    'satellite', 'scale', 'scan-face', 'scroll', 'shield-alert', 'ship', 'spade', 'stamp', 'swords', 'tornado',
    'train-front', 'trash-2', 'trees', 'unlock', 'user-check', 'user-x', 'waves'
]

symbols = []
# Preserva marca e shield se já existirem no icones.svg atual
try:
    atual = open("icones.svg", encoding="utf-8").read()
    for keep in ("marca", "shield"):
        m = re.search(rf'<symbol id="{keep}"[^>]*>.*?</symbol>', atual, re.S)
        if m:
            symbols.append(m.group(0))
except FileNotFoundError:
    pass

# Ponto neutro para ícone inexistente
symbols.append('<symbol id="ponto-neutro" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/></symbol>')

print(f"Baixando {len(icons)} icones...")
for name in icons:
    url = f"https://unpkg.com/lucide-static@1.73.0/icons/{name}.svg"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req) as resp:
        content = resp.read().decode("utf-8")
    inner = re.sub(r"<!--[^>]*-->", "", content.strip()).strip()
    inner = re.sub(r"^<svg[^>]*>", "", inner).strip()
    inner = re.sub(r"</svg>$", "", inner).strip()
    symbols.append(f'<symbol id="{name}" viewBox="0 0 24 24">{inner}</symbol>')

cabecalho = """<!--
  Lucide Icons (v1.73.0)
  Licenca ISC: https://github.com/lucide-icons/lucide/blob/main/LICENSE
  Sprite gerado para Longe & Perto
-->
<svg xmlns="http://www.w3.org/2000/svg" style="display: none;">
  <defs>
"""
corpo = "\n".join("    " + s for s in symbols)
rodape = """
  </defs>
</svg>
"""

with open("icones.svg", "w", encoding="utf-8") as f:
    f.write(cabecalho + corpo + rodape)

print(f"Concluido! icones.svg salvo com {len(symbols)} simbolos.")
