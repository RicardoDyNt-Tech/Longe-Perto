import re

with open("icons/marca-bruta.svg", "r", encoding="utf-8") as f:
    text = f.read()

path_d = re.findall(r'<path[^>]*d=[\'"]([^\'"]+)[\'"]', text)[0]

svg_marca = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="24" height="24">
  <!-- Símbolo oficial Longe & Perto (monograma L&P em linha contínua) -->
  <path d="{path_d}" fill="currentColor" stroke="none" fill-rule="evenodd" />
</svg>
'''

with open("icons/marca.svg", "w", encoding="utf-8") as f:
    f.write(svg_marca)

icon_app = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#17132A" rx="112" />
  <path d="{path_d}" fill="#FFFFFF" stroke="none" fill-rule="evenodd" />
</svg>
'''

with open("icons/icon.svg", "w", encoding="utf-8") as f:
    f.write(icon_app)

# Atualizar o symbol da marca no icones.svg
with open("icones.svg", "r", encoding="utf-8") as f:
    icones_content = f.read()

novo_symbol = f'<symbol id="marca" viewBox="0 0 512 512"><path d="{path_d}" fill="currentColor" stroke="none" fill-rule="evenodd"/></symbol>'
icones_content = re.sub(r'<symbol id="marca"[^>]*>.*?</symbol>', novo_symbol, icones_content, flags=re.DOTALL)

with open("icones.svg", "w", encoding="utf-8") as f:
    f.write(icones_content)

print("Marca vetorizada com sucesso em icons/marca.svg, icons/icon.svg e icones.svg!")
