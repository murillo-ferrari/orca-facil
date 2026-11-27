import type { Branding } from '../types'
import { isHex, readableAccent } from '../lib/color'

const LOGO = /^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=]+$/

/**
 * Aparência a usar no PDF. Os dados vêm do registro da empresa (que pode ter sido sincronizado ou importado de um
 * arquivo), então só valem logotipo em data URL de PNG/JPEG (nunca uma URL, que o PDF tentaria baixar) e cor `#rrggbb`.
 * A cor sai escurecida, se preciso, para o texto continuar legível.
 */
export function resolveBranding(b?: Branding | null) {
  return {
    logo: b?.logo && LOGO.test(b.logo) ? b.logo : null,
    accent: isHex(b?.accent) ? readableAccent(b.accent) : null,
  }
}
