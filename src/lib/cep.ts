import { onlyDigits } from './format'

export interface CepResult {
  street: string
  district: string
  city: string
  state: string
}

/** Consulta o CEP na API pública ViaCEP. Retorna null se não encontrado ou offline. */
export async function lookupCep(cep: string): Promise<CepResult | null> {
  const digits = onlyDigits(cep)
  if (digits.length !== 8) return null
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
    if (!res.ok) return null
    const data = await res.json()
    if (data.erro) return null
    return {
      street: data.logradouro ?? '',
      district: data.bairro ?? '',
      city: data.localidade ?? '',
      state: data.uf ?? '',
    }
  } catch {
    return null
  }
}
