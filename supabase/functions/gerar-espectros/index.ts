// Longe & Perto — Edge Function "gerar-espectros": gera pares de extremos inéditos para o Sintonizador pela Mistral.
// A chave da Mistral fica exclusivamente nos secrets do Supabase (MISTRAL_API_KEY).
import { createClient } from "jsr:@supabase/supabase-js@2";

const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";

const CATEGORIAS_VALIDAS = new Set([
  "geral",
  "cotidiano",
  "casal",
  "cultura-pop",
  "absurdo",
  "ousado",
]);

const DESCRICAO_CATEGORIA: Record<string, string> = {
  geral: "temas variados (cotidiano, casal, cultura pop e dilemas divertidos)",
  cotidiano: "hábitos do dia a dia, comidas, rotina, trabalho, compras e clima",
  casal: "encontros, viagens, convivência, romance, reencontro e mensagens",
  "cultura-pop": "filmes, séries, músicas, jogos, nostalgia e entretenimento",
  absurdo: "dilemas engraçados, superpoderes e comparações improváveis",
  ousado: "clima adulto respeitoso, sedução e tensão romântica, sem conteúdo explícito",
};

const SISTEMA = `Você cria pares de extremos inéditos para o jogo "Sintonizador" (estilo Wavelength) jogado por um casal adulto em português do Brasil.

Regras obrigatórias:
- Escreva em português do Brasil natural, criativo e sem emojis.
- Cada extremo ("esquerda" e "direita") deve ser curto: no máximo 3 a 4 palavras (até 36 caracteres), para caber bem na tela de um celular.
- Os dois extremos devem formar um espectro contínuo, claro e divertido de debater (algo que faça sentido posicionar de 0% a 100%).
- Não repita nenhum par parecido com a lista de exemplos a evitar.
- Nunca use conteúdo explícito ou ofensivo.
- Responda SOMENTE com um objeto JSON válido, sem texto fora do JSON, exatamente nesta estrutura:
{
  "pares": [
    { "esquerda": "Extremo esquerdo", "direita": "Extremo direito", "categoria": "cotidiano" }
  ]
}`;

const hojeBahia = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bahia" }).format(new Date());

function corsHeaders(origem: string) {
  return {
    "Access-Control-Allow-Origin": origem,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function origemValida(origem: string): string | null {
  const permitida = (Deno.env.get("ALLOWED_ORIGIN") ?? "").trim();
  if (permitida && origem === permitida) return permitida;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origem)) return origem;
  if (!permitida && origem) return origem;
  return null;
}

function limparJsonTexto(bruto: string): string {
  return bruto
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function limparTexto(val: unknown, maxLen: number): string {
  if (typeof val !== "string") return "";
  return val
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

type ParEspectro = {
  esquerda: string;
  direita: string;
  categoria: string;
};

async function chamarMistral(
  promptUsuario: string,
  categoriaPadrao: string,
  quantidade: number,
  permitirOusado: boolean
): Promise<ParEspectro[] | null> {
  const chave = Deno.env.get("MISTRAL_API_KEY") ?? "";
  if (!chave) throw new Error("chave_ausente");

  const modelo = Deno.env.get("MISTRAL_MODEL") || "mistral-medium-latest";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  let r: Response;
  try {
    r = await fetch(MISTRAL_URL, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${chave}`,
      },
      body: JSON.stringify({
        model: modelo,
        messages: [
          { role: "system", content: SISTEMA },
          { role: "user", content: promptUsuario },
        ],
        response_format: { type: "json_object" },
        temperature: 0.9,
        max_tokens: 600,
      }),
    });
  } catch (_) {
    throw new Error("falha_rede");
  } finally {
    clearTimeout(timer);
  }

  if (!r.ok) throw new Error("falha_api");

  try {
    const j = await r.json();
    const conteudo = j?.choices?.[0]?.message?.content;
    if (typeof conteudo !== "string") return null;
    const dados = JSON.parse(limparJsonTexto(conteudo)) as Record<string, unknown>;
    const lista = Array.isArray(dados.pares) ? dados.pares : [];

    const vistos = new Set<string>();
    const validos: ParEspectro[] = [];

    for (const item of lista) {
      if (!item || typeof item !== "object") continue;
      const obj = item as Record<string, unknown>;
      const esquerda = limparTexto(obj.esquerda, 40);
      const direita = limparTexto(obj.direita, 40);
      if (esquerda.length < 2 || direita.length < 2) continue;
      if (esquerda.toLowerCase() === direita.toLowerCase()) continue;

      const chaveUnica = `${esquerda.toLowerCase()}|${direita.toLowerCase()}`;
      if (vistos.has(chaveUnica)) continue;
      vistos.add(chaveUnica);

      let cat = limparTexto(obj.categoria, 20).toLowerCase();
      if (!CATEGORIAS_VALIDAS.has(cat)) cat = categoriaPadrao;
      if (!permitirOusado && cat === "ousado") cat = "casal";

      validos.push({ esquerda, direita, categoria: cat });
      if (validos.length >= quantidade) break;
    }

    return validos.length ? validos : null;
  } catch (_) {
    return null;
  }
}

Deno.serve(async (req) => {
  const origem = req.headers.get("Origin") ?? "";
  const okOrigem = origemValida(origem);
  if (!okOrigem) {
    return new Response("origem não permitida", { status: 403 });
  }
  const h = { ...corsHeaders(okOrigem), "Content-Type": "application/json" };
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(okOrigem) });
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ erro: "metodo", mensagem: "Método não permitido." }),
      { status: 405, headers: h }
    );
  }

  let entrada: Record<string, unknown>;
  try {
    entrada = await req.json();
  } catch (_) {
    return new Response(
      JSON.stringify({ erro: "entrada", mensagem: "JSON inválido." }),
      { status: 400, headers: h }
    );
  }

  const salaCodigo = typeof entrada.sala_codigo === "string" ? entrada.sala_codigo.trim() : "";
  if (!salaCodigo || salaCodigo.length > 30) {
    return new Response(
      JSON.stringify({ erro: "entrada", mensagem: "Código da sala obrigatório." }),
      { status: 400, headers: h }
    );
  }

  const permitirOusado = Boolean(entrada.permitir_ousado);
  const catBruta = typeof entrada.categoria === "string" ? entrada.categoria.trim().toLowerCase() : "geral";
  let categoria = CATEGORIAS_VALIDAS.has(catBruta) ? catBruta : "geral";
  if (!permitirOusado && categoria === "ousado") {
    categoria = "geral";
  }

  const quantidade = Math.max(3, Math.min(5, Math.round(Number(entrada.quantidade) || 5)));

  const evitar = Array.isArray(entrada.evitar)
    ? entrada.evitar
        .filter((x): x is string => typeof x === "string")
        .map((x) => limparTexto(x, 85))
        .filter(Boolean)
        .slice(0, 20)
    : [];

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );
  const limite = Math.max(1, Number(Deno.env.get("IA_LIMITE_DIA") ?? 40) || 40);
  const dia = hojeBahia();

  try {
    const s = await db.from("salas").select("codigo").eq("codigo", salaCodigo).maybeSingle();
    if (s.error) {
      return new Response(
        JSON.stringify({ erro: "falha", mensagem: "Erro ao validar a sala." }),
        { status: 500, headers: h }
      );
    }
    if (!s.data) {
      return new Response(
        JSON.stringify({ erro: "sala", mensagem: "Sala não encontrada." }),
        { status: 404, headers: h }
      );
    }

    const u = await db
      .from("ia_uso")
      .select("qtd")
      .eq("sala", salaCodigo)
      .eq("dia", dia)
      .maybeSingle();
    if (u.error) {
      return new Response(
        JSON.stringify({ erro: "falha", mensagem: "Erro ao consultar cota diária." }),
        { status: 500, headers: h }
      );
    }
    const usadas = u.data?.qtd ?? 0;
    if (usadas >= limite) {
      return new Response(
        JSON.stringify({
          erro: "limite",
          mensagem: "Vocês atingiram o limite diário de gerações de IA. Tentem novamente amanhã.",
          restantes_hoje: 0,
        }),
        { status: 429, headers: h }
      );
    }

    const linhasPrompt = [
      `Gere exatamente ${quantidade} pares de extremos inéditos para o Sintonizador.`,
      `Categoria solicitada: ${categoria} (${DESCRICAO_CATEGORIA[categoria] || DESCRICAO_CATEGORIA.geral}).`,
      permitirOusado
        ? "Tema ousado respeitoso está liberado caso faça sentido para a categoria."
        : "PROIBIDO tema ousado, sensual ou adulto. Mantenha tudo leve e divertido.",
      evitar.length
        ? `Evite repetir ou parafrasear estes espectros recentes:\n- ${evitar.join("\n- ")}`
        : "",
    ].filter(Boolean);

    let pares: ParEspectro[] | null = null;
    for (let tentativa = 0; tentativa < 2 && !pares; tentativa++) {
      pares = await chamarMistral(linhasPrompt.join("\n"), categoria, quantidade, permitirOusado);
    }

    if (!pares) {
      return new Response(
        JSON.stringify({
          erro: "parse",
          mensagem: "Não foi possível gerar espectros agora. Tente novamente em instantes.",
        }),
        { status: 502, headers: h }
      );
    }

    const rUso = await db.rpc("ia_registrar_uso", { p_sala: salaCodigo, p_dia: dia });
    const novoTotal = typeof rUso.data === "number" ? rUso.data : usadas + 1;
    const restantesHoje = Math.max(0, limite - novoTotal);

    return new Response(
      JSON.stringify({
        pares,
        restantes_hoje: restantesHoje,
        usadas_hoje: novoTotal,
        limite,
      }),
      { status: 200, headers: h }
    );
  } catch (_) {
    return new Response(
      JSON.stringify({
        erro: "falha",
        mensagem: "Não foi possível conectar à IA agora. Tente novamente.",
      }),
      { status: 502, headers: h }
    );
  }
});
