// Configuração do PM2: mantém o Node rodando, reinicia se cair e inicia junto com a VPS.
// Uso (dentro da pasta do projeto):  pm2 start deploy/ecosystem.config.cjs
const path = require('node:path');
const PASTA = path.join(__dirname, '..'); // pasta do projeto

module.exports = {
    apps: [
        {
            name: 'formulario',
            script: path.join(PASTA, 'servidor.js'),
            cwd: PASTA,
            // Caminho ABSOLUTO do .env: um caminho relativo depende da pasta
            // em que o PM2 foi iniciado (após um reboot, não é a do projeto).
            node_args: `--env-file=${path.join(PASTA, '.env')}`,
            exec_mode: 'fork',                      // processo Node comum (o modo "cluster" não combina com ESM nem com --env-file)
            instances: 1,                           // SQLite: um processo só
            autorestart: true,
            max_memory_restart: '200M',             // reinicia se passar disso (proteção)
            kill_timeout: 10000,                    // dá tempo do desligamento seguro
            time: true,                             // data/hora em cada linha do log
        },
    ],
};
