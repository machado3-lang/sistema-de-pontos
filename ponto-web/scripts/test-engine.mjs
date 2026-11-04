const E = await import('../src/engine/index.js');

let falhas = 0;
function check(nome, cond, extra = '') {
  if (!cond) { falhas++; console.log('FALHOU:', nome, extra); }
  else console.log('OK:', nome);
}

const dias = {
  seg: { ativo: true, periodos: [{ entrada: '08:00', saida: '12:00' }, { entrada: '13:00', saida: '17:00' }] },
  ter: { ativo: true, periodos: [{ entrada: '08:00', saida: '12:00' }, { entrada: '13:00', saida: '17:00' }] },
  qua: { ativo: true, periodos: [{ entrada: '08:00', saida: '12:00' }, { entrada: '13:00', saida: '17:00' }] },
  qui: { ativo: true, periodos: [{ entrada: '08:00', saida: '12:00' }, { entrada: '13:00', saida: '17:00' }] },
  sex: { ativo: true, periodos: [{ entrada: '08:00', saida: '12:00' }, { entrada: '13:00', saida: '17:00' }] },
  sab: { ativo: false, periodos: [] },
  dom: { ativo: false, periodos: [] },
};
const horario = { id: 1, tipo: 'Fixa', ativo: true, dias };
const params = {};

const diaNormal = E.calcularDia({
  data: '2026-10-30', funcionario: {}, horario, params,
  marcacoes: [{ hora: '08:00' }, { hora: '12:00' }, { hora: '13:00' }, { hora: '17:00' }],
});
check('dia normal previsto 480', diaNormal.previstoMin === 480, diaNormal.previstoMin);
check('dia normal trabalhado 480', diaNormal.trabalhadoMin === 480, diaNormal.trabalhadoMin);
check('dia normal sem extra', diaNormal.extraMin === 0, diaNormal.extraMin);
check('dia normal sem falta', diaNormal.faltaMin === 0, diaNormal.faltaMin);

const diaExtra = E.calcularDia({
  data: '2026-10-30', funcionario: {}, horario, params,
  marcacoes: [{ hora: '08:00' }, { hora: '12:00' }, { hora: '13:00' }, { hora: '19:00' }],
});
check('extra 120 min', diaExtra.extraMin === 120, diaExtra.extraMin);
check('extra faixa1 120', diaExtra.extraFaixa1 === 120, diaExtra.extraFaixa1);
check('extra 50%', diaExtra.faixa1Pct === 50, diaExtra.faixa1Pct);

const diaTol5 = E.calcularDia({
  data: '2026-10-30', funcionario: {}, horario, params,
  marcacoes: [{ hora: '08:05' }, { hora: '12:00' }, { hora: '13:00' }, { hora: '17:00' }],
});
check('tolerancia 5 min sem falta', diaTol5.faltaMin === 0, diaTol5.faltaMin);
check('tolerancia 5 min registrada', diaTol5.toleranciaMin === 5, diaTol5.toleranciaMin);

const diaTol15 = E.calcularDia({
  data: '2026-10-30', funcionario: {}, horario, params,
  marcacoes: [{ hora: '08:15' }, { hora: '12:00' }, { hora: '13:00' }, { hora: '17:00' }],
});
check('atraso 15 min gera falta 15', diaTol15.faltaMin === 15, diaTol15.faltaMin);

const diaFalta = E.calcularDia({
  data: '2026-10-30', funcionario: {}, horario, params, marcacoes: [],
});
check('falta dia inteiro 480', diaFalta.faltaMin === 480, diaFalta.faltaMin);

const diaJustificado = E.calcularDia({
  data: '2026-10-30', funcionario: { id: 'f1' }, horario, params, marcacoes: [],
  justificativas: [{
    id: 1, funcionario_id: 'f1', data: '2026-10-30',
    tipo_comportamento: 'dia_inteiro', abona_falta: true,
  }],
});
check('justificativa dia inteiro abona falta', diaJustificado.faltaMin === 0, diaJustificado.faltaMin);
check('justificativa dia inteiro abono 480', diaJustificado.abonoMin === 480, diaJustificado.abonoMin);
check('justificativa dia inteiro total JUSTIFICADA', diaJustificado.total_formatado === 'JUSTIFICADA', diaJustificado.total_formatado);

const diaPeriodoJust = E.calcularDia({
  data: '2026-10-30', funcionario: { id: 'f1' }, horario, params,
  marcacoes: [{ hora: '08:00' }, { hora: '12:00' }, { hora: '13:00' }, { hora: '16:00' }],
  justificativas: [{
    id: 2, funcionario_id: 'f1', data: '2026-10-30',
    tipo_comportamento: 'periodo', inicio: '08:00', fim: '09:00',
  }],
});
check('justificativa periodo abona 60', diaPeriodoJust.abonoMin === 60, diaPeriodoJust.abonoMin);
check('justificativa periodo zera falta', diaPeriodoJust.faltaMin === 0, diaPeriodoJust.faltaMin);

const diaHorasJust = E.calcularDia({
  data: '2026-10-30', funcionario: { id: 'f1' }, horario, params,
  marcacoes: [{ hora: '08:00' }, { hora: '12:00' }, { hora: '13:00' }, { hora: '16:00' }],
  justificativas: [{
    id: 3, funcionario_id: 'f1', data: '2026-10-30',
    tipo_comportamento: 'horas', abona_horas: true, minutos: 30,
  }],
});
check('justificativa horas abona 30', diaHorasJust.abonoMin === 30, diaHorasJust.abonoMin);
check('justificativa horas falta 30', diaHorasJust.faltaMin === 30, diaHorasJust.faltaMin);

const diaAjuste = E.calcularDia({
  data: '2026-10-30', funcionario: { id: 'f1' }, horario, params,
  marcacoes: [{ hora: '08:00' }, { hora: '12:00' }, { hora: '13:00' }, { hora: '16:00' }],
  justificativas: [{
    id: 4, funcionario_id: 'f1', data: '2026-10-30',
    tipo_comportamento: 'ajuste', minutos: -30,
  }],
});
check('justificativa ajuste -30', diaAjuste.ajusteMin === -30, diaAjuste.ajusteMin);
check('justificativa ajuste saldo -90', diaAjuste.saldoDiaMin === -90, diaAjuste.saldoDiaMin);

const diaBancoJust = E.calcularDia({
  data: '2026-10-30', funcionario: { id: 'f1' }, horario, params,
  marcacoes: [{ hora: '08:00' }, { hora: '12:00' }, { hora: '13:00' }, { hora: '19:00' }],
  justificativas: [{
    id: 5, funcionario_id: 'f1', data: '2026-10-30',
    tipo_comportamento: 'banco', gera_banco: true,
  }],
});
check('justificativa banco reloca extra', diaBancoJust.extraMin === 0, diaBancoJust.extraMin);
check('justificativa banco credita 120', diaBancoJust.bancoAjusteMin === 120, diaBancoJust.bancoAjusteMin);

const linhasDSRBase = [
  { data: '2026-10-26', tipoDia: 'dias_uteis', extraMin: 0, faltaMin: 0 },
  { data: '2026-10-27', tipoDia: 'dias_uteis', extraMin: 0, faltaMin: 0 },
  { data: '2026-10-28', tipoDia: 'dias_uteis', extraMin: 0, faltaMin: 0 },
  { data: '2026-10-29', tipoDia: 'dias_uteis', extraMin: 0, faltaMin: 0 },
  { data: '2026-10-30', tipoDia: 'dias_uteis', extraMin: 0, faltaMin: 480, protegeDSR: true },
  { data: '2026-11-01', tipoDia: 'domingos_feriados', extraMin: 120, faltaMin: 0 },
];
const dsrSemProtecao = E.calcularDSR({
  linhas: linhasDSRBase.map((l) => ({ ...l, protegeDSR: false })),
  params: { dsr: { descontar_faltas: true, faltas_para_perder_dsr: 1 } },
});
const dsrComProtecao = E.calcularDSR({
  linhas: linhasDSRBase,
  params: { dsr: { descontar_faltas: true, faltas_para_perder_dsr: 1 } },
});
check('dsr desconta falta sem protecao', dsrSemProtecao.detalhes[0].diasComFalta === 1, dsrSemProtecao.detalhes[0].diasComFalta);
check('dsr protegido ignora falta', dsrComProtecao.detalhes[0].diasComFalta === 0, dsrComProtecao.detalhes[0].diasComFalta);

const incTipos = [
  { id: 'i1', nome: 'Batida ímpar', campo: 'batida', prioridade: 1, ativo: true },
  { id: 'i2', nome: 'Atraso 10', campo: 'atraso', valor_min: 10, prioridade: 3, ativo: true },
  { id: 'i3', nome: 'Extra 120', campo: 'extra', valor_min: 120, prioridade: 4, ativo: true },
];
const incDia = E.avaliarInconsistencias({ valido: false, atrasoMin: 15, extraMin: 0 }, incTipos);
check('inconsistencia batida impar', incDia.some((i) => i.campo === 'batida'), incDia);
check('inconsistencia atraso', incDia.some((i) => i.campo === 'atraso' && i.valor === 15), incDia);
check('inconsistencia extra nao dispara', !incDia.some((i) => i.campo === 'extra'), incDia);
check('inconsistencia prioridade', incDia[0]?.campo === 'batida', incDia);
const incExtra = E.avaliarInconsistencias({ valido: true, atrasoMin: 0, extraMin: 130 }, incTipos);
check('inconsistencia extra dispara', incExtra.some((i) => i.campo === 'extra' && i.valor === 130), incExtra);

const diaTiers = E.calcularDia({
  data: '2026-10-30', funcionario: {}, horario, params,
  marcacoes: [{ hora: '08:00' }, { hora: '12:00' }, { hora: '13:00' }, { hora: '21:00' }],
});
check('extra 240 min', diaTiers.extraMin === 240, diaTiers.extraMin);
check('faixa1 120', diaTiers.extraFaixa1 === 120, diaTiers.extraFaixa1);
check('faixa2 120', diaTiers.extraFaixa2 === 120, diaTiers.extraFaixa2);
check('percentual medio 75', diaTiers.percentualHE === 75, diaTiers.percentualHE);

const diaFeriado = E.calcularDia({
  data: '2026-11-02', funcionario: {}, horario, params,
  marcacoes: [{ hora: '08:00' }, { hora: '12:00' }],
});
check('feriado nao previsto', diaFeriado.previstoMin === 0, diaFeriado.previstoMin);
check('feriado trabalhado vira extra 240', diaFeriado.extraMin === 240, diaFeriado.extraMin);
check('feriado extra 100%', diaFeriado.percentualHE === 100, diaFeriado.percentualHE);

const horarioNoturno = {
  id: 2, tipo: 'Turno Noturno', ativo: true, adicional_noturno: 20,
  dias: { ...dias, seg: { ativo: true, periodos: [{ entrada: '22:00', saida: '05:00' }] } },
};
const periodoNoturno = E.calcularPeriodo({
  funcionario: {}, doc: '12345678901', horario: horarioNoturno, params,
  dataInicio: '2026-10-26', dataFim: '2026-10-27',
  marcacoes: [
    { data: '2026-10-26', hora: '22:00' },
    { data: '2026-10-27', hora: '05:00' },
  ],
});
const linhaNoturna = periodoNoturno.linhas.find((l) => l.data === '2026-10-26');
check('noturno trabalhado 420', linhaNoturna.trabalhadoMin === 420, linhaNoturna.trabalhadoMin);
check('noturno reduzido 480', Math.round(linhaNoturna.noturnoMin) === 480, linhaNoturna.noturnoMin);

const periodoDSR = E.calcularPeriodo({
  funcionario: {}, doc: '12345678901', horario, params,
  dataInicio: '2026-10-26', dataFim: '2026-11-01',
  marcacoes: ['2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30'].flatMap((data) => [
    { data, hora: '08:00' }, { data, hora: '12:00' }, { data, hora: '13:00' }, { data, hora: '19:00' },
  ]),
});
check('DSR 120 min', Math.round(periodoDSR.totais.totalDSR) === 120, periodoDSR.totais.totalDSR);

const periodoBanco = E.calcularPeriodo({
  funcionario: {}, doc: '12345678901', horario,
  params: { banco_horas: { ativo: true, limite_positivo: 40, limite_negativo: 10 } },
  dataInicio: '2026-10-26', dataFim: '2026-11-01',
  marcacoes: ['2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30'].flatMap((data) => [
    { data, hora: '08:00' }, { data, hora: '12:00' }, { data, hora: '13:00' }, { data, hora: '19:00' },
  ]),
});
check('banco saldo 600', Math.round(periodoBanco.banco.saldoFinal) === 600, periodoBanco.banco.saldoFinal);

const afd1510 = '000000001' + '3' + '30' + '10' + '2026' + '08' + '00' + '000123456789';
const afd671 = '000000002' + '3' + '2026-10-30T08:00:00-0300' + '012345678901';
const afdRepP = '000000003' + '7' + '2026-10-30T09:00:00-0300' + '012345678901' + '2026-10-30T09:00:01-0300' + '04' + '0' + 'a'.repeat(64);
const p1510 = E.parseAFD(afd1510);
const p671 = E.parseAFD(afd671);
const pRepP = E.parseAFD(afdRepP);
check('AFD 1510 documento', Object.keys(p1510.dados)[0] === '00123456789', Object.keys(p1510.dados));
check('AFD 671 documento', Object.keys(p671.dados)[0] === '12345678901', Object.keys(p671.dados));
check('AFD REP-P tipo 7 documento', Object.keys(pRepP.dados)[0] === '12345678901', Object.keys(pRepP.dados));
check('AFD total batidas', p1510.totalBatidas === 1 && p671.totalBatidas === 1, `${p1510.totalBatidas}/${p671.totalBatidas}`);

const pad = (s, n) => String(s ?? '').padEnd(n, ' ');
const h1510 = '000000001' + '1' + '1' + '11111111000199'.padEnd(14)
  + '0'.repeat(12) + pad('EMPRESA 1510', 150) + '01102026' + '30102026' + '04112026';
const emp1510 = '000000002' + '5' + '30102026' + '0800' + 'I' + '000123456789'
  + pad('FUNCIONARIO TESTE', 52);
const m1510 = '000000003' + '3' + '30102026' + '0800' + '000123456789';
const t1510 = '999999999' + '000000000' + '000000001' + '000000000' + '000000000' + '9';
const v1510 = E.validarAFD([h1510, emp1510, m1510, t1510].join('\r\n'));
check('AFD 1510 portaria', v1510.resumo.portaria === '1510', v1510.resumo.portaria);
check('AFD 1510 trailer reconhecido', v1510.resumo.marcacoes === 1, v1510.resumo.marcacoes);
check('AFD 1510 sem avisos', v1510.avisos.length === 0, v1510.avisos);
check('AFD 1510 empregado 1510', v1510.resumo.funcionariosCadastradosNoRep === 1, v1510.resumo.funcionariosCadastradosNoRep);
const info1510 = E.parseAFDLinhas([h1510, emp1510, m1510, t1510].join('\r\n'));
check('AFD 1510 nome do empregado', info1510.funcionarios[0]?.nome === 'FUNCIONARIO TESTE', info1510.funcionarios[0]?.nome);

const h671 = '000000001' + '1' + '1' + pad('11111111000199', 14) + pad('', 14)
  + pad('EMPRESA 671', 150) + pad('', 17) + '2026-10-01' + '2026-10-31'
  + pad('2026-11-04T10:00:00-0300', 24) + '004' + '1' + pad('11111111000199', 14)
  + pad('MODELO', 30) + '0000';
const m671 = '000000002' + '3' + '2026-10-30T08:00:00-0300' + '012345678901' + '0000';
const t671 = '999999999' + '000000000' + '000000001' + '000000000' + '000000000'
  + '000000000' + '000000000' + '9';
const v671 = E.validarAFD([h671, m671, t671].join('\r\n'));
check('AFD 671 portaria no cabecalho', v671.resumo.portaria === '671', v671.resumo.portaria);
check('AFD 671 trailer reconhecido', v671.resumo.marcacoes === 1, v671.resumo.marcacoes);
check('AFD 671 sem avisos', v671.avisos.length === 0, v671.avisos);

const diaSabadoFolga = E.calcularDia({
  data: '2026-10-31', funcionario: {}, horario, params,
  marcacoes: [{ hora: '08:00' }, { hora: '12:00' }],
});
check('trabalho em folga vira 100%', diaSabadoFolga.percentualHE === 100, diaSabadoFolga.percentualHE);
check('trabalho em folga extra 240', diaSabadoFolga.extraMin === 240, diaSabadoFolga.extraMin);

const horarioEscala = {
  id: 3, tipo: 'Escala Flexível', ativo: true, data_inicio_escala: '2026-10-26',
  dias_escala: [
    { tipo: 'Trabalho', periodos: [{ entrada: '08:00', saida: '17:00' }] },
    { tipo: 'Folga', periodos: [] },
  ],
};
const escalaDia0 = E.calcularDia({ data: '2026-10-26', funcionario: {}, horario: horarioEscala, params, marcacoes: [] });
const escalaDia1 = E.calcularDia({ data: '2026-10-27', funcionario: {}, horario: horarioEscala, params, marcacoes: [] });
const escalaDia2 = E.calcularDia({ data: '2026-10-28', funcionario: {}, horario: horarioEscala, params, marcacoes: [] });
check('escala dia 0 trabalha', escalaDia0.trabalha && escalaDia0.previstoMin === 540, escalaDia0.previstoMin);
check('escala dia 1 folga', !escalaDia1.trabalha, escalaDia1.motivo);
check('escala dia 2 trabalha (ciclo)', escalaDia2.trabalha, escalaDia2.motivo);

const diaTolSimples = E.calcularDia({
  data: '2026-10-30', funcionario: {}, horario,
  params: { clt_art58: { metodo: 'simples', tolerancia_entrada_minutos: 10, tolerancia_saida_minutos: 10 } },
  marcacoes: [{ hora: '08:15' }, { hora: '12:00' }, { hora: '13:00' }, { hora: '17:00' }],
});
check('tolerancia simples 10 min', diaTolSimples.toleranciaMin === 10, diaTolSimples.toleranciaMin);
check('tolerancia simples falta 5', diaTolSimples.faltaMin === 5, diaTolSimples.faltaMin);

const periodoBancoTeto = E.calcularPeriodo({
  funcionario: {}, doc: '12345678901', horario,
  params: { banco_horas: { ativo: true, limite_positivo: 1, limite_negativo: 0 } },
  dataInicio: '2026-10-30', dataFim: '2026-10-30',
  marcacoes: [{ data: '2026-10-30', hora: '08:00' }, { data: '2026-10-30', hora: '12:00' }, { data: '2026-10-30', hora: '13:00' }, { data: '2026-10-30', hora: '19:00' }],
});
check('banco respeita teto 1h', Math.round(periodoBancoTeto.banco.saldoFinal) === 60, periodoBancoTeto.banco.saldoFinal);

const periodoBancoPiso = E.calcularPeriodo({
  funcionario: {}, doc: '12345678901', horario,
  params: { banco_horas: { ativo: true, limite_positivo: 40, limite_negativo: 0 } },
  dataInicio: '2026-10-30', dataFim: '2026-10-30',
  marcacoes: [],
});
check('banco respeita piso 0', Math.round(periodoBancoPiso.banco.saldoFinal) === 0, periodoBancoPiso.banco.saldoFinal);

console.log(falhas === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${falhas} TESTE(S) FALHARAM`);
process.exit(falhas === 0 ? 0 : 1);

