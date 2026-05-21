import md5 from 'md5'
import { MODULES_CONFIG } from './modulesConfig'

const escapeXml = (value) => {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export const rowToXml = (row, moduleKey) => {
  const config = MODULES_CONFIG[moduleKey]
  if (!config) throw new Error(`Module inconnu : ${moduleKey}`)

  const { xmlTag, multilingualFields, md5Fields, requiredFields, optionalFields } = config
  const allFields = [...requiredFields, ...optionalFields]

  let xmlFields = ''

  for (const field of allFields) {
    const value = row[field.csv]
    if (value === undefined || value === null || value === '') continue

    let finalValue = value
    if (md5Fields.includes(field.xml)) {
      finalValue = md5(String(value))
    }

    if (multilingualFields.includes(field.xml)) {
      xmlFields += `
        <${field.xml}>
          <language id="1"><![CDATA[${finalValue}]]></language>
        </${field.xml}>`
    } else {
      xmlFields += `
        <${field.xml}>${escapeXml(finalValue)}</${field.xml}>`
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <${xmlTag}>
    ${xmlFields}
  </${xmlTag}>
</prestashop>`
}