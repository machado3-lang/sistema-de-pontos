/**
 * Utilitários de data e hora do motor de ponto.
 * Tudo trabalha com "minutos desde 00:00" e datas ISO (YYYY-MM-DD) em horário local.
 */

import { WEEKDAY_KEYS, WEEKDAY_NAMES, FIXED_HOLIDAYS } from './constants.js';

/** Converte "HH:MM", "HH:MM:SS", número de minutos ou vazio em minutos. */
export function toMinutes(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  const s = String(value).trim();
  if (!s) return 0;
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  const negativo = s.startsWith('-');
  const partes = s.replace('-', '').split(':').map(Number);
  const h = partes[0] || 0;
  const m = partes[1] || 0;
  const seg = partes[2] || 0;
  const total = h * 60 + m + Math.round(seg / 60);
  return negativo ? -total : total;
}

/** Formata minutos como HH:MM (ou +HH:MM quando signed). */
export function formatMinutes(min, { signed = false } = {}) {
  const n = Math.round(Number(min) || 0);
  const sinal = n < 0 ? '-' : (signed && n > 0 ? '+' : '');
  const abs = Math.abs(n);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sinal}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Formata minutos como horas decimais (ex.: 1:30 -> "1,50"). */
export function formatDecimalHours(min) {
  return (Math.round((Number(min) || 0) / 6) / 10).toFixed(2).replace('.', ',');
}

/** Cria uma Date local ao meio-dia (evita problemas de fuso/DST). */
export function parseDate(dateStr) {
  if (dateStr instanceof Date) return new Date(dateStr.getFullYear(), dateStr.getMonth(), dateStr.getDate(), 12, 0, 0);
  const [y, m, d] = String(dateStr || '').split('-').map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1, 12, 0, 0);
}

/** Date -> YYYY-MM-DD. */
export function formatDate(date) {
  const d = date instanceof Date ? date : parseDate(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(dateStr, n) {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + Number(n || 0));
  return formatDate(d);
}

/** Lista de datas (inclusive) entre início e fim. */
export function eachDate(start, end) {
  const datas = [];
  if (!start || !end) return datas;
  const inicio = parseDate(start);
  const fim = parseDate(end);
  if (inicio > fim) return datas;
  const cursor = new Date(inicio);
  while (cursor <= fim) {
    datas.push(formatDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return datas;
}

export function weekdayIndex(dateStr) {
  return parseDate(dateStr).getDay();
}

export function weekdayKey(dateStr) {
  return WEEKDAY_KEYS[weekdayIndex(dateStr)];
}

export function weekdayName(dateStr) {
  return WEEKDAY_NAMES[weekdayIndex(dateStr)];
}

export function weekdayLabel(dateStr) {
  return ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][weekdayIndex(dateStr)];
}

export function isWeekend(dateStr) {
  const d = weekdayIndex(dateStr);
  return d === 0 || d === 6;
}

export function isSunday(dateStr) {
  return weekdayIndex(dateStr) === 0;
}

/** Verifica feriado nacional fixo ou feriado informado (YYYY-MM-DD). */
export function isHoliday(dateStr, feriados = []) {
  if (!dateStr) return false;
  const mesDia = String(dateStr).slice(5);
  if (FIXED_HOLIDAYS.includes(mesDia)) return true;
  return (feriados || []).some((f) => {
    if (!f) return false;
    return String(f) === dateStr || String(f).slice(5) === mesDia;
  });
}

/** Tipo do dia para fins de hora extra/DSR. */
export function dayType(dateStr, feriados = []) {
  if (isHoliday(dateStr, feriados)) return 'domingos_feriados';
  const key = weekdayKey(dateStr);
  if (key === 'dom') return 'domingos_feriados';
  if (key === 'sab') return 'sabados';
  return 'dias_uteis';
}

/**
 * Minutos de sobreposição entre [inicioMin, fimMin] e a janela noturna.
 * Trata turnos que cruzam a meia-noite e janelas que cruzam a meia-noite.
 */
export function nightClockMinutes(inicioMin, fimMin, janelaInicio, janelaFim) {
  let ini = Number(inicioMin) || 0;
  let fim = Number(fimMin) || 0;
  if (fim <= ini) fim += 1440; // turno cruzando a meia-noite

  let jIni = Number(janelaInicio) || 0;
  let jFim = Number(janelaFim) || 0;
  if (jFim <= jIni) jFim += 1440; // janela 22:00 -> 05:00

  let total = 0;
  // Compara o turno com a janela no dia 0 e no dia +1 (cobre turnos longos).
  for (const offset of [0, 1440]) {
    const a = Math.max(ini, jIni + offset);
    const b = Math.min(fim, jFim + offset);
    if (b > a) total += b - a;
  }
  return total;
}

/** Início da semana (segunda-feira) no formato YYYY-MM-DD. */
export function weekStart(dateStr) {
  const d = parseDate(dateStr);
  const day = d.getDay(); // 0 = domingo
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return formatDate(d);
}

/** Início do mês no formato YYYY-MM-DD. */
export function monthStart(dateStr) {
  const d = parseDate(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

/** Diferença em dias entre duas datas (b - a). */
export function diffDays(a, b) {
  return Math.round((parseDate(b) - parseDate(a)) / 86400000);
}
