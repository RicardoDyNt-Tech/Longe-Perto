// Longe & Perto — conquistas do casal (v5).
// Cada conquista: { codigo, titulo, descricao, categoria: "jornada" | "ousadia", escopo: "casal" | "jogador", meta, contar(dados, jogador) }.
// `dados` vem pronto do app (tudo da sala):
//   partidas: [{ placar: [p0, p1], vencedor }] já na ordem dos jogadores atuais
//   autorais, envelopes, capsulas, apostas, observacoes, momentos, cofre, seq: [dias seguidos de cada um]
// As partidas antigas não têm os contadores da v5 (porNivel, eventos, pulosUsados…) e contam como zero.
(function () {
  const soma = (lista, f) => lista.reduce((s, x) => s + (Number(f(x)) || 0), 0);
  const doJogador = (d, i, f) => soma(d.partidas, p => f(p.placar[i] || {}));
  // sintonia e missão em dupla contam para os dois no placar: do casal vale o maior dos dois em cada partida
  const doCasal = (d, campo) => soma(d.partidas, p => Math.max(Number((p.placar[0] || {})[campo]) || 0, Number((p.placar[1] || {})[campo]) || 0));
  const nivel = (p, n, k) => ((p.porNivel || {})[n] || {})[k] || 0;
  const cheio = a => Array.isArray(a) && a.length === 2 && a.every(x => typeof x === "string" && x.length);
  const TIPOS_EVENTO = ["efeito", "duelo", "sintonia", "missao_dupla"];

  const jornada = (codigo, titulo, descricao, escopo, meta, contar) => ({ codigo, titulo, descricao, categoria: "jornada", escopo, meta, contar });
  const ousadia = (codigo, titulo, descricao, meta, contar) => ({ codigo, titulo, descricao, categoria: "ousadia", escopo: "jogador", meta, contar });

  window.CONQUISTAS = [
    // Jornada · casal
    jornada("primeira_partida", "Primeira de muitas", "1 partida terminada", "casal", 1, d => d.partidas.length),
    jornada("dez_partidas", "Casal de carteirinha", "10 partidas terminadas", "casal", 10, d => d.partidas.length),
    jornada("cinquenta_partidas", "Temporada completa", "50 partidas terminadas", "casal", 50, d => d.partidas.length),
    jornada("sintonia_5", "Na mesma frequência", "5 sintonias certeiras", "casal", 5, d => doCasal(d, "sintonias")),
    jornada("sintonia_20", "Telepatia", "20 sintonias certeiras", "casal", 20, d => doCasal(d, "sintonias")),
    jornada("dupla_1", "Time", "1 missão em dupla concluída", "casal", 1, d => doCasal(d, "duplas")),
    jornada("dupla_10", "Dupla imbatível", "10 missões em dupla concluídas", "casal", 10, d => doCasal(d, "duplas")),
    jornada("autorais_10", "Autores", "10 cartas criadas por vocês", "casal", 10, d => d.autorais),
    jornada("autorais_50", "Baralho próprio", "50 cartas criadas por vocês", "casal", 50, d => d.autorais),
    jornada("envelope_1", "Correio do amor", "1 envelope aberto", "casal", 1, d => d.envelopes.filter(x => x.aberto_em).length),
    jornada("envelope_10", "Carteiros", "10 envelopes abertos", "casal", 10, d => d.envelopes.filter(x => x.aberto_em).length),
    jornada("capsula_1", "Viajantes do tempo", "1 cápsula aberta", "casal", 1, d => d.capsulas.filter(x => cheio(x.respostas) && cheio(x.respostas_depois)).length),
    jornada("apostas_10", "Conheço você", "10 apostas certeiras (somando os dois)", "casal", 10, d => d.apostas.filter(x => x.resultado === "acertou").length),
    jornada("observacao_4", "Olhos atentos", "4 missões de observação confirmadas", "casal", 4, d => d.observacoes.length),
    jornada("album_10", "Álbum de família", "10 momentos no álbum", "casal", 10, d => d.momentos.length),
    jornada("cofre_1", "Promessa cumprida", "1 item do cofre marcado como feito", "casal", 1, d => d.cofre.filter(x => x.feito).length),
    jornada("eventos_todos", "Experimentamos de tudo", "Pelo menos 1 de cada: efeito, duelo, sintonia e missão em dupla", "casal", 4,
      d => TIPOS_EVENTO.filter(t => d.partidas.some(p => p.placar.some(q => ((q || {}).eventos || {})[t] > 0))).length),
    // Jornada · jogador
    jornada("vitoria_1", "Primeira vitória", "1 vitória", "jogador", 1, (d, i) => d.partidas.filter(p => p.vencedor === i).length),
    jornada("vitoria_10", "Campeão(ã)", "10 vitórias", "jogador", 10, (d, i) => d.partidas.filter(p => p.vencedor === i).length),
    jornada("sequencia_7", "Constância", "7 dias seguidos no desafio do dia", "jogador", 7, (d, i) => d.seq[i]),
    jornada("sequencia_30", "Inabalável", "30 dias seguidos no desafio do dia", "jogador", 30, (d, i) => d.seq[i]),
    jornada("sem_pulo", "Sem desculpas", "Terminar uma partida sem usar nenhum pulo", "jogador", 1,
      (d, i) => d.partidas.filter(p => p.placar[i] && p.placar[i].pulosUsados === 0).length),
    jornada("duelista_10", "Duelista", "10 duelos vencidos", "jogador", 10, (d, i) => doJogador(d, i, q => q.duelos)),
    // Ousadia · jogador
    ousadia("prendas_10", "Paga tudo", "10 prendas cumpridas", 10, (d, i) => doJogador(d, i, q => q.prendas)),
    ousadia("sem_filtro", "Sem filtro", "30 verdades Picante ou Pesado cumpridas", 30, (d, i) => doJogador(d, i, q => nivel(q, "picante", "v") + nivel(q, "pesado", "v"))),
    ousadia("corajoso_20", "Corajoso(a)", "20 desafios Pesados cumpridos", 20, (d, i) => doJogador(d, i, q => nivel(q, "pesado", "d"))),
    ousadia("indomavel", "Indomável", "5 efeitos Pesados até o fim", 5, (d, i) => doJogador(d, i, q => q.efeitosPesados)),
    ousadia("secreta_pesada", "Agente secreto(a)", "1 missão secreta Pesada cumprida", 1, (d, i) => doJogador(d, i, q => q.secretasPesadas))
  ];
})();
