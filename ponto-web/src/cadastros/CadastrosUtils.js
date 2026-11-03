import { Clock, Users, Building2, Briefcase, Plus, Save, X, Edit2, Trash2, Search, Loader, Sliders, Cpu, Calendar, List, Wifi, Server, Globe, CheckCircle, XCircle, RefreshCw, Upload, Download } from 'lucide-react';

export function formatCPF(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  let formatted = '';
  for (let i = 0; i < digits.length; i++) {
    if (i === 3 || i === 6) formatted += '.';
    if (i === 9) formatted += '-';
    formatted += digits[i];
  }
  return formatted;
}

export function formatCNPJ(value) {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  let formatted = '';
  for (let i = 0; i < digits.length; i++) {
    if (i === 2 || i === 5) formatted += '.';
    if (i === 8) formatted += '/';
    if (i === 12) formatted += '-';
    formatted += digits[i];
  }
  return formatted;
}

export function formatPIS(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  let formatted = '';
  for (let i = 0; i < digits.length; i++) {
    if (i === 3) formatted += '.';
    if (i === 8) formatted += '.';
    if (i === 10) formatted += '-';
    formatted += digits[i];
  }
  return formatted;
}

export function formatCEP(value) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  let formatted = '';
  for (let i = 0; i < digits.length; i++) {
    if (i === 5) formatted += '-';
    formatted += digits[i];
  }
  return formatted;
}

export function formatPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  let formatted = '';
  for (let i = 0; i < digits.length; i++) {
    if (i === 0) formatted += '(';
    if (i === 2) formatted += ') ';
    if (i === 7) formatted += '-';
    formatted += digits[i];
  }
  return formatted;
}

export function isValidCPF(cpf) {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let firstDV = (sum * 10) % 11;
  if (firstDV === 10) firstDV = 0;
  if (firstDV !== parseInt(digits[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  let secondDV = (sum * 10) % 11;
  if (secondDV === 10) secondDV = 0;
  if (secondDV !== parseInt(digits[10])) return false;
  return true;
}

export function isValidCNPJ(cnpj) {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0, mult = 5; i < 12; i++, mult = (mult <= 2 ? 9 : mult - 1)) sum += parseInt(digits[i]) * mult;
  let remainder = sum % 11;
  let firstDV = remainder < 2 ? 0 : 11 - remainder;
  if (firstDV !== parseInt(digits[12])) return false;
  sum = 0;
  for (let i = 0, mult = 6; i < 13; i++, mult = (mult <= 2 ? 9 : mult - 1)) sum += parseInt(digits[i]) * mult;
  remainder = sum % 11;
  let secondDV = remainder < 2 ? 0 : 11 - remainder;
  if (secondDV !== parseInt(digits[13])) return false;
  return true;
}

export function calcMinutos(horario) {
  if (!horario) return 0;
  const [h, m] = horario.split(':').map(Number);
  return h * 60 + m;
}

export function calcTotalDia(periodos) {
  let total = 0;
  for (const p of periodos) total += calcMinutos(p.saida) - calcMinutos(p.entrada);
  return total;
}

export function formatMinutos(min) {
  if (min <= 0) return '00:00';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function periodoPadrao() {
  return { entrada: '', saida: '' };
}

export function carregarLocal(key, padrao) {
  try { return JSON.parse(localStorage.getItem(key)) || padrao; } catch { return padrao; }
}
export function salvarLocal(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function isUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(str));
}

// ── Hash de senha mobile (PBKDF2-SHA256) ────────────────────────────────────
// Usa Web Crypto quando disponível (HTTPS/localhost) e um fallback em JS para
// contextos não seguros (HTTP em rede local), garantindo que a senha nunca
// seja gravada em texto puro.
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }

function sha256Bytes(bytes) {
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const len = bytes.length;
  const padded = new Uint8Array((((len + 8) >> 6) + 1) * 64);
  padded.set(bytes);
  padded[len] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor((len * 8) / 0x100000000));
  view.setUint32(padded.length - 4, (len * 8) >>> 0);
  const w = new Uint32Array(64);
  for (let off = 0; off < padded.length; off += 64) {
    for (let t = 0; t < 16; t++) w[t] = view.getUint32(off + t * 4);
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }
    let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + SHA256_K[t] + w[t]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) outView.setUint32(i * 4, H[i]);
  return out;
}

function concatBytes(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
}

function hmacSha256(key, msg) {
  const k = key.length > 64 ? sha256Bytes(key) : key;
  const ipad = new Uint8Array(64);
  const opad = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    ipad[i] = (k[i] || 0) ^ 0x36;
    opad[i] = (k[i] || 0) ^ 0x5c;
  }
  return sha256Bytes(concatBytes(opad, sha256Bytes(concatBytes(ipad, msg))));
}

function pbkdf2Sha256(password, salt, iterations, dkLen) {
  const pwd = new TextEncoder().encode(String(password));
  const blocks = Math.ceil(dkLen / 32);
  const out = new Uint8Array(blocks * 32);
  for (let b = 1; b <= blocks; b++) {
    const saltBlock = new Uint8Array(salt.length + 4);
    saltBlock.set(salt);
    new DataView(saltBlock.buffer).setUint32(salt.length, b);
    let u = hmacSha256(pwd, saltBlock);
    const t = u.slice();
    for (let i = 1; i < iterations; i++) {
      u = hmacSha256(pwd, u);
      for (let j = 0; j < 32; j++) t[j] ^= u[j];
    }
    out.set(t, (b - 1) * 32);
  }
  return out.slice(0, dkLen);
}

function bytesToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

// Formato: pbkdf2$<iteracoes>$<salt_base64>$<hash_base64>
export async function hashSenhaMobile(senha) {
  const salt = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(salt);
  } else {
    for (let i = 0; i < salt.length; i++) salt[i] = Math.floor(Math.random() * 256);
  }

  if (globalThis.crypto?.subtle) {
    const iterations = 100000;
    const keyMaterial = await globalThis.crypto.subtle.importKey(
      'raw', new TextEncoder().encode(String(senha)), 'PBKDF2', false, ['deriveBits']
    );
    const bits = await globalThis.crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, keyMaterial, 256
    );
    return `pbkdf2$${iterations}$${bytesToBase64(salt)}$${bytesToBase64(bits)}`;
  }

  // Fallback para contexto não seguro (HTTP em rede local).
  const iterations = 20000;
  const bits = pbkdf2Sha256(senha, salt, iterations, 32);
  return `pbkdf2$${iterations}$${bytesToBase64(salt)}$${bytesToBase64(bits)}`;
}

export const DIAS_SEMANA = [
  { key: 'segunda', label: 'Segunda' }, { key: 'terca', label: 'Terça' },
  { key: 'quarta', label: 'Quarta' }, { key: 'quinta', label: 'Quinta' },
  { key: 'sexta', label: 'Sexta' }, { key: 'sabado', label: 'Sábado' },
  { key: 'domingo', label: 'Domingo' }
];

export const TIPOS_JORNADA = ['Fixa', 'Escala Flexível', 'Turno Noturno', 'Eventual'];

export const ESTADOS_BR = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
];

export { Clock, Users, Building2, Briefcase, Plus, Save, X, Edit2, Trash2, Search, Loader, Sliders, Cpu, Calendar, List, Wifi, Server, Globe, CheckCircle, XCircle, RefreshCw, Upload, Download };
