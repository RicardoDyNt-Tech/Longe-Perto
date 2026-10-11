# Plano — Longe & Perto: contador do reencontro em tempo real

Ajuste pequeno, uma fase e um commit, sem SQL. Pode entrar sobre a versão que estiver na `main`.

**Objetivo:** o contador do reencontro deixa de contar só dias e passa a mostrar **dias, horas, minutos e segundos**, atualizando ao vivo, até o horário exato do encontro.

---

## Regras para o Claude Code

Valem as **Regras da v2**:
- mudança mínima;
- não alterar `config.js`;
- não rodar SQL;
- texto só via `textContent`;
- valores padrão para salas antigas;
- sem dependências novas.

---

## 1. Data e hora do reencontro

Hoje a data fica em `estado.reencontro` (`'AAAA-MM-DD'`). Passa a aceitar data **e hora**:

```js
reencontro: '2026-10-10T14:30'   // horário de Brasília/Bahia (America/Bahia, UTC−3)
```

- **Formulário:** o campo de data ganha um campo de hora (`<input type="time">`) ao lado, e vira "Data e hora do encontro".
  - **Sem hora (salas antigas ou campo vazio):** vale **00:00** do dia, e o app mostra a dica "Coloque o horário para o contador ficar exato".
- **Fuso:** grava sempre no fuso **America/Bahia (UTC−3)**, sem horário de verão. Para calcular, converter com o deslocamento fixo `-03:00` (`new Date('2026-10-10T14:30:00-03:00')`). Assim os dois celulares contam igual, mesmo se um estiver com outro fuso.
- **Quem pode mudar:** os mesmos de hoje. Com as Configurações, segue a regra atual do contador.
- **Compatibilidade:** valor só com data (`'2026-10-10'`) continua funcionando, tratado como `'2026-10-10T00:00'`.

## 2. O contador

1. **Formato** (números grandes, rótulos pequenos embaixo):

   ```
   8      14      32      07
   dias   horas   min     seg
   ```

   - Com menos de 1 dia, esconde os dias: `14 h 32 min 07 s`.
   - Com menos de 1 hora, destaque visual (cor quente, pulsando de leve).
2. **Atualização:** a cada segundo, com um único `setInterval` de 1 s. Recalcula sempre a partir de `Date.now()`, sem ir subtraindo, para não acumular erro.
   - Pausar quando a aba ficar oculta (`visibilitychange`) e recalcular ao voltar.
   - Respeitar `prefers-reduced-motion`: sem o pulso, só o número.
3. **Embaixo:** "Encontro em sáb, 10 de out, às 14:30".
4. **Quando zerar:** "É agora! 💞" com uma animação curta (confete ou corações, CSS) e vibração `[200, 100, 200, 100, 400]`, respeitando o silenciar.
   - Se o modo presencial existir, oferecer o botão "Ligar o modo Juntos".
   - Depois do horário: "Vocês estão juntos há 2 h 15 min", até alguém marcar a próxima data.
5. **Onde aparece:** em todos os lugares onde hoje aparece "Faltam X dias":
   - Casa/Início;
   - mapa da saudade (v6);
   - tela de boa noite (v6);
   - cabeçalho do jogo (versão compacta, só `8d 14h 32m`).

## 3. Widget opcional na tela inicial do celular

Fica de fora: precisa do APK. Fica anotado para o plano do app Android.

---

## Aceite

- Definir 10/10 às 14:30 mostra a contagem certa nos dois celulares, com diferença de no máximo 1 segundo.
- O contador anda a cada segundo e não "pula" ao voltar de outra aba.
- Sala antiga com só a data conta até a meia-noite do dia e mostra a dica do horário.
- No horário: "É agora! 💞", animação e vibração.
- Um celular com outro fuso horário mostra o mesmo tempo restante.

## Prompt para colar no Claude Code

> Leia `plano-longe-perto-contador.md` na raiz do repositório. Crie a branch `contador` a partir da `main` e aplique num commit só: campo de hora junto da data do reencontro (fuso fixo −03:00, compatível com o valor antigo só de data) e contador ao vivo em dias, horas, minutos e segundos em todos os lugares onde hoje aparece "Faltam X dias". Siga as regras da v2 (mudança mínima, não alterar `config.js`, sem SQL, texto só via `textContent`, sem dependências novas). Rode o aceite, me conte o resultado e não faça merge na `main`.
