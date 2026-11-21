# Publicação passo a passo — VPS Hostinger

Guia para colocar o `formulario_db_vps` no ar numa **VPS da Hostinger** com **Ubuntu**, **Nginx**, **PM2**, **HTTPS gratuito** e **backup diário**.

> ⏱️ Tempo estimado: 1 a 2 horas na primeira vez.
> 💡 Os nomes dos menus do painel da Hostinger (hPanel) mudam de vez em quando. Se algum não bater exatamente, procure o equivalente: a ideia de cada passo continua a mesma.

---

## Visão geral: o que vamos montar

```
 Visitante ──HTTPS (443)──▶ ┌──────────────────────── VPS Ubuntu ─────────────────────────┐
                            │  Firewall (UFW): só deixa entrar 22 (SSH), 80 e 443        │
                            │        │                                                    │
                            │        ▼                                                    │
                            │  Nginx ── certificado HTTPS (Let's Encrypt / Certbot)       │
                            │        │  repassa para 127.0.0.1:3000                       │
                            │        ▼                                                    │
                            │  Node.js (servidor.js) ── mantido no ar pelo PM2            │
                            │        │                                                    │
                            │        ▼                                                    │
                            │  /var/lib/formulario/inscricoes.db  (SQLite)                │
                            │  /var/backups/formulario/           (backup diário, cron)   │
                            └─────────────────────────────────────────────────────────────┘
```

| Peça | Papel | Analogia |
|---|---|---|
| **VPS** | Um computador Linux alugado, ligado 24 h na internet | O terreno |
| **Nginx** | Recebe os visitantes, cuida do HTTPS e repassa para o Node | A recepção do prédio |
| **Node.js** | Roda o `servidor.js` | O escritório que faz o trabalho |
| **PM2** | Mantém o Node rodando e o religa se cair ou se a VPS reiniciar | O zelador |
| **Certbot** | Gera e renova o certificado HTTPS (cadeado) | O cartório |
| **UFW** | Firewall: fecha todas as portas, menos as necessárias | O portão |
| **cron** | Agenda tarefas (o backup diário) | O despertador |

### Convenções deste guia
- `SEU_IP` → o IP da sua VPS (ex.: `82.25.10.123`)
- `SEU_DOMINIO.com.br` → o seu domínio
- Blocos marcados **💻 Windows (PowerShell)** são digitados **no seu computador**.
- Blocos marcados **🐧 VPS** são digitados **na VPS**, depois de conectar por SSH.

---

## Etapa 0 — O que você precisa

- [ ] Um plano **VPS** da Hostinger. O menor plano (KVM 1: 1 vCPU, 4 GB RAM) sobra para este projeto.
- [ ] Um **domínio** (opcional no começo, mas **necessário para o HTTPS**). Pode ser registrado na própria Hostinger.
- [ ] Windows 10/11 com **PowerShell**: os comandos `ssh`, `scp` e `tar` já vêm instalados.
- [ ] O projeto testado no seu computador (`npm start` funcionando).

---

## Etapa 1 — Criar a VPS no hPanel

1. Entre em **hpanel.hostinger.com** → menu **VPS** → selecione a sua VPS (ou clique em **Configurar**, se for nova).
2. Em **Sistema operacional**, escolha **Ubuntu 24.04 LTS**, a versão **"limpa"** (só o sistema operacional, sem painel de controle). Os modelos com painel (CyberPanel, CloudPanel, etc.) instalam coisas que não vamos usar e que podem conflitar com o Nginx.
3. Defina a **senha do root** (o administrador da VPS). Use uma senha forte e guarde num gerenciador de senhas.
4. Aguarde a instalação terminar.
5. Na página da VPS (**Visão geral**), anote o **endereço IP** (IPv4).

> ⚠️ **Firewall do hPanel:** a Hostinger tem um firewall próprio, na área de segurança da VPS. Se você ativá-lo, libere as portas **22, 80 e 443 (TCP)**, senão o site não abre. Neste guia usaremos o UFW, dentro da VPS; você pode usar os dois.

---

## Etapa 2 — Criar uma chave SSH (recomendado)

Uma **chave SSH** é um par de arquivos que substitui a senha ao entrar na VPS: a parte **privada** fica no seu computador, a **pública** vai para a VPS. É bem mais segura que senha, porque robôs tentam adivinhar senhas de VPS o dia todo.

**💻 Windows (PowerShell):**
```powershell
ssh-keygen -t ed25519 -C "minha-vps"
```
Ele faz 3 perguntas:
1. `Enter file in which to save the key (...\.ssh\id_ed25519):` → aperte **Enter** sem digitar nada (local padrão).
2. `Enter passphrase:` → crie uma senha para a chave e aperte Enter. **Nada aparece na tela enquanto você digita.** É normal, não está travado.
3. `Enter same passphrase again:` → repita a senha.

✅ Deu certo se aparecer `Your public key has been saved in ...\.ssh\id_ed25519.pub` e um desenho de caracteres (*randomart*). Se você apertar Ctrl + C ou fechar a janela antes disso, **a chave não é criada**.

Confira se os dois arquivos existem:
```powershell
Get-ChildItem $env:USERPROFILE\.ssh
```
Devem aparecer `id_ed25519` (privada) e `id_ed25519.pub` (pública). Se só aparecer `known_hosts`, a chave não foi criada: rode o `ssh-keygen` de novo.

Agora mostre a chave **pública**:
```powershell
Get-Content $env:USERPROFILE\.ssh\id_ed25519.pub
```
Copie a linha inteira (começa com `ssh-ed25519`).

| Erro | Causa | Solução |
|---|---|---|
| `Cannot find path '...\id_ed25519.pub' because it does not exist` | A chave não foi criada (o `ssh-keygen` não chegou ao fim) | Rode o `ssh-keygen` e responda às 3 perguntas |
| `'Get-Content' não é reconhecido` / `$env:USERPROFILE` não funciona | Você está no **Prompt de Comando (cmd)**, não no PowerShell | No cmd use: `type %USERPROFILE%\.ssh\id_ed25519.pub` |

> ⚠️ Se existir outra chave em outra pasta (ex.: `C:\Users\<você>\.ollama\id_ed25519.pub`, do programa Ollama), **não use**: ela pertence a outro programa.

No **hPanel**, na página da VPS, procure a opção de **chaves SSH** (fica nas configurações da VPS), adicione a chave colada e salve.

> 🔐 Nunca compartilhe o arquivo `id_ed25519` (sem `.pub`). Ele é a sua "chave de casa".

---

## Etapa 3 — Primeiro acesso

**💻 Windows (PowerShell):**
```powershell
ssh root@SEU_IP
```
Na primeira vez ele pergunta se você confia no servidor (`Are you sure you want to continue connecting?`): digite `yes`. Se não configurou a chave, digite a senha do root (ela **não aparece** enquanto você digita; isso é normal).

Quando aparecer algo como `root@srv123:~#`, você está **dentro da VPS**.

Atualize o sistema e acerte o fuso horário:

**🐧 VPS:**
```bash
apt update && apt upgrade -y
timedatectl set-timezone America/Sao_Paulo
```
Se aparecer uma tela roxa perguntando sobre serviços a reiniciar, aperte **Enter** (ou Tab + Enter).

---

## Etapa 4 — Criar um usuário próprio (não usar o root)

O `root` pode tudo, inclusive estragar tudo com um comando errado. O padrão de mercado é criar um usuário comum que usa `sudo` só quando precisa.

**🐧 VPS (como root):**
```bash
adduser deploy                     # crie uma senha e aperte Enter nas outras perguntas
usermod -aG sudo deploy            # permite usar sudo
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy   # copia sua chave SSH para o novo usuário
```

Teste em **outra** janela do PowerShell, sem fechar a atual:

**💻 Windows:**
```powershell
ssh deploy@SEU_IP
```
Entrou **sem pedir senha**? Então **a partir daqui use sempre `deploy`**. Pode fechar a janela do root.

> ⚠️ **Pediu `deploy@...'s password:`?** Então a chave não chegou ao usuário `deploy`. Isso acontece quando a chave foi gerada ou movida **depois** do `rsync`, ou quando o hPanel recebeu outra chave. Para copiar a chave direto, rode no **💻 Windows** (a senha do `deploy` será pedida uma última vez):
> ```powershell
> Get-Content $env:USERPROFILE\.ssh\id_ed25519.pub | ssh deploy@SEU_IP "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
> ```
> Depois, `ssh deploy@SEU_IP` deve entrar sem pedir senha.

---

## Etapa 5 — Firewall (UFW)

**🐧 VPS:**
```bash
sudo ufw allow OpenSSH        # ⚠️ ANTES de ativar, senão você se tranca para fora
sudo ufw enable               # responda y
sudo ufw status
```
Deve aparecer `OpenSSH ALLOW`. As portas 80/443 serão liberadas na Etapa 11.

---

## Etapa 6 — Instalar Node.js, PM2 e Nginx

**🐧 VPS:**
```bash
# Node.js (versão LTS mais recente, pelo repositório oficial NodeSource)
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs
node -v          # precisa ser 22.13 ou maior
npm -v

# PM2 (gerenciador de processos)
sudo npm install -g pm2

# Nginx (servidor web / proxy)
sudo apt install -y nginx
```

Teste o Nginx: abra `http://SEU_IP` no navegador. Ainda **não** vai abrir, porque o firewall bloqueia a porta 80. Isso é esperado; liberamos na Etapa 11.

---

## Etapa 7 — Criar as pastas

**🐧 VPS:**
```bash
sudo mkdir -p /var/www/formulario        # código
sudo mkdir -p /var/lib/formulario        # banco de dados (fora do código!)
sudo mkdir -p /var/backups/formulario    # backups
sudo chown -R deploy:deploy /var/www/formulario /var/lib/formulario /var/backups/formulario
```

> **Por que o banco fica fora da pasta do código?** Ao atualizar o site, você substitui a pasta do código. Se o banco morasse lá dentro, um descuido apagaria todas as inscrições.

---

## Etapa 8 — Enviar o projeto para a VPS

Vamos empacotar o projeto **sem** `node_modules` (é recriada na VPS), **sem** `.env` (cada lugar tem o seu) e **sem** bancos de teste.

**💻 Windows (PowerShell), na pasta que CONTÉM a `formulario_db_vps`:**
```powershell
cd "C:\NATAN\04-PROJETOS"
tar -czf formulario.tar.gz --exclude=.git --exclude=node_modules --exclude=.env --exclude="*.db" formulario_db_vps
scp formulario.tar.gz deploy@SEU_IP:/tmp/
```

**🐧 VPS:**
```bash
tar -xzf /tmp/formulario.tar.gz -C /var/www/formulario --strip-components=1
rm /tmp/formulario.tar.gz
cd /var/www/formulario
ls          # deve listar servidor.js, package.json, public, admin, db, deploy...
npm ci --omit=dev
```

> **`npm ci` em vez de `npm install`:** instala **exatamente** as versões do `package-lock.json`, que são as mesmas testadas no seu computador. É o padrão para servidores.

> **Alternativa com Git:** se o projeto estiver no GitHub, use `git clone <url> /var/www/formulario` em vez do `tar`/`scp`. Assim, para atualizar, basta um `git pull`.

---

## Etapa 9 — Configurar o `.env` e testar

**🐧 VPS:**
```bash
cd /var/www/formulario
cp .env.exemplo .env
openssl rand -base64 24       # gera uma senha forte: copie o resultado
nano .env
```
No editor `nano`, cole a senha gerada em `ADMIN_SENHA=`. Confira se `DB_PATH=/var/lib/formulario/inscricoes.db`. Salve com **Ctrl + O**, **Enter** e saia com **Ctrl + X**.

Guarde a senha do admin no seu gerenciador de senhas. Depois proteja o arquivo:
```bash
chmod 600 .env                # só o usuário deploy consegue ler
```

Teste rápido, rodando o servidor "na mão":
```bash
npm start
```
Deve aparecer `Servidor em http://127.0.0.1:3000 (produção)`. Em **outra** janela SSH:
```bash
curl http://127.0.0.1:3000/saude
```
Resposta esperada: `{"status":"ok","banco":true,...}`. Volte à primeira janela e pare com **Ctrl + C**.

---

## Etapa 10 — PM2: manter o site no ar

**🐧 VPS:**
```bash
cd /var/www/formulario
pm2 start deploy/ecosystem.config.cjs
pm2 status                    # "formulario" deve estar "online"
pm2 save                      # memoriza a lista de processos
pm2 startup                   # mostra UM comando começando com "sudo env PATH=..."
```
**Copie e rode o comando que o `pm2 startup` mostrar.** É ele que faz o site voltar sozinho quando a VPS reiniciar.

Comandos úteis do PM2:
| Comando | Para quê |
|---|---|
| `pm2 status` | Ver se está rodando |
| `pm2 logs formulario` | Ver os logs ao vivo (Ctrl + C para sair) |
| `pm2 reload formulario` | Reiniciar sem derrubar (após atualizar) |
| `pm2 monit` | Painel de CPU e memória |

---

## Etapa 11 — Nginx: publicar na porta 80

**🐧 VPS:**
**0. Antes de mexer no Nginx, confirme que o Node responde** (se isto falhar, volte à Etapa 10):
```bash
pm2 status                            # "formulario" deve estar "online"
curl http://127.0.0.1:3000/saude      # deve responder {"status":"ok",...}
```

**1. Copie o arquivo e ajuste o `server_name`.** Rode **só um**: o (a) **ou** o (b). Quem tem domínio usa o (b), porque o Certbot (Etapa 13) precisa do domínio escrito aqui. Rodar o (a) apaga o domínio.
```bash
sudo cp /var/www/formulario/deploy/nginx.conf /etc/nginx/sites-available/formulario

# (a) AINDA SEM DOMÍNIO: acesso pelo IP. A linha inteira vira "server_name _;"
sudo sed -i 's/^\s*server_name .*/    server_name _;/' /etc/nginx/sites-available/formulario

# (b) COM DOMÍNIO: troque meudominio.com.br pelo seu (sem http://, sem www)
sudo sed -i 's/SEU_DOMINIO\.com\.br/meudominio.com.br/g' /etc/nginx/sites-available/formulario

grep server_name /etc/nginx/sites-available/formulario   # confira o resultado
```
> A linha `server_name` tem o domínio **duas vezes** (com e sem `www`). Na opção (a) a linha toda é substituída por `server_name _;`. Não deixe `SEU_DOMINIO` sobrando nem escreva `www._`.

**2. Ative o site, desative a página padrão e libere o firewall** (os comandos podem ser repetidos sem erro):
```bash
sudo ln -sf /etc/nginx/sites-available/formulario /etc/nginx/sites-enabled/formulario
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t                         # deve dizer "syntax is ok" e "test is successful"
sudo systemctl reload nginx
sudo ufw allow 'Nginx Full'           # libera as portas 80 e 443
sudo ufw status                       # deve listar OpenSSH e Nginx Full
```

**3. Teste de dentro da VPS** (isola o problema antes de culpar a internet):
```bash
curl -I http://127.0.0.1              # "HTTP/1.1 200 OK" = Nginx + Node funcionando
```
- `200 OK` aqui, mas não abre no seu PC → é **firewall** (UFW ou o firewall do **hPanel**: libere TCP 80 e 443 lá).
- `502 Bad Gateway` → o Node não está rodando (passo 0).
- Página "Welcome to nginx" → o `default` ainda está ativo (`ls /etc/nginx/sites-enabled/` deve mostrar só `formulario`).

**4. Teste no navegador:** abra `http://SEU_IP` (digite `http://` explicitamente; o navegador pode tentar `https://`, que ainda não existe). Com domínio, `http://SEU_DOMINIO.com.br` só funciona depois que o DNS apontar para o IP (Etapa 12). A **página inicial** do projeto deve aparecer. 🎉

> ⚠️ Ainda sem HTTPS: **não acesse a área `/admin/` antes da Etapa 13**, porque a senha trafegaria sem criptografia.

---

## Etapa 12 — Apontar o domínio (DNS)

DNS é a "lista telefônica" da internet: traduz `SEU_DOMINIO.com.br` para o IP da VPS.

No **hPanel** → **Domínios** → seu domínio → **DNS / Nameservers** (gerenciar registros DNS):

| Tipo | Nome | Aponta para | TTL |
|---|---|---|---|
| `A` | `@` | `SEU_IP` | padrão |
| `A` | `www` | `SEU_IP` | padrão |

- Se já existirem registros `A` para `@` ou `www` (apontando para a hospedagem padrão), **edite-os** em vez de criar duplicados.
- Se o domínio estiver registrado em outra empresa, crie esses registros no painel dela.

A propagação leva de alguns minutos a algumas horas. Para conferir:

**💻 Windows:**
```powershell
nslookup SEU_DOMINIO.com.br
```
Quando a resposta mostrar o `SEU_IP`, siga em frente.

---

## Etapa 13 — HTTPS gratuito (Let's Encrypt)

**🐧 VPS:**
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d SEU_DOMINIO.com.br -d www.SEU_DOMINIO.com.br
```
O Certbot pede um e-mail (para avisos de vencimento) e o aceite dos termos. Ele mesmo altera o arquivo do Nginx para usar HTTPS e **redirecionar** `http://` para `https://`.

A renovação é automática (o certificado vale 90 dias). Para testar a renovação:
```bash
sudo certbot renew --dry-run
```

Abra **https://SEU_DOMINIO.com.br**: o cadeado deve aparecer. Agora sim, teste a área administrativa em **https://SEU_DOMINIO.com.br/admin/**: o navegador pede usuário (`admin`) e a senha do `.env`.

---

## Etapa 14 — Backup automático diário

**🐧 VPS:**
```bash
crontab -e                     # se perguntar o editor, escolha 1 (nano)
```
Adicione esta linha no fim do arquivo:
```
0 3 * * * cd /var/www/formulario && /usr/bin/node --env-file=.env db/backup.js >> /home/deploy/backup.log 2>&1
```
Ou seja: **todo dia às 3h**, cria uma cópia do banco em `/var/backups/formulario/` e mantém as 14 últimas.

Rode uma vez na mão para conferir:
```bash
cd /var/www/formulario && node --env-file=.env db/backup.js
ls -lh /var/backups/formulario/
```

> 💡 **Regra de ouro:** backup que só existe dentro da VPS não protege contra perder a VPS. De vez em quando, baixe uma cópia para o seu computador:
> ```powershell
> scp deploy@SEU_IP:/var/backups/formulario/inscricoes-*.db .
> ```
> A Hostinger também oferece **snapshots/backups da VPS** no hPanel; vale ativar.

---

## Etapa 15 — Verificação final ✅

| Teste | Como | Esperado |
|---|---|---|
| Página inicial | `https://SEU_DOMINIO.com.br` | Página do projeto com cadeado |
| HTTP vira HTTPS | `http://SEU_DOMINIO.com.br` | Redireciona para `https://` |
| Inscrição | Preencher e enviar o formulário | Página "Inscrição realizada!" |
| Consentimento | Enviar sem marcar a caixa (desmarque e remova o `required` pelo F12) | Erro pedindo o aceite |
| Admin protegido | `https://.../admin/` | Pede usuário e senha |
| Admin funcionando | Entrar com a senha do `.env` | Lista com a inscrição de teste e relatório |
| Node não exposto | `http://SEU_IP:3000` | **Não abre** (firewall + `HOST=127.0.0.1`) |
| Saúde | `https://.../saude` | `{"status":"ok","banco":true,...}` |
| Reinício | `sudo reboot`, aguarde 1 min e abra o site | Site volta sozinho (PM2) |
| Backup | `ls /var/backups/formulario/` no dia seguinte | Um arquivo novo por dia |

Depois de testar, **exclua as inscrições de teste** pela área admin.

---

## Como atualizar o site depois

**💻 Windows**, depois de testar as mudanças localmente:
```powershell
cd "C:\NATAN\04-PROJETOS"
tar -czf formulario.tar.gz --exclude=.git --exclude=node_modules --exclude=.env --exclude="*.db" formulario_db_vps
scp formulario.tar.gz deploy@SEU_IP:/tmp/
```

**🐧 VPS:**
```bash
cd /var/www/formulario && node --env-file=.env db/backup.js     # backup antes de mexer
tar -xzf /tmp/formulario.tar.gz -C /var/www/formulario --strip-components=1
rm /tmp/formulario.tar.gz
npm ci --omit=dev
pm2 reload formulario
pm2 logs formulario --lines 20                                   # confira se subiu sem erro
```
O `.env` e o banco não são tocados: o `.env` não vai no pacote e o banco mora em `/var/lib/formulario`.

---

## Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| `ssh: connect ... timed out` | IP errado, VPS desligada ou porta 22 bloqueada no firewall do hPanel | Confira o IP e o status da VPS no hPanel; libere a porta 22 |
| Site não abre pelo IP | Porta 80 fechada | `sudo ufw status` deve mostrar `Nginx Full`; confira o firewall do hPanel |
| Página padrão "Welcome to nginx" | Site padrão ainda ativo | `sudo rm /etc/nginx/sites-enabled/default && sudo systemctl reload nginx` |
| **502 Bad Gateway** | O Node não está rodando | `pm2 status` e `pm2 logs formulario` para ver o erro |
| `pm2 status` com `errored` e log `node: .env: not found` | Falta o `.env`, ou o `ecosystem.config.cjs` é antigo (com caminho relativo e modo `cluster`) | Confira `ls -la /var/www/formulario/.env`, envie o `ecosystem.config.cjs` atual e rode `pm2 delete formulario`, `pm2 start deploy/ecosystem.config.cjs` e `pm2 save` |
| `nginx -t` com erro | Erro de digitação no arquivo | A mensagem indica a linha; corrija com `sudo nano` |
| Certbot falha | DNS ainda não aponta para a VPS ou porta 80 fechada | `nslookup` deve mostrar o IP; espere a propagação |
| `/admin/` responde "Área administrativa desativada" | `ADMIN_SENHA` vazia | Preencha no `.env` e rode `pm2 reload formulario` |
| `EACCES` / `permission denied` no banco | Pasta com dono errado | `sudo chown -R deploy:deploy /var/lib/formulario` |
| `EADDRINUSE` | Outro processo usando a porta 3000 | `pm2 status`; não rode `npm start` com o PM2 já rodando |
| Erro `--env-file` ao iniciar | Node antigo | `node -v` precisa ser 22.13+; refaça a Etapa 6 |
| "Muitas tentativas seguidas" ao testar | Limite de 10 envios a cada 15 min por IP | Aguarde 15 minutos (é a proteção funcionando) |

---

## Segurança extra (opcional, depois que tudo funcionar)

1. **Desligar o login por senha e o login do root**, depois de confirmar que `ssh deploy@SEU_IP` funciona com a chave:
   ```bash
   sudo nano /etc/ssh/sshd_config
   ```
   Ajuste (ou adicione) as linhas:
   ```
   PermitRootLogin no
   PasswordAuthentication no
   ```
   Depois: `sudo systemctl restart ssh`. **Antes de fechar a sessão**, teste o login numa nova janela.
2. **Fail2ban**: bloqueia IPs que erram a senha do SSH muitas vezes: `sudo apt install -y fail2ban`.
3. **Atualizações automáticas de segurança**: `sudo apt install -y unattended-upgrades && sudo dpkg-reconfigure -plow unattended-upgrades`.
4. **Antes de um evento real:** edite `public/privacidade.html` com o nome e o contato do responsável pelos dados.

---

## Resumo dos comandos (cola rápida)

```bash
# Status e logs
pm2 status
pm2 logs formulario
sudo systemctl status nginx
sudo tail -f /var/log/nginx/error.log

# Reiniciar
pm2 reload formulario
sudo systemctl reload nginx

# Banco e backup
node --env-file=.env db/backup.js
ls -lh /var/backups/formulario/
```
