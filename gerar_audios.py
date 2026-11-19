#!/usr/bin/env python3
"""
Longe & Perto — gera os áudios da Investigação com vozes neurais (pt-BR).

Lê os casos direto dos arquivos SQL do repositório (030, 032, 034...) e grava um MP3 por
documento em casos/<caso>/audio/<documento>.mp3.

  python gerar_audios.py                    # documentos do tipo "audio" (gravações, vídeos, rádio)
  python gerar_audios.py --depoimentos      # também os depoimentos, cada suspeito com a sua voz
  python gerar_audios.py --caso som-06-sanatorio --forcar
  python gerar_audios.py --servico edge     # usa a voz grátis do Edge em vez da ElevenLabs
  python gerar_audios.py --vozes            # lista as vozes que o serviço vai usar e sai
  python gerar_audios.py --mostrar          # só mostra quem fala o quê, sem gerar nada

Como fica:
  - Uma narradora lê o cabeçalho e as descrições ("VÍDEO, celular de Luciana...", "Queda de energia").
  - As falas entre aspas ou depois de "Nome:" saem na voz de quem fala.
  - Suspeito tem sempre a mesma voz, em todo documento do caso.
  - Voz sem nome ("Voz feminina", "voz do padre") usa uma voz neutra que nenhum suspeito usa,
    para o áudio não entregar quem é.

Serviços:
  elevenlabs (padrão)  vozes mais naturais e muitas vozes diferentes. Precisa do secret
                       ELEVENLABS_API_KEY. Para não estourar o plano, para ao chegar em
                       --limite-caracteres (padrão 9000, abaixo dos 10 mil do plano grátis).
  speechify            API do Speechify, modelo simba-3.5. Plano grátis bem maior. Precisa do secret
                       SPEECHIFY_API_KEY. Limite padrão por rodada: 400 mil caracteres.
  edge                 voz do Microsoft Edge pelo pacote edge-tts. Grátis, sem chave, só 3 vozes pt-BR.

Cada caso guarda em casos/<caso>/audio/audios.json quais documentos têm áudio e um resumo do
roteiro: só gera de novo o que mudou. Trocar de serviço refaz tudo.
"""
import argparse, asyncio, base64, glob, hashlib, json, os, re, sys, urllib.error, urllib.request

# --------------------------------------------------------------------------- leitura dos casos

def ler_casos(arquivos):
    """Acha cada chamada a caso_instalar e lê o JSON do caso, codificado ($b64$) ou aberto ($caso$)."""
    casos = {}
    inicio = re.compile(r"caso_instalar\(\s*'((?:[^']|'')+)'")
    for arq in arquivos:
        texto = open(arq, encoding="utf-8").read()
        achados = list(inicio.finditer(texto))
        for i, m in enumerate(achados):
            fim = achados[i + 1].start() if i + 1 < len(achados) else len(texto)
            trecho = texto[m.end():fim]          # nunca passa para a chamada seguinte
            cid = m.group(1).replace("''", "'")
            b64 = re.search(r"\$b64\$(.*?)\$b64\$", trecho, re.S)
            aberto = re.search(r"\$caso\$(.*?)\$caso\$", trecho, re.S)
            if b64:
                dados = json.loads(base64.b64decode(re.sub(r"\s", "", b64.group(1))).decode("utf-8"))
            elif aberto:
                dados = json.loads(aberto.group(1))
            else:
                continue
            casos[cid] = dados
    return casos

# --------------------------------------------------------------------------- texto falado

MESES = ["", "janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
         "agosto", "setembro", "outubro", "novembro", "dezembro"]

def para_fala(t):
    t = t.replace("\u00a0", " ")
    t = re.sub(r"\b(\d{1,2})h(\d{2})\b", r"\1:\2", t)            # 21h09 -> 21:09
    t = re.sub(r"\b1h\b", "1 hora", t)
    t = re.sub(r"\b(\d{1,2})h\b", r"\1 horas", t)                  # 22h -> 22 horas
    t = t.replace("nº", "número").replace("Nº", "número")
    t = re.sub(r"\b([A-Za-z0-9_]+)\.(mp3|wav|mp4|mov)\b", r"\1 ponto \2", t, flags=re.I)
    # palavras em caixa alta com 4 letras ou mais viram normais (a voz lia letra por letra);
    # siglas curtas (BA, GPS) ficam
    t = re.sub(r"\b[A-ZÀ-Ý]{4,}\b", lambda m: m.group(0).capitalize(), t)
    t = re.sub(r"\b(DE|DA|DO|DAS|DOS)\b", lambda m: m.group(0).lower(), t)
    t = re.sub(r"\b(\d{1,2})/(\d{1,2})\b(?!/)",                   # 08/12 -> 8 de dezembro
               lambda m: f"{int(m.group(1))} de {MESES[int(m.group(2))]}" if 1 <= int(m.group(2)) <= 12 else m.group(0), t)
    t = t.replace(" · ", ", ").replace("·", ",")
    t = t.replace("“", "\"").replace("”", "\"").replace("\"", "")
    t = re.sub(r"\s+", " ", t).strip()
    if t and t[-1] not in ".!?:;,…":
        t += "."
    return t

# --------------------------------------------------------------------------- vozes

CRIANCA = re.compile(r"\b(filh[oa]|menin[oa]|criança|garot[oa]|neto|neta)\b", re.I)
MULHER = re.compile(r"\b(mulher|feminina|moça|senhora|dona|ela|irmã|mãe|tia|avó|freira)\b", re.I)

def genero_do_retrato(cid):
    """casos/<caso>/retratos.json: 'woman' ou 'man' na descrição em inglês de cada retrato."""
    caminho = os.path.join("casos", cid, "retratos.json")
    if not os.path.exists(caminho):
        return {}
    g = {}
    for r in json.load(open(caminho, encoding="utf-8")).get("retratos", []):
        p = " " + r.get("prompt", "").lower()
        if re.search(r"\b(woman|girl|lady|widow|nun|queen|princess|witch|mother|bride)\b", p):
            g[r["id"]] = "F"
        elif re.search(r"\b(man|boy|lord|king|knight|priest|father|monk)\b", p):
            g[r["id"]] = "M"
    return g

def genero_pelo_nome(nome):
    primeiro = nome.split()[0].lower()
    if primeiro in ("luca", "nicola", "jonas", "elias"):
        return "M"
    return "F" if primeiro.endswith(("a", "ane", "ene", "ice", "iz", "ete")) else "M"

class Elenco:
    """Decide QUEM fala cada trecho, como um papel. O serviço de voz transforma o papel em voz.

    Papéis, que nunca usam a mesma voz entre si:
      ("narrador",)              cabeçalho e descrições
      ("anonima", g)             voz SEM nome ("voz masculina", "voz do padre")
      ("crianca",)               criança sem nome
      ("nomeado", g)             pessoa com nome que não é suspeita (vítima, testemunha, garçom)
      ("suspeito", g, k)         suspeito; k é diferente para cada suspeito do mesmo gênero no caso
    Assim a voz sem nome nunca soa igual à de um suspeito nem à de uma testemunha.
    """

    def __init__(self, cid, dados):
        self.cid = cid
        self.suspeitos = dados.get("suspeitos", [])
        ret = genero_do_retrato(cid)
        self.genero = {s["id"]: ret.get(s["id"]) or genero_pelo_nome(s["nome"]) for s in self.suspeitos}
        self.primeiro_nome = {}
        for s in self.suspeitos:
            nome = re.sub(r"^(dona|seu|sr\.|sra\.|dr\.|dra\.|padre|frei|irmã)\s+", "", s["nome"], flags=re.I)
            self.primeiro_nome[nome.split()[0].lower()] = s["id"]
            for apelido in re.findall(r"[\"“'](\w+)[\"”']", s["nome"]):     # Maria "Mia" Souza
                self.primeiro_nome[apelido.lower()] = s["id"]

    def narrador(self):
        return ("narrador",)

    def anonima(self, descricao):
        if CRIANCA.search(descricao):
            return ("crianca",)
        if MULHER.search(descricao):
            return ("anonima", "F")
        nome = re.match(r"\s*([A-ZÀ-Ý][a-zà-ÿ]+)", descricao)
        if nome and nome.group(1).lower() not in ("voz", "leitura"):
            p = nome.group(1).lower()
            gen = "M" if p in ("garçom", "locutor", "repórter", "porteiro") else genero_pelo_nome(p)
            return ("nomeado", gen)
        return ("anonima", "M")

    def do_suspeito(self, sid):
        g = self.genero.get(sid, "M")
        mesmos = sorted(x["id"] for x in self.suspeitos if self.genero.get(x["id"]) == g)
        i = mesmos.index(sid) if sid in mesmos else 0
        n = int(hashlib.sha1(self.cid.encode()).hexdigest(), 16) % 97   # varia de caso para caso
        return ("suspeito", g, i + n)

    def de_quem(self, descricao):
        """Voz de uma fala, pela descrição antes dos dois-pontos. Só usa a voz de um suspeito
        quando a descrição COMEÇA com o nome dele ("Marta, ao microfone"). "A filha de Marta
        pergunta" não é a Marta: vai para a voz neutra."""
        palavras = re.findall(r"[A-Za-zÀ-ÿ]+", descricao)
        if palavras:
            p = palavras[0].lower()
            if p in ("seu", "dona", "dr", "dra", "padre", "frei") and len(palavras) > 1:
                p = palavras[1].lower()
            if p in self.primeiro_nome:
                return self.do_suspeito(self.primeiro_nome[p])
        return self.anonima(descricao)

# --------------------------------------------------------------------------- roteiro

FALA_ASPAS = re.compile(r"([^\"]*?):\s*\"([^\"]+)\"")
HORA = re.compile(r"^\s*(\d{1,2}[:h]\d{2}(?:\s*a\s*\d{1,2}[:h]\d{2})?)[\s,·]+(.*)$")

VERBO_DE_FALA = re.compile(r"\bvoz\b|pergunt|respond|\bdiz\b|\bfala\b|grit|sussurr|cham|cant|coment|"
                           r"microfone|ao fundo|telefone|murmur|exclam|repete", re.I)

def parece_quem_fala(desc):
    """'Edson', 'Marcos responde', 'voz do padre' sim; 'Local gravado pelo aparelho' não."""
    palavras = desc.split()
    return bool(VERBO_DE_FALA.search(desc)) or (len(palavras) <= 2 and desc[:1].isupper())

def roteiro_gravacao(texto, elenco):
    """Quebra o documento em trechos (papel, texto)."""
    texto = texto.replace("“", "\"").replace("”", "\"")
    partes = []
    for linha in texto.split("\n"):
        linha = linha.strip()
        if not linha:
            continue
        m = HORA.match(linha)
        if m:
            partes.append((elenco.narrador(), m.group(1)))
            linha = m.group(2).lstrip(" ,;·-–—")
        falas = list(FALA_ASPAS.finditer(linha))
        if falas:
            resto = 0
            for f in falas:
                desc, fala = f.group(1).strip(), f.group(2).strip()
                if desc:
                    partes.append((elenco.narrador(), desc + ":"))
                partes.append((elenco.de_quem(desc), fala))
                resto = f.end()
            sobra = linha[resto:].strip()
            if sobra:
                partes.append((elenco.narrador(), sobra))
            continue
        # sem aspas: "Edson: Boa noite!" ou "voz do padre: A primeira leitura..."
        s = re.match(r"^([^:]{1,60}):\s+(.+)$", linha)
        if s and not s.group(2)[:1].isdigit() and parece_quem_fala(s.group(1)):
            desc, fala = s.group(1).strip(), s.group(2).strip()
            partes.append((elenco.narrador(), desc + ":"))
            partes.append((elenco.de_quem(desc), fala))
        else:
            partes.append((elenco.narrador(), linha))
    # junta trechos seguidos da mesma voz, para soar corrido
    juntos = []
    for papel, t in partes:
        t = para_fala(t)
        if not t:
            continue
        if juntos and juntos[-1][0] == papel:
            juntos[-1] = (papel, juntos[-1][1] + " " + t)
        else:
            juntos.append((papel, t))
    return juntos

def dono_do_depoimento(doc, suspeitos):
    m = re.match(r"dep-([a-z0-9]+)", doc["id"])
    if m and m.group(1) in {s["id"] for s in suspeitos}:
        return m.group(1)
    titulo = doc.get("titulo", "").lower()
    for s in suspeitos:
        if s["nome"].lower() in titulo:
            return s["id"]
    return None

def roteiro_depoimento(doc, elenco):
    sid = dono_do_depoimento(doc, elenco.suspeitos)
    if sid:
        papel = elenco.do_suspeito(sid)
    else:                                   # testemunha: faixa das pessoas com nome
        titulo = re.sub(r"^Depoimento d[eao]s?\s+", "", doc.get("titulo", ""))
        p = elenco.anonima(titulo)
        papel = ("nomeado", p[1] if len(p) > 1 else "F")
    return [(papel, para_fala(doc["texto"]))]

# --------------------------------------------------------------------------- serviço: Edge (grátis)

class Edge:
    nome = "edge"
    TONS = ["-5Hz", "+5Hz", "-10Hz", "+9Hz", "-14Hz", "+13Hz"]
    RITMOS = ["+0%", "-6%", "+6%"]

    def __init__(self, offline=False):
        self.v = {"F": "pt-BR-FranciscaNeural", "M": "pt-BR-AntonioNeural",
                  "narrador": "pt-BR-ThalitaMultilingualNeural"}
        self.offline = offline

    async def preparar(self):
        if self.offline:
            return
        import edge_tts
        pt = [v["ShortName"] for v in await edge_tts.list_voices() if v["Locale"] == "pt-BR"]
        if self.v["narrador"] not in pt:
            self.v["narrador"] = "pt-BR-FranciscaNeural"

    def voz(self, papel):
        t = papel[0]
        if t == "narrador":
            return (self.v["narrador"], "+0Hz", "-6%")
        if t == "crianca":
            return (self.v["F"], "+14Hz", "+4%")
        if t == "anonima":
            return (self.v[papel[1]], "+0Hz", "+0%")
        if t == "nomeado":
            return (self.v[papel[1]], "-3Hz", "+0%")
        k = papel[2]
        return (self.v[papel[1]], self.TONS[k % 6], self.RITMOS[k % 3])

    def rotulo(self, voz):
        return f"{voz[0].replace('pt-BR-', '').replace('Neural', '')} {voz[1]} {voz[2]}"

    async def falar(self, voz, texto, antes, depois):
        import edge_tts
        buf = bytearray()
        async for parte in edge_tts.Communicate(texto, voz[0], rate=voz[2], pitch=voz[1]).stream():
            if parte["type"] == "audio":
                buf.extend(parte["data"])
        return bytes(buf)

# --------------------------------------------------------------------------- serviço: ElevenLabs

class CotaAcabou(Exception):
    pass

class ElevenLabs:
    nome = "elevenlabs"
    API = "https://api.elevenlabs.io/v1"

    def __init__(self, modelo, offline=False):
        self.modelo = modelo
        self.offline = offline
        self.chave = os.environ.get("ELEVENLABS_API_KEY", "")
        self.F, self.M, self.nomes = [], [], {}

    def _pedir(self, metodo, caminho, corpo=None):
        req = urllib.request.Request(self.API + caminho, method=metodo,
                                     data=json.dumps(corpo).encode() if corpo is not None else None,
                                     headers={"xi-api-key": self.chave, "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            msg = e.read().decode("utf-8", "replace")[:300]
            if e.code in (401, 402, 429) and re.search(r"quota|credit|limit|exceed", msg, re.I):
                raise CotaAcabou(msg)
            raise RuntimeError(f"HTTP {e.code}: {msg}")

    async def preparar(self):
        if self.offline:
            self.F = [f"F{i}" for i in range(8)]
            self.M = [f"M{i}" for i in range(10)]
            self.nomes = {v: v for v in self.F + self.M}
            return
        if not self.chave:
            sys.exit("Falta o secret ELEVENLABS_API_KEY (ou use --servico edge).")
        vozes = json.loads(self._pedir("GET", "/voices"))["voices"]
        def ordem(v):
            lab = {k: str(x).lower() for k, x in (v.get("labels") or {}).items()}
            brasileira = "pt" in lab.get("language", "") or "brazil" in lab.get("accent", "")
            return (0 if brasileira else 1, v["name"])          # vozes brasileiras primeiro
        for v in sorted(vozes, key=ordem):
            g = str((v.get("labels") or {}).get("gender", "")).lower()
            (self.F if g.startswith("f") else self.M if g.startswith("m") else []).append(v["voice_id"])
            self.nomes[v["voice_id"]] = v["name"]
        # quem quiser escolher as vozes: ELEVEN_VOZES_F e ELEVEN_VOZES_M com ids separados por vírgula
        for g in ("F", "M"):
            fixas = [x.strip() for x in os.environ.get(f"ELEVEN_VOZES_{g}", "").split(",") if x.strip()]
            if fixas:
                setattr(self, g, fixas)
        if len(self.F) < 2 or len(self.M) < 2:
            sys.exit("A conta tem poucas vozes femininas ou masculinas para montar o elenco.")

    def voz(self, papel):
        # reservadas: F[0] narradora, F[1] mulher sem nome e criança, F[2] mulher com nome,
        #             M[0] homem sem nome, M[1] homem com nome. O resto é dos suspeitos.
        F, M = self.F, self.M
        t = papel[0]
        if t == "narrador":
            return F[0]
        if t in ("crianca",) or papel == ("anonima", "F"):
            return F[1]
        if papel == ("anonima", "M"):
            return M[0]
        if papel == ("nomeado", "F"):
            return F[2 % len(F)]
        if papel == ("nomeado", "M"):
            return M[1]
        lista = (F[3:] or F) if papel[1] == "F" else (M[2:] or M)
        return lista[papel[2] % len(lista)]

    def rotulo(self, voz):
        return self.nomes.get(voz, voz)

    async def falar(self, voz, texto, antes, depois):
        corpo = {"text": texto, "model_id": self.modelo,
                 "voice_settings": {"stability": 0.45, "similarity_boost": 0.8, "style": 0.15}}
        if "v2_5" in self.modelo or "flash" in self.modelo or "turbo" in self.modelo:
            corpo["language_code"] = "pt"
        if antes:
            corpo["previous_text"] = antes[-300:]       # entonação continua do trecho anterior
        if depois:
            corpo["next_text"] = depois[:300]
        caminho = f"/text-to-speech/{voz}?output_format=mp3_44100_64"
        return await asyncio.to_thread(self._pedir, "POST", caminho, corpo)

    def restante(self):
        """Caracteres que ainda sobram no plano, se a chave puder ler isso."""
        try:
            s = json.loads(self._pedir("GET", "/user/subscription"))
            return s["character_limit"] - s["character_count"]
        except Exception:
            return None

# --------------------------------------------------------------------------- serviço: Speechify

class Speechify(ElevenLabs):
    """API do Speechify, modelo simba-3.5 (fala português do Brasil). Mesmo elenco da ElevenLabs:
    F[0] narradora, F[1] mulher sem nome, F[2] mulher com nome, M[0] homem sem nome,
    M[1] homem com nome, o resto para os suspeitos."""
    nome = "speechify"
    API = "https://api.speechify.ai/v1"
    MAX = 1800          # a API cobra até 2.000 caracteres por pedido; textos maiores são divididos

    def __init__(self, modelo, offline=False):
        super().__init__(modelo, offline)
        self.chave = os.environ.get("SPEECHIFY_API_KEY", "")

    def _pedir(self, metodo, caminho, corpo=None, tentativas=4):
        for t in range(tentativas):
            req = urllib.request.Request(self.API + caminho, method=metodo,
                                         data=json.dumps(corpo).encode() if corpo is not None else None,
                                         headers={"Authorization": "Bearer " + self.chave,
                                                  "Content-Type": "application/json"})
            try:
                with urllib.request.urlopen(req, timeout=120) as r:
                    return r.read()
            except urllib.error.HTTPError as e:
                msg = e.read().decode("utf-8", "replace")[:300]
                if e.code == 402 or (e.code in (403, 429) and re.search(r"quota|credit|balance|spend|limit exceeded", msg, re.I)):
                    raise CotaAcabou(msg)
                if e.code in (429, 500, 502, 503) and t + 1 < tentativas:
                    espera = int(e.headers.get("RateLimit-Reset") or e.headers.get("Retry-After") or 5 * (t + 1))
                    print(f"   serviço pediu pausa ({e.code}), esperando {min(espera, 60)} s")
                    import time; time.sleep(min(espera, 60))
                    continue
                raise RuntimeError(f"HTTP {e.code}: {msg}")

    async def preparar(self):
        if self.offline:
            return await super().preparar()
        if not self.chave:
            sys.exit("Falta o secret SPEECHIFY_API_KEY (ou use outro --servico).")
        vozes, cursor = [], None
        for _ in range(20):                                   # catálogo paginado
            q = "?model=" + self.modelo + ("&cursor=" + urllib.request.quote(cursor) if cursor else "")
            d = json.loads(self._pedir("GET", "/voices" + q))
            vozes += d.get("voices", d if isinstance(d, list) else [])
            novo = d.get("next_cursor") if isinstance(d, dict) else None
            if not novo or novo == cursor or not d.get("has_more", True):
                break
            cursor = novo
        def brasileira(v):
            locs = [v.get("locale", "")] + [l.get("locale", "") for m in v.get("models", []) for l in m.get("languages", [])]
            return any(str(l).lower().startswith("pt") for l in locs)
        def ordem(v):
            # vozes brasileiras primeiro, depois as escolhidas pela equipe deles
            return (0 if brasileira(v) else 1, v.get("staff_pick_rank") or 9999, v.get("display_name", ""))
        vistas = set()
        vozes = [v for v in vozes if not (v["id"] in vistas or vistas.add(v["id"]))]
        for v in sorted(vozes, key=ordem):
            g = str(v.get("gender", "")).lower()
            (self.F if g.startswith("f") else self.M if g.startswith("m") else []).append(v["id"])
            self.nomes[v["id"]] = v.get("display_name", v["id"]) + ("" if brasileira(v) else " (estrangeira)")
        for g in ("F", "M"):
            fixas = [x.strip() for x in os.environ.get(f"SPEECHIFY_VOZES_{g}", "").split(",") if x.strip()]
            if fixas:
                setattr(self, g, fixas)
        if len(self.F) < 2 or len(self.M) < 2:
            sys.exit("O catálogo tem poucas vozes femininas ou masculinas para montar o elenco.")

    async def falar(self, voz, texto, antes, depois):
        partes = dividir(texto, self.MAX)
        saida = b""
        for p in partes:
            corpo = {"input": p, "voice_id": voz, "model": self.modelo,
                     "audio_format": "mp3", "language": "pt-BR"}
            d = json.loads(await asyncio.to_thread(self._pedir, "POST", "/audio/speech", corpo))
            audio = base64.b64decode(d["audio_data"])
            if str(d.get("audio_format", "mp3")).lower() != "mp3":
                audio = await asyncio.to_thread(para_mp3, audio, d.get("audio_format"))
            saida += audio
        return saida

    def restante(self):
        return None      # a API não informa o saldo; o limite por rodada protege o plano

def dividir(texto, maximo):
    """Quebra por frases sem passar de `maximo` caracteres por pedaço."""
    if len(texto) <= maximo:
        return [texto]
    frases = re.split(r"(?<=[.!?…])\s+", texto)
    pedacos, atual = [], ""
    for f in frases:
        while len(f) > maximo:
            pedacos.append(f[:maximo]); f = f[maximo:]
        if len(atual) + len(f) + 1 > maximo and atual:
            pedacos.append(atual); atual = f
        else:
            atual = (atual + " " + f).strip()
    if atual:
        pedacos.append(atual)
    return pedacos

def para_mp3(audio, formato):
    """Converte WAV/OGG para MP3 com o ffmpeg (já vem no runner do GitHub)."""
    import shutil, subprocess, tempfile
    if not shutil.which("ffmpeg"):
        raise RuntimeError(f"o serviço devolveu {formato} e não há ffmpeg para converter")
    with tempfile.TemporaryDirectory() as d:
        ent, sai = os.path.join(d, "e." + (formato or "wav")), os.path.join(d, "s.mp3")
        open(ent, "wb").write(audio)
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", ent, "-ar", "44100", "-ac", "1",
                        "-b:a", "64k", sai], check=True)
        return open(sai, "rb").read()

# --------------------------------------------------------------------------- geração

async def sintetizar(servico, trechos, destino):
    """Gera cada trecho e emenda os MP3 (mesmo formato, então tocam em sequência)."""
    pedacos = []
    for i, (voz, texto) in enumerate(trechos):
        antes = trechos[i - 1][1] if i else ""
        depois = trechos[i + 1][1] if i + 1 < len(trechos) else ""
        audio = await servico.falar(voz, texto, antes, depois)
        if not audio:
            raise RuntimeError(f"sem áudio para: {texto[:40]}")
        pedacos.append(audio)
    tmp = destino + ".tmp"
    with open(tmp, "wb") as f:
        for p in pedacos:
            f.write(p)
    os.replace(tmp, destino)

MODELO_PADRAO = {"elevenlabs": "eleven_multilingual_v2", "speechify": "simba-3.5", "edge": ""}
LIMITE_PADRAO = {"elevenlabs": 9000, "speechify": 400000, "edge": 0}

def criar_servico(a, offline=False):
    modelo = a.modelo or MODELO_PADRAO[a.servico]
    a.modelo = modelo
    if a.servico == "elevenlabs":
        return ElevenLabs(modelo, offline)
    if a.servico == "speechify":
        return Speechify(modelo, offline)
    return Edge(offline)

def ler_indice(caminho):
    if not os.path.exists(caminho):
        return {"servico": None, "docs": {}}
    d = json.load(open(caminho, encoding="utf-8"))
    return d if "docs" in d else {"servico": None, "docs": d}     # formato antigo

async def principal(a):
    arquivos = a.sql or sorted(glob.glob("supabase/*.sql")) or sorted(glob.glob("*.sql"))
    casos = {k: v for k, v in ler_casos(arquivos).items() if a.caso or not k.startswith("teste")}
    if a.caso:
        casos = {k: v for k, v in casos.items() if k == a.caso}
    if not casos:
        sys.exit("Nenhum caso encontrado nos arquivos SQL.")
    servico = criar_servico(a, offline=a.mostrar)
    await servico.preparar()
    limite = a.limite_caracteres if a.limite_caracteres is not None else LIMITE_PADRAO[servico.nome]
    if limite and not a.mostrar:
        sobra = servico.restante()
        if sobra is not None:
            print(f"Plano ElevenLabs: {sobra} caracteres sobrando.")
            limite = min(limite, max(0, sobra - 200))
    # gravações primeiro, depoimentos depois: com o limite da rodada, o mais importante sai antes
    tarefas = []
    for cid, dados in sorted(casos.items()):
        elenco = Elenco(cid, dados)
        for doc in dados.get("docs", []):
            if not doc.get("texto"):
                continue
            if doc["tipo"] == "audio":
                tarefas.append((0, cid, doc, roteiro_gravacao(doc["texto"], elenco)))
            elif a.depoimentos and doc["tipo"] == "depoimento":
                tarefas.append((1, cid, doc, roteiro_depoimento(doc, elenco)))
    tarefas.sort(key=lambda x: (x[0], x[1]))
    indices, mudados = {}, set()
    gastos = feitos = erros = 0
    parou = ""
    for _, cid, doc, papeis in tarefas:
        trechos = [(servico.voz(p), t) for p, t in papeis]
        if a.mostrar:
            print(f"\n== {cid}/{doc['id']}")
            for v, t in trechos:
                print(f"  [{servico.rotulo(v)}] {t}")
            continue
        pasta = os.path.join("casos", cid, "audio")
        if cid not in indices:
            indices[cid] = ler_indice(os.path.join(pasta, "audios.json"))
        indice = indices[cid]
        h = hashlib.sha1(json.dumps([servico.nome, a.modelo, trechos], ensure_ascii=False).encode()).hexdigest()[:12]
        destino = os.path.join(pasta, doc["id"] + ".mp3")
        if not a.forcar and indice["docs"].get(doc["id"]) == h and os.path.exists(destino):
            continue
        custo = sum(len(t) for _, t in trechos)
        if limite and gastos + custo > limite:
            parou = f"limite de {limite} caracteres nesta rodada"
            break
        os.makedirs(pasta, exist_ok=True)
        print(f"{cid}/{doc['id']}: {len(trechos)} trecho(s), {custo} caracteres")
        try:
            await sintetizar(servico, trechos, destino)
        except CotaAcabou as e:
            parou = f"o plano avisou que os créditos acabaram ({e})"
            break
        except Exception as e:
            print(f"   ERRO, pulando: {e}")
            erros += 1
            continue
        gastos += custo
        indice["servico"] = servico.nome
        indice["docs"][doc["id"]] = h
        mudados.add(cid)
        feitos += 1
    for cid in mudados:
        caminho = os.path.join("casos", cid, "audio", "audios.json")
        json.dump(indices[cid], open(caminho, "w", encoding="utf-8"), ensure_ascii=False, indent=1, sort_keys=True)
    if not a.mostrar:
        print(f"\nPronto: {feitos} áudio(s) gerado(s), {gastos} caracteres, {erros} com erro.")
        if parou:
            print(f"Parei antes do fim: {parou}. Rode de novo depois para continuar de onde parou.")
        if erros and not feitos:
            sys.exit(1)

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--sql", nargs="*", help="arquivos SQL com os casos (padrão: supabase/*.sql)")
    p.add_argument("--caso", help="só este caso")
    p.add_argument("--depoimentos", action="store_true", help="também os depoimentos, com voz por suspeito")
    p.add_argument("--servico", choices=["elevenlabs", "speechify", "edge"], default="elevenlabs")
    p.add_argument("--modelo", default=None,
                   help="modelo do serviço (padrão: eleven_multilingual_v2 ou simba-3.5)")
    p.add_argument("--limite-caracteres", type=int, default=None,
                   help="no máximo quantos caracteres nesta rodada (0 = sem limite; "
                        "padrão 9000 na ElevenLabs e 400000 no Speechify)")
    p.add_argument("--forcar", action="store_true", help="refaz mesmo o que não mudou")
    p.add_argument("--mostrar", action="store_true", help="só mostra o roteiro de vozes, sem gerar")
    p.add_argument("--vozes", action="store_true", help="mostra as vozes que o serviço vai usar e sai")
    a = p.parse_args()
    if a.vozes:
        async def listar():
            s = criar_servico(a)
            await s.preparar()
            if isinstance(s, ElevenLabs):
                print("Femininas:", ", ".join(s.nomes[v] if v in s.nomes else v for v in s.F))
                print("Masculinas:", ", ".join(s.nomes[v] if v in s.nomes else v for v in s.M))
            else:
                print(json.dumps(s.v, indent=1))
        asyncio.run(listar())
        sys.exit()
    asyncio.run(principal(a))
