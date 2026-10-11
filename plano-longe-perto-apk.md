# Plano — Longe & Perto: app Android (APK)

Transforma o site num app Android instalável, com o que o navegador não faz bem:
- notificações push;
- popups com botões;
- widgets na tela inicial;
- trava por digital;
- câmera e microfone;
- vibração à distância.

**O site continua existindo e funcionando igual, e os dois funcionam juntos:** a mesma sala, o mesmo placar e as mesmas cartas, com um de vocês no app e o outro no navegador, se quiserem. O app é o mesmo site aberto pelo **Capacitor**, com uma camada nativa que só liga quando roda dentro do APK.

**Instalação fora da Play Store.** A política do Google proíbe conteúdo sexual explícito, então o APK é gerado pelo GitHub Actions e instalado direto no celular.

---

## Decisões

| Tema | Decisão | Por quê |
|---|---|---|
| Embrulho | Capacitor **abrindo o site do GitHub Pages** (`server.url`), com uma tela "Sem internet" embutida para quando não houver conexão | O app fica **sempre na mesma versão do site**: mudança no site aparece no app na hora, sem gerar APK novo nem reinstalar. O app já não funciona sem internet de qualquer jeito (tudo vem do Supabase). Só mudanças na parte nativa (plugins, widgets) pedem APK novo. |
| Onde fica o código | Pasta nova `app/` no mesmo repositório | O site continua sem npm e sem dependências; só `app/` tem `package.json`. |
| Recursos nativos no site | Arquivo novo `nativo.js`, que não faz nada fora do APK e confere cada plugin com `Capacitor.isPluginAvailable()` antes de usar | Uma base de código só. O site pode ser mais novo que o APK instalado; se um plugin ainda não existe naquele APK, o recurso só não aparece. |
| Push | Firebase Cloud Messaging (FCM), gratuito | É o único caminho de push no Android. |
| Quem dispara o push | Webhooks do banco (Supabase) chamando a Edge Function `enviar-push` | O push sai quando alguém cria um dengo, carinho, envelope etc., mesmo com o app do outro fechado. |
| Texto das notificações | **Discreto por padrão** ("Longe & Perto · 💌 Chegou algo pra você") e escondido na tela bloqueada | Conteúdo +18 não pode aparecer no bloqueio nem na barra para quem pegar o celular. |
| Lembretes com hora marcada | Notificações locais agendadas no aparelho | Não precisam de servidor (reencontro, "Abra quando", boa noite). |
| Mídia íntima | **Continua nunca sendo guardada no servidor** | A câmera só lê QR, tira fotos que ficam no próprio aparelho e faz chamada ao vivo ponta a ponta. |
| Build | GitHub Actions gera o APK assinado, por botão ou por tag | Ricardo não precisa de Android Studio. |
| Onde baixar | Artefato do Actions (não Release pública) | O repositório é público; artefato só baixa quem está logado, e expira. |

---

## Site e app juntos

O app e o site são **o mesmo jogo, no mesmo banco**. Na prática:

| Situação | Como funciona |
|---|---|
| Ricardo no app, Carol no site (ou o contrário) | Mesma sala, mesmo `estado`, mesmo Realtime e Presence. Tudo sincroniza como hoje entre dois navegadores. |
| Mudança no site (cartas, telas, regras) | Chega no app na hora, porque o app abre o próprio site. |
| Mudança na parte nativa (push, widgets, digital) | Precisa de APK novo; o app avisa (Fase 8). |
| Recurso só do app (widgets, digital, ícone discreto, popup com botões, câmera para fotos locais, vibração com o app fechado) | No site, o botão nem aparece. Quem está no site continua **recebendo** o que vem do app: o toque de saudade vira vibração + aviso com a página aberta. |
| Notificações para quem está no site | Opcional: **push no navegador** (Fase 3, item "Web push"). Funciona no Chrome do Android com o site fechado. |

**Cuidados para não dar conflito:**
1. **Ninguém apaga campo que não conhece.** O `gravar()` tem que sempre partir do `estado` atual e mesclar só o que mudou (`{ ...estadoAtual, ...mudanca }`). Assim um aparelho com o site em cache mais antigo não apaga campos novos. O Claude Code confere isso na Fase 1 e corrige se o `gravar()` montar o objeto do zero.
2. **Cache do site no app:** o WebView guarda cache como o navegador. O app recarrega o site ao voltar de segundo plano depois de 30 min e o `index.html` sai sem cache (`?v=` nos scripts, que já é o padrão do GitHub Pages com mudança de arquivo).
3. **Primeira vez no app:** o app é como um navegador novo: não sabe a sala, o nome nem o token de dono (cada um fica no `localStorage` do próprio aparelho e o do app é separado do Chrome).
   - Tela de boas-vindas: "Já joga no navegador? Entre na mesma sala", com código, link de convite ou **QR** (Fase 6).
   - O dono leva o acesso pelo "👑 Entrar como dono" das Configurações, que já existe. **O token nunca vai em link nem em QR.**
4. **Link aberto no celular com o app instalado:** o site mostra uma faixa "Abrir no app 💞" (link `intent://` com o esquema `longeperto://`), só no Android e só se o usuário já marcou "tenho o app" naquele navegador.
5. **Push para os dois tipos:** a tabela `dispositivos` guarda `plataforma` (`android` ou `web`), e a mesma Edge Function manda para os dois pelo FCM.

---

## Regras para o Claude Code

Valem as **Regras da v2** e mais estas:
- mudança mínima no site; tudo de nativo passa por `nativo.js` e por `if (window.Capacitor?.isNativePlatform())`;
- **o site no navegador tem que continuar funcionando igual** a cada fase;
- não alterar `config.js`; não rodar SQL; não fazer deploy de Edge Function (o Ricardo faz);
- **nunca colocar no repositório:** keystore, senhas da keystore, `google-services.json`, conta de serviço do Firebase, chave da Mistral. Tudo vai em *GitHub Secrets* ou em *secrets do Supabase*;
- `.gitignore` em `app/` cobrindo `*.jks`, `*.keystore`, `google-services.json`, `node_modules`, `android/app/build`;
- dependências npm só dentro de `app/`, nas versões estáveis atuais compatíveis entre si (Capacitor e plugins na mesma versão principal);
- código nativo em Kotlin dentro de `app/android/`, só o necessário;
- branch `apk` a partir da `main`, um commit por fase, **não fazer merge na `main`**.

---

## Fase 0 — Preparação (o Ricardo faz, com o passo a passo abaixo)

O Claude Code escreve `app/LEIA-ME.md` com estes passos e **para** até o Ricardo confirmar.

1. **Nome do pacote:** `io.github.ricardodynt.longeperto` (não dá para mudar depois sem reinstalar).
2. **Keystore (a "assinatura" do app):** no PC, com o Java instalado (vem com o Android Studio, ou o JDK Temurin):
   ```
   keytool -genkeypair -v -keystore longeperto.jks -alias longeperto -keyalg RSA -keysize 2048 -validity 10000
   ```
   - Guardar o `longeperto.jks` e as senhas **fora do repositório** (Google Drive pessoal, por exemplo).
   - **Se perder a keystore, nenhuma atualização instala por cima:** tem que desinstalar e perder os dados locais.
   - Converter para texto: `base64 -w0 longeperto.jks > keystore.txt` (no Windows: `certutil -encode`).
3. **Firebase:** em console.firebase.google.com, criar o projeto "Longe e Perto" (sem Analytics) e adicionar um app Android com o nome do pacote acima. Baixar o `google-services.json`.
4. **Conta de serviço do Firebase** (para o servidor mandar push): Configurações do projeto → Contas de serviço → "Gerar nova chave privada". Baixa um `.json`. **Não colar em chat.**
5. **GitHub Secrets** (repositório → Settings → Secrets and variables → Actions):
   - `ANDROID_KEYSTORE_BASE64` — conteúdo do `keystore.txt`;
   - `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`longeperto`), `ANDROID_KEY_PASSWORD`;
   - `GOOGLE_SERVICES_JSON` — conteúdo inteiro do `google-services.json`.
6. **Secrets do Supabase** (Edge Functions → Secrets), usados na Fase 3:
   - `FCM_SERVICE_ACCOUNT` — conteúdo inteiro do `.json` da conta de serviço;
   - `PUSH_WEBHOOK_SECRET` — uma senha longa inventada (os webhooks mandam ela no cabeçalho).

---

## Fase 1 — O app abre (casca Capacitor e build)

1. **`app/`** com Capacitor: `appId` `io.github.ricardodynt.longeperto`, `appName` "Longe & Perto", `webDir` `www`.
2. **Abrir o site:** `server.url` = `https://ricardodynt-tech.github.io/Longe-Perto/`, `allowNavigation` só para esse domínio e o do Supabase. O `webDir` (`app/www`) tem só uma página "Sem internet 💔 · Tentar de novo", usada quando o site não carrega.
   - **Conferir o `gravar()`** (ver "Site e app juntos", item 1) e corrigir se ele não mesclar com o estado atual.
3. **Ícone e splash** a partir do ícone atual do site (gerados com `@capacitor/assets`).
4. **Workflow `.github/workflows/apk.yml`:**
   - dispara por `workflow_dispatch` (botão "Run workflow") e por tag `apk-v*`;
   - Node + Java 21 + Android SDK; `npm ci`, `npx cap sync android`;
   - recria `google-services.json` e a keystore a partir dos secrets **só durante o build** (não sobem como artefato);
   - `./gradlew assembleRelease` assinado; `versionCode` = número da execução do Actions; `versionName` = tag ou `0.0.<execução>`;
   - artefato `longe-perto-<versão>.apk`, retido por 30 dias.
5. **Ajustes que todo app precisa:**
   - botão voltar do Android fecha modais e volta de tela antes de sair do app;
   - barra de status na cor do tema (muda no modo Juntos);
   - links externos (Spotify, WhatsApp, imagens das posições) abrem fora do app;
   - `localStorage` funciona igual dentro do app, mas é **separado do Chrome**: a primeira abertura mostra a tela "Já joga no navegador?" (ver "Site e app juntos", item 3).
   - Recarregar o site ao voltar de segundo plano depois de 30 min.
6. **Como instalar** (vai no `LEIA-ME.md`): baixar o artefato no Actions → mandar o `.apk` pelo WhatsApp para os dois celulares → abrir → permitir "instalar apps desconhecidos" para o WhatsApp/Arquivos → instalar. Atualizar é igual: instala por cima, sem perder nada.

**Aceite:**
- O Actions gera um APK assinado sem nenhum segredo no repositório.
- O app abre, entra na sala, joga uma partida inteira e sincroniza com o site no navegador **nos dois sentidos** (app → site e site → app).
- Uma mudança publicada no site aparece no app ao reabrir, sem APK novo.
- Um aparelho com versão antiga do site não apaga campos novos do `estado`.
- Voltar do Android não fecha o app no meio de um modal.

---

## Fase 2 — Privacidade e conforto

Tudo isso aparece em **"📱 Este aparelho"**, uma seção nova de ajustes **locais** (valem só para o celular, não para a sala, então não passam pelo dono).

1. **Trava por digital/rosto** (`@aparajita/capacitor-biometric-auth` ou equivalente estável): pede ao abrir e ao voltar de segundo plano depois de X minutos (1, 5, 15). Sem biometria cadastrada, cai para o PIN/padrão do celular. Padrão: **ligada**.
2. **Bloquear prints e a prévia nos apps recentes** (`FLAG_SECURE`, via `@capacitor-community/privacy-screen`). Padrão: **ligado**. Aviso: com isso ligado, compartilhar a tela do app numa chamada não funciona.
3. **Ícone discreto:** troca o ícone e o nome na tela inicial para "Notas ✿" com ícone neutro (dois `activity-alias` no `AndroidManifest`, um plugin pequeno em Kotlin troca qual está ativo). Padrão: desligado.
4. **Tela sempre acesa** durante a partida, o cronômetro e a massagem (`@capacitor-community/keep-awake`).
5. **Vibração nativa** (`@capacitor/haptics`) no lugar do `navigator.vibrate`, respeitando o silenciar que já existe.
6. **Link de convite:** `longeperto://sala/CODIGO` abre o app direto na sala. No navegador, o link `https://…/Longe-Perto/?sala=CODIGO` continua como hoje.

**Aceite:**
- Ao reabrir o app depois do tempo escolhido, pede a digital antes de mostrar qualquer coisa.
- Com o bloqueio de prints ligado, o print sai preto e a tela de apps recentes fica em branco.
- O ícone discreto aparece como "Notas ✿" e o app abre normalmente.

---

## Fase 3 — Notificações push

### SQL (já pronto)
`027_dispositivos_push.sql`, fornecido pronto. O Claude Code coloca em `supabase/` sem editar e **para** para o Ricardo rodar.
- Tabela `dispositivos` (sala, jogador, token FCM, preferências): o app **não consegue ler**; só registra e remove pelos RPCs `registrar_dispositivo` e `remover_dispositivo`. Até 10 aparelhos por sala.
- Tabela `push_log`: registro de envios, para limitar spam.

### No app
1. Ao entrar numa sala no APK, pede a permissão de notificação (Android 13+) com uma tela explicando antes ("Para você saber quando {nome} mandar um dengo 💌").
2. Registra o token com `registrar_dispositivo(sala, jogador, token, preferencias)`. Troca de sala ou de jogador → registra de novo. Sair da sala → `remover_dispositivo`.
3. **Preferências** em "📱 Este aparelho → Notificações":
   - por tipo (dengo, carinho, envelope, abra quando, pergunta do dia, sua vez, mensagens do mural);
   - **horário de silêncio** (padrão 23:00–07:00, fuso −03:00); "Pedir dengo" pode furar o silêncio se marcado;
   - **mostrar o conteúdo** (desligado = texto discreto).
4. **Canais do Android** (cada um ajustável nas configurações do sistema):
   - `chamados` — importância alta, com som e popup: pedir dengo, toque de saudade, "é agora";
   - `carinhos` — importância normal: carinho, envelope, mural, pergunta do dia;
   - `jogo` — importância baixa: sua vez.
5. Todas as notificações com **visibilidade privada**: na tela bloqueada aparece só "Longe & Perto · nova notificação".
6. Tocar na notificação abre o app **na tela certa** (o dengo, o envelope, a sala na vez).

### Edge Function `enviar-push`
1. Recebe o webhook do banco (`INSERT` ou `UPDATE`), confere o cabeçalho `x-push-secret` contra `PUSH_WEBHOOK_SECRET` e recusa sem ele. Deploy com `--no-verify-jwt` (a proteção é o segredo).
2. **Mapa de eventos** num objeto só no topo do arquivo: tabela → como achar a sala, quem enviou, para quem vai, tipo, canal e texto. O Claude Code **confere os nomes reais das tabelas e colunas** no `supabase/` e no código (dengos, carinhos, envelopes, abra quando, respostas do dia, mural, humor) e só inclui as que existem.
3. **"Sua vez":** webhook de `UPDATE` em `salas`; só envia se `estado.vez` mudou de verdade (compara `old_record` com `record`) e no máximo 1 por sala a cada 2 minutos.
4. Busca os aparelhos do **outro jogador** em `dispositivos` (service role), aplica preferências e silêncio, consulta o `push_log` (no máximo 1 push do mesmo tipo por minuto por pessoa) e manda pela **API HTTP v1 do FCM**, gerando o token de acesso com a `FCM_SERVICE_ACCOUNT`.
5. Manda **mensagens de dados** (`data`, prioridade alta), não `notification`: quem monta a notificação é o app (Fase 4), para ter texto discreto, canal e botões.
6. Token que o FCM responde como inválido (`UNREGISTERED`) é apagado de `dispositivos`.
7. **Sem conteúdo íntimo no push:** no máximo o tipo e o nome de quem mandou; o texto do dengo/carinho só aparece se "mostrar o conteúdo" estiver ligado naquele aparelho, e ainda assim nunca na tela bloqueada.

### Webhooks (o Ricardo cria, com o passo a passo no `LEIA-ME.md`)
Supabase → Database → Webhooks → um por tabela do mapa (inclui `chamadas`, para os marcos do plano de chamadas, se ele já estiver no ar): evento `INSERT` (e `UPDATE` em `salas`), tipo "Supabase Edge Functions" → `enviar-push`, cabeçalho `x-push-secret`.

### Web push (para quem estiver no site)
Opcional, para o navegador do Android também receber notificação com o site fechado:
1. **Service worker** `sw-push.js` na raiz do site, com o SDK do Firebase Messaging carregado do CDN oficial (`gstatic.com`, versão fixa), sem npm. A configuração web do Firebase (chave pública e IDs) pode ficar no código: ela é pública por natureza. A chave VAPID pública também.
2. Em "Notificações" no site: botão "Receber avisos neste navegador". Registra com `registrar_dispositivo(..., p_plataforma => 'web')`.
3. A `enviar-push` manda para os tokens `web` com `webpush.notification` (título e texto discretos, sem botões) e para os `android` como já descrito.
4. Toque na notificação abre o site na tela certa.
5. Se não funcionar no navegador (iOS, aba anônima, permissão negada), o botão some e explica.

### Lembretes locais (sem servidor)
Com `@capacitor/local-notifications`, agendados no próprio aparelho sempre que o estado mudar:
- **reencontro:** 7 dias antes, 1 dia antes, 1 hora antes e na hora ("É agora! 💞");
- **"Abra quando…"** com data marcada;
- **boa noite** no horário escolhido (v6), se ligado.

Android 12+ pede a permissão de alarme exato para o "na hora"; se negada, avisa com até alguns minutos de atraso.

**Aceite:**
- Com o app da Carol **fechado**, o Ricardo pede um dengo e o celular dela mostra o popup em segundos.
- Na tela bloqueada, nada além de "Longe & Perto · nova notificação".
- No horário de silêncio, nada toca (exceto pedir dengo, se marcado).
- Sair da sala para de receber.
- Dez carinhos seguidos geram no máximo uma notificação por minuto.

---

## Fase 4 — Popup com botões e "toque de saudade"

1. **Serviço nativo** (Kotlin) que estende o serviço de mensagens do plugin de push do Capacitor (para não quebrar o registro do plugin) e monta a notificação a partir da mensagem de dados.
2. **Botões direto na notificação**, sem abrir o app:
   - Pedir dengo: **"Tô indo 💞"** e **"Agora não, mais tarde"**;
   - Carinho/envelope: **"💗 Mandar de volta"**;
   - Sua vez: **"Abrir jogo"**.
   - O botão chama, em segundo plano (WorkManager), o mesmo RPC ou insert que o app já usa, com a anon key e a sala/jogador guardados no aparelho. Se falhar sem internet, tenta de novo quando voltar.
3. **Toque de saudade:** botão novo na Casa, "📳 Mandar um toque". O celular do outro **vibra num padrão de batimento** (`[0,150,120,150,600,150,120,150]`) e mostra "{nome} está pensando em você". Limite: 1 por minuto. Respeita o silêncio.
4. **"É agora!" em tela cheia** (opcional, desligado por padrão): na hora do reencontro, aparece por cima da tela bloqueada como um alarme. No Android 14+ precisa liberar "notificações em tela cheia" nas configurações do app; o app mostra o atalho.

Sem "janela flutuante por cima de outros apps" (`SYSTEM_ALERT_WINDOW`): o popup do próprio Android (heads-up) já resolve e não precisa de permissão perigosa.

**Aceite:**
- "Tô indo" responde o dengo sem abrir o app, e o outro recebe a resposta.
- O toque de saudade vibra no padrão de batimento com o app fechado.

---

## Fase 5 — Widgets na tela inicial

Widgets nativos (`AppWidgetProvider` + `RemoteViews`, em Kotlin). O app grava os dados que os widgets usam num armazenamento local compartilhado, por um plugin pequeno (`WidgetPonte.atualizar(dados)`), sempre que o estado muda. O push da Fase 3 também atualiza os widgets com o app fechado.

1. **⏳ Contador do reencontro** (2×1 e 4×1):
   - dias em texto + **horas, minutos e segundos andando de verdade** com o `Chronometer` em contagem regressiva (Android 7+), sem gastar bateria;
   - a linha dos dias se atualiza à meia-noite com um alarme;
   - no fim: "É agora! 💞"; depois, "Juntos há X dias".
2. **💭 Humor de {nome}** (2×1): o emoji e a frase do humor atual do outro (v7) e há quanto tempo mudou. Toque abre o app no humor.
3. **💗 Pensei em você** (1×1): um botão. Toque manda um carinho (ou um toque de saudade, escolhido ao colocar o widget) **sem abrir o app**, com um "✓" de confirmação no próprio widget por 2 segundos. Limite: 1 por minuto.
4. **🎴 Pergunta do dia** (4×2, opcional): mostra a pergunta de hoje e se o outro já respondeu (sem mostrar a resposta). Toque abre para responder.

Todos respeitam o **ícone discreto**: com ele ligado, os widgets não mostram o nome do app nem conteúdo, só o contador e emojis.

**Aceite:**
- O contador do widget anda segundo a segundo e bate com o do app.
- A Carol muda o humor e o widget do Ricardo atualiza em segundos, com o app dele fechado.
- O botão "Pensei em você" manda o carinho sem abrir o app.

---

## Fase 6 — Câmera e microfone (sem guardar mídia íntima)

Permissões pedidas só na hora de usar, com explicação antes.

### Câmera
1. **Entrar na sala por QR code:** "Mostrar QR da sala" num celular, "Ler QR" no outro (leitor de código pela câmera, por exemplo `@capacitor-mlkit/barcode-scanning`).
2. **Álbum de momentos local:** no modo Juntos, "Cumprimos ✓" e os momentos ganham **"📷 Foto do momento"**.
   - A foto vai para a **pasta privada do app** (não para a galeria, não para o servidor), protegida pela trava por digital.
   - O álbum mostra as fotos do próprio aparelho junto dos momentos; no outro celular aparece só "📷 foto no celular de {nome}".
   - Botão "Salvar na galeria" e "Apagar", por foto. Desinstalar o app apaga tudo, e isso é avisado.

### Microfone
> **Atenção:** durante uma chamada do WhatsApp, o Android costuma dar o microfone só para o WhatsApp, e os outros apps recebem silêncio. Por isso os recursos de microfone abaixo valem **fora da chamada do WhatsApp** (ou dentro da chamada do próprio app, Fase 7, que usa o mesmo áudio). O app testa e avisa "o microfone está ocupado pela chamada".

1. **Sopre a vela 🕯️:** mini-jogo romântico para o modo a distância e os aniversários de namoro. Um bolo com velas na tela; quem sopra o microfone apaga as velas (só mede o volume, nada é gravado). Pode virar desafio nas cartas.
2. **Medidor de grito/riso:** efeito para desafios de rir alto ou cantar: o app mede o volume ao vivo e dá a nota. Nada é gravado.
3. **Áudio de boa noite: fica de fora** desta versão. Guardar voz exigiria armazenar mídia no servidor, o que contraria a regra; continua pelo WhatsApp.

**Aceite:**
- Nenhuma foto ou áudio sai do aparelho (conferir as chamadas de rede no aceite).
- Sem permissão de câmera/microfone, o resto do app funciona e o botão explica como liberar.

---

## Fase 7 — Chamada de vídeo dentro do app (opcional, a maior)

Para jogar **sem alternar com o WhatsApp**: a chamada fica no fundo e a carta da rodada aparece **por cima do vídeo**, igual para os dois.

1. **WebRTC** direto entre os dois celulares (`getUserMedia` no WebView do Capacitor, com as permissões de câmera e microfone).
   - O vídeo e o áudio são **criptografados ponta a ponta** pelo próprio WebRTC e **não passam nem ficam** no Supabase.
2. **Sinalização** (o "aperto de mão" da chamada) pelo canal Realtime da sala, que já existe (broadcast), com as mensagens de oferta/resposta/candidatos.
3. **Servidor TURN:** em rede móvel no Brasil (operadora com CGNAT), a conexão direta costuma falhar. Precisa de um TURN, que só **repassa** os dados já criptografados, sem conseguir ver.
   - Opção gratuita: o TURN da Cloudflare (Realtime) ou o plano grátis do Metered. As credenciais temporárias saem de uma Edge Function `turn-credenciais`, com a chave em secret.
4. **Tela da chamada:**
   - vídeo do outro em tela cheia, o seu pequeno no canto;
   - a carta, o placar, o cronômetro e a roleta por cima, em faixa translúcida;
   - botões: mudo, câmera, virar câmera, desligar;
   - **picture-in-picture** ao sair do app.
5. **Ligar:** "📹 Chamar {nome}" manda um push de chamada no canal `chamados` com "Atender" / "Recusar". Só aparelhos registrados na sala recebem.
6. **Plano B:** se a conexão não fechar em 20 s, "Não deu para conectar. Abrir o WhatsApp?".
7. **Nada é gravado.** Sem botão de gravar; o bloqueio de prints da Fase 2 vale também aqui.

**Aceite:**
- Chamada estável em 4G nos dois celulares, com a carta aparecendo por cima para os dois ao mesmo tempo.
- Nenhum quadro de vídeo passa pelo Supabase (só mensagens de sinalização pequenas).

---

## Fase 8 — Atualizações

1. **Site:** como o app abre o site, toda mudança no site já chega sozinha. Nada a fazer.
2. **Parte nativa:** o site publica um `versao-app.json` (`{ "versionCode": 42, "versionName": "1.3.0", "novidades": "…" }`), atualizado à mão pelo Ricardo quando gerar um APK com novidade nativa.
3. Ao abrir, o app compara com a própria versão. Se houver nova: "Tem versão nova do app 💞 · novidades…", com o botão "Como atualizar" (baixar com o Ricardo e instalar por cima).

---

## Itens de outros planos que entram neste branch

Quando o plano correspondente já estiver na `main`, o branch `apk` também implementa:

| De onde | Item |
|---|---|
| Chamadas (Fase 5) | Sinal de chamada pela chamada do app; detecção experimental de chamada do WhatsApp (`MODE_IN_COMMUNICATION` nos dois celulares); widget "📞 Horas juntos". |
| v9 (Fase 2) | Lembretes locais da campanha (21h) e da cláusula do dia (8h). |
| v9 (Fase 4) | Toque de presença: a notificação acende a tela com "{nome} tocou na tela pensando em você" e vibração dupla; carta secreta protegida pelo bloqueio de prints. |
| v9 (Fase 5) | Áudio-cápsula gravada no modo Juntos, guardada só no aparelho, com data para abrir. |
| v9 (Fase 6) | Push "🪫 {nome} está sem bateria social" e silêncio dos pushes de jogo durante o período. |

---

## O que não entra (e por quê)

- **Play Store:** proibido pelo conteúdo.
- **Gravar e guardar fotos, vídeos ou áudios no servidor:** contraria a regra de nunca guardar mídia íntima. Se um dia houver login de verdade (Supabase Auth) e armazenamento com criptografia de ponta a ponta e apagamento automático, dá para reavaliar.
- **iOS:** vocês não usam.
- **Login com conta:** o app continua com código de sala + token de dono, como hoje.

---

## Resumo do que o Ricardo precisa fazer

| Quando | O quê |
|---|---|
| Antes da Fase 1 | Keystore, projeto no Firebase, `google-services.json`, conta de serviço, GitHub Secrets e secrets do Supabase (Fase 0). |
| Fase 1 | Rodar o workflow, baixar o APK, instalar nos dois celulares. |
| Fase 3 | Rodar `027_dispositivos_push.sql`, fazer deploy da `enviar-push`, criar os webhooks. |
| Fase 3 | Em celulares Xiaomi, Motorola, Samsung: tirar o app da "otimização de bateria" para o push chegar com o app fechado (o app mostra o atalho). |
| Fase 7 | Criar a conta grátis do TURN e colocar a chave em secret; deploy da `turn-credenciais`. |

---

## Ordem de execução

1. Branch `apk` a partir da `main`.
2. **Fase 0:** `app/LEIA-ME.md` com o passo a passo. Commit `apk: preparação`. **Parar para o Ricardo fazer.**
3. **Fase 1**, commit `apk: casca capacitor e build`. **Parar para o Ricardo rodar o workflow e testar a instalação.**
4. **Fase 2**, commit `apk: privacidade e conforto`.
5. **Fase 3:** colocar `027_dispositivos_push.sql` em `supabase/` sem editar; Edge Function `enviar-push`; registro no app; lembretes locais. Commit `apk: notificações`. **Parar para o Ricardo rodar o SQL, fazer o deploy e criar os webhooks.**
6. **Fase 4**, commit `apk: popup com botões e toque de saudade`.
7. **Fase 5**, commit `apk: widgets`.
8. **Fase 6**, commit `apk: câmera e microfone`.
9. **Fase 7** (só se o Ricardo pedir), commit `apk: chamada de vídeo`.
10. **Fase 8**, commit `apk: aviso de atualização`.
11. Rodar o checklist, reportar e **não fazer merge na `main`**.

Se o tempo for curto: **as Fases 0 a 3 já entregam um app instalável com notificação**, que é o ganho maior. Widgets e câmera vêm depois.

## Checklist de testes

- [ ] O site no navegador funciona exatamente como antes (nenhum erro no console sem o Capacitor).
- [ ] Um no app e outro no site: partida inteira sincronizando nos dois sentidos.
- [ ] Mudança publicada no site aparece no app sem APK novo.
- [ ] (Web push) Notificação chega no Chrome do Android com o site fechado.
- [ ] Nenhum segredo no repositório (`git grep` por `BEGIN PRIVATE KEY`, `private_key`, `.jks`, `AIza`).
- [ ] APK assinado instala por cima da versão anterior sem perder a sala.
- [ ] Trava por digital, bloqueio de prints e ícone discreto funcionando.
- [ ] Push com o app fechado; texto discreto na tela bloqueada; silêncio respeitado; limite por minuto.
- [ ] Botões "Tô indo" e "Mandar de volta" funcionam sem abrir o app.
- [ ] Lembretes locais do reencontro nos horários certos (fuso −03:00).
- [ ] Widgets: contador anda, humor atualiza, "Pensei em você" envia.
- [ ] Fotos do momento ficam só no aparelho; o sopro não grava nada.
- [ ] (Fase 7) Chamada em 4G com a carta por cima, sem mídia no Supabase.

## Prompt para colar no Claude Code

> Leia `plano-longe-perto-apk.md` na raiz do repositório. Crie a branch `apk` a partir da `main` e siga a "Ordem de execução", com um commit por fase e parando nos pontos marcados para eu fazer a minha parte. Todo o projeto Android fica em `app/` (Capacitor abrindo o site do GitHub Pages, Kotlin só onde for preciso); no site, só o `nativo.js` e chamadas protegidas por `isNativePlatform()` e `isPluginAvailable()`. O site no navegador tem que continuar funcionando igual, e site e app têm que jogar juntos na mesma sala (confira se o `gravar()` mescla com o estado atual). Nunca coloque keystore, senhas, `google-services.json`, conta de serviço ou qualquer chave no repositório: use GitHub Secrets e secrets do Supabase. Coloque `027_dispositivos_push.sql` em `supabase/` sem editar. Antes de montar o mapa de eventos da `enviar-push`, confira os nomes reais das tabelas e colunas. Siga as regras da v2 (mudança mínima, não alterar `config.js`, não rodar SQL, texto só via `textContent`, padrão para salas antigas). A Fase 7 só se eu pedir. No fim, rode o checklist, me conte o resultado e não faça merge na `main`.
