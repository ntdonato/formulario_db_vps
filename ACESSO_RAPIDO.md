# Acesso rápido — como entrar e mexer em tudo de novo

Guia de bolso com a configuração que **já está pronta**. Nada aqui precisa ser instalado de novo.

> **Onde rodar cada comando:**
> - 💻 **PC (PowerShell):** a linha começa com `PS C:\Users\natan>`
> - 🐧 **VPS (Linux):** a linha começa com `deploy@srv2182811:~$`
>
> Copie **só o que está dentro do bloco cinza**, um bloco por vez.

---

## Dados da configuração

| Item | Valor |
|---|---|
| IP da VPS | `179.197.77.52` |
| Domínio | `natandonato.io` e `www.natandonato.io` |
| Usuário Linux | `deploy` (o `root` não é usado) |
| Apelido SSH | `vps` (em `C:\Users\natan\.ssh\config`) |
| Chave SSH | `C:\Users\natan\.ssh\id_ed25519` (protegida por passphrase) |
| Pasta do projeto na VPS | `/var/www/formulario` |
| Configurações e senhas | `/var/www/formulario/.env` (nunca vai para o Git) |
| Banco de dados | `/var/lib/formulario/inscricoes.db` |
| Backups | `/var/backups/formulario/` |
| Pasta do projeto no PC | `C:\NATAN\04-PROJETOS\formulario_db_vps` |
| Painel Hostinger | hpanel.hostinger.com → VPS (firewall, DNS, reinício de emergência) |

**As 3 senhas** (nenhuma está escrita aqui, guarde-as num gerenciador de senhas):

| Senha | Quando é pedida |
|---|---|
| Passphrase da chave | Ao conectar por SSH (ou uma vez, se usar o ssh-agent) |
| Senha do `deploy` | Em comandos com `sudo` na VPS |
| `ADMIN_SENHA` | Na área `/admin/` do site (fica no `.env`) |

---

## 1. Entrar na VPS

💻
```powershell
ssh vps
```
Deve pedir **só a passphrase**. Se pedir `deploy@...'s password:`, a chave não funcionou; veja a seção 9.

Para sair da VPS:
```bash
exit
```

### Não digitar a passphrase toda vez (uma vez só)
💻 No PowerShell **como Administrador**:
```powershell
Get-Service ssh-agent | Set-Service -StartupType Automatic
```
```powershell
Start-Service ssh-agent
```
💻 No PowerShell normal:
```powershell
ssh-add $env:USERPROFILE\.ssh\id_ed25519
```

---

## 2. Ver se está tudo funcionando (checklist de 1 minuto)

🐧
```bash
pm2 status
```
O certo é `formulario` com `fork` e `online`.
```bash
curl http://127.0.0.1:3000/saude
```
O certo é `{"status":"ok","banco":true,...}`.
```bash
curl -sI http://127.0.0.1 | head -1
```
O certo é `HTTP/1.1 200 OK` (passando pelo Nginx).
```bash
sudo systemctl status nginx --no-pager | head -3
```
O certo é `active (running)`.

💻 De fora:
```powershell
curl.exe -I http://natandonato.io
```

---

## 3. Ver o site

- Site: `http://natandonato.io` (`https://` depois do Certbot)
- Inscrição: `/inscricao.html`
- Área admin: `https://natandonato.io/admin/`, com usuário `admin` e a `ADMIN_SENHA`. **Só use com HTTPS.**

---

## 4. Consultar o banco de dados

🐧 Abrir em **modo somente leitura** (não altera nada):
```bash
sqlite3 -readonly -header -column /var/lib/formulario/inscricoes.db
```
Dentro do `sqlite>`:

| Comando | O que faz |
|---|---|
| `.tables` | Lista as tabelas |
| `.schema inscricoes` | Mostra a estrutura |
| `.quit` | Sai |

Quantos inscritos existem:
```sql
SELECT COUNT(*) AS total FROM inscricoes;
```
As últimas 10 inscrições:
```sql
SELECT id, nome, email, criado_em FROM inscricoes ORDER BY id DESC LIMIT 10;
```
Inscrições com o nome do curso:
```sql
SELECT i.nome, c.nome AS curso, i.semestre FROM inscricoes i JOIN cursos c ON c.id = i.curso_id;
```
Mais consultas: `db/consultas.sql`.

### Baixar uma cópia para abrir no PC (DB Browser for SQLite)
🐧
```bash
sqlite3 /var/lib/formulario/inscricoes.db ".backup /tmp/copia.db"
```
💻
```powershell
scp vps:/tmp/copia.db $env:USERPROFILE\Downloads\copia.db
```
⚠️ A cópia tem dados pessoais (LGPD). Depois de usar, apague as duas:

🐧
```bash
rm /tmp/copia.db
```
💻
```powershell
Remove-Item $env:USERPROFILE\Downloads\copia.db
```

---

## 5. Ver configurações e usuários

🐧 Onde está o banco:
```bash
grep DB_PATH /var/www/formulario/.env
```
🐧 Usuário e senha da área admin (mostra a senha na tela):
```bash
grep -E "ADMIN_USUARIO|ADMIN_SENHA" /var/www/formulario/.env
```
🐧 Editar o `.env` (salvar: Ctrl+O, Enter; sair: Ctrl+X):
```bash
nano /var/www/formulario/.env
```
Depois de mudar o `.env`, reinicie o site:
```bash
pm2 restart formulario
```

---

## 6. Atualizar o site depois de mudar o código no PC

💻 Enviar um arquivo (exemplo: `servidor.js`):
```powershell
scp C:\NATAN\04-PROJETOS\formulario_db_vps\servidor.js vps:/var/www/formulario/
```
💻 Enviar um arquivo de uma subpasta (exemplo: `public/index.html`):
```powershell
scp C:\NATAN\04-PROJETOS\formulario_db_vps\public\index.html vps:/var/www/formulario/public/
```
🐧 Aplicar:
```bash
pm2 restart formulario
```
```bash
pm2 status
```

**Mudou o `deploy/ecosystem.config.cjs`?** O `restart` não basta:
```bash
cd /var/www/formulario
```
```bash
pm2 delete formulario
```
```bash
pm2 start deploy/ecosystem.config.cjs
```
```bash
pm2 save
```

**Mudou o `package.json` (novas dependências)?**
```bash
cd /var/www/formulario && npm ci --omit=dev && pm2 restart formulario
```

---

## 7. Logs (quando algo der errado)

🐧 Erros do site:
```bash
pm2 logs formulario --lines 30 --nostream --err
```
🐧 Erros do Nginx:
```bash
sudo tail -n 30 /var/log/nginx/error.log
```
🐧 Acompanhar ao vivo (Ctrl+C para sair):
```bash
pm2 logs formulario
```

---

## 8. Nginx, firewall e reinício

🐧 Testar e recarregar o Nginx depois de editar a configuração:
```bash
sudo nginx -t && sudo systemctl reload nginx
```
🐧 Ver o firewall:
```bash
sudo ufw status
```
🐧 Reiniciar a VPS (o site volta sozinho pelo `pm2-deploy`):
```bash
sudo reboot
```
Espere uns 2 minutos, rode `ssh vps` e depois `pm2 status`.

🐧 HTTPS: ver o certificado e testar a renovação (depois do Certbot):
```bash
sudo certbot certificates
```
```bash
sudo certbot renew --dry-run
```

---

## 9. Problemas comuns: diagnóstico rápido

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| `ssh vps` pede `deploy@...'s password:` | A chave não foi aceita | 💻 `Test-Path $env:USERPROFILE\.ssh\id_ed25519` deve dar True; 🐧 `ssh-keygen -lf ~/.ssh/authorized_keys` deve mostrar `SHA256:SnmsOqbX...` |
| `Connection timed out` no SSH | IP digitado errado, ou VPS desligada | Use `ssh vps`; veja se a VPS está ligada no hPanel |
| `Connection reset` | Conexão parada muito tempo | Entre de novo; o `ServerAliveInterval` já reduz isso |
| **502 Bad Gateway** | O Node está parado | `pm2 status`; `pm2 logs formulario --err` |
| `pm2 status` vazio depois de um reboot | Faltou `pm2 save` | `cd /var/www/formulario && pm2 start deploy/ecosystem.config.cjs && pm2 save` |
| `errored` + `.env: not found` | `.env` sumiu, ou o ecosystem é antigo | `ls -la /var/www/formulario/.env`; veja a seção 6 |
| Site não abre de fora, mas o `curl` na VPS dá 200 | Firewall | `sudo ufw status`; firewall do hPanel (22, 80, 443) |
| Página sem estilo | Cabeçalho HTTPS no HTTP | `curl -sI http://127.0.0.1 \| grep -i upgrade-insecure` não deve mostrar nada |
| `/admin/` responde 503 | `ADMIN_SENHA` vazia | Preencha no `.env` e rode `pm2 restart formulario` |

**Ordem para isolar qualquer problema:** Node (`curl :3000/saude`) → Nginx (`curl 127.0.0.1`) → internet (`curl.exe` no PC) → navegador.

---

## 10. Emergência: fiquei trancado para fora

1. hpanel.hostinger.com → VPS → **Terminal do navegador** (console web). Ele funciona mesmo sem SSH.
2. Lá dentro, confira `sudo ufw status` e `ls -la /home/deploy/.ssh/`.
3. Se for preciso, copie de novo a chave pública (a linha `ssh-ed25519 AAAA... minha-vps`) para `/home/deploy/.ssh/authorized_keys`.

---

Histórico do que aconteceu na configuração: [DIARIO_2026-11-20.md](DIARIO_2026-11-20.md). Passo a passo completo da instalação: [PUBLICACAO_HOSTINGER.md](PUBLICACAO_HOSTINGER.md).
