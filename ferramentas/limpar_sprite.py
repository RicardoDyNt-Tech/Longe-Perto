import re

with open("icones.svg", "r", encoding="utf-8") as f:
    content = f.read()

# Substituir cada symbol que contém <svg ...> ... </svg>
def clean_symbol(match):
    sym_id = match.group(1)
    inner = match.group(2)
    # Remove qualquer comentário <!-- ... -->
    inner = re.sub(r"<!--.*?-->", "", inner, flags=re.DOTALL)
    # Remove a tag <svg ...> externa
    inner = re.sub(r"<svg[^>]*>", "", inner, flags=re.DOTALL)
    # Remove </svg>
    inner = re.sub(r"</svg>", "", inner, flags=re.DOTALL)
    # Remove atributos de stroke nas tags filhas se houver (para herdar do css do <svg class="icone">)
    # No Lucide, stroke, stroke-width, fill, stroke-linecap, stroke-linejoin estão na tag <svg> original,
    # os elementos internos são path, circle, line, rect, polyline etc sem stroke fixo
    return f'<symbol id="{sym_id}" viewBox="0 0 24 24">{inner.strip()}</symbol>'

pattern = re.compile(r'<symbol id="([^"]+)" viewBox="0 0 24 24">(.*?)</symbol>', re.DOTALL)
new_content = pattern.sub(clean_symbol, content)

with open("icones.svg", "w", encoding="utf-8") as f:
    f.write(new_content)

print("icones.svg limpo com sucesso!")
