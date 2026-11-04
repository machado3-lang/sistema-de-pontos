/**
 * Compatibilidade: o motor real vive em `src/engine`.
 * Este arquivo mantém a API antiga usada pelo Dashboard.
 */

export { parseAFD, parseAFDLinhas, validarAFD } from './engine/afd.js';
export { formatMinutes as parseMinutosToHHMM } from './engine/time.js';
