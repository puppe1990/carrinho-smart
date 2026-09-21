export interface RealCatalogProduct {
  barcode: string
  brand: string
}

/**
 * EAN-13 reais (fonte: Open Food Facts) para os produtos do catálogo.
 * Usados pelo seed e por uma migração que atualiza catálogos já existentes.
 */
export const CATALOG_REAL_PRODUCTS: Record<string, RealCatalogProduct> = {
  'prod-1': { barcode: '7896089011982', brand: 'Pilão' },
  'prod-2': { barcode: '7893500020110', brand: 'Tio João' },
  'prod-3': { barcode: '7896006744115', brand: 'Camil' },
  'prod-4': { barcode: '7891910000197', brand: 'União' },
  'prod-5': { barcode: '7896036090244', brand: 'Liza' },
  'prod-6': { barcode: '5601216120152', brand: 'Andorinha' },
  'prod-7': { barcode: '7896022200756', brand: 'Galo' },
  'prod-8': { barcode: '7896036099988', brand: 'Pomarola' },
  'prod-9': { barcode: '7898215151708', brand: 'Piracanjuba' },
  'prod-10': { barcode: '7891097103841', brand: 'President' },
  'prod-11': { barcode: '7891025120230', brand: 'Danone' },
  'prod-12': { barcode: '7896331100310', brand: 'Aviação' },
  'prod-13': { barcode: '7891999144485', brand: 'Vigor' },
  'prod-20': { barcode: '7896098902042', brand: 'Ypê' },
  'prod-22': { barcode: '7896056401044', brand: 'Urca' },
  'prod-23': { barcode: '7898969564298', brand: 'Absoluto' },
  'prod-28': { barcode: '7896066301778', brand: 'Wickbold' },
}
