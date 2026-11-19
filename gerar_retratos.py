#!/usr/bin/env python3
"""
Longe & Perto — gera os retratos dos suspeitos de um caso a partir de descrições (texto para imagem).

Lê casos/<caso>/retratos.json e grava casos/<caso>/<id>.jpg (ou .png, conforme o serviço).
Por padrão só gera os que ainda não existem.

  python gerar_retratos.py violao-do-cais                         # Cloudflare (padrão)
  python gerar_retratos.py --todos                                # todos os casos que tiverem retratos.json
  python gerar_retratos.py violao-do-cais --so otavio --variar    # refaz um com rosto novo
  python gerar_retratos.py violao-do-cais --forcar                # refaz todos
  python gerar_retratos.py violao-do-cais --servico gemini        # API do Gemini (paga, melhor qualidade)
  python gerar_retratos.py violao-do-cais --servico pollinations  # sem cadastro (lento)
  python gerar_retratos.py --todos --limite 60                    # no máximo 60 imagens nesta rodada

Chaves, sempre por variável de ambiente (nunca no arquivo nem no repositório):
  Cloudflare: CF_ACCOUNT_ID e CF_API_TOKEN (token com permissão "Workers AI")
  Gemini:     GEMINI_API_KEY (chave do Google AI Studio com faturamento ligado)

Se o Pillow estiver instalado (pip install pillow), cada imagem é recortada em 5:6 e reduzida
para 480 x 576 em JPEG (cerca de 40 KB). Sem o Pillow, a imagem é gravada como veio do serviço.

Um erro numa imagem não para as outras. Se o serviço disser que a cota acabou, o script para
e guarda o que já gerou; é só rodar de novo depois (ele pula o que já existe).

Não foi testado contra os serviços de verdade: se algum deles mudou o formato, a mensagem de
erro mostra o que voltou.
"""
import argparse, base64, glob, io, json, os, random, sys, time, urllib.error, urllib.parse, urllib.request

class CotaAcabou(Exception):
    pass

def pedir(url, dados=None, cabecalhos=None, tentativas=3):
    for i in range(tentativas):
        try:
            req = urllib.request.Request(url, data=dados, headers={"User-Agent": "longe-perto/1.0", **(cabecalhos or {})})
            with urllib.request.urlopen(req, timeout=180) as r:
                return r.read(), r.headers.get("Content-Type", "")
        except urllib.error.HTTPError as e:
            corpo = e.read()[:400]
            texto = corpo.decode("utf-8", "ignore").lower()
            if e.code == 429 and any(p in texto for p in ("daily", "quota", "limit", "neuron", "exhausted")) and i >= 1:
                raise CotaAcabou(f"HTTP 429: {corpo!r}")
            if e.code in (400, 401, 403, 404) or i == tentativas - 1:
                if e.code == 429:
                    raise CotaAcabou(f"HTTP 429: {corpo!r}")
                raise RuntimeError(f"HTTP {e.code}: {corpo!r}")
            print(f"   HTTP {e.code}, tentando de novo em 20 s...")
        except Exception as e:
            if i == tentativas - 1:
                raise
            print(f"   {e}, tentando de novo em 20 s...")
        time.sleep(20)

def cloudflare(prompt, cfg, semente):
    conta, token = os.environ.get("CF_ACCOUNT_ID"), os.environ.get("CF_API_TOKEN")
    if not conta or not token:
        sys.exit("Defina CF_ACCOUNT_ID e CF_API_TOKEN nas variáveis de ambiente.")
    modelo = os.environ.get("CF_MODELO", "@cf/black-forest-labs/flux-1-schnell")
    url = f"https://api.cloudflare.com/client/v4/accounts/{conta}/ai/run/{modelo}"
    corpo, tipo = pedir(url, json.dumps({"prompt": prompt, "steps": 8}).encode(),
                        {"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    if tipo.startswith("image/"):
        return corpo, ".png" if "png" in tipo else ".jpg"
    r = json.loads(corpo)
    img = (r.get("result") or {}).get("image")
    if not img:
        raise RuntimeError(f"O Cloudflare não devolveu imagem: {str(r)[:300]}")
    return base64.b64decode(img), ".jpg"

def gemini(prompt, cfg, semente):
    chave = os.environ.get("GEMINI_API_KEY")
    if not chave:
        sys.exit("Defina GEMINI_API_KEY nas variáveis de ambiente.")
    modelo = os.environ.get("GEMINI_MODELO", "gemini-2.5-flash-image")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent"
    corpo, _ = pedir(url, json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseModalities": ["IMAGE"], "imageConfig": {"aspectRatio": "4:5"}},
    }).encode(), {"x-goog-api-key": chave, "Content-Type": "application/json"})
    r = json.loads(corpo)
    for parte in ((r.get("candidates") or [{}])[0].get("content") or {}).get("parts", []):
        dado = parte.get("inlineData") or parte.get("inline_data")
        if dado and dado.get("data"):
            ext = ".png" if "png" in dado.get("mimeType", dado.get("mime_type", "")) else ".jpg"
            return base64.b64decode(dado["data"]), ext
    raise RuntimeError(f"O Gemini não devolveu imagem: {str(r)[:400]}")

def pollinations(prompt, cfg, semente):
    url = ("https://image.pollinations.ai/prompt/" + urllib.parse.quote(prompt, safe="") +
           f"?model=flux&width={cfg['largura']}&height={cfg['altura']}&seed={semente}&nologo=true")
    corpo, tipo = pedir(url)
    if not tipo.startswith("image/"):
        raise RuntimeError(f"O Pollinations não devolveu imagem ({tipo}): {corpo[:200]!r}")
    time.sleep(16)   # sem cadastro: 1 pedido a cada 15 segundos
    return corpo, ".jpg"

SERVICOS = {"cloudflare": cloudflare, "gemini": gemini, "pollinations": pollinations}

def reduzir(img, ext):
    """Recorta em 5:6 (rosto um pouco acima do centro) e reduz para 480 x 576 em JPEG, se houver Pillow."""
    try:
        from PIL import Image
    except ImportError:
        return img, ext
    im = Image.open(io.BytesIO(img)).convert("RGB")
    w, h = im.size
    alvo = 5 / 6
    if w / h > alvo:                       # larga demais: corta dos lados
        nw = int(h * alvo); x = (w - nw) // 2
        im = im.crop((x, 0, x + nw, h))
    else:                                  # alta demais: corta embaixo, guardando o alto da cabeça
        nh = int(w / alvo); y = int((h - nh) * 0.3)
        im = im.crop((0, y, w, y + nh))
    im = im.resize((480, 576), Image.LANCZOS)
    saida = io.BytesIO()
    im.save(saida, "JPEG", quality=82, optimize=True, progressive=True)
    return saida.getvalue(), ".jpg"

def existente(pasta, id_):
    for ext in (".jpg", ".png"):
        if os.path.exists(os.path.join(pasta, id_ + ext)):
            return id_ + ext
    return None

CONTA = {"feitos": 0, "erros": 0}

def gerar_caso(pasta, a, restante):
    cfg = json.load(open(os.path.join(pasta, "retratos.json"), encoding="utf-8"))
    feitos, erros = 0, 0
    for r in cfg["retratos"]:
        if restante is not None and feitos >= restante:
            break
        if a.so and r["id"] not in a.so:
            continue
        ja = existente(pasta, r["id"])
        if ja and not (a.forcar or a.so):
            print(f"{os.path.basename(pasta)}/{r['id']}: já existe ({ja}), pulando")
            continue
        semente = random.randint(1, 999999) if a.variar else r["semente"]
        print(f"{os.path.basename(pasta)}/{r['id']}: gerando com {a.servico} (semente {semente})...")
        try:
            img, ext = SERVICOS[a.servico](r["prompt"] + " " + cfg["estilo"], cfg, semente)
            img, ext = reduzir(img, ext)
        except CotaAcabou:
            raise
        except SystemExit:
            raise
        except Exception as e:
            print(f"   ERRO, pulando este: {e}")
            erros += 1
            CONTA["erros"] += 1
            continue
        for velho in (".jpg", ".png"):
            caminho = os.path.join(pasta, r["id"] + velho)
            if velho != ext and os.path.exists(caminho):
                os.remove(caminho)
        destino = os.path.join(pasta, r["id"] + ext)
        open(destino, "wb").write(img)
        print(f"   salvo em {destino} ({len(img) // 1024} KB)")
        feitos += 1
        CONTA["feitos"] += 1
    return feitos, erros

p = argparse.ArgumentParser()
p.add_argument("caso", nargs="?")
p.add_argument("--todos", action="store_true", help="todos os casos com retratos.json")
p.add_argument("--servico", choices=list(SERVICOS), default=os.environ.get("RETRATOS_SERVICO", "cloudflare"))
p.add_argument("--so", nargs="*", help="gera só estes ids (mesmo que já existam)")
p.add_argument("--variar", action="store_true", help="sorteia uma semente nova (rosto diferente)")
p.add_argument("--forcar", action="store_true", help="refaz mesmo os que já existem")
p.add_argument("--limite", type=int, default=0, help="no máximo N imagens nesta rodada (0 = sem limite)")
p.add_argument("--prontos", action="store_true", help="só atualiza casos/prontos.json e sai")
a = p.parse_args()

def atualizar_prontos():
    prontos = []
    for arq in sorted(glob.glob(os.path.join("casos", "*", "retratos.json"))):
        pasta = os.path.dirname(arq)
        cfg = json.load(open(arq, encoding="utf-8"))
        rets = cfg.get("retratos", [])
        if rets and all(existente(pasta, r["id"]) for r in rets):
            prontos.append(os.path.basename(pasta))
    with open(os.path.join("casos", "prontos.json"), "w", encoding="utf-8") as f:
        json.dump(prontos, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"casos/prontos.json atualizado: {len(prontos)} caso(s) completos.")

if a.prontos:
    atualizar_prontos()
    sys.exit(0)

if a.todos:
    pastas = sorted(os.path.dirname(f) for f in glob.glob(os.path.join("casos", "*", "retratos.json")))
elif a.caso:
    pastas = [os.path.join("casos", a.caso)]
else:
    p.error("informe o caso ou use --todos")

total = 0
try:
    for pasta in pastas:
        if not os.path.exists(os.path.join(pasta, "retratos.json")):
            sys.exit(f"Não achei {pasta}/retratos.json")
        restante = (a.limite - total) if a.limite else None
        if restante is not None and restante <= 0:
            print(f"\nLimite de {a.limite} imagens atingido nesta rodada.")
            break
        gerar_caso(pasta, a, restante)
        total = CONTA["feitos"]
except CotaAcabou as e:
    print(f"\nA cota do serviço acabou ({e}). Rode de novo mais tarde: o que já foi gerado fica guardado.")
atualizar_prontos()
print(f"\nPronto: {CONTA['feitos']} retrato(s) gerado(s), {CONTA['erros']} com erro.")
