/**
 * Municípios do IBGE por UF.
 * Usado nos selects de cidade (feriado e funcionário) para evitar erro de digitação.
 */

const CACHE_PREFIX = 'ponto_municipios_';

export async function carregarMunicipios(uf) {
  const sigla = String(uf || '').toUpperCase();
  if (!sigla) return [];

  const chave = CACHE_PREFIX + sigla;
  try {
    const cache = JSON.parse(localStorage.getItem(chave) || 'null');
    if (Array.isArray(cache) && cache.length) return cache;
  } catch {
    // Cache inválido: busca novamente.
  }

  try {
    const res = await fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${sigla}/municipios`
    );
    if (!res.ok) throw new Error(`IBGE ${res.status}`);
    const dados = await res.json();
    const lista = (Array.isArray(dados) ? dados : [])
      .map((m) => ({ codigo: String(m.id), nome: m.nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    try {
      localStorage.setItem(chave, JSON.stringify(lista));
    } catch {
      // Cache opcional.
    }
    return lista;
  } catch {
    return [];
  }
}

export function nomeMunicipio(lista, codigo) {
  return lista.find((m) => m.codigo === String(codigo))?.nome || '';
}
