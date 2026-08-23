/**
 * Provider de cobertura de rede — GEO.ANACOM
 *
 * INVESTIGACAO REALIZADA (Fase 1):
 * - GEO.ANACOM corre sobre ArcGIS Enterprise 11.3.0 (confirmado via
 *   https://geo.anacom.pt/portal/sharing/portals/self?f=pjson, acessivel sem autenticacao)
 * - Isto significa que existe uma API REST publica e documentada pelo standard
 *   ArcGIS REST API (nao e scraping do mapa visual, e a mesma interface que
 *   qualquer cliente ArcGIS usa para consultar dados)
 * - server base confirmado: https://geo.anacom.pt/server/rest/services
 *
 * PECA EM FALTA (bloqueio conhecido):
 * - Nao foi possivel descobrir, so por pesquisa, o nome exato do
 *   FeatureLayer/MapServer que contem a camada "Cobertura (Fixa, Movel e
 *   Satelite)". Isto requer inspecionar o separador "Network" das
 *   Ferramentas de Programador do browser enquanto se clica num ponto no
 *   mapa em https://geo.anacom.pt/publico/home
 * - Assim que esse nome for obtido, basta preencher COVERAGE_LAYER_URL
 *   abaixo — o resto do provider ja esta pronto para o usar.
 *
 * Ate la, getCoverage() devolve um resultado "indisponivel" de forma
 * explicita, para nunca inventar dados de cobertura.
 */

const COVERAGE_LAYER_URL: string | null = null

export interface CoverageResult {
  available: boolean
  address?: string
  lat?: number
  lon?: number
  operators?: unknown[]
  source: string
  fetchedAt: string
  note?: string
}

export async function getCoverage(lat: number, lon: number, address?: string): Promise<CoverageResult> {
  if (!COVERAGE_LAYER_URL) {
    return {
      available: false,
      address,
      lat,
      lon,
      source: 'GEO.ANACOM (ArcGIS Enterprise) — geo.anacom.pt',
      fetchedAt: new Date().toISOString(),
      note: 'Camada de cobertura ainda nao configurada (falta o nome exato do servico).',
    }
  }

  const url = `${COVERAGE_LAYER_URL}/query?geometry=${lon},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&f=json`

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) throw new Error(`GEO.ANACOM respondeu ${res.status}`)
    const data = await res.json()
    return {
      available: true,
      address,
      lat,
      lon,
      operators: data.features ?? [],
      source: 'GEO.ANACOM (ArcGIS Enterprise) — geo.anacom.pt',
      fetchedAt: new Date().toISOString(),
    }
  } catch (err) {
    return {
      available: false,
      address,
      lat,
      lon,
      source: 'GEO.ANACOM (ArcGIS Enterprise) — geo.anacom.pt',
      fetchedAt: new Date().toISOString(),
      note: `Erro ao consultar: ${err instanceof Error ? err.message : 'desconhecido'}`,
    }
  }
}
