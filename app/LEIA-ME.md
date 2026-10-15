# Longe & Perto — app Android (APK)

O app é o próprio site (GitHub Pages) aberto pelo **Capacitor**, com uma camada nativa que só liga dentro do APK. O site continua funcionando igual no navegador, e os dois jogam juntos na mesma sala.

Este arquivo é o passo a passo da parte que **só o Ricardo pode fazer** (contas, chaves e senhas). Nada disto vai para o repositório.

> **Regra de ouro:** keystore, senhas, `google-services.json` e a conta de serviço do Firebase **nunca** entram no repositório nem em chat. Tudo vai em *GitHub Secrets* ou em *secrets do Supabase*.

---

## Fase 0 — Preparação

### 1. Nome do pacote

```
io.github.ricardodynt.longeperto
```

Não dá para mudar depois sem desinstalar o app e perder os dados locais. Use exatamente este nome no Firebase (passo 3).

### 2. Keystore (a "assinatura" do app)

No PC, com o Java instalado (vem com o Android Studio, ou instale o JDK Temurin 21 em adoptium.net):

```
keytool -genkeypair -v -keystore longeperto.jks -alias longeperto -keyalg RSA -keysize 2048 -validity 10000
```

- O `keytool` pede uma **senha da keystore** e os seus dados (nome, cidade… pode ser qualquer coisa). Se pedir uma **senha da chave**, use a mesma ou outra e anote.
- Guarde o `longeperto.jks` e as senhas **fora do repositório** (por exemplo, no seu Google Drive pessoal).
- **Se perder a keystore, nenhuma atualização instala por cima:** vai ser preciso desinstalar o app e perder o que está só no celular (fotos locais, ajustes do aparelho).

Converta a keystore para texto (para colar no GitHub):

- Linux/macOS: `base64 -w0 longeperto.jks > keystore.txt` (no macOS: `base64 -i longeperto.jks -o keystore.txt`)
- Windows (PowerShell): `[Convert]::ToBase64String([IO.File]::ReadAllBytes("longeperto.jks")) | Out-File -Encoding ascii keystore.txt`

Apague o `keystore.txt` depois de colar no GitHub.

### 3. Firebase (para as notificações)

1. Entre em <https://console.firebase.google.com> e crie o projeto **"Longe e Perto"** (pode desligar o Google Analytics).
2. Na página do projeto, **Adicionar app → Android**.
   - Nome do pacote: `io.github.ricardodynt.longeperto`
   - Apelido: Longe & Perto (o resto pode ficar em branco)
3. Baixe o **`google-services.json`**. Não precisa seguir os passos de "adicionar o SDK": o build faz isso.

### 4. Conta de serviço do Firebase (para o servidor mandar push)

1. No Firebase: ⚙️ **Configurações do projeto → Contas de serviço**.
2. **Gerar nova chave privada** → baixa um `.json`.
3. **Não cole esse arquivo em chat nem no repositório.** Ele vai só no Supabase (passo 6).

### 5. GitHub Secrets

No GitHub: repositório **Longe-Perto → Settings → Secrets and variables → Actions → New repository secret**. Crie um por um:

| Nome | Valor |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | o conteúdo inteiro do `keystore.txt` |
| `ANDROID_KEYSTORE_PASSWORD` | a senha da keystore |
| `ANDROID_KEY_ALIAS` | `longeperto` |
| `ANDROID_KEY_PASSWORD` | a senha da chave (a mesma da keystore, se você usou a mesma) |
| `GOOGLE_SERVICES_JSON` | o conteúdo inteiro do `google-services.json` (abrir no Bloco de Notas, copiar tudo, colar) |

### 6. Secrets do Supabase (usados na Fase 3)

No Supabase: **Edge Functions → Secrets** (ou *Project Settings → Edge Functions*). Crie:

| Nome | Valor |
|---|---|
| `FCM_SERVICE_ACCOUNT` | o conteúdo inteiro do `.json` da conta de serviço (passo 4) |
| `PUSH_WEBHOOK_SECRET` | uma senha longa inventada (ex.: 40 letras e números aleatórios). Anote: ela vai também nos webhooks da Fase 3 |

---

## Quando terminar

Avise "Fase 0 pronta". A próxima fase (casca do Capacitor e o workflow do GitHub Actions que gera o APK) só usa os secrets acima; nada precisa ser colado aqui.

---

## Fase 1 — Gerar e instalar o APK

O app abre o site do GitHub Pages (`https://ricardodynt-tech.github.io/Longe-Perto/`). Mudança no site aparece no app sozinha; só mudanças na parte nativa pedem um APK novo.

### Gerar o APK (GitHub Actions)

O workflow `.github/workflows/apk.yml` roda de dois jeitos:

- **Por tag (funciona já, direto do branch `apk`):** criar uma tag que começa com `apk-v`.
  1. No GitHub: **Releases → Draft a new release**.
  2. Em **Choose a tag**, digite `apk-v0.1.0` (ou o próximo número) e clique em **Create new tag**.
  3. Em **Target**, escolha o branch **`apk`**.
  4. Clique em **Save draft** (não precisa publicar a release; a tag já dispara o build).
- **Pelo botão "Run workflow"** (aba **Actions → APK**): só aparece depois que o arquivo do workflow estiver na `main`.

O build leva uns 5 a 10 minutos. Se der erro, abra a execução na aba **Actions** e veja o passo que ficou vermelho. "Faltam os secrets" ou "keystore password was incorrect" quer dizer que algum secret da Fase 0 está faltando ou com valor errado.

### Baixar e instalar

1. Na aba **Actions**, abra a execução que terminou com ✅.
2. Lá embaixo, em **Artifacts**, baixe `longe-perto-<versão>` (vem um `.zip` com o `.apk` dentro; só quem está logado consegue baixar, e some em 30 dias).
3. Tire o `.apk` do zip e mande pelo WhatsApp para os dois celulares (pode ser para você mesmo).
4. No celular, toque no arquivo. Na primeira vez, o Android pede para **permitir instalar apps desconhecidos** do WhatsApp (ou do app Arquivos): permita e volte.
5. Instale. Aparece o ícone 💞 "Longe & Perto".

**Atualizar** é igual: instala o APK novo por cima, sem desinstalar. A sala e os ajustes continuam.

### Primeira vez no app

O app é como um navegador novo: não sabe a sala, o nome nem o token de dono (cada um fica guardado no próprio aparelho, separado do Chrome).

- Entre na mesma sala digitando o código ou o nome da sala, ou colando o link de convite no campo do código.
- Quem é dono: depois de entrar, **Configurações → 👑 Entrar como dono** com o código de dono.

### O que testar

- Um no app e o outro no navegador: jogar uma partida inteira; tudo sincroniza nos dois sentidos.
- Botão voltar do Android: fecha janelas e telas abertas antes de minimizar o app.
- Links do Spotify e do WhatsApp abrem nos apps deles.
- Sem internet: aparece "Sem internet 💔 · Tentar de novo".
