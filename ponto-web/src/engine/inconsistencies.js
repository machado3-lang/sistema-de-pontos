/**
 * Inconsistências configuráveis da apuração (estilo RHiD).
 *
 * Cada tipo cadastrado tem um `campo`:
 *  - batida: número ímpar de batidas;
 *  - atraso: minutos de atraso/débito parcial;
 *  - falta:  minutos de falta;
 *  - extra:  minutos de hora extra;
 *  - banco:  saldo de banco (em módulo);
 *  - outro:  reservado.
 *
 * `valor_min` é o limite em minutos (inclusive para os campos numéricos).
 * A prioridade menor aparece primeiro.
 */

export function avaliarInconsistencias(linha = {}, tipos = []) {
  const encontradas = [];

  for (const t of tipos || []) {
    if (!t || t.ativo === false) continue;
    const limite = Math.max(0, Number(t.valor_min) || 0);
    let valor = 0;
    let dispara = false;

    switch (t.campo) {
      case 'batida':
        dispara = linha.valido === false;
        break;
      case 'atraso':
        valor = Math.max(0, Number(linha.atrasoMin ?? linha.debitoMin) || 0);
        dispara = valor > limite;
        break;
      case 'falta':
        valor = Math.max(0, Number(linha.faltaMin ?? linha.debitoMin) || 0);
        dispara = valor > limite;
        break;
      case 'extra':
        valor = Math.max(0, Number(linha.extraMin) || 0);
        dispara = valor > limite;
        break;
      case 'banco':
        valor = Math.abs(Number(linha.bancoMin) || 0);
        dispara = valor > limite;
        break;
      default:
        break;
    }

    if (dispara) {
      encontradas.push({
        id: t.id,
        nome: t.nome || t.campo,
        campo: t.campo,
        valorMin: limite,
        valor,
        prioridade: Number(t.prioridade) || 5,
        icone: t.icone || '',
        cor: t.cor || '',
      });
    }
  }

  encontradas.sort((a, b) => a.prioridade - b.prioridade || a.nome.localeCompare(b.nome));
  return encontradas;
}

export function inconsistenciaPrincipal(linha = {}, tipos = []) {
  return avaliarInconsistencias(linha, tipos)[0] || null;
}
