import re

with open("icones.svg", "r", encoding="utf-8") as f:
    content = f.read()

# Novo símbolo da marca: dois anéis em linha que se cruzam/entrelaçam (como na imagem aprovada)
novo_symbol = '<symbol id="marca" viewBox="0 0 24 24"><circle cx="8.5" cy="12" r="5.25" fill="none" stroke="currentColor" stroke-width="1.75"/><circle cx="15.5" cy="12" r="5.25" fill="none" stroke="currentColor" stroke-width="1.75"/></symbol>'

# Substituir o symbol da marca
content = re.sub(r'<symbol id="marca"[^>]*>.*?</symbol>', novo_symbol, content, flags=re.DOTALL)

with open("icones.svg", "w", encoding="utf-8") as f:
    f.write(content)

print("icones.svg atualizado com a nova marca!")
