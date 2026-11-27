/**
 * Logotipo e cor da empresa no PDF são do plano Pro. A edição Cloud liga isto quando sabe que a conta é Pro; a Local
 * (que não tem plano) nunca liga. Fica fora de `editions/cloud` para o PDF não puxar código da Cloud para a Local.
 */
let allowed = false
export const brandingAllowed = () => allowed
export const setBrandingAllowed = (value: boolean) => {
  allowed = value
}
