import re

with open("icones.svg", "r", encoding="utf-8") as f:
    content = f.read()

# Marca: dois circulos que se tocam, um contornado e um cheio ("longe" e "perto")
# No viewBox 0 0 24 24:
# Círculo 1 (contornado, "longe"): cx=7, cy=12, r=5, fill="none", stroke="currentColor", stroke-width="1.75"
# Círculo 2 (cheio, "perto"): cx=17, cy=12, r=5, fill="currentColor", stroke="none"
# Eles se tocam exatamente no ponto central x=12.
marca_symbol = '<symbol id="marca" viewBox="0 0 24 24"><circle cx="7" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="1.75" /><circle cx="17" cy="12" r="5" fill="currentColor" stroke="none" /></symbol>'

if 'id="marca"' not in content:
    content = content.replace('<symbol id="ponto-neutro"', marca_symbol + '\n    <symbol id="ponto-neutro"')

with open("icones.svg", "w", encoding="utf-8") as f:
    f.write(content)

print("Simbolo da marca adicionado a icones.svg!")
