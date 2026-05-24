import axiosInstance from '../axiosInstance'
import { parseXML } from '../xmlParser'
import { getStockAvailableRecord } from './stockMovementService'

// IDs des états de commande PrestaShop
// IN_CART est un état virtuel géré localement uniquement (pas de PUT vers PrestaShop)
export const ORDER_STATES = {
  IN_CART:          'cart',  // État virtuel — panier, pas encore une commande PrestaShop
  PAYMENT_ACCEPTED: '2',     // Paiement effectué
  CANCELLED:        '6',     // Annulé
  DELIVERED:        '5',     // Livré
}

/**
 * Appelle le module mon_order_state pour changer l'état d'une commande.
 * Gère les transitions autorisées (payé→livré, payé→annulé, panier→annulé).
 * PS exécute automatiquement les effets de bord : stock, historique, emails.
 */
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

/**
 * Crée une commande depuis un panier PrestaShop existant (action backoffice).
 * Le panier contient déjà les produits ; PrestaShop calcule les totaux via validateOrder().
 * PS_OS_WS_PAYMENT est en état non-logable (13) → pas d'erreur OrderPayment.
 * On récupère ensuite la commande créée et on passe son état à 2 (Paiement accepté).
 */
export const createOrderFromCart = async (cartItem) => {
  // Le cart peut avoir été créé avec adresse=0 (création anticipée avant sélection d'adresse).
  // Dans ce cas, on récupère automatiquement la première adresse active du client.
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

  // Panier PS FO : le transporteur n'est pas encore sélectionné (id_carrier=0).
  // On prend le premier transporteur actif disponible dans PS.
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

  // Passer à l'état 2 via updateOrderState (GET + PUT éprouvé)
  await updateOrderState(orderId, ORDER_STATES.PAYMENT_ACCEPTED)

  return orderId
}

/**
 * Met à jour l'état d'une commande dans PrestaShop
 * NE PAS appeler cette fonction pour ORDER_STATES.IN_CART (état virtuel)
 * PrestaShop exige le renvoi de l'objet complet lors d'un PUT
 * Étape 1 : GET pour récupérer les données actuelles
 * Étape 2 : Modifier current_state
 * Étape 3 : PUT avec l'objet complet reconstruit en XML
 */
/**
 * @param {string} orderId
 * @param {string} newStateId
 * @param {{ dateAdd?: string }} options - dateAdd : forcer une date_add CSV (import)
 */
export const updateOrderState = async (orderId, newStateId, options = {}) => {
  // Garde : ne jamais envoyer l'état virtuel "cart" à PrestaShop
  if (newStateId === ORDER_STATES.IN_CART) {
    throw new Error('L\'état "Dans le panier" est un état virtuel, il ne peut pas être envoyé à PrestaShop.')
  }

  // Étape 1 : Récupérer la commande actuelle
  const current = await getOrderById(orderId)
  const order = current?.prestashop?.order
  if (!order) throw new Error(`Commande #${orderId} introuvable`)

  // Étape 2 : Construire le XML complet avec le nouvel état (+ date CSV si fournie)
  const xml = buildOrderXml(order, newStateId, options.dateAdd)

  // Étape 3 : PUT avec le XML complet
  await axiosInstance.put(`/orders/${orderId}`, xml, {
    headers: { 'Content-Type': 'application/xml' },
  })
}

/**
 * Corrige le date_add d'une commande après sa création.
 * PS force date_add = NOW() à la création via WS ; ce PUT dédié le remplace.
 * Appel séparé de updateOrderState pour que PS traite les deux modifications indépendamment.
 *
 * @param {string} orderId
 * @param {string} dateAdd - format 'YYYY-MM-DD HH:MM:SS'
 */
export const updateOrderDateAdd = async (orderId, dateAdd) => {
  const current = await getOrderById(orderId)
  const order = current?.prestashop?.order
  if (!order) throw new Error(`Commande #${orderId} introuvable pour correction de date`)
  const xml = buildOrderXml(order, getVal(order.current_state), dateAdd)
  await axiosInstance.put(`/orders/${orderId}`, xml, {
    headers: { 'Content-Type': 'application/xml' },
  })
}

const getVal = (field) => {
  if (field === null || field === undefined) return ''
  if (typeof field === 'object') {
    // xlink + texte : { '@_xlink:href': '...', '#text': 18 }
    if (field['#text'] !== undefined) return String(field['#text'])
    // xlink seul sans valeur textuelle (ex: shipping_number vide)
    return ''
  }
  // Scalaire — String(0) → '0' (ne pas traiter 0 comme falsy)
  return String(field)
}

/**
 * Reconstruit le XML complet d'une commande
 * en remplaçant uniquement current_state
 * PrestaShop rejette les PUT avec des champs manquants
 */
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

/**
 * Crée un panier (cart) PrestaShop contenant les produits clonés
 */
export const createCart = async (customerId, addressId, carrierId, currencyId, products) => {
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19)

  // Construction dynamique de la liste des produits en XML
  const productsXml = products.map(p => `
    <cart_row>
      <id_product>${p.id_product}</id_product>
      <id_product_attribute>${p.id_product_attribute || '0'}</id_product_attribute>
      id_address_delivery>${addressId}</id_address_delivery>
      <quantity>${p.quantity}</quantity>
    </cart_row>`).join('')

  const cartXml = `<?xml version="1.0" encoding="UTF-8"?>
  <prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
    <cart>
      <id_billing_address>${addressId}</id_billing_address>
      <id_shipping_address>${addressId}</id_shipping_address>
      <id_currency>${currencyId}</id_currency>
      <id_customer>${customerId}</id_customer>
      <id_lang>1</id_lang>
      <id_carrier>${carrierId}</id_carrier>
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

  const response = await axiosInstance.post('/carts', cartXml, {
    headers: { 'Content-Type': 'application/xml' },
  })
  const result = parseXML(response.data)
  return result?.prestashop?.cart
}

/**
 * ALÉA 2 : Duplication de commande avec vérification stricte des stocks
 */
export const duplicateOrderWithMultiplier = async (orderId, multiplier) => {
  // Récupérer la commande d'origine
  const current = await getOrderById(orderId)
  const order = current?.prestashop?.order
  if (!order) throw new Error(`Commande #${orderId} introuvable pour duplication`)
    // Extraction des lignes de produits
  const rawRows = order.associations?.order_rows?.order_row
  if (!rawRows) throw new Error(`La commande #${orderId} n'a pas de lignes de produits à dupliquer`)
  const orderRows = Array.isArray(rawRows) ? rawRows : [rawRows]

  // Vérification des stocks pour chaque produit
  for (const row of orderRows) {
    const productId = getVal(row.product_id)
    const productAttributeId = getVal(row.product_attribute_id) || '0'
    const requestQty = parseInt(getVal(row.product_quantity)) * multiplier
    // Appel de ton stockMouvementService
    const stockItem = await getStockAvailableRecord(productId, productAttributeId)

    if (!stockItem) {
      throw new Error(`Impossible de vérifier les stocks pour le produits ID ${productId}`)
    }

    const availableQty = parseInt(getVal(stockItem.quantity), 10)
    if (availableQty < requestQty) {
      throw new Error(`Stock insuffisant pour le produit "${getVal(row.product_name)}" (ID ${productId}). Disponible: ${availableQty}, requis: ${requestQty}`)
    }
  }
  
  // Si tous les produits ont suffisamment de stock, procéder à la duplication
  // 3. Préparer les données pour le panier de transition
  const customerId = getVal(order.id_customer)
  const addressId = getVal(order.id_address_delivery) 
  const carrierId = getVal(order.id_carrier)
  const currencyId = getVal(order.id_currency)

  const clonedProducts = orderRows.map(row => ({
    id_product: getVal(row.product_id),
    id_product_attribute: getVal(row.product_attribute_id) || '0',
    quantity: parseInt(getVal(row.product_quantity), 10) * multiplier
  }))

  // 4. Créer le panier temporaire dans PrestaShop
  const newcart = await createCart(customerId, addressId, carrierId, currencyId, clonedProducts)
  const rawCartId = getVal(newcart?.id)

  if (!rawCartId) throw new Error('Échec de la création du panier pour la duplication de commande')
  
  // 5. Convertir ce panier en commande payée
  const dummyCartItem = {
    rawCartId,
    customerId,
    addressId,
    carrierId,
    currencyId,
    cartSecureKey: getVal(newcart.secure_key)
  }
  const newOrderId = await createOrderFromCart(dummyCartItem)
  return newOrderId
}
