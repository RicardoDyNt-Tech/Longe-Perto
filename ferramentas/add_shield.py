import urllib.request
import re

url = "https://unpkg.com/lucide-static@1.73.0/icons/shield.svg"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
with urllib.request.urlopen(req) as resp:
    content = resp.read().decode("utf-8")

inner = re.sub(r"^<svg[^>]*>", "", content.strip())
inner = re.sub(r"</svg>$", "", inner.strip()).strip()
inner = re.sub(r"<!--.*?-->", "", inner, flags=re.DOTALL).strip()
symbol = f'<symbol id="shield" viewBox="0 0 24 24">{inner}</symbol>'

with open("icones.svg", "r", encoding="utf-8") as f:
    text = f.read()

text = text.replace('<symbol id="ponto-neutro"', symbol + '\n    <symbol id="ponto-neutro"')

with open("icones.svg", "w", encoding="utf-8") as f:
    f.write(text)

print("shield adicionado ao icones.svg!")
