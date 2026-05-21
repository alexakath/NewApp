import axiosInstance from '../../api/axiosInstance'
import { parseXML } from '../../api/xmlParser'

const getVal = (field) => {
  if (field === null || field === undefined) return ''
  if (typeof field === 'object') {
    if (field['#text'] !== undefined) return String(field['#text'])
    return ''
  }
  return String(field)
}

const toArray = (data) => {
  if (!data) return []
  return Array.isArray(data) ? data : [data]
}

export const getCustomerAddresses = async (customerId) => {
  const response = await axiosInstance.get(`/addresses?display=full&filter[id_customer]=${customerId}`)
  const data = parseXML(response.data)
  return toArray(data?.prestashop?.addresses?.address).filter(
    a => String(getVal(a.deleted)) !== '1'
  )
}

export const getClickAndCollectCarrier = async () => {
  const response = await axiosInstance.get('/carriers?display=full')
  const data = parseXML(response.data)
  const carriers = toArray(data?.prestashop?.carriers?.carrier)
  const carrier = carriers.find(c =>
    (getVal(c.name) || '').toLowerCase().includes('click')
  )
  return carrier ? String(getVal(carrier.id)) : '1'
}

export const getDefaultCurrency = async () => {
  const response = await axiosInstance.get('/currencies?display=full&filter[deleted]=0')
  const data = parseXML(response.data)
  const currencies = toArray(data?.prestashop?.currencies?.currency)
  const def = currencies.find(c => String(getVal(c.conversion_rate)) === '1') || currencies[0]
  return def ? String(getVal(def.id)) : '1'
}

export const createAddress = async (customerId, addressData) => {
  // Récupérer dynamiquement l'ID du pays France actif (évite le hardcode qui peut varier selon l'installation PS)
  let countryId = '8'
  try {
    const ctryResp = await axiosInstance.get('/countries?display=full&filter[active]=[1]&filter[iso_code]=[FR]')
    const ctryData = parseXML(ctryResp.data)
    const raw = ctryData?.prestashop?.countries?.country
    const france = raw ? (Array.isArray(raw) ? raw[0] : raw) : null
    if (france) countryId = String(getVal(france.id)) || '8'
  } catch { /* fallback 8 */ }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <address>
    <id_customer>${customerId}</id_customer>
    <id_country>${countryId}</id_country>
    <alias>${addressData.alias || 'Mon adresse'}</alias>
    <firstname>${addressData.firstname}</firstname>
    <lastname>${addressData.lastname}</lastname>
    <address1>${addressData.address1}</address1>
    <city>${addressData.city}</city>
    <phone>${addressData.phone || ''}</phone>
  </address>
</prestashop>`

  const response = await axiosInstance.post('/addresses', xml, {
    headers: { 'Content-Type': 'application/xml' },
  })
  const result = parseXML(response.data)
  return String(getVal(result?.prestashop?.address?.id))
}

// ── LocalStorage helpers pour le cart PS ──────────────────────
const psCartKey = (customerId) => `ps_cart_${customerId}`

export const getStoredPsCart = (customerId) => {
  try {
    const raw = localStorage.getItem(psCartKey(customerId))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const saveStoredPsCart = (customerId, cartId, cartSecureKey) => {
  localStorage.setItem(psCartKey(customerId), JSON.stringify({ cartId, cartSecureKey }))
}

export const clearPsCart = (customerId) => {
  localStorage.removeItem(psCartKey(customerId))
}

// ── PS Cart API ────────────────────────────────────────────────

/**
 * Crée un cart PS vide pour un client (adresse=0, sera mise à jour à la validation).
 * Sauvegarde l'ID + secure_key en localStorage.
 */
export const createEmptyPsCart = async (customerId, currencyId, carrierId) => {
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19)
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <cart>
    <id_currency>${currencyId}</id_currency>
    <id_lang>1</id_lang>
    <id_customer>${customerId}</id_customer>
    <id_address_delivery>0</id_address_delivery>
    <id_address_invoice>0</id_address_invoice>
    <id_carrier>${carrierId}</id_carrier>
    <id_shop_group>1</id_shop_group>
    <id_shop>1</id_shop>
    <recyclable>0</recyclable>
    <gift>0</gift>
    <gift_message></gift_message>
    <mobile_theme>0</mobile_theme>
    <delivery_option></delivery_option>
    <allow_seperated_package>0</allow_seperated_package>
    <date_add>${now}</date_add>
    <date_upd>${now}</date_upd>
  </cart>
</prestashop>`

  const response = await axiosInstance.post('/carts', xml, {
    headers: { 'Content-Type': 'application/xml' },
  })
  const result = parseXML(response.data)
  const cartId = String(getVal(result?.prestashop?.cart?.id))
  const cartSecureKey = String(getVal(result?.prestashop?.cart?.secure_key))
  if (!cartId || cartId === 'undefined') throw new Error('Erreur création panier PS')
  saveStoredPsCart(customerId, cartId, cartSecureKey)
  return { cartId, cartSecureKey }
}

/**
 * Synchronise les lignes du cart PS avec les articles du panier localStorage.
 * Appelé après chaque ajout/retrait d'article et à la validation (avec la vraie adresse).
 */
export const syncPsCartRows = async ({
  cartId, cartSecureKey, customerId, currencyId, carrierId, addressId = '0', items,
}) => {
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19)
  const cartRowsXml = items.map(item =>
    `        <cart_row>
          <id_product>${item.productId}</id_product>
          <id_product_attribute>${item.combinationId || 0}</id_product_attribute>
          <id_address_delivery>${addressId}</id_address_delivery>
          <id_customization>0</id_customization>
          <quantity>${item.qty}</quantity>
        </cart_row>`
  ).join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <cart>
    <id>${cartId}</id>
    <id_currency>${currencyId}</id_currency>
    <id_lang>1</id_lang>
    <id_customer>${customerId}</id_customer>
    <id_address_delivery>${addressId}</id_address_delivery>
    <id_address_invoice>${addressId}</id_address_invoice>
    <id_carrier>${carrierId}</id_carrier>
    <id_shop_group>1</id_shop_group>
    <id_shop>1</id_shop>
    <recyclable>0</recyclable>
    <gift>0</gift>
    <gift_message></gift_message>
    <mobile_theme>0</mobile_theme>
    <delivery_option></delivery_option>
    <allow_seperated_package>0</allow_seperated_package>
    <date_add>${now}</date_add>
    <date_upd>${now}</date_upd>
    <secure_key>${cartSecureKey}</secure_key>
    <associations>
      <cart_rows nodeType="cart_row" api="cart_rows">
${cartRowsXml}
      </cart_rows>
    </associations>
  </cart>
</prestashop>`

  await axiosInstance.put(`/carts/${cartId}`, xml, {
    headers: { 'Content-Type': 'application/xml' },
  })
}

/**
 * Supprime le cart PS et efface le localStorage.
 * Appelé quand le panier est vidé ou après une commande réussie.
 */
export const deletePsCart = async (customerId, cartId) => {
  clearPsCart(customerId)
  await axiosInstance.delete(`/carts/${cartId}`)
}

/**
 * Charge le panier PS actif d'un utilisateur dans le localStorage.
 * Utilisé quand le panier local est vide mais qu'un cart existe en PS
 * (ex: panier créé via import CSV ou autre canal externe).
 *
 * @returns {{ cartId, cartSecureKey, carrierId, currencyId, items }} | null
 */
export const loadCartFromPs = async (customerId) => {
  const psUrl = import.meta.env.VITE_PRESTASHOP_URL

  // 1. Carts du client + commandes pour filtrer les carts déjà convertis
  const [cartsResp, ordersResp, productsResp, combsResp, taxesResp, taxRulesResp] = await Promise.all([
    axiosInstance.get(`/carts?display=full&filter[id_customer]=[${customerId}]`),
    axiosInstance.get(`/orders?display=full&filter[id_customer]=[${customerId}]`),
    axiosInstance.get('/products?display=full'),
    axiosInstance.get('/combinations?display=full'),
    axiosInstance.get('/taxes?display=full'),
    axiosInstance.get('/tax_rules?display=full'),
  ])

  const cartsData    = (await import('../../api/xmlParser')).parseXML(cartsResp.data)
  const ordersData   = (await import('../../api/xmlParser')).parseXML(ordersResp.data)
  const productsData = (await import('../../api/xmlParser')).parseXML(productsResp.data)
  const combsData    = (await import('../../api/xmlParser')).parseXML(combsResp.data)
  const taxesData    = (await import('../../api/xmlParser')).parseXML(taxesResp.data)
  const taxRulesData = (await import('../../api/xmlParser')).parseXML(taxRulesResp.data)

  const rawCarts    = toArray(cartsData?.prestashop?.carts?.cart)
  const rawOrders   = toArray(ordersData?.prestashop?.orders?.order)
  const rawProducts = toArray(productsData?.prestashop?.products?.product)
  const rawCombs    = toArray(combsData?.prestashop?.combinations?.combination)

  // Map taux de taxe réels : tax_id → rate, group_id → rate
  const taxRateById = {}
  toArray(taxesData?.prestashop?.taxes?.tax).forEach(t => {
    taxRateById[String(getVal(t.id))] = parseFloat(String(getVal(t.rate) || '0').replace(',', '.'))
  })
  const taxRateByGroup = {}
  toArray(taxRulesData?.prestashop?.tax_rules?.tax_rule).forEach(r => {
    const gid = String(getVal(r.id_tax_rules_group))
    const tid = String(getVal(r.id_tax))
    if (!taxRateByGroup[gid] && taxRateById[tid] !== undefined) taxRateByGroup[gid] = taxRateById[tid]
  })

  // Carts déjà convertis en commande
  const convertedIds = new Set(rawOrders.map(o => String(getVal(o.id_cart))))

  // Trouver le cart actif (non converti, avec lignes)
  const activeCart = rawCarts.find(cart => {
    const id = String(getVal(cart.id))
    if (convertedIds.has(id)) return false
    return toArray(cart?.associations?.cart_rows?.cart_row).length > 0
  })
  if (!activeCart) return null

  const cartId       = String(getVal(activeCart.id))
  const cartSecureKey = String(getVal(activeCart.secure_key) || '')
  const carrierId    = String(getVal(activeCart.id_carrier) || '1')
  const currencyId   = String(getVal(activeCart.id_currency) || '1')
  const rows         = toArray(activeCart?.associations?.cart_rows?.cart_row)

  // Maps produits et combinaisons avec taux de taxe réels
  const productMap = {}
  rawProducts.forEach(p => {
    const id      = String(getVal(p.id))
    const priceHT = parseFloat(getVal(p.price) || 0)
    const groupId = String(getVal(p.id_tax_rules_group))
    const taxRate = taxRateByGroup[groupId] || 0
    const imageId = getVal(p.id_default_image)
    const name    = p.name?.language?.['#text'] || p.name?.language
    productMap[id] = {
      name:    typeof name === 'object' ? String(Object.values(name)[0] || '') : String(name || '—'),
      priceHT,
      taxRate,
      imageUrl: imageId ? `${psUrl}/api/images/products/${id}/${imageId}` : null,
    }
  })

  // combMap : id → { reference, priceDelta (HT) }
  const combMap = {}
  rawCombs.forEach(c => {
    const id = String(getVal(c.id))
    combMap[id] = {
      reference:  getVal(c.reference) || `Décl.#${id}`,
      priceDelta: parseFloat(getVal(c.price) || 0),
    }
  })

  // Construire les items au format cart localStorage avec prix TTC correct
  const items = rows.map(row => {
    const productId     = String(getVal(row.id_product))
    const combinationId = String(getVal(row.id_product_attribute) || '0')
    const qty           = parseInt(getVal(row.quantity) || 1)
    const hasComb       = combinationId && combinationId !== '0'
    const prod          = productMap[productId] || { name: `#${productId}`, priceHT: 0, taxRate: 0, imageUrl: null }
    const comb          = hasComb ? combMap[combinationId] : null
    const effectiveHT   = prod.priceHT + (comb?.priceDelta || 0)
    const effectiveTTC  = (effectiveHT * (1 + prod.taxRate / 100)).toFixed(2)

    return {
      itemId:         hasComb ? `${productId}_${combinationId}` : productId,
      productId,
      combinationId:  hasComb ? combinationId : null,
      name:           prod.name,
      attributeLabel: hasComb ? (comb?.reference || null) : null,
      price:          effectiveTTC,
      imageUrl:       prod.imageUrl,
      qty,
    }
  })

  return { cartId, cartSecureKey, carrierId, currencyId, items }
}

/**
 * Crée une commande depuis le panier client.
 * Si existingCartId est fourni (cart PS déjà créé), l'étape 1 est sautée.
 * L'étape 2 (sync lignes + adresse) est toujours exécutée.
 */
export const createOrder = async ({
  customerId, addressId, carrierId, currencyId, cart, totalHT, totalTTC,
  existingCartId, existingCartSecureKey,
}) => {
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19)

  let cartId, cartSecureKey

  if (existingCartId) {
    cartId = existingCartId
    cartSecureKey = existingCartSecureKey
  } else {
    // Étape 1 : créer le panier PrestaShop
    const cartXml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <cart>
    <id_currency>${currencyId}</id_currency>
    <id_lang>1</id_lang>
    <id_customer>${customerId}</id_customer>
    <id_address_delivery>${addressId}</id_address_delivery>
    <id_address_invoice>${addressId}</id_address_invoice>
    <id_carrier>${carrierId}</id_carrier>
    <id_shop_group>1</id_shop_group>
    <id_shop>1</id_shop>
    <recyclable>0</recyclable>
    <gift>0</gift>
    <gift_message></gift_message>
    <mobile_theme>0</mobile_theme>
    <delivery_option></delivery_option>
    <allow_seperated_package>0</allow_seperated_package>
    <date_add>${now}</date_add>
    <date_upd>${now}</date_upd>
  </cart>
</prestashop>`

    const cartResponse = await axiosInstance.post('/carts', cartXml, {
      headers: { 'Content-Type': 'application/xml' },
    })
    const cartResult = parseXML(cartResponse.data)
    cartId = String(getVal(cartResult?.prestashop?.cart?.id))
    cartSecureKey = String(getVal(cartResult?.prestashop?.cart?.secure_key))
    if (!cartId || cartId === 'undefined') throw new Error('Erreur création panier')
  }

  // Étape 2 : peupler le panier — met à jour adresse + lignes (toujours exécutée)
  const cartRowsXml = cart.map(item =>
    `        <cart_row>
          <id_product>${item.productId}</id_product>
          <id_product_attribute>${item.combinationId || 0}</id_product_attribute>
          <id_address_delivery>${addressId}</id_address_delivery>
          <id_customization>0</id_customization>
          <quantity>${item.qty}</quantity>
        </cart_row>`
  ).join('\n')

  const cartUpdateXml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <cart>
    <id>${cartId}</id>
    <id_currency>${currencyId}</id_currency>
    <id_lang>1</id_lang>
    <id_customer>${customerId}</id_customer>
    <id_address_delivery>${addressId}</id_address_delivery>
    <id_address_invoice>${addressId}</id_address_invoice>
    <id_carrier>${carrierId}</id_carrier>
    <id_shop_group>1</id_shop_group>
    <id_shop>1</id_shop>
    <recyclable>0</recyclable>
    <gift>0</gift>
    <gift_message></gift_message>
    <mobile_theme>0</mobile_theme>
    <delivery_option></delivery_option>
    <allow_seperated_package>0</allow_seperated_package>
    <date_add>${now}</date_add>
    <date_upd>${now}</date_upd>
    <secure_key>${cartSecureKey}</secure_key>
    <associations>
      <cart_rows nodeType="cart_row" api="cart_rows">
${cartRowsXml}
      </cart_rows>
    </associations>
  </cart>
</prestashop>`

  await axiosInstance.put(`/carts/${cartId}`, cartUpdateXml, {
    headers: { 'Content-Type': 'application/xml' },
  })

  // Étape 3 : créer la commande
  const orderXml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <order>
    <id_address_delivery>${addressId}</id_address_delivery>
    <id_address_invoice>${addressId}</id_address_invoice>
    <id_cart>${cartId}</id_cart>
    <id_currency>${currencyId}</id_currency>
    <id_lang>1</id_lang>
    <id_customer>${customerId}</id_customer>
    <id_carrier>${carrierId}</id_carrier>
    <module>ps_cashondelivery</module>
    <payment>Paiement a la livraison</payment>
    <recyclable>0</recyclable>
    <gift>0</gift>
    <gift_message></gift_message>
    <mobile_theme>0</mobile_theme>
    <total_discounts>0</total_discounts>
    <total_discounts_tax_incl>0</total_discounts_tax_incl>
    <total_discounts_tax_excl>0</total_discounts_tax_excl>
    <total_paid>${totalTTC}</total_paid>
    <total_paid_tax_incl>${totalTTC}</total_paid_tax_incl>
    <total_paid_tax_excl>${totalHT}</total_paid_tax_excl>
    <total_paid_real>${totalTTC}</total_paid_real>
    <total_products>${totalHT}</total_products>
    <total_products_wt>${totalTTC}</total_products_wt>
    <total_shipping>0</total_shipping>
    <total_shipping_tax_incl>0</total_shipping_tax_incl>
    <total_shipping_tax_excl>0</total_shipping_tax_excl>
    <carrier_tax_rate>0</carrier_tax_rate>
    <total_wrapping>0</total_wrapping>
    <total_wrapping_tax_incl>0</total_wrapping_tax_incl>
    <total_wrapping_tax_excl>0</total_wrapping_tax_excl>
    <round_mode>2</round_mode>
    <round_type>1</round_type>
    <conversion_rate>1</conversion_rate>
    <secure_key>${cartSecureKey}</secure_key>
    <id_shop_group>1</id_shop_group>
    <id_shop>1</id_shop>
    <valid>1</valid>
    <date_add>${now}</date_add>
    <date_upd>${now}</date_upd>
    <invoice_date>0000-00-00 00:00:00</invoice_date>
    <invoice_number>0</invoice_number>
    <shipping_number></shipping_number>
  </order>
</prestashop>`

  let orderId = ''
  try {
    const orderResponse = await axiosInstance.post('/orders', orderXml, {
      headers: { 'Content-Type': 'application/xml' },
    })
    const orderResult = parseXML(orderResponse.data)
    orderId = String(getVal(orderResult?.prestashop?.order?.id) || '')
  } catch (err) {
    // 500 = hook PS (gamification…) — la commande est committée, on la retrouve via id_cart
    if (err.response?.status === 500) {
      try {
        const findResp = await axiosInstance.get(`/orders?display=full&filter[id_cart]=[${cartId}]`)
        const findParsed = parseXML(findResp.data)
        const raw = findParsed?.prestashop?.orders?.order
        const found = raw ? (Array.isArray(raw) ? raw[0] : raw) : null
        if (found) orderId = String(getVal(found.id) || '')
      } catch { /* orderId reste vide → erreur ci-dessous */ }
      if (!orderId) throw err
    } else {
      console.error('Order creation error:', err.response?.data)
      throw err
    }
  }

  if (!orderId || orderId === 'undefined') throw new Error('Erreur création commande')

  // Étape 4 : passer l'état à 2 "Paiement accepté" via GET + PUT
  const getResp = await axiosInstance.get(`/orders/${orderId}?display=full`)
  const orderData = parseXML(getResp.data)
  const order = orderData?.prestashop?.order
  if (!order) throw new Error('Impossible de récupérer la commande créée')

  const reference = String(getVal(order.reference))

  const updateXml = buildOrderStateXml(order, '2')
  await axiosInstance.put(`/orders/${orderId}`, updateXml, {
    headers: { 'Content-Type': 'application/xml' },
  })

  return { orderId, reference }
}

/**
 * Charge les articles d'une commande PS en état "Dans le panier" pour le client.
 * Utilisé quand le cart PS a été converti en commande (import CSV) mais que la commande
 * n'est pas encore confirmée (état "Dans le panier").
 *
 * @returns {{ orderId, reference, carrierId, currencyId, items }} | null
 */
export const loadDansPanierOrderFromPs = async (customerId) => {
  const psUrl = import.meta.env.VITE_PRESTASHOP_URL

  const [ordersResp, statesResp] = await Promise.all([
    axiosInstance.get(`/orders?display=full&filter[id_customer]=[${customerId}]`),
    axiosInstance.get('/order_states?display=full'),
  ])

  const rawOrders = toArray(parseXML(ordersResp.data)?.prestashop?.orders?.order)
  const rawStates = toArray(parseXML(statesResp.data)?.prestashop?.order_states?.order_state)

  const getStateName = (s) => {
    const n = s.name
    if (!n) return ''
    if (typeof n === 'string') return n
    const lang = n.language
    if (!lang) return ''
    const first = Array.isArray(lang) ? lang[0] : lang
    return typeof first === 'object' ? String(first['#text'] || '') : String(first || '')
  }

  const dansPanierIds = new Set(
    rawStates
      .filter(s => getStateName(s).toLowerCase() === 'dans le panier')
      .map(s => String(getVal(s.id)))
  )

  const pendingOrder = rawOrders.find(o => dansPanierIds.has(String(getVal(o.current_state))))
  if (!pendingOrder) return null

  const orderId    = String(getVal(pendingOrder.id))
  const reference  = String(getVal(pendingOrder.reference) || '—')
  const carrierId  = String(getVal(pendingOrder.id_carrier) || '1')
  const currencyId = String(getVal(pendingOrder.id_currency) || '1')

  const [detailsResp, productsResp, taxesResp2, taxRulesResp2] = await Promise.all([
    axiosInstance.get(`/order_details?display=full&filter[id_order]=[${orderId}]`),
    axiosInstance.get('/products?display=full'),
    axiosInstance.get('/taxes?display=full'),
    axiosInstance.get('/tax_rules?display=full'),
  ])

  const rawDetails  = toArray(parseXML(detailsResp.data)?.prestashop?.order_details?.order_detail)
  const rawProducts = toArray(parseXML(productsResp.data)?.prestashop?.products?.product)

  const txById = {}
  toArray(parseXML(taxesResp2.data)?.prestashop?.taxes?.tax).forEach(t => {
    txById[String(getVal(t.id))] = parseFloat(String(getVal(t.rate) || '0').replace(',', '.'))
  })
  const txByGroup = {}
  toArray(parseXML(taxRulesResp2.data)?.prestashop?.tax_rules?.tax_rule).forEach(r => {
    const gid = String(getVal(r.id_tax_rules_group))
    const tid = String(getVal(r.id_tax))
    if (!txByGroup[gid] && txById[tid] !== undefined) txByGroup[gid] = txById[tid]
  })

  const productMap = {}
  rawProducts.forEach(p => {
    const id      = String(getVal(p.id))
    const priceHT = parseFloat(getVal(p.price) || 0)
    const groupId = String(getVal(p.id_tax_rules_group))
    const taxRate = txByGroup[groupId] || 0
    const imageId = getVal(p.id_default_image)
    const nameRaw = p.name?.language?.['#text'] || p.name?.language
    productMap[id] = {
      name:    typeof nameRaw === 'object' ? String(Object.values(nameRaw)[0] || '') : String(nameRaw || '—'),
      priceHT,
      taxRate,
      imageUrl: imageId ? `${psUrl}/api/images/products/${id}/${imageId}` : null,
    }
  })

  const items = rawDetails.map(detail => {
    const productId     = String(getVal(detail.product_id))
    const combinationId = String(getVal(detail.product_attribute_id) || '0')
    const qty           = parseInt(getVal(detail.product_quantity) || 1)
    const hasComb       = combinationId && combinationId !== '0'
    const prod          = productMap[productId] || { name: `#${productId}`, priceHT: 0, taxRate: 0, imageUrl: null }
    // Pour les détails de commande, le prix unitaire stocké dans order_detail peut être utilisé directement
    const unitPriceTTC = parseFloat(String(getVal(detail.unit_price_tax_incl) || '0').replace(',', '.'))
    const price = unitPriceTTC > 0
      ? unitPriceTTC.toFixed(2)
      : (prod.priceHT * (1 + prod.taxRate / 100)).toFixed(2)
    return {
      itemId:         hasComb ? `${productId}_${combinationId}` : productId,
      productId,
      combinationId:  hasComb ? combinationId : null,
      name:           prod.name,
      attributeLabel: null,
      price,
      imageUrl:       prod.imageUrl,
      qty,
    }
  })

  if (items.length === 0) return null
  return { orderId, reference, carrierId, currencyId, items }
}

const buildStockXml = (stockId, productId, quantity, combinationId) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <stock_available>
    <id>${stockId}</id>
    <id_product>${productId}</id_product>
    <id_product_attribute>${combinationId}</id_product_attribute>
    <id_shop>1</id_shop>
    <id_shop_group>0</id_shop_group>
    <quantity>${quantity}</quantity>
    <depends_on_stock>0</depends_on_stock>
    <out_of_stock>1</out_of_stock>
  </stock_available>
</prestashop>`

/**
 * Décrémente le stock PS pour chaque article du panier.
 * Appelé après validation d'une commande (état → Paiement accepté).
 * Les commandes "Dans le panier" ne déclenchent PAS cette fonction.
 */
export const decrementStockForItems = async (items) => {
  for (const item of items) {
    try {
      const combId = (item.combinationId && item.combinationId !== '0') ? item.combinationId : '0'
      const resp = await axiosInstance.get(
        `/stock_availables?display=full&filter[id_product]=[${item.productId}]&filter[id_product_attribute]=[${combId}]`
      )
      const data   = parseXML(resp.data)
      const raw    = data?.prestashop?.stock_availables?.stock_available
      const stock  = raw ? (Array.isArray(raw) ? raw[0] : raw) : null
      if (!stock) continue
      const stockId    = String(getVal(stock.id))
      const currentQty = parseInt(getVal(stock.quantity) || '0', 10)
      const newQty     = Math.max(0, currentQty - item.qty)
      await axiosInstance.put(`/stock_availables/${stockId}`, buildStockXml(stockId, item.productId, newQty, combId), {
        headers: { 'Content-Type': 'application/xml' },
      })
    } catch (err) {
      console.warn(`Stock decrement failed for product ${item.productId}:`, err.message)
    }
  }
}

/**
 * Re-incrémente le stock PS après validation d'une commande.
 * PS décrémente automatiquement via validateOrder() — on annule ici.
 * Le stock ne doit baisser qu'à la livraison (bouton "Livrer").
 */
export const reIncrementStockForItems = async (items) => {
  for (const item of items) {
    try {
      const combId = (item.combinationId && item.combinationId !== '0') ? item.combinationId : '0'
      const resp = await axiosInstance.get(
        `/stock_availables?display=full&filter[id_product]=[${item.productId}]&filter[id_product_attribute]=[${combId}]`
      )
      const data   = parseXML(resp.data)
      const raw    = data?.prestashop?.stock_availables?.stock_available
      const stock  = raw ? (Array.isArray(raw) ? raw[0] : raw) : null
      if (!stock) continue
      const stockId    = String(getVal(stock.id))
      const currentQty = parseInt(getVal(stock.quantity) || '0', 10)
      const newQty     = currentQty + item.qty
      await axiosInstance.put(`/stock_availables/${stockId}`, buildStockXml(stockId, item.productId, newQty, combId), {
        headers: { 'Content-Type': 'application/xml' },
      })
    } catch (err) {
      console.warn(`Stock re-increment failed for product ${item.productId}:`, err.message)
    }
  }
}

/**
 * Confirme une commande "Dans le panier" en passant son état à "Paiement accepté" (state 2).
 * Utilisé quand le client finalise une commande importée depuis CartPage.
 */
export const confirmDansPanierOrder = async (orderId) => {
  const getResp = await axiosInstance.get(`/orders/${orderId}?display=full`)
  const order   = parseXML(getResp.data)?.prestashop?.order
  if (!order) throw new Error('Commande introuvable')
  const reference = String(getVal(order.reference))
  const updateXml = buildOrderStateXml(order, '2')
  await axiosInstance.put(`/orders/${orderId}`, updateXml, {
    headers: { 'Content-Type': 'application/xml' },
  })
  return { orderId, reference }
}

const buildOrderStateXml = (order, newState) => `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <order>
    <id>${getVal(order.id)}</id>
    <id_address_delivery>${getVal(order.id_address_delivery)}</id_address_delivery>
    <id_address_invoice>${getVal(order.id_address_invoice)}</id_address_invoice>
    <id_cart>${getVal(order.id_cart)}</id_cart>
    <id_currency>${getVal(order.id_currency)}</id_currency>
    <id_lang>${getVal(order.id_lang)}</id_lang>
    <id_customer>${getVal(order.id_customer)}</id_customer>
    <id_carrier>${getVal(order.id_carrier)}</id_carrier>
    <current_state>${newState}</current_state>
    <module>${getVal(order.module)}</module>
    <invoice_number>${getVal(order.invoice_number)}</invoice_number>
    <invoice_date>${getVal(order.invoice_date)}</invoice_date>
    <valid>${getVal(order.valid)}</valid>
    <date_add>${getVal(order.date_add)}</date_add>
    <date_upd>${getVal(order.date_upd)}</date_upd>
    <shipping_number>${getVal(order.shipping_number)}</shipping_number>
    <id_shop_group>${getVal(order.id_shop_group)}</id_shop_group>
    <id_shop>${getVal(order.id_shop)}</id_shop>
    <secure_key>${getVal(order.secure_key)}</secure_key>
    <payment>${getVal(order.payment)}</payment>
    <recyclable>${getVal(order.recyclable)}</recyclable>
    <gift>${getVal(order.gift)}</gift>
    <gift_message>${getVal(order.gift_message)}</gift_message>
    <mobile_theme>${getVal(order.mobile_theme)}</mobile_theme>
    <total_discounts>${getVal(order.total_discounts)}</total_discounts>
    <total_discounts_tax_incl>${getVal(order.total_discounts_tax_incl)}</total_discounts_tax_incl>
    <total_discounts_tax_excl>${getVal(order.total_discounts_tax_excl)}</total_discounts_tax_excl>
    <total_paid>${getVal(order.total_paid)}</total_paid>
    <total_paid_tax_incl>${getVal(order.total_paid_tax_incl)}</total_paid_tax_incl>
    <total_paid_tax_excl>${getVal(order.total_paid_tax_excl)}</total_paid_tax_excl>
    <total_paid_real>${getVal(order.total_paid_real)}</total_paid_real>
    <total_products>${getVal(order.total_products)}</total_products>
    <total_products_wt>${getVal(order.total_products_wt)}</total_products_wt>
    <total_shipping>${getVal(order.total_shipping)}</total_shipping>
    <total_shipping_tax_incl>${getVal(order.total_shipping_tax_incl)}</total_shipping_tax_incl>
    <total_shipping_tax_excl>${getVal(order.total_shipping_tax_excl)}</total_shipping_tax_excl>
    <carrier_tax_rate>${getVal(order.carrier_tax_rate)}</carrier_tax_rate>
    <total_wrapping>${getVal(order.total_wrapping)}</total_wrapping>
    <total_wrapping_tax_incl>${getVal(order.total_wrapping_tax_incl)}</total_wrapping_tax_incl>
    <total_wrapping_tax_excl>${getVal(order.total_wrapping_tax_excl)}</total_wrapping_tax_excl>
    <round_mode>${getVal(order.round_mode)}</round_mode>
    <round_type>${getVal(order.round_type)}</round_type>
    <conversion_rate>${getVal(order.conversion_rate)}</conversion_rate>
    <reference>${getVal(order.reference)}</reference>
  </order>
</prestashop>`
