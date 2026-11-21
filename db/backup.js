// =====================================================================
// Cópia de segurança do banco. Agendado no cron da VPS (ver PUBLICACAO_HOSTINGER.md):
//   node --env-file=.env db/backup.js
// Mantém as últimas 14 cópias em BACKUP_DIR (padrão: /var/backups/formulario).
// =====================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fazerBackup, fecharBanco } from './banco.js';

const PASTA = process.env.BACKUP_DIR || '/var/backups/formulario';
const MANTER = 14;

const carimbo = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19); // 2026-11-20-14-05-00
const destino = path.join(PASTA, `inscricoes-${carimbo}.db`);

fazerBackup(destino);
fecharBanco();
console.log(`Backup criado: ${destino}`);

// Apaga as cópias mais antigas, mantendo só as últimas MANTER
const copias = fs.readdirSync(PASTA).filter((n) => /^inscricoes-.*\.db$/.test(n)).sort();
for (const antiga of copias.slice(0, Math.max(0, copias.length - MANTER))) {
    fs.unlinkSync(path.join(PASTA, antiga));
    console.log(`Backup antigo removido: ${antiga}`);
}
