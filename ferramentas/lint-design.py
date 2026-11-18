#!/usr/bin/env python3
"""
Lint de design para Longe & Perto.
Verifica aderência aos tokens de cor, tipografia, bordas, gradientes, sombras e emojis.
"""

import os
import re
import sys

# Importa o verificador de emojis existente
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    import sem_emoji
except ImportError:
    sem_emoji = None

ARQUIVOS_CSS = ["style.css"]
ARQUIVOS_HTML = ["index.html"]

# Valores permitidos na escala de tipografia (tokens + equivalentes exatos)
TAMANHOS_PERMITIDOS = {
    "40px", "2.5rem",
    "30px", "1.875rem",
    "27px", "1.6875rem",
    "21px", "1.3125rem",
    "15px", "0.9375rem",
    "13.5px", "0.84375rem",
    "11.5px", "0.71875rem",
    "100%", "inherit", "0",
}

PESOS_PROIBIDOS = {"600", "700", "800", "900", "bold", "bolder"}

RAIOS_PERMITIDOS = {
    "0", "0px",
    "8px", "10px", "14px", "18px", "999px",
    "inherit",
}

# Exceções explícitas (com motivo)
EXCECOES_CSS = [
    # Ex: {'regra': 'gradient', 'contexto': '.roleta'}
]


def eh_bloco_tokens(linha, em_tokens):
    """Detecta se estamos dentro do bloco de tokens (:root, [data-tema=...], etc.)."""
    if re.search(r"(:root|\[data-tema)", linha):
        return True
    return em_tokens


def checar_css(caminho):
    ocorrencias = []
    if not os.path.exists(caminho):
        return ocorrencias

    with open(caminho, "r", encoding="utf-8") as f:
        linhas = f.readlines()

    em_tokens = False
    profundidade_tokens = 0
    em_comentario = False

    for num, raw_linha in enumerate(linhas, start=1):
        linha = raw_linha

        # Controle simples de comentários /* ... */
        if em_comentario:
            if "*/" in linha:
                linha = linha.split("*/", 1)[1]
                em_comentario = False
            else:
                continue
        while "/*" in linha:
            antes, resto = linha.split("/*", 1)
            if "*/" in resto:
                _, depois = resto.split("*/", 1)
                linha = antes + " " + depois
            else:
                linha = antes
                em_comentario = True
                break

        strip = linha.strip()
        if not strip:
            continue

        # Detecta entrada/saída de bloco de tokens (:root, [data-tema...], body.juntos ou @media (prefers-color-scheme...))
        if not em_tokens and re.match(r"^\s*(:root|\[data-tema[^\]]*\]|body\.juntos|@media\s*\(prefers-color-scheme)", strip):
            em_tokens = True
            profundidade_tokens = strip.count("{") - strip.count("}")
            if profundidade_tokens <= 0:
                em_tokens = False
            continue
        elif em_tokens:
            profundidade_tokens += strip.count("{") - strip.count("}")
            if profundidade_tokens <= 0:
                em_tokens = False
            continue

        # 1. Cores (#hex, rgb(), rgba(), hsl(), hsla()) fora do bloco de tokens
        cores = re.findall(r"(#[0-9a-fA-F]{3,8}\b|\brgba?\([^)]+\)|\bhsla?\([^)]+\))", linha)
        for c in cores:
            ocorrencias.append((num, "cor", f"{c} -> {strip}"))

        # 2. font-size fora da escala
        for m in re.finditer(r"font-size\s*:\s*([^;}{]+)", linha):
            val = m.group(1).strip().replace("!important", "").strip()
            if not val.startswith("var(--t-") and val not in TAMANHOS_PERMITIDOS:
                ocorrencias.append((num, "font-size", f"{val} -> {strip}"))

        # 3. font-weight 600, 700, 800, bold
        for m in re.finditer(r"font-weight\s*:\s*([^;}{]+)", linha):
            val = m.group(1).strip().replace("!important", "").strip()
            if val in PESOS_PROIBIDOS:
                ocorrencias.append((num, "font-weight", f"{val} -> {strip}"))

        # 4. border-radius fora dos 5 valores
        for m in re.finditer(r"border-radius\s*:\s*([^;}{]+)", linha):
            val = m.group(1).strip().replace("!important", "").strip()
            partes = val.split()
            for p in partes:
                if not p.startswith("var(--r-") and p not in RAIOS_PERMITIDOS:
                    ocorrencias.append((num, "border-radius", f"{val} -> {strip}"))
                    break

        # 5. gradient fora da roleta
        if re.search(r"(linear|radial|conic)-gradient\s*\(", linha):
            if "roleta" not in strip.lower() and "roda" not in strip.lower():
                ocorrencias.append((num, "gradient", strip))

        # 6. box-shadow fora de modal e toast
        for m in re.finditer(r"box-shadow\s*:\s*([^;}{]+)", linha):
            val = m.group(1).strip()
            if val != "none" and not any(k in strip.lower() for k in ("folha", "dialog", "modal", "toast")):
                ocorrencias.append((num, "box-shadow", f"{val} -> {strip}"))

    return ocorrencias


def checar_html(caminho):
    ocorrencias = []
    if not os.path.exists(caminho):
        return ocorrencias

    with open(caminho, "r", encoding="utf-8") as f:
        linhas = f.readlines()

    for num, linha in enumerate(linhas, start=1):
        # Verifica estilos inline com cor ou font-size/weight/radius
        for m in re.finditer(r'style\s*=\s*"([^"]+)"', linha):
            estilo = m.group(1)
            if re.search(r"(#[0-9a-fA-F]{3,8}\b|\brgba?\()", estilo):
                ocorrencias.append((num, "cor-inline", estilo))
            if "font-size" in estilo:
                ocorrencias.append((num, "font-size-inline", estilo))
            if "box-shadow" in estilo:
                ocorrencias.append((num, "box-shadow-inline", estilo))
    return ocorrencias


def contar_emojis():
    """Executa a checagem de emojis usando sem-emoji.py."""
    import subprocess
    script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sem-emoji.py")
    if not os.path.exists(script):
        return 0
    res = subprocess.run([sys.executable, script], capture_output=True, text=True, encoding="utf-8")
    m = re.search(r"Total de ocorrências encontradas:\s*(\d+)", res.stdout)
    return int(m.group(1)) if m else 0


def main():
    todas = {}
    for arq in ARQUIVOS_CSS:
        ocs = checar_css(arq)
        if ocs:
            todas[arq] = ocs
    for arq in ARQUIVOS_HTML:
        ocs = checar_html(arq)
        if ocs:
            todas[arq] = ocs

    resumo = {}
    total = 0
    for arq, ocs in todas.items():
        print(f"\n[{arq}] ({len(ocs)} ocorrências)")
        for num, tipo, detalhe in ocs[:30]:
            print(f"  L{num} [{tipo}]: {detalhe[:100]}")
        if len(ocs) > 30:
            print(f"  ... e mais {len(ocs) - 30} ocorrências neste arquivo.")
        for _, tipo, _ in ocs:
            resumo[tipo] = resumo.get(tipo, 0) + 1
            total += 1

    emojis = contar_emojis()
    if emojis > 0:
        resumo["emoji"] = emojis
        total += emojis

    print("\n" + "=" * 50)
    print("RESUMO DO LINT DE DESIGN")
    for tipo, qtd in sorted(resumo.items()):
        print(f"  {tipo:18s}: {qtd}")
    print(f"Total de ocorrências: {total}")
    print("=" * 50)
    return 1 if total > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
