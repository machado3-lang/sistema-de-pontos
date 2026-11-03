/**
 * Rate limit simples em memória para login.
 */

const TENTATIVAS = new Map();
const JANELA_MS = 15 * 60 * 1000;
const MAX_TENTATIVAS = 10;

export function loginPermitido(chave) {
  const agora = Date.now();
  if (TENTATIVAS.size > 1000) {
    for (const [k, v] of TENTATIVAS) {
      if (agora > v.resetAt) TENTATIVAS.delete(k);
    }
  }
  const atual = TENTATIVAS.get(chave);
  if (!atual || agora > atual.resetAt) {
    TENTATIVAS.set(chave, { count: 1, resetAt: agora + JANELA_MS });
    return true;
  }
  if (atual.count >= MAX_TENTATIVAS) return false;
  atual.count++;
  return true;
}

export function limparTentativas(chave) {
  TENTATIVAS.delete(chave);
}
