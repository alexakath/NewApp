import axiosInstance from '../axiosInstance'
import { parseXML } from '../xmlParser'

const getVal = (field) => {
  if (field === null || field === undefined) return ''
  if (typeof field === 'object') {
    if (field['#text'] !== undefined) return String(field['#text'])
    return ''
  }
  return String(field)
}

const getStockAvailableRecord = async (idProduct, idProductAttribute = 0) => {
  const response = await axiosInstance.get(
    `/stock_availables?display=full&filter[id_product]=[${idProduct}]&filter[id_product_attribute]=[${idProductAttribute}]`
  )
  const data = parseXML(response.data)
  const raw = data?.prestashop?.stock_availables?.stock_available
  const records = Array.isArray(raw) ? raw : raw ? [raw] : []
  if (records.length === 0) throw new Error(`Stock introuvable pour produit #${idProduct}`)
  return records[0]
}

/**
 * Ajoute une quantité au stock d'un produit/déclinaison.
 * 1. POST /stock_movements  — crée la trace d'entrée dans ps_stock_mvt
 * 2. PUT  /stock_availables — met à jour la quantité réelle dans ps_stock_available
 */
export const addStock = async (idProduct, idProductAttribute = 0, qty) => {
  const record = await getStockAvailableRecord(idProduct, idProductAttribute)
  const idStockAvailable = getVal(record.id)
  const previousQty = parseInt(getVal(record.quantity)) || 0
  const newQty = previousQty + parseInt(qty)
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19)

  // PS dérive objectNodeName du nom de table : stock_mvt → tag XML <stock_mvt>
  const movXml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <stock_mvt>
    <id_stock>${idStockAvailable}</id_stock>
    <id_stock_mvt_reason>1</id_stock_mvt_reason>
    <id_employee>0</id_employee>
    <physical_quantity>${Math.abs(parseInt(qty))}</physical_quantity>
    <sign>1</sign>
    <price_te>0</price_te>
    <date_add>${now}</date_add>
  </stock_mvt>
</prestashop>`

  await axiosInstance.post('/stock_movements', movXml, {
    headers: { 'Content-Type': 'application/xml' },
  })

  const putXml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <stock_available>
    <id>${idStockAvailable}</id>
    <id_product>${getVal(record.id_product)}</id_product>
    <id_product_attribute>${getVal(record.id_product_attribute)}</id_product_attribute>
    <id_shop>${getVal(record.id_shop)}</id_shop>
    <id_shop_group>${getVal(record.id_shop_group)}</id_shop_group>
    <quantity>${newQty}</quantity>
    <physical_quantity>${newQty}</physical_quantity>
    <reserved_quantity>${getVal(record.reserved_quantity) || 0}</reserved_quantity>
    <out_of_stock>${getVal(record.out_of_stock) || 0}</out_of_stock>
    <location>${getVal(record.location) || ''}</location>
    <depends_on_stock>${getVal(record.depends_on_stock) || 0}</depends_on_stock>
  </stock_available>
</prestashop>`

  await axiosInstance.put(`/stock_availables/${idStockAvailable}`, putXml, {
    headers: { 'Content-Type': 'application/xml' },
  })

  return { previousQuantity: previousQty, newQuantity: newQty }
}

/**
 * Récupère tous les mouvements de stock (entrées + sorties) pour un produit/déclinaison.
 * Filtre via id_stock (= id_stock_available) — déjà filtré côté PS, pas de post-filtre nécessaire.
 * Retourne le tableau brut des stock_mvt XML-parsés.
 */
export const getStockMovements = async (idProduct, idProductAttribute = 0) => {
  const record = await getStockAvailableRecord(idProduct, idProductAttribute)
  const idStockAvailable = getVal(record.id)

  // date=1 requis pour que date_add soit disponible comme champ de tri
  const response = await axiosInstance.get(
    `/stock_movements?display=full&date=1&filter[id_stock]=[${idStockAvailable}]&sort=[date_add_DESC]&limit=200`
  )
  const data = parseXML(response.data)
  // objectsNodeName = table + 's' = 'stock_mvts', objectNodeName = 'stock_mvt'
  const raw = data?.prestashop?.stock_mvts?.stock_mvt
  if (!raw) return []
  return Array.isArray(raw) ? raw : [raw]
}
