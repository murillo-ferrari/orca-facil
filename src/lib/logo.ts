/**
 * Prepara o logotipo para o PDF: reduz e converte para PNG (ou JPEG, se o PNG não couber), tudo no navegador.
 * O resultado fica dentro do registro da empresa (limite de 64 KB por registro na nuvem), então o teto é pequeno.
 */
export const MAX_LOGO_CHARS = 45_000
const SIZES = [480, 320, 200, 120]
const MAX_FILE_BYTES = 8 * 1024 * 1024

export class LogoError extends Error {}

export async function prepareLogo(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new LogoError('Use uma imagem PNG, JPG ou WebP.')
  if (file.size > MAX_FILE_BYTES) throw new LogoError('Imagem grande demais. Use uma de até 8 MB.')
  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) throw new LogoError('Não foi possível ler esta imagem.')
  try {
    for (const max of SIZES) {
      const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) break
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      const png = canvas.toDataURL('image/png')
      if (png.length <= MAX_LOGO_CHARS) return png
      // Foto ou arte com muitos detalhes: JPEG é menor (sem transparência, então fundo branco)
      ctx.globalCompositeOperation = 'destination-over'
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      const jpg = canvas.toDataURL('image/jpeg', 0.85)
      if (jpg.length <= MAX_LOGO_CHARS) return jpg
    }
  } finally {
    bitmap.close()
  }
  throw new LogoError('Não foi possível reduzir esta imagem. Tente uma versão mais simples do logotipo.')
}
