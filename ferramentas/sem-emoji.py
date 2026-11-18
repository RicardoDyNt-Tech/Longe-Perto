#!/usr/bin/env python3
"""
ferramentas/sem-emoji.py
Verifica a presença de emojis e símbolos pictográficos em arquivos .js, .html e .css.
Serve de checagem do plano de identidade visual sem emojis.
"""

import os
import re
import sys

# Padrão abrangente de emojis e símbolos de interface que foram substituídos por ícones
EMOJI_PATTERN = re.compile(
    r'[\U0001F000-\U0001FAFF]'      # Emoticons, símbolos pictográficos diversos
    r'|[\U00002700-\U000027BF]'      # Dingbats
    r'|[\U00002600-\U000026FF]'      # Misc symbols (ex: ☕, ⚡, ✈, ☁)
    r'|[\U00002B50-\U00002B55]'      # Estrelas e formas
    r'|[\U0000231A-\U000023F3]'      # Relógio, ampulheta
    r'|[\u2705\u2714\u2716\u274c\u2757\u2764]'
    r'|[✓✕✗←→↗↑↓⭐★☆]'
)

# Lista de exceções justificadas (arquivo, trecho de código / motivo)
# Por exemplo, mapeamentos no JS para compatibilidade reversa com dados já gravados no banco
EXCECOES = [
    # Mapeamentos de compatibilidade com versões antigas do banco
    {'arquivo': 'app.js', 'prefixo': 'ICONE_DE_EMOJI'},
    {'arquivo': 'app.js', 'prefixo': 'EMOJI_DE_ICONE'},
    {'arquivo': 'app.js', 'prefixo': 'ROTULO_PLAYLIST'},
    # config.js é intocável pelas regras do projeto (comentário de instruções com seta ->)
    {'arquivo': 'config.js', 'prefixo': 'Project Settings'},
]

def verificar_arquivos(diretorio_base="."):
    extensoes = ('.js', '.html', '.css')
    pastas_ignoradas = {'.git', 'node_modules', 'ferramentas'}
    
    total_encontrados = 0
    arquivos_com_emoji = 0

    for raiz, dirs, arquivos in os.walk(diretorio_base):
        dirs[:] = [d for d in dirs if d not in pastas_ignoradas]
        
        for arq in arquivos:
            if not arq.endswith(extensoes):
                continue
            
            caminho = os.path.relpath(os.path.join(raiz, arq), diretorio_base)
            # Ignora arquivos de teste ou build gerados caso existam
            if caminho.startswith("app" + os.sep + "android"):
                continue
                
            try:
                with open(caminho, 'r', encoding='utf-8') as f:
                    linhas = f.readlines()
            except Exception as e:
                print(f"Erro ao ler {caminho}: {e}", file=sys.stderr)
                continue

            ocorrencias_arquivo = []
            em_bloco_excecao = False

            for num_linha, linha in enumerate(linhas, start=1):
                # Checa início e fim de bloco de exceção
                if "const ICONE_DE_EMOJI" in linha or "const EMOJI_DE_ICONE" in linha or "const ROTULO_PLAYLIST" in linha:
                    em_bloco_excecao = True
                
                matches = EMOJI_PATTERN.findall(linha)
                matches = [m for m in matches if m != '\ufe0f']
                
                if em_bloco_excecao:
                    if "};" in linha:
                        em_bloco_excecao = False
                    continue

                if not matches:
                    continue
                
                # Checa exceções pontuais
                ignorar = False
                for exc in EXCECOES:
                    if exc.get('arquivo') == caminho and exc.get('prefixo') in linha:
                        ignorar = True
                        break
                if ignorar:
                    continue
                
                ocorrencias_arquivo.append((num_linha, matches, linha.strip()))
            
            if ocorrencias_arquivo:
                arquivos_com_emoji += 1
                print(f"\n{caminho} ({len(ocorrencias_arquivo)} linha(s) com emoji):")
                for num, matches, texto in ocorrencias_arquivo:
                    total_encontrados += len(matches)
                    emojis_str = " ".join(matches)
                    preview = texto if len(texto) <= 70 else texto[:67] + "..."
                    print(f"  L{num:4d} [{emojis_str}]: {preview}")

    print("\n" + "=" * 50)
    print(f"Total de ocorrências encontradas: {total_encontrados}")
    print(f"Arquivos com emoji: {arquivos_com_emoji}")
    print("=" * 50)
    return total_encontrados

if __name__ == "__main__":
    base = sys.argv[1] if len(sys.argv) > 1 else "."
    encontrados = verificar_arquivos(base)
    sys.exit(1 if encontrados > 0 else 0)
