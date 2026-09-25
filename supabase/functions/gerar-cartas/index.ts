// Longe & Perto — Edge Function "gerar-cartas": sugestões de cartas pela Mistral.
// A chave da Mistral fica só nos secrets do Supabase; nunca vai para o site.
// Secrets: MISTRAL_API_KEY, MISTRAL_MODEL, ALLOWED_ORIGIN, IA_LIMITE_DIA (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem).
// Para a Mistral vai só: tipo, nível, tema e exemplos de cartas PADRÃO. Nada de nomes, cartas de vocês ou envelopes.
import { createClient } from "jsr:@supabase/supabase-js@2";

const TIPOS = ["verdade", "desafio", "prenda", "ideia_mensagem"];
const NIVEIS = ["leve", "criativo", "picante", "pesado"];
const MIDIAS = ["foto", "video", "audio"];
const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";

const SISTEMA = `Você cria cartas para um jogo de verdade ou desafio de um casal adulto que namora a distância. Os dois jogam juntos em chamada de vídeo pelo WhatsApp, cada um na sua casa, e combinaram entre si os limites do jogo.

Regras para toda carta:
- Escreva em português do Brasil, com frases curtas e diretas, falando com quem vai cumprir ("você"). Quando for sobre a outra pessoa, use "eu/mim" (quem lê a carta).
- A carta tem de ser possível de cumprir a distância: pela câmera, por mensagem, por áudio, ou por foto ou vídeo enviados pelo WhatsApp.
- Nada envolvendo menores de idade, terceiros sem consentimento, exposição em público, violência, coerção, algo ilegal ou risco à saúde.
- Nunca repita nem parafraseie de perto os exemplos fornecidos.
- Se a carta pedir foto, vídeo ou áudio, preencha "midia" com "foto", "video" ou "audio"; caso contrário, null.
- Responda somente com JSON no formato { "cartas": [ { "texto": "…", "midia": null } ] }, sem nenhum texto fora do JSON.

Níveis:
- leve: carinhoso e divertido, nada sexual.
- criativo: imaginação, desenho, histórias, imitação, movimento.
- picante: sensual e provocante, sem ser explícito.
- pesado: ousado e sexual entre adultos que consentem: nudez, provocação, fantasias, posições, fotos e vídeos íntimos enviados em visualização única. Direto, sem ser gráfico demais.

Tipos:
- verdade: pergunta.
- desafio: ação.
- prenda: ação curta de penalidade.
- ideia_mensagem: uma sugestão do que escrever numa mensagem para a outra pessoa.`;

const hojeBahia = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bahia" }).format(new Date());
const normal = (t: string) => t.toLowerCase().replace(/\s+/g, " ").replace(/[.!?…]+$/, "").trim();

function cors(origem: string) {
  return {
    "Access-Control-Allow-Origin": origem,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

type Carta = { texto: string; midia: string | null };

// chama a Mistral; devolve as cartas do JSON, null se veio sem cartas/recusa, ou lança "falha"
async function pedirMistral(user: string): Promise<Carta[] | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  let r: Response;
  try {
    r = await fetch(MISTRAL_URL, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("MISTRAL_API_KEY") ?? ""}` },
      body: JSON.stringify({
        model: Deno.env.get("MISTRAL_MODEL"),
        messages: [{ role: "system", content: SISTEMA }, { role: "user", content: user }],
        response_format: { type: "json_object" },
        temperature: 0.9,
        max_tokens: 600,
      }),
    });
  } catch (_) {
    throw new Error("falha");   // timeout ou rede
  } finally {
    clearTimeout(timer);
  }
  if (!r.ok) throw new Error("falha");   // 429, 5xx, chave errada…
  let conteudo: unknown;
  try {
    const j = await r.json();
    conteudo = j?.choices?.[0]?.message?.content;
    if (typeof conteudo !== "string") return null;
    const dados = JSON.parse(conteudo);
    return Array.isArray(dados?.cartas) ? dados.cartas : null;
  } catch (_) {
    return null;   // JSON inválido ou texto de recusa
  }
}

function limpar(lista: unknown[], exemplos: string[], quantidade: number): Carta[] {
  const vistos = new Set(exemplos.map(normal));
  const out: Carta[] = [];
  for (const c of lista) {
    const x = c as { texto?: unknown; midia?: unknown };
    if (typeof x?.texto !== "string") continue;
    const texto = x.texto.replace(/\s+/g, " ").trim().slice(0, 280).trim();
    const n = normal(texto);
    if (texto.length < 3 || vistos.has(n)) continue;
    vistos.add(n);
    out.push({ texto, midia: typeof x.midia === "string" && MIDIAS.includes(x.midia) ? x.midia : null });
    if (out.length >= quantidade) break;
  }
  return out;
}

Deno.serve(async (req) => {
  const permitida = Deno.env.get("ALLOWED_ORIGIN") ?? "";
  const origem = req.headers.get("Origin") ?? "";
  // só aceita chamadas do site do jogo
  if (!permitida || origem !== permitida) return new Response("origem não permitida", { status: 403 });
  const h = { ...cors(permitida), "Content-Type": "application/json" };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(permitida) });
  if (req.method !== "POST") return new Response(JSON.stringify({ erro: "falha" }), { status: 405, headers: h });
  const responder = (corpo: unknown) => new Response(JSON.stringify(corpo), { headers: h });

  // validação da entrada
  let entrada: Record<string, unknown>;
  try { entrada = await req.json(); } catch (_) { return new Response(JSON.stringify({ erro: "entrada" }), { status: 400, headers: h }); }
  const sala = typeof entrada.sala === "string" ? entrada.sala : "";
  const tipo = String(entrada.tipo ?? ""), nivel = String(entrada.nivel ?? "");
  const tema = typeof entrada.tema === "string" ? entrada.tema.trim() : "";
  const quantidade = Number(entrada.quantidade ?? 3);
  if (!sala || sala.length > 30 || !TIPOS.includes(tipo) || !NIVEIS.includes(nivel) || tema.length > 60 || /[\r\n]/.test(tema)
    || !Number.isInteger(quantidade) || quantidade < 1 || quantidade > 5) {
    return new Response(JSON.stringify({ erro: "entrada" }), { status: 400, headers: h });
  }

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const limite = Math.max(1, Number(Deno.env.get("IA_LIMITE_DIA") ?? 40) || 40);
  const dia = hojeBahia();
  try {
    // a sala existe?
    const s = await db.from("salas").select("codigo").eq("codigo", sala).maybeSingle();
    if (s.error) return responder({ erro: "falha" });
    if (!s.data) return responder({ erro: "sala" });
    // limite do dia (a soma só acontece depois de uma resposta válida)
    const u = await db.from("ia_uso").select("qtd").eq("sala", sala).eq("dia", dia).maybeSingle();
    if (u.error) return responder({ erro: "falha" });
    if ((u.data?.qtd ?? 0) >= limite) return responder({ erro: "limite", usadasHoje: u.data?.qtd ?? 0, limite });
    // até 15 cartas padrão do mesmo tipo e nível, para não repetir
    const ex = await db.from("cartas").select("texto").is("sala", null).eq("tipo", tipo).eq("nivel", nivel).eq("ativa", true).limit(200);
    const exemplos = (ex.data ?? []).map((x: { texto: string }) => x.texto).sort(() => Math.random() - 0.5).slice(0, 15);

    const user = [
      `Tipo: ${tipo}`,
      `Nível: ${nivel}`,
      tema ? `Tema: ${tema}` : "Tema: livre",
      `Quantidade: ${quantidade}`,
      exemplos.length ? `Exemplos para NÃO repetir:\n${exemplos.map((t: string) => `- ${t}`).join("\n")}` : "",
    ].filter(Boolean).join("\n");

    // uma nova tentativa se vier JSON inválido, sem cartas ou recusa
    let cartas: Carta[] = [];
    for (let tentativa = 0; tentativa < 2 && !cartas.length; tentativa++) {
      const bruto = await pedirMistral(user);
      if (bruto) cartas = limpar(bruto, exemplos, quantidade);
    }
    if (!cartas.length) return responder({ erro: "recusado" });

    const r = await db.rpc("ia_registrar_uso", { p_sala: sala, p_dia: dia });
    return responder({ cartas, usadasHoje: typeof r.data === "number" ? r.data : (u.data?.qtd ?? 0) + 1, limite });
  } catch (_) {
    return responder({ erro: "falha" });
  }
});
