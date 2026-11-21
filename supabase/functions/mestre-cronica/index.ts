// Longe & Perto — Edge Function "mestre-cronica": narrador de RPG cooperativo pela Mistral.
// A chave da Mistral fica exclusivamente nos secrets do Supabase (MISTRAL_API_KEY).
import { createClient } from "jsr:@supabase/supabase-js@2";

const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";

const SISTEMA = `Você é o Mestre narrador de uma crônica interativa cooperativa para um casal adulto, jogada durante uma chamada de vídeo.

Regras obrigatórias:
- Escreva em português do Brasil natural, envolvente e sem emojis.
- Narração enxuta: 2 a 3 parágrafos curtos (no máximo 650 caracteres no total), com ritmo ágil para ler em voz alta.
- Mantenha coerência com a energia, o inventário e o resumo dos turnos anteriores.
- Respeite o resultado da rolagem de dado enviada:
  - "falha": consequência interessante ou reviravolta que aumenta a tensão (pode reduzir energia em -1 ou -2).
  - "parcial": sucesso com custo, dilema ou pista incompleta.
  - "sucesso": avanço claro e recompensador.
  - "critico": avanço marcante, descoberta importante ou item útil.
- Progressão em 3 atos:
  - Ato 1: descoberta e exploração inicial.
  - Ato 2: complicação, dilema central ou reviravolta.
  - Ato 3: clímax e desfecho satisfatório (marque "fim_historia": true quando encerrar a jornada).
- Responda SOMENTE com um objeto JSON válido, sem texto fora do JSON, exatamente nesta estrutura:
{
  "narracao": "Texto da cena em 2 a 3 parágrafos curtos.",
  "opcoes_sugeridas": ["Opção curta 1", "Opção curta 2", "Opção curta 3"],
  "mudancas": {
    "energia": [0, 0],
    "itens_ganhos": [],
    "itens_usados": []
  },
  "resumo_atualizado": "Resumo curto de até 400 caracteres do estado atual da história.",
  "avancar_ato": false,
  "fim_historia": false
}`;

const hojeBahia = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bahia" }).format(new Date());

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

function clampDelta(n: unknown): number {
  const v = Math.round(Number(n) || 0);
  return Math.max(-3, Math.min(3, v));
}

function limparListaTexto(val: unknown, maxItens: number, maxLen: number): string[] {
  if (!Array.isArray(val)) return [];
  return val
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.replace(/\s+/g, " ").trim().slice(0, maxLen))
    .filter(Boolean)
    .slice(0, maxItens);
}

type RespostaMestre = {
  narracao: string;
  opcoes_sugeridas: string[];
  mudancas: {
    energia: [number, number];
    itens_ganhos: string[];
    itens_usados: string[];
  };
  resumo_atualizado: string;
  avancar_ato: boolean;
  fim_historia: boolean;
};

async function chamarMistral(promptUsuario: string): Promise<RespostaMestre | null> {
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
        temperature: 0.8,
        max_tokens: 750,
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
    const narracao = typeof dados.narracao === "string" ? dados.narracao.trim().slice(0, 1200) : "";
    if (narracao.length < 10) return null;

    let opcoes = limparListaTexto(dados.opcoes_sugeridas, 3, 120);
    if (!opcoes.length && !dados.fim_historia) {
      opcoes = ["Investigar o local com calma", "Conversar sobre o próximo passo", "Seguir em frente juntos"];
    }

    const mud = (dados.mudancas && typeof dados.mudancas === "object" ? dados.mudancas : {}) as Record<string, unknown>;
    const enArr = Array.isArray(mud.energia) ? mud.energia : [0, 0];
    const resumo = typeof dados.resumo_atualizado === "string"
      ? dados.resumo_atualizado.replace(/\s+/g, " ").trim().slice(0, 400)
      : "";

    return {
      narracao,
      opcoes_sugeridas: opcoes,
      mudancas: {
        energia: [clampDelta(enArr[0]), clampDelta(enArr[1])],
        itens_ganhos: limparListaTexto(mud.itens_ganhos, 2, 50),
        itens_usados: limparListaTexto(mud.itens_usados, 2, 50),
      },
      resumo_atualizado: resumo,
      avancar_ato: Boolean(dados.avancar_ato),
      fim_historia: Boolean(dados.fim_historia),
    };
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
    return new Response(JSON.stringify({ erro: "metodo", mensagem: "Método não permitido." }), { status: 405, headers: h });
  }

  let entrada: Record<string, unknown>;
  try {
    entrada = await req.json();
  } catch (_) {
    return new Response(JSON.stringify({ erro: "entrada", mensagem: "JSON inválido." }), { status: 400, headers: h });
  }

  const salaCodigo = typeof entrada.sala_codigo === "string" ? entrada.sala_codigo.trim() : "";
  const acaoCasal = typeof entrada.acao_casal === "string" ? entrada.acao_casal.trim().slice(0, 280) : "";
  const ato = Math.max(1, Math.min(3, Math.round(Number(entrada.ato) || 1)));
  const turno = Math.max(1, Math.round(Number(entrada.turno) || 1));

  if (!salaCodigo || salaCodigo.length > 30 || !acaoCasal) {
    return new Response(JSON.stringify({ erro: "entrada", mensagem: "Dados obrigatórios ausentes." }), { status: 400, headers: h });
  }

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
      return new Response(JSON.stringify({ erro: "falha", mensagem: "Erro ao validar a sala." }), { status: 500, headers: h });
    }
    if (!s.data) {
      return new Response(JSON.stringify({ erro: "sala", mensagem: "Sala não encontrada." }), { status: 404, headers: h });
    }

    const u = await db.from("ia_uso").select("qtd").eq("sala", salaCodigo).eq("dia", dia).maybeSingle();
    if (u.error) {
      return new Response(JSON.stringify({ erro: "falha", mensagem: "Erro ao consultar cota diária." }), { status: 500, headers: h });
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

    const cenario = (entrada.cenario && typeof entrada.cenario === "object" ? entrada.cenario : {}) as Record<string, unknown>;
    const resumo = typeof entrada.resumo_historia === "string" ? entrada.resumo_historia.trim().slice(0, 600) : "";
    const jogadores = Array.isArray(entrada.jogadores) ? entrada.jogadores : [];
    const rolagem = (entrada.rolagem && typeof entrada.rolagem === "object" ? entrada.rolagem : {}) as Record<string, unknown>;

    const promptUsuario = [
      `Cenário: ${String(cenario.titulo ?? "Crônica")} (${String(cenario.tema ?? "aventura")})`,
      cenario.ato_descricao ? `Objetivo do Ato ${ato}: ${String(cenario.ato_descricao)}` : "",
      `Ato atual: ${ato} de 3 · Turno: ${turno}`,
      resumo ? `Resumo até agora: ${resumo}` : "Resumo até agora: Início da aventura.",
      `Jogadores: ${JSON.stringify(jogadores)}`,
      `Ação escolhida pelo casal: ${acaoCasal}`,
      `Rolagem de dado: dado=${rolagem.dado ?? "?"}, atributo=${rolagem.atributo ?? "?"}, bonus=${rolagem.bonus ?? 0}, total=${rolagem.total ?? "?"}, faixa=${rolagem.faixa ?? "parcial"}`,
    ].filter(Boolean).join("\n");

    let resposta: RespostaMestre | null = null;
    for (let tentativa = 0; tentativa < 2 && !resposta; tentativa++) {
      resposta = await chamarMistral(promptUsuario);
    }

    if (!resposta) {
      return new Response(
        JSON.stringify({ erro: "parse", mensagem: "O Mestre não conseguiu montar a cena agora. Tente novamente." }),
        { status: 502, headers: h }
      );
    }

    const rUso = await db.rpc("ia_registrar_uso", { p_sala: salaCodigo, p_dia: dia });
    const novoTotal = typeof rUso.data === "number" ? rUso.data : usadas + 1;
    const restantesHoje = Math.max(0, limite - novoTotal);

    return new Response(
      JSON.stringify({ ...resposta, restantes_hoje: restantesHoje, usadas_hoje: novoTotal, limite }),
      { status: 200, headers: h }
    );
  } catch (_) {
    return new Response(
      JSON.stringify({ erro: "falha", mensagem: "Não foi possível falar com o Mestre agora. Tente novamente." }),
      { status: 502, headers: h }
    );
  }
});
