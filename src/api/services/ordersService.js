import axiosInstance from '../axiosInstance'
import { parseXML } from '../xmlParser'
import { getStockAvailableRecord } from './stockMovementService'

// 1️⃣ Les constantes d'état en premier
export const ORDER_STATES = {
  IN_CART:          'cart',  
  PAYMENT_ACCEPTED: '2',     
  CANCELLED:        '6',     
  DELIVERED:        '5',     
}

// 2️⃣ La fonction utilitaire getVal doit être placée en haut pour être accessible partout
const getVal = (field) => {
  if (field === null || field === undefined) return ''
  if (typeof field === 'object') {
    if (field['#text'] !== undefined) return String(field['#text'])
    return ''
  }
  return String(field)
}

// 3️⃣ Les fonctions d'action de statut
export const changeOrderState = async (orderId, newStateId) => {
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19)
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <order_state_update>
    <id_order>${orderId}</id_order>
    <id_order_state>${newStateId}</id_order_state>
    <date_add>${now}</date_add>
  </order_state_update>
</prestashop>`

  const response = await axiosInstance.post('/order_state_update', xml, {
    headers: { 'Content-Type': 'application/xml' },
  })
  return parseXML(response.data)
}

export const getAllOrders = async () => {
  const response = await axiosInstance.get('/orders')
  return parseXML(response.data)
}

export const getOrderById = async (id) => {
  const response = await axiosInstance.get(`/orders/${id}?display=full&language=1`)
  return parseXML(response.data)
}

export const deleteOrderById = async (id) => {
  await axiosInstance.delete(`/orders/${id}`)
}

export const deleteAllOrders = async () => {
  const data = await getAllOrders()
  const ordersList = data?.prestashop?.orders?.order
  if (!ordersList) return
  const ordersArray = Array.isArray(ordersList) ? ordersList : [ordersList]
  await Promise.all(ordersArray.map((o) => deleteOrderById(o['@_id'])))
}

export const deleteCart = async (cartId) => {
  await axiosInstance.delete(`/carts/${cartId}`)
}

// 4️⃣ La fonction maîtresse paramétrable pour la création
export const createOrderFromCart = async (cartItem, targetStateId = ORDER_STATES.PAYMENT_ACCEPTED) => {
  let addressId = cartItem.addressId
  if (!addressId || addressId === '0') {
    const addrRes = await axiosInstance.get(
      `/addresses?display=full&filter[id_customer]=[${cartItem.customerId}]`
    )
    const addrData = parseXML(addrRes.data)
    const raw = addrData?.prestashop?.addresses?.address
    const addresses = (Array.isArray(raw) ? raw : raw ? [raw] : [])
      .filter(a => String(getVal(a.deleted)) !== '1')
    if (addresses.length === 0) {
      throw new Error("Ce client n'a pas d'adresse de livraison configurée")
    }
    addressId = String(getVal(addresses[0].id))
  }

  let carrierId = cartItem.carrierId
  if (!carrierId || carrierId === '0') {
    const carrierRes = await axiosInstance.get('/carriers?display=full&filter[deleted]=[0]')
    const carrierData = parseXML(carrierRes.data)
    const raw = carrierData?.prestashop?.carriers?.carrier
    const rawCarriers = raw ? (Array.isArray(raw) ? raw : [raw]) : []
    const active = rawCarriers.find(c => String(getVal(c.active)) === '1') || rawCarriers[0]
    carrierId = active ? String(getVal(active.id)) : '1'
  }

  const now = new Date().toISOString().replace('T', ' ').substring(0, 19)

  const orderXml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <order>
    <id_address_delivery>${addressId}</id_address_delivery>
    <id_address_invoice>${addressId}</id_address_invoice>
    <id_cart>${cartItem.rawCartId}</id_cart>
    <id_currency>${cartItem.currencyId}</id_currency>
    <id_lang>1</id_lang>
    <id_customer>${cartItem.customerId}</id_customer>
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
    <total_paid>0</total_paid>
    <total_paid_tax_incl>0</total_paid_tax_incl>
    <total_paid_tax_excl>0</total_paid_tax_excl>
    <total_paid_real>0</total_paid_real>
    <total_products>0</total_products>
    <total_products_wt>0</total_products_wt>
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
    <secure_key>${cartItem.cartSecureKey || ''}</secure_key>
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

  let response
  try {
    response = await axiosInstance.post('/orders', orderXml, {
      headers: { 'Content-Type': 'application/xml' },
    })
  } catch (err) {
    console.error('Backoffice order creation error:', err.response?.data)
    throw err
  }

  const result = parseXML(response.data)
  const orderId = String(getVal(result?.prestashop?.order?.id))
  if (!orderId || orderId === 'undefined') throw new Error('Erreur création commande depuis panier')

  // Passage par "Paiement effectué" (état 2) puis état cible (ex: Livré = 5)
  await updateOrderState(orderId, ORDER_STATES.PAYMENT_ACCEPTED)
  await updateOrderState(orderId, targetStateId)

  return orderId
}

// 5️⃣ Le reste des fonctions de mise à jour
const buildOrderXml = (order, newStateId, dateAddOverride) => {
  return `<?xml version="1.0" encoding="UTF-8"?>
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
    <current_state>${newStateId}</current_state>
    <module>${getVal(order.module)}</module>
    <invoice_number>${getVal(order.invoice_number)}</invoice_number>
    <invoice_date>${getVal(order.invoice_date)}</invoice_date>
    <valid>${getVal(order.valid)}</valid>
    <date_add>${dateAddOverride || getVal(order.date_add)}</date_add>
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
}

export const updateOrderState = async (orderId, newStateId, options = {}) => {
  if (newStateId === ORDER_STATES.IN_CART) {
    throw new Error('L\'état "Dans le panier" est un état virtuel, il ne peut pas être envoyé à PrestaShop.')
  }
  const current = await getOrderById(orderId)
  const order = current?.prestashop?.order
  if (!order) throw new Error(`Commande #${orderId} introuvable`)
  const xml = buildOrderXml(order, newStateId, options.dateAdd)
  await axiosInstance.put(`/orders/${orderId}`, xml, {
    headers: { 'Content-Type': 'application/xml' },
  })
}

export const updateOrderDateAdd = async (orderId, dateAdd) => {
  const current = await getOrderById(orderId)
  const order = current?.prestashop?.order
  if (!order) throw new Error(`Commande #${orderId} introuvable pour correction de date`)
  const xml = buildOrderXml(order, getVal(order.current_state), dateAdd)
  await axiosInstance.put(`/orders/${orderId}`, xml, {
    headers: { 'Content-Type': 'application/xml' },
  })
}

export const createCart = async (customerId, addressId, carrierId, currencyId, products) => {
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19)
  const cartRowsXml = products.map(p => `
      <cart_row>
        <id_product>${getVal(p.id_product)}</id_product>
        <id_product_attribute>${getVal(p.id_product_attribute || '0')}</id_product_attribute>
        <id_address_delivery>${getVal(addressId)}</id_address_delivery>
        <quantity>${getVal(p.quantity)}</quantity>
      </cart_row>`).join('')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <cart>
    <id_billing_address>${getVal(addressId)}</id_billing_address>
    <id_shipping_address>${getVal(addressId)}</id_shipping_address>
    <id_currency>${getVal(currencyId)}</id_currency>
    <id_customer>${getVal(customerId)}</id_customer>
    <id_lang>1</id_lang>
    <id_carrier>${getVal(carrierId)}</id_carrier>
    <recyclable>0</recyclable>
    <gift>0</gift>
    <gift_message></gift_message>
    <mobile_theme>0</mobile_theme>
    <delivery_option></delivery_option>
    <secure_key></secure_key>
    <allow_seperated_package>0</allow_seperated_package>
    <date_add>${now}</date_add>
    <date_upd>${now}</date_upd>
    <associations>
      <cart_rows>
        ${cartRowsXml}
      </cart_rows>
    </associations>
  </cart>
</prestashop>`

  const response = await axiosInstance.post('/carts', xml, {
    headers: { 'Content-Type': 'application/xml' },
  })
  const result = parseXML(response.data)
  return result?.prestashop?.cart
}

export const prepareDuplicateCart = async (orderId, multiplier) => {
  const current = await getOrderById(orderId)
  const order = current?.prestashop?.order
  if (!order) throw new Error(`Commande source #${orderId} introuvable`)
  const rawRows = order.associations?.order_rows?.order_row
  if (!rawRows) throw new Error("La commande d'origine ne contient aucun produit.")
  const orderRows = Array.isArray(rawRows) ? rawRows : [rawRows]

  const customerId = getVal(order.id_customer)
  const addressId = getVal(order.id_address_delivery)
  const carrierId = getVal(order.id_carrier)
  const currencyId = getVal(order.id_currency)

  const clonedProducts = orderRows.map(row => ({
    id_product: getVal(row.product_id),
    id_product_attribute: getVal(row.product_attribute_id) || '0',
    quantity: parseInt(getVal(row.product_quantity), 10) * multiplier
  }))

  const newCart = await createCart(customerId, addressId, carrierId, currencyId, clonedProducts)
  return newCart
}

export const getCartById = async (cartId) => {
  const response = await axiosInstance.get(`/carts/${cartId}`)
  return parseXML(response.data)
}

const getProductById = async (idProduct) => {
  const response = await axiosInstance.get(`/products/${idProduct}?display=full`)
  return parseXML(response.data)
}

export const verifyCartStock = async (cartId) => {
  const cartData = await getCartById(cartId)
  const rawRows = cartData?.prestashop?.cart?.associations?.cart_rows?.cart_row
  const cartRows = Array.isArray(rawRows) ? rawRows : (rawRows ? [rawRows] : [])

  if (cartRows.length === 0) {
    throw new Error("Le panier est vide ou introuvable.")
  }

  for (const row of cartRows) {
    const idProduct   = getVal(row.id_product)
    const idAttribute = getVal(row.id_product_attribute) || '0'
    const qtyDemandee = parseInt(getVal(row.quantity), 10)

    const stockRecord = await getStockAvailableRecord(idProduct, idAttribute)
    const qtyEnStock = parseInt(stockRecord?.quantity, 10) || 0

    if (qtyDemandee > qtyEnStock) {
      // 1. Appel API pour récupérer les détails du produit
      const productData = await getProductById(idProduct)
  
      // 2. Extraction du nom du produit (en gérant le format textuel du XML)
      const productName = productData?.prestashop?.product?.name?.['#text'] || productData?.prestashop?.product?.name || `Produit #${idProduct}`

      // 3. Lancer l'erreur personnalisée requise par la règle de gestion
      throw new Error(`Manque de stock de ${productName}. Demandé : ${qtyDemandee}, Disponible : ${qtyEnStock}`)
    }
  }
  
  const cart = cartData?.prestashop?.cart
  const cartItem = {
    rawCartId: String(cartId),
    customerId: String(cart?.id_customer?.['#text'] || cart?.id_customer || '0'),
    currencyId: String(cart?.id_currency?.['#text'] || cart?.id_currency || '1'),
    carrierId: String(cart?.id_carrier?.['#text'] || cart?.id_carrier || '0'),
    addressId: String(cart?.id_address_delivery?.['#text'] || cart?.id_address_delivery || '0'),
    cartSecureKey: String(cart?.secure_key?.['#text'] || cart?.secure_key || ''),
  }

  return cartItem
}