import { XMLParser } from 'fast-xml-parser'

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
})

export const parseXML = (xmlString) => {
  if (typeof xmlString !== 'string') return parser.parse(String(xmlString ?? ''))

  let clean = xmlString

  // Supprimer les warnings PHP AVANT le XML (ex: "headers already sent")
  const xmlStart = clean.indexOf('<?xml')
  if (xmlStart > 0) clean = clean.slice(xmlStart)

  // Supprimer tout ce qui suit </prestashop> (warnings PHP APRÈS le XML).
  // validateOrder() de PrestaShop déclenche de nombreux hooks qui peuvent écrire
  // du contenu après la réponse XML, causant "Pi Tag is not closed".
  const xmlEnd = clean.lastIndexOf('</prestashop>')
  if (xmlEnd !== -1) clean = clean.slice(0, xmlEnd + '</prestashop>'.length)

  return parser.parse(clean)
}