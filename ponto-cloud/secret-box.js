/**
 * Criptografia de credenciais de REP (AES-256-GCM).
 *
 * Formato: `enc:v1:<iv_base64>:<tag_base64>:<cipher_base64>`
 *
 * A chave vem de `REP_SECRET`. Sem a variável, o valor é gravado em texto puro
 * (compatibilidade) e o servidor emite um aviso.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const SEGREDO = process.env.REP_SECRET || '';
const PREFIXO = 'enc:v1:';

let avisou = false;

function chave() {
  if (!SEGREDO) {
    if (!avisou) {
      console.warn('[REP] REP_SECRET não definido — credenciais de REP serão gravadas em texto puro.');
      avisou = true;
    }
    return null;
  }
  return createHash('sha256').update(SEGREDO).digest();
}

export function precisaCriptografar(valor) {
  return Boolean(valor) && !String(valor).startsWith(PREFIXO);
}

export function criptografar(valor) {
  if (valor === null || valor === undefined || valor === '') return valor;
  if (String(valor).startsWith(PREFIXO)) return valor;
  const k = chave();
  if (!k) return valor;

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', k, iv);
  const cifrado = Buffer.concat([cipher.update(String(valor), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIXO}${iv.toString('base64')}:${tag.toString('base64')}:${cifrado.toString('base64')}`;
}

export function descriptografar(valor) {
  if (valor === null || valor === undefined || valor === '') return valor;
  const texto = String(valor);
  if (!texto.startsWith(PREFIXO)) return valor;

  const k = chave();
  if (!k) return null;

  try {
    const [ivB64, tagB64, cifradoB64] = texto.slice(PREFIXO.length).split(':');
    const decipher = createDecipheriv('aes-256-gcm', k, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const aberto = Buffer.concat([
      decipher.update(Buffer.from(cifradoB64, 'base64')),
      decipher.final(),
    ]);
    return aberto.toString('utf8');
  } catch {
    console.warn('[REP] falha ao descriptografar credencial (REP_SECRET mudou?)');
    return null;
  }
}
