# Plano — Longe & Perto v9

Ideias novas, em seis blocos:

| # | Bloco | O que entra |
|---|---|---|
| 1 | **Reencontro** | Descongelamento, "A fatura chegou" (cofre com vales e prendas ao vivo), cardápio secreto de desejos |
| 2 | **Três noites seguidas** | Campanha em 3 atos, efeito borboleta (cláusulas para o dia seguinte) |
| 3 | **Enredos com escolhas** | Roleplay em árvore: cada escolha abre o próximo trecho |
| 4 | **Corpo e celular** | Desafio do silêncio (microfone como juiz), vibração sincronizada, carta secreta |
| 5 | **Daqui a um ano** | Cápsula de espelho, retrospectiva "Nosso ano", áudio-cápsula (só no app) |
| 6 | **Dias ruins** | Bateria social baixa, recados sem resposta, companhia silenciosa |

**Funciona no site e no app ao mesmo tempo**, na mesma sala. O que só existe no APK está marcado com 📱 e fica para o branch do APK; no site, esses botões não aparecem.

Pode entrar sobre a versão que estiver na `main`. Partes que dependem de versões ainda não implementadas ficam preparadas e são ignoradas se o recurso não existir:
- roteiros (v8);
- cofre (v3);
- Manual e Mãos juntas (v6/v7);
- modo Juntos;
- chamadas;
- Configurações.

---

## Regras para o Claude Code

Valem as **Regras da v2**:
- mudança mínima;
- não alterar `config.js`;
- não rodar SQL;
- texto do banco e de usuário só via `textContent`;
- valores padrão para salas antigas;
- sem dependências novas.

Se as Configurações existirem, tudo que for sorteado ou exibido passa por `permitido()` e respeita os níveis ligados.

---

## Fase 0 — SQL (já pronto)

O `029_v9.sql` é fornecido pronto e foi testado num Postgres local: roda duas vezes sem erro. O Claude Code coloca em `supabase/` e **não edita**. O Ricardo roda no SQL Editor, **depois do 022/023 (v8)**.

| Parte | O que cria |
|---|---|
| Cofre | Colunas `tipo` (`promessa`, `vale`, `prenda`), `credor`, `minutos`, `quitado_em`. Se o cofre não existir, pula com um aviso. |
| `vales_modelos` | 17 vales (massagem, escolher o filme, banho a dois, 10 min no comando…), por nível |
| `desejos_itens` | 38 desejos padrão (sair, casa, romântico, picante, pesado) + itens próprios da sala |
| `desejos_votos` / `desejos_envios` | Votos do cardápio secreto. **Sem leitura pela API**: só os RPCs `desejos_enviar`, `desejos_status`, `desejos_revelar` e `desejos_item_criar` |
| `roteiros` | 3 roteiros novos (Ato 1, 2 e 3), `ativo = false`, para não aparecerem soltos |
| `campanhas` | 2 campanhas: "Minissérie em 3 atos" e "Contagem para o reencontro" |
| `clausulas` / `clausulas_sala` | 25 cláusulas (5 por nível) e as cláusulas sorteadas de cada sala |
| `enredos` | 3 enredos com escolhas: "Primeiro encontro de novo" (romântico), "Estranhos no bar do hotel" (picante), "Entrevista proibida" (pesado) |
| `recados` | Recados sem resposta |
| `cartas` | 12 perguntas novas de cápsula (`capsula`, romântico) para o espelho de 1 ano |

**Sobre o segredo do cardápio:** ninguém lê os votos pela API, nem com o código da sala. Só aparece o que os dois marcaram. A exceção é quem é dono do projeto no Supabase (o Ricardo), que tecnicamente vê tudo no painel. Fica no combinado.

---

## Fase 1 — Reencontro

### 1.1 Descongelamento (os primeiros minutos juntos)
- Ao ligar o modo Juntos **pela primeira vez em cada reencontro**, antes de qualquer jogo, o app oferece "💞 Descongelar primeiro?" (pode pular).
- Uma sequência curta, uma tela por vez, com cronômetro e sem pontos:
  1. **Abraço de 2 minutos**, em silêncio.
  2. **Olhar nos olhos** por 1 minuto, sem falar.
  3. **Mãos dadas**, reconhecendo as mãos do outro, por 1 minuto.
  4. **"Uma coisa que eu só consigo dizer ao vivo"**: cada um diz uma.
  5. **Respirar juntos** por 1 minuto (círculo que cresce e diminui na tela, 4 s para cada lado).
- No fim: "Pronto. Agora sim 💞", e os jogos ficam liberados. Grava `estado.descongelado = 'AAAA-MM-DD'` do reencontro.

### 1.2 "A fatura chegou" (o cofre vira cobrança)
- **Durante a distância, entram no cofre:**
  - **Prendas para pagar ao vivo:** toda prenda ganha o botão "🧾 Deixar para o reencontro". A prenda sai da tela, vai para o cofre com `tipo = 'prenda'` e `credor` = o outro, e só conta quando for quitada.
  - **Vales:** quem vence uma partida ganha um vale sorteado de `vales_modelos`, dentro dos níveis ligados (`tipo = 'vale'`, `credor` = quem venceu, `minutos` do modelo). Aviso: "🎟️ Você ganhou: Vale massagem nas costas (15 min)".
  - **Promessas:** o que já existia (`tipo = 'promessa'`).
- **No modo Juntos**, o cartão "Hoje é dia de cumprir" do plano presencial vira **"🧾 A fatura chegou"**:
  - um placar no topo: "Ricardo pode cobrar 4 · Carol pode cobrar 6";
  - a lista separada por credor, com filtros (vales, prendas, promessas);
  - **"Resgatar"**, só para quem é credor: abre o item para os dois, com o cronômetro dos `minutos` já preparado;
  - **"Quitado ✓"**, também só o credor carimba: grava `quitado_em` e `feito = true`, e vai para o álbum de momentos com a data.
- Itens sem credor (promessas antigas) qualquer um marca.

### 1.3 Cardápio secreto de desejos (blind match)
- **Quando aparece:** com o reencontro marcado e faltando 3 dias ou menos, a Casa mostra "🤫 Cardápio secreto: marque o que você quer fazer nos dias juntos". Também pode abrir a qualquer momento pelo menu.
- **Rodada:** a data do reencontro (`estado.reencontro`, só a parte da data). Cada reencontro tem o seu cardápio.
- **Tela de escolha:**
  - os desejos padrão e os da sala, por categoria, só dos níveis ligados;
  - cada item com "Quero 💚" ou "Passo";
  - "+ Adicionar desejo" cria um item da sala (`desejos_item_criar`), que o outro também vai votar sem saber quem escreveu.
  - Os votos ficam **só no aparelho** (`localStorage`) até enviar.
- **Enviar:** "Enviar meu cardápio" (`desejos_enviar`), com confirmação "Depois de enviar não dá para mudar". O outro vê "{nome} já enviou o cardápio 🤫" (`desejos_status`), nunca o que foi marcado.
- **Revelar:** quando os dois enviarem, "✨ Ver o que deu match" (`desejos_revelar`) mostra **só os itens que os dois quiseram**, com uma animação de cartas virando.
  - Cada item do match vira um item do cofre (`tipo = 'promessa'`, sem credor), para entrar na fatura.
  - Se não houver nenhum match: "Nenhum match desta vez. Que tal conversar sobre isso? 😄".

**Aceite:**
- O descongelamento aparece uma vez por reencontro.
- A prenda deixada para depois aparece na fatura com o credor certo; só o credor resgata e quita.
- O vencedor da partida ganha um vale dentro dos níveis ligados.
- No cardápio, nenhum voto do outro aparece antes do match; o match mostra só os itens marcados pelos dois.

---

## Fase 2 — Três noites seguidas

### 2.1 Campanha em 3 atos
**Depende da sessão com roteiro (v8, Fase 3).** Sem ela, esta parte fica de fora.

- **Onde:** na aba Jogo, ao lado de "🎬 Jogar com roteiro", o botão **"🎞️ Campanha de 3 noites"**. Lista as campanhas de `campanhas` cujo `nivel_max` cabe nos níveis da sala.
- **Começar:** `estado.campanha = { id, noite: 0, comecou: 'AAAA-MM-DD', bonus: [0, 0], quebrou: [false, false] }`.
- **Cada noite:**
  - mostra a capa: "Noite 2 de 3 · Tensão & proibição", com a **regra da noite** em destaque (campo `regra`);
  - joga o roteiro da noite (`roteiro`, pelo nome), usando o mesmo mecanismo da v8.
- **Bônus:**
  - nas noites 1 e 2, cada 3 pontos viram 1 ficha de bônus para a noite 3;
  - na noite 2, o botão discreto "Quebrei a regra 🙈" (palavra de honra) zera as fichas de quem apertou.
- **Na noite 3**, cada ficha pode ser gasta para:
  - escolher o nível da próxima carta;
  - escolher quem cumpre;
  - pular sem prenda.
- **Próxima noite:** fica liberada no dia seguinte (fuso −03:00). Se pularem um dia, "Continuar a campanha" segue normal. Depois de 7 dias sem jogar, oferece "Recomeçar".
- **Fim:** tela "Campanha concluída 🎞️", com o placar das três noites e a conquista `campanha_1`, se as conquistas existirem.
- 📱 **No APK:** lembrete local às 21h nos dias da campanha: "Noite 2 da campanha hoje 🎞️".

### 2.2 Efeito borboleta (cláusulas para amanhã)
- **Quando:** ao terminar uma partida (ou uma noite da campanha), quem perdeu recebe uma **cláusula** sorteada de `clausulas` no nível mais alto ligado ou um abaixo.
  - Grava em `clausulas_sala` com `vale_para` = amanhã (fuso −03:00).
  - Aviso: "📜 Cláusula para amanhã: …". Empate: sem cláusula.
- **No dia seguinte:** a Casa mostra "📜 Cláusula de hoje para {nome}" para os dois.
  - **"Cumpriu ✓"**: só o outro (quem ganhou) marca, e grava `cumprida_em`.
  - **Veto:** cada um tem 1 veto por semana para trocar a cláusula por outra do mesmo nível.
- **Não cumpriu até o fim do dia:** a cláusula vira uma prenda na fatura (cofre, `tipo = 'prenda'`, credor = quem ganhou), se o cofre existir.
- **Configurações (dono):** `clausulas: { ativo: true }`. Desligado, nada é sorteado.
- 📱 **No APK:** lembrete local às 8h para quem deve: "📜 Sua cláusula de hoje".

**Aceite:**
- A campanha avança de noite em noite, com a regra na capa, e as fichas só valem na noite 3.
- "Quebrei a regra" zera as fichas de quem apertou.
- A cláusula sai só no nível permitido; só o vencedor marca "Cumpriu"; vencida, vira prenda na fatura.

---

## Fase 3 — Enredos com escolhas

- **Onde:** botão **"🎭 Enredos"** na aba Jogo. Lista os enredos de `enredos` com `nivel_max` dentro dos níveis da sala e `modo` compatível com o modo atual.
- **Começar:** escolher quem fica com cada papel (`papeis[0]` e `papeis[1]`). Grava `estado.enredo = { id, no: 'a', papeis: [jogadorDoPapel0, jogadorDoPapel1], caminho: ['a'] }`.
- **Cada trecho (`nos`)**, igual nas duas telas:
  - `narracao`: texto em itálico, para um dos dois ler em voz alta;
  - `verdade` / `desafio`: aparece para quem faz (`quem`: `vez` = papel 1, `outro` = papel 2, `ambos`), com "Cumpri";
  - `opcoes`: botões com o `rotulo`. Escolhe quem acabou de cumprir; em `ambos` ou `narracao`, qualquer um. A escolha aparece para o outro ("{nome} escolheu: Subir junto").
- **Fim** (`fim: true`): "Fim do enredo 🎭", com o caminho percorrido. O botão "Continuar com cartas" abre a roleta no nível mais alto do enredo.
- **Pontos:** +1 por trecho cumprido para quem fez, no placar da noite.
- **Sair:** "Sair do enredo", com confirmação. Novos enredos entram pelo banco (Table Editor ou seed), sem mudar código.

**Aceite:**
- Só aparecem enredos permitidos pelos níveis e pelo modo.
- As escolhas levam ao trecho certo nos dois aparelhos.
- O fim mostra o caminho percorrido.

---

## Fase 4 — Corpo e celular

### 4.1 Desafio do silêncio (microfone como juiz)
> **Limite real:** durante uma chamada do WhatsApp, o Android costuma dar o microfone só para o WhatsApp, e o site/app recebe silêncio. Por isso o desafio do silêncio vale:
> - **no modo Juntos** (sem chamada, um celular ouvindo a pessoa);
> - 📱 **na chamada de vídeo do próprio app** (Fase 7 do APK): quem julga é o celular do outro, analisando o áudio que chega.

- **Efeito "🤫 Valendo silêncio"**: botão nos desafios e prendas de nível Picante e Pesado, só onde o microfone estiver disponível.
- **Calibrar:** 3 s em silêncio para medir o barulho do ambiente; o limite é esse nível + uma margem, ajustável em 3 sensibilidades (fácil, normal, difícil).
- **Durante o desafio:** um medidor de volume ao vivo (Web Audio, `getUserMedia({ audio: true })`). Passou do limite (suspiro alto, risada, gemido):
  - a tela pisca em vermelho e vibra;
  - "Falhou! 🤫";
  - o outro escolhe uma prenda imediata.
- **Passou o tempo em silêncio:** +2 pontos.
- **Privacidade:** só mede o volume; nada é gravado nem enviado.

### 4.2 Vibração sincronizada
- **Mãos juntas (v6):** enquanto os dois seguram, os dois celulares vibram no ritmo de um batimento suave (`[0, 120, 100, 120, 700]`, em loop), sincronizado por um sinal a cada batida pelo canal da sala (broadcast).
- **Duelos e contagens 3-2-1:** vibração crescente nos dois aparelhos (100 ms, 200 ms, 400 ms).
- Funciona no Chrome do Android (site) e no app. No iPhone o navegador ignora, sem erro. Respeita o silenciar.

### 4.3 Carta secreta
- **Efeito "🔒 Carta secreta"** para verdades e desafios (quem gira pode ligar antes de virar a carta).
- O texto fica **borrado** e só aparece **enquanto o dedo estiver segurando** a carta. Soltou, borra de novo.
- **Celular virado para baixo** (sensor de orientação, `deviceorientation`): esconde na hora.
- 📱 **No APK:** com o bloqueio de prints ligado, a carta nunca aparece em print nem em compartilhamento de tela.
- **Por que não pelo sensor de proximidade:** cobrir o sensor (celular colado no rosto ou contra o peito) também tapa a tela, então daria para esconder, mas não para ler. "Segure para ver" + "virou, escondeu" resolve o mesmo problema.

### 4.4 Toque de presença pelo widget
Já está no plano do APK (Fase 4 "toque de saudade" e Fase 5 widget "Pensei em você"). Ajuste a incluir lá: a notificação acende a tela com "{nome} tocou na tela pensando em você" e vibração dupla.

**Aceite:**
- O silêncio só aparece com microfone disponível e falha acima do limite calibrado.
- As vibrações são simultâneas nos dois celulares.
- A carta secreta só aparece com o dedo segurando e some ao virar o celular.

---

## Fase 5 — Daqui a um ano

### 5.1 Cápsula de espelho
A cápsula do tempo da v5 já guarda a resposta de agora e a de depois (`respostas` e `respostas_depois`). O espelho muda só a experiência:
- **"Nova cápsula de espelho 🪞"**: abre em **1 ano** por padrão e sorteia primeiro entre as 12 perguntas novas de espelho.
- **Na data:** a resposta antiga **fica escondida** até a pessoa responder de novo ("Responda como você se sente hoje, antes de ver o que disse há um ano").
- **Depois de responder:** tela lado a lado, "Há um ano" × "Hoje", para cada um, com as duas datas.
- Na Casa: "🪞 Uma cápsula de espelho abre hoje".

### 5.2 "Nosso ano" (retrospectiva)
- **Onde:** botão "✨ Nosso ano" no Histórico; destaque automático na Casa em dezembro e no aniversário de namoro (campo `datas` do Manual ou `estado.namoroDesde`, se existir).
- **Formato:** telas em sequência, como stories (toque para avançar), calculadas no próprio app a partir das tabelas. Cada tela só aparece se houver dado:
  1. Horas em chamada e recorde (plano de chamadas).
  2. Partidas jogadas e o placar geral.
  3. Nível mais jogado ao longo dos meses.
  4. Dengos pedidos e quantos tiveram "Tô indo" (o Claude Code confere as colunas de `dengos`).
  5. A verdade favorita (a mais marcada com ⭐ em `cartas_marcadas`).
  6. O dia de mais saudade (o humor mais baixo da semana com mais "Pensei em você", ou o pico do mapa da saudade).
  7. Promessas e vales quitados no cofre, reencontros e dias juntos.
  8. Conquistas desbloqueadas.
  9. Fechamento: "Ano que vem tem mais 💞", com o contador do próximo reencontro.
- **Período:** "Este ano" ou "Desde o começo".
- **Sobre o pedido original "a verdade que mais destravou conversa":** o app não tem como medir conversa, então usa a verdade favorita marcada por vocês.

### 5.3 📱 Áudio-cápsula (só no app)
- **No modo Juntos:** "🎙️ Gravar uma áudio-cápsula" (até 3 min), falando sobre o momento.
- O áudio fica **só no aparelho em que foi gravado**, na pasta privada do app, protegido pela trava por digital. **Nunca vai para o servidor.**
- **Data de abertura:** próximo reencontro, aniversário de namoro ou data livre. Até lá, aparece só "🔒 Áudio-cápsula · abre em 87 dias", sem tocar.
- **Na data:** notificação local nos dois aparelhos (o outro recebe "Abram juntos a áudio-cápsula 💞" pelo push); toca no celular que gravou.
- **Avisos na tela:**
  - desinstalar o app apaga o áudio;
  - o cadeado é uma promessa, não um cofre-forte (quem tem o celular consegue mexer nos arquivos se quiser muito).
- **No site:** não aparece.

**Aceite:**
- No espelho, a resposta antiga só aparece depois da nova.
- "Nosso ano" mostra só as telas com dados e não quebra numa sala nova.
- 📱 A áudio-cápsula não toca antes da data e não aparece em nenhuma chamada de rede.

---

## Fase 6 — Dias ruins

### 6.1 Bateria social baixa 🪫
- **Ligar:** no humor (v7) ou na Casa, "🪫 Estou sem bateria social", com duração de 2 h, até amanhã ou até eu desligar. Grava `estado.bateria = { [jogador]: 'ISO de até quando' }`.
- **Para quem ligou:** a tela fica calma. Sem roleta nem desafios na Casa; aparecem só o "Pensei em você", os recados e a companhia silenciosa.
- **Para o outro:** o jogo, os desafios e o "Pedir dengo" para essa pessoa ficam escondidos. No lugar, aparece o **"Protocolo de cuidado"**, montado a partir do Manual de quem está sem bateria:
  - **O que não fazer / não perguntar hoje** (campo `naoFazer` e o campo novo `naoPerguntar`, até 300);
  - **O que acalma** (`acalma`);
  - **Ação silenciosa sugerida:** "Peça {delivery} sem avisar", "Mande a {musicaConforto}" ou "Mande só um boa noite, sem esperar resposta";
  - botões para mandar um recado sem resposta ou um "Pensei em você".
- **Sem o Manual preenchido:** usa as sugestões de `sugestoes_cuidado` do humor 1.
- 📱 **No APK:** o outro recebe "🪫 {nome} está sem bateria social hoje. Veja como cuidar" e, durante o período, só os pushes de carinho, sem "sua vez".

### 6.2 Recados sem resposta
Diferente do mural (desenho): só texto e **sem campo de resposta**.
- **"💛 Deixar um recado"**: até 500 caracteres, insere em `recados`.
- **Quem recebe:**
  - vê o recado num cartão suave;
  - **não há botão de responder**, só "Fechar";
  - ao abrir, grava `lido_em`;
  - um aviso: "Não precisa responder. É só para você receber o carinho."
- **Quem mandou vê:** "✓ {nome} leu e está só absorvendo o carinho, sem pressão para conversar".
- Lista dos recados recebidos, para reler (só leitura).

### 6.3 Companhia silenciosa 🕯️
- **"🕯️ Ficar junto em silêncio"**: uma tela quase vazia, para deixar o celular apoiado na mesa enquanto trabalham ou estudam.
- **Com os dois na tela** (Presence): o avatar do outro com uma **luz pulsando devagar**. Se o outro sair: "{nome} saiu, mas volta logo".
- **Tocar na luz:** a luz do outro brilha mais forte por 2 s e o celular vibra de leve. No máximo 1 toque a cada 30 s.
- **Música:** sugere uma faixa de `musicas` (níveis romântico e leve) com o player embutido. **Cada um dá o play no próprio celular:** o Spotify embutido não deixa sincronizar a música entre dois aparelhos.
- **Tela acesa:** Wake Lock no site (Chrome), keep-awake no app; brilho reduzido com fundo escuro.
- **Chamadas:** o tempo na companhia **não conta** como chamada (não manda o sinal de presença). O Histórico mostra só "horas de companhia" à parte.

**Aceite:**
- Com a bateria baixa ligada, o outro não vê jogo nem "Pedir dengo" para essa pessoa e vê o protocolo com os dados do Manual.
- O recado não tem resposta e quem mandou vê "leu".
- Na companhia, a luz pulsa só com os dois na tela e o toque chega ao outro.

---

## Estado — resumo dos campos novos

```js
descongelado: null,   // 'AAAA-MM-DD' do reencontro em que já descongelaram
campanha: null,       // { id, noite, comecou, bonus: [0,0], quebrou: [false,false] }
enredo: null,         // { id, no, papeis: [j0, j1], caminho: [] }
bateria: {},          // { 0: 'ISO até quando', 1: ... }
efeitos: { silencio: false, secreta: false }   // da carta atual
```

Manual (`manuais.campos`, sem SQL): campo novo `naoPerguntar` (até 300).

**Configurações (dono), se existirem:** `clausulas.ativo`, `fatura.vales` (ganhar vale ao vencer), `silencio.ativo`, `cardapio.ativo`. Todos ligados por padrão.

---

## Ordem de execução

1. Branch `v9` a partir da `main`.
2. **Fase 0:** colocar `029_v9.sql` em `supabase/` sem editar. Commit `sql v9`. **Parar para o Ricardo rodar.**
3. **Fase 1**, commit `reencontro: descongelar, fatura e cardápio secreto`.
4. **Fase 2**, commit `campanha e cláusulas`.
5. **Fase 3**, commit `enredos`.
6. **Fase 4**, commit `silêncio, vibração e carta secreta`.
7. **Fase 5**, commit `espelho e nosso ano` (a áudio-cápsula fica para o branch do APK).
8. **Fase 6**, commit `dias ruins`.
9. Rodar o checklist, reportar e **não fazer merge na `main`**.

Se o tempo for curto antes do próximo encontro: **as Fases 0 e 1** já mudam o reencontro, e **a Fase 6** é a de maior cuidado no dia a dia.

## Checklist de testes

- [ ] Um no site e outro no app (ou dois navegadores): tudo sincroniza nos dois sentidos.
- [ ] Descongelamento uma vez por reencontro.
- [ ] Fatura: prenda deixada para depois e vale aparecem com o credor certo; resgatar e quitar só pelo credor.
- [ ] Cardápio: votos invisíveis até os dois enviarem; match mostra só os itens marcados pelos dois e eles entram no cofre.
- [ ] Campanha: três noites em dias seguidos, regra na capa, fichas só na noite 3.
- [ ] Cláusula: sorteio no nível permitido, "Cumpriu" só do vencedor, vencida vira prenda.
- [ ] Enredo: escolhas levam ao trecho certo nos dois aparelhos.
- [ ] Silêncio: falha acima do limite; nada é gravado.
- [ ] Vibração simultânea nas Mãos juntas e no 3-2-1.
- [ ] Carta secreta: só com o dedo; some ao virar.
- [ ] Espelho: resposta antiga escondida até a nova.
- [ ] "Nosso ano" sem erro numa sala vazia.
- [ ] Bateria baixa: protocolo com os dados do Manual; jogo escondido para o outro.
- [ ] Recado sem resposta e com "leu".
- [ ] Companhia: luz e toque com os dois na tela.
- [ ] Sala antiga abre sem erro; console sem erros.

## Prompt para colar no Claude Code

> Leia `plano-longe-perto-v9.md` na raiz do repositório. Crie a branch `v9` a partir da `main` e siga a "Ordem de execução", com um commit por fase. Na Fase 0, coloque `029_v9.sql` em `supabase/` sem editar e pare para eu rodar no Supabase. O cardápio secreto usa só os RPCs `desejos_*` (os votos não são legíveis pela API). Aplique só o que existir no código hoje: partes que dependem de versões ainda não implementadas (cofre, roteiros da v8, Manual, Mãos juntas, modo Juntos, chamadas, Configurações) ficam preparadas e são ignoradas se o recurso não existir. Itens marcados com 📱 ficam para o branch do APK. Tudo tem que funcionar com um jogador no site e outro no app, na mesma sala. Siga as regras da v2 (mudança mínima, não alterar `config.js`, não rodar SQL, texto só via `textContent`, padrão para salas antigas, sem dependências novas). No fim, rode o checklist, me conte o resultado e não faça merge na `main`.
