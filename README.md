# Formulário de Inscrição — versão para publicação (VPS)

Versão de **produção** do projeto `formulário_db`: o formulário de inscrição da Semana Acadêmica de Tecnologia e Inovação com Node.js + SQLite, preparado para ficar no ar numa VPS com domínio e HTTPS.

- 📘 Passo a passo da publicação na Hostinger: **[PUBLICACAO_HOSTINGER.md](PUBLICACAO_HOSTINGER.md)**
- 🎓 Explicação didática do código base: `C:\NATAN\02-ESTUDOS\if-rolante\2- semestre\INTRODUÇÃO AO DESENVOLVIMENTO WEB\natan\formulário_db\ESTUDO.md`

---

## O que mudou em relação ao `formulário_db`

O `formulário_db` é a versão de **estudo**: roda no seu computador e mostra tudo aberto. Na internet, qualquer pessoa pode acessar, então esta versão acrescenta:

| Mudança | Por quê |
|---|---|
| **Página inicial** (`/`) explicando o projeto | Quem chega pelo link entende o que é o site antes de se inscrever |
| **Área administrativa com senha** (`/admin/`) | A lista tem nomes e e-mails. Aberta, qualquer pessoa veria dados pessoais (LGPD) |
| **Consentimento + política de privacidade** | A LGPD exige informar o uso dos dados e registrar o aceite (`consentimento_em`) |
| **Configuração por `.env`** | Senhas e caminhos ficam fora do código e nunca vão para o Git |
| **Banco fora da pasta do código** (`DB_PATH`) | Atualizar o código nunca apaga os dados |
| **Escuta só em `127.0.0.1`** | Só o Nginx fala com o Node; ninguém acessa a porta 3000 direto |
| **`helmet`**: cabeçalhos de segurança | CSP, proteção contra *clickjacking* e outros, com uma linha |
| **`express-rate-limit`**: limite de envios | Impede robôs de enviarem milhares de inscrições ou de tentarem senhas |
| **Busca com `%` e `_` escapados** | Corrige a limitação L2 do relatório de testes |
| **SQLite em modo WAL + `busy_timeout`** | Leituras não travam gravações; espera em vez de falhar quando o banco está ocupado |
| **Desligamento seguro** | Ao reiniciar, termina as requisições em andamento e fecha o banco |
| **Rota `/saude`** | Permite verificar (ou monitorar) se o sistema e o banco estão no ar |
| **Backup automático** (`db/backup.js`) | Cópia diária consistente do banco, guardando as 14 últimas |
| **Página 404 própria e logs sem e-mail** | Melhor experiência e logs sem dados pessoais |
| Saíram: versão JSON e importador | Eram etapas de estudo; não fazem parte do sistema publicado |

---

## Rodar no seu computador

```bash
npm install
npm start
```
Abra http://localhost:3000.

Sem `.env`, o servidor usa os padrões: porta 3000, banco em `db/inscricoes.db` e **área admin desativada**. Para testar a área admin localmente, crie um `.env` a partir do `.env.exemplo`, com `NODE_ENV=development`, `DB_PATH` vazio e uma `ADMIN_SENHA` qualquer.

---

## Estrutura

```
formulario_db_vps/
  servidor.js               ← servidor de produção (rotas, segurança, admin)
  validacao.js              ← regras de validação (inclui consentimento LGPD)
  package.json / package-lock.json
  .env.exemplo              ← modelo de configuração (copiar para .env)
  db/
    schema.sql              ← tabelas + dados iniciais
    banco.js                ← todo o SQL
    backup.js               ← cópia de segurança (agendada no cron)
    consultas.sql           ← consultas de estudo
  public/                   ← tudo que é público
    index.html              ← página inicial explicando o projeto
    inscricao.html          ← formulário
    privacidade.html        ← política de privacidade
    confirmacao.html
    estilo.css
    js/formulario.js
  admin/                    ← só com usuário e senha
    index.html              ← lista, busca, exclusão e relatório
    js/lista.js
  deploy/
    nginx.conf              ← configuração do Nginx (proxy + HTTPS)
    ecosystem.config.cjs    ← configuração do PM2 (mantém o Node rodando)
```

## Variáveis de ambiente (`.env`)

| Variável | Exemplo | Para que serve |
|---|---|---|
| `NODE_ENV` | `production` | Liga o cache de arquivos estáticos |
| `PORTA` | `3000` | Porta interna do Node |
| `HOST` | `127.0.0.1` | Só aceita conexões da própria máquina |
| `DB_PATH` | `/var/lib/formulario/inscricoes.db` | Onde fica o banco |
| `ADMIN_USUARIO` | `admin` | Usuário da área admin |
| `ADMIN_SENHA` | *(senha longa)* | Senha da área admin. Vazia = admin desligado |
| `BACKUP_DIR` | `/var/backups/formulario` | Pasta dos backups (opcional) |

## Rotas

| Método | Rota | Acesso | O que faz |
|---|---|---|---|
| GET | `/` | público | Página inicial |
| GET | `/inscricao.html`, `/privacidade.html` | público | Formulário e política |
| GET | `/api/opcoes` | público | Cursos e atividades |
| POST | `/inscricoes` | público (limite: 10 a cada 15 min por IP) | Recebe a inscrição |
| GET | `/saude` | público | Status do sistema e do banco |
| GET | `/admin/` | **senha** | Lista, busca, exclusão e relatório |
| GET | `/api/admin/inscricoes?busca=` | **senha** | Lista de inscrições |
| DELETE | `/api/admin/inscricoes/:id` | **senha** | Exclui uma inscrição |
| GET | `/api/admin/relatorio` | **senha** | Totais por curso, atividade, modalidade e semestre |

## Testes realizados (2026-11-20)

32/32 testes de requisição passaram (Node v26.13.1, com banco isolado numa pasta temporária):
- página inicial, páginas públicas e cabeçalhos de segurança;
- consentimento obrigatório e e-mail duplicado;
- área admin recusando acesso sem senha e com senha errada (página, script e API);
- busca com `%` e `_`, relatório, exclusão, 404;
- limite de envios (`429`).

Também passaram: o backup (`VACUUM INTO`), a confirmação de que o servidor escuta só em `127.0.0.1` e o teste no Chrome (página inicial e formulário sem erros de console com a CSP ativa). O Nginx, o PM2, o HTTPS e o cron só podem ser testados na VPS: siga a seção de verificação do guia de publicação.
