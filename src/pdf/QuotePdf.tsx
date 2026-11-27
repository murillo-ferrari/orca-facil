import { Document, Font, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { CompanyProfile, Quote } from '../types'
import { itemTotal, quoteTotals } from '../lib/calc'
import { formatAddressLines, formatCurrency, formatDate, formatNumber } from '../lib/format'
import { resolveBranding } from './branding'

// Sem hifenização automática (evita quebras como "silvare-formas")
Font.registerHyphenationCallback((word) => [word])

const LH = 1.4

const C = {
  text: '#1e293b',
  muted: '#64748b',
  light: '#94a3b8',
  line: '#e2e8f0',
  strong: '#0f172a',
  band: '#f1f5f9',
}

const s = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 56,
    paddingHorizontal: 44,
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    color: C.text,
  },
  // Obs. (react-pdf): lineHeight NÃO pode ficar na Page nem em Views (some a numeração / espaçamentos
  // exagerados). Use-o só em estilos de Text que também definem fontSize.
  header: { flexDirection: 'row', justifyContent: 'space-between', gap: 24 },
  // Caixa fixa: o logotipo (qualquer proporção) cabe inteiro, encostado à esquerda
  logo: { width: 150, height: 46, objectFit: 'contain', objectPosition: 'left center', marginBottom: 8 },
  companyName: { fontFamily: 'Helvetica-Bold', fontSize: 16, lineHeight: 1.2, color: C.strong, marginBottom: 4 },
  companyLine: { color: C.muted, fontSize: 8.5, lineHeight: LH },
  docBox: { alignItems: 'flex-end', minWidth: 150 },
  docTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 18,
    lineHeight: 1.2,
    letterSpacing: 2,
    color: C.strong,
    marginBottom: 2,
  },
  docNumber: { fontSize: 10, color: C.muted, marginBottom: 8 },
  metaRow: { flexDirection: 'row', gap: 6, fontSize: 8.5, marginTop: 2 },
  metaLabel: { color: C.muted, width: 52, textAlign: 'right' },
  metaValue: { fontFamily: 'Helvetica-Bold', width: 62, textAlign: 'right' },
  rule: { borderBottomWidth: 1.2, borderBottomColor: C.strong, marginTop: 16, marginBottom: 16 },
  sectionLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    letterSpacing: 1,
    color: C.muted,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  clientName: { fontFamily: 'Helvetica-Bold', fontSize: 11, lineHeight: 1.3, color: C.strong, marginBottom: 2 },
  title: { fontFamily: 'Helvetica-Bold', fontSize: 11, lineHeight: 1.3, color: C.strong, marginTop: 14 },
  table: { marginTop: 16 },
  th: {
    flexDirection: 'row',
    backgroundColor: C.band,
    paddingVertical: 6,
    paddingHorizontal: 6,
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tr: {
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderBottomWidth: 0.6,
    borderBottomColor: C.line,
  },
  cIdx: { width: 20, color: C.light },
  cDesc: { flex: 1, paddingRight: 8 },
  cQty: { width: 48, textAlign: 'right' },
  cUnit: { width: 36, textAlign: 'center' },
  cPrice: { width: 72, textAlign: 'right' },
  cTotal: { width: 76, textAlign: 'right' },
  itemDesc: { fontFamily: 'Helvetica-Bold', fontSize: 9.5, lineHeight: LH, color: C.strong },
  itemDetails: { color: C.muted, fontSize: 8.5, marginTop: 1, lineHeight: LH },
  totals: { marginTop: 12, alignSelf: 'flex-end', width: 230 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2.5 },
  totalLabel: { color: C.muted },
  grandTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1.2,
    borderTopColor: C.strong,
  },
  grandLabel: { fontFamily: 'Helvetica-Bold', fontSize: 11, lineHeight: 1.2, color: C.strong },
  grandValue: { fontFamily: 'Helvetica-Bold', fontSize: 13, lineHeight: 1.2, color: C.strong },
  blocks: { marginTop: 22, gap: 14 },
  twoCols: { flexDirection: 'row', gap: 24 },
  col: { flex: 1 },
  body: { fontSize: 9.5, lineHeight: LH, color: C.text },
  muted: { fontSize: 9.5, lineHeight: LH, color: C.muted },
  footerLine: {
    position: 'absolute',
    bottom: 36,
    left: 44,
    right: 44,
    height: 1,
    borderTopWidth: 0.6,
    borderTopColor: C.line,
  },
  footerLeft: { position: 'absolute', bottom: 22, left: 44, fontSize: 7.5, color: C.light },
  footerRight: {
    position: 'absolute',
    bottom: 22,
    left: 300,
    right: 44,
    fontSize: 7.5,
    color: C.light,
    textAlign: 'right',
  },
})

function companyLines(p: CompanyProfile): string[] {
  const lines: string[] = []
  const regs = [
    p.document && `${p.docType} ${p.document}`,
    p.stateRegistration && `IE ${p.stateRegistration}`,
    p.municipalRegistration && `IM ${p.municipalRegistration}`,
  ].filter(Boolean)
  if (regs.length) lines.push(regs.join('  ·  '))
  lines.push(...formatAddressLines(p.address))
  const phones = [p.phone, p.whatsapp && p.whatsapp !== p.phone ? `WhatsApp ${p.whatsapp}` : '']
    .filter(Boolean)
    .join('  ·  ')
  const online = [p.email, p.website].filter(Boolean).join('  ·  ')
  if (phones) lines.push(phones)
  if (online) lines.push(online)
  return lines
}

export function QuotePdf({ quote, profile }: { quote: Quote; profile: CompanyProfile }) {
  const totals = quoteTotals(quote)
  const { logo, accent } = resolveBranding(profile.branding)
  const c = quote.client
  const companyName = profile.tradeName || profile.legalName || profile.label
  const showLegal = profile.tradeName && profile.legalName && profile.legalName !== profile.tradeName
  const clientLines = [
    c.document && `${c.docType} ${c.document}`,
    c.contactName && `A/C ${c.contactName}`,
    [c.phone, c.email].filter(Boolean).join('  ·  '),
    ...formatAddressLines(c.address),
  ].filter(Boolean) as string[]
  const hasPix = !!profile.pixKey
  const b = profile.bank
  const hasBank = profile.showBankInfo && !!(b.bank || b.account)
  const items = quote.items.filter((it) => it.description.trim() || it.unitPrice)

  return (
    <Document title={`Orçamento ${quote.number}`} author={companyName} creator="Gerador de Orçamentos" language="pt-BR">
      <Page size="A4" style={s.page}>
        {/* Cabeçalho */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            {logo ? <Image src={logo} style={s.logo} /> : null}
            <Text style={s.companyName}>{companyName}</Text>
            {showLegal && <Text style={s.companyLine}>{profile.legalName}</Text>}
            {companyLines(profile).map((l, i) => (
              <Text key={i} style={s.companyLine}>
                {l}
              </Text>
            ))}
          </View>
          <View style={s.docBox}>
            <Text style={[s.docTitle, accent ? { color: accent } : {}]}>ORÇAMENTO</Text>
            <Text style={s.docNumber}>Nº {quote.number}</Text>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Emissão</Text>
              <Text style={s.metaValue}>{formatDate(quote.issueDate)}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Validade</Text>
              <Text style={s.metaValue}>{formatDate(quote.validUntil)}</Text>
            </View>
          </View>
        </View>

        <View style={[s.rule, accent ? { borderBottomColor: accent } : {}]} />

        {/* Cliente */}
        {c.name ? (
          <View>
            <Text style={s.sectionLabel}>Cliente</Text>
            <Text style={s.clientName}>{c.name}</Text>
            {clientLines.map((l, i) => (
              <Text key={i} style={s.muted}>
                {l}
              </Text>
            ))}
          </View>
        ) : null}

        {quote.title ? <Text style={s.title}>{quote.title}</Text> : null}

        {/* Itens */}
        <View style={s.table}>
          <View style={[s.th, accent ? { backgroundColor: accent, color: '#ffffff' } : {}]} fixed>
            <Text style={[s.cIdx, accent ? { color: '#ffffff' } : {}]}>#</Text>
            <Text style={s.cDesc}>Descrição</Text>
            <Text style={s.cQty}>Qtd</Text>
            <Text style={s.cUnit}>Un</Text>
            <Text style={s.cPrice}>Valor unit.</Text>
            <Text style={s.cTotal}>Total</Text>
          </View>
          {items.map((it, i) => (
            <View key={it.id} style={s.tr} wrap={false}>
              <Text style={s.cIdx}>{i + 1}</Text>
              <View style={s.cDesc}>
                <Text style={s.itemDesc}>{it.description}</Text>
                {it.details ? <Text style={s.itemDetails}>{it.details}</Text> : null}
              </View>
              <Text style={s.cQty}>{formatNumber(it.quantity)}</Text>
              <Text style={s.cUnit}>{it.unit}</Text>
              <Text style={s.cPrice}>{formatCurrency(it.unitPrice)}</Text>
              <Text style={[s.cTotal, { fontFamily: 'Helvetica-Bold' }]}>{formatCurrency(itemTotal(it))}</Text>
            </View>
          ))}
        </View>

        {/* Totais */}
        <View style={s.totals} wrap={false}>
          {(totals.discountValue > 0 || totals.extrasTotal !== 0) && (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Subtotal</Text>
              <Text>{formatCurrency(totals.subtotal)}</Text>
            </View>
          )}
          {totals.discountValue > 0 && (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>
                Desconto{quote.discount.type === 'percent' ? ` (${formatNumber(quote.discount.value)}%)` : ''}
              </Text>
              <Text>- {formatCurrency(totals.discountValue)}</Text>
            </View>
          )}
          {quote.extras
            .filter((e) => e.value)
            .map((e) => (
              <View key={e.id} style={s.totalRow}>
                <Text style={s.totalLabel}>{e.label || 'Acréscimo'}</Text>
                <Text>{formatCurrency(e.value)}</Text>
              </View>
            ))}
          <View style={[s.grandTotal, accent ? { borderTopColor: accent } : {}]}>
            <Text style={s.grandLabel}>Total</Text>
            <Text style={[s.grandValue, accent ? { color: accent } : {}]}>{formatCurrency(totals.total)}</Text>
          </View>
        </View>

        {/* Condições */}
        <View style={s.blocks}>
          {(quote.paymentTerms || quote.executionTime) && (
            <View style={s.twoCols} wrap={false}>
              {quote.paymentTerms ? (
                <View style={s.col}>
                  <Text style={s.sectionLabel}>Forma de pagamento</Text>
                  <Text style={s.body}>{quote.paymentTerms}</Text>
                </View>
              ) : null}
              {quote.executionTime ? (
                <View style={s.col}>
                  <Text style={s.sectionLabel}>Prazo de execução</Text>
                  <Text style={s.body}>{quote.executionTime}</Text>
                </View>
              ) : null}
            </View>
          )}

          {(hasPix || hasBank) && (
            <View wrap={false}>
              <Text style={s.sectionLabel}>Dados para pagamento</Text>
              <View style={s.twoCols}>
                {hasPix && (
                  <View style={s.col}>
                    <Text style={s.body}>
                      <Text style={{ fontFamily: 'Helvetica-Bold' }}>PIX</Text> ({profile.pixKeyType}): {profile.pixKey}
                    </Text>
                  </View>
                )}
                {hasBank && (
                  <View style={s.col}>
                    {b.bank ? <Text style={s.body}>Banco: {b.bank}</Text> : null}
                    <Text style={s.body}>
                      {[
                        b.agency && `Agência ${b.agency}`,
                        b.account && `Conta ${b.accountType.toLowerCase()} ${b.account}`,
                      ]
                        .filter(Boolean)
                        .join('  ·  ')}
                    </Text>
                    {b.holder ? <Text style={s.body}>Titular: {b.holder}</Text> : null}
                  </View>
                )}
              </View>
            </View>
          )}

          {quote.notes ? (
            <View>
              <Text style={s.sectionLabel}>Observações</Text>
              <Text style={s.body}>{quote.notes}</Text>
            </View>
          ) : null}

          <Text style={{ color: C.muted, fontSize: 8.5 }}>
            Este orçamento é válido até {formatDate(quote.validUntil)}.
          </Text>
        </View>

        {/* Rodapé fixo em todas as páginas.
            Obs. (react-pdf): View absoluta precisa de height; Text com `render` precisa de
            largura (left+right), conteúdo inicial (' ') e não pode herdar lineHeight da Page. */}
        <View style={s.footerLine} fixed />
        <Text style={s.footerLeft} fixed>
          {companyName} · Orçamento {quote.number}
        </Text>
        <Text
          style={s.footerRight}
          fixed
          render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
        >
          {' '}
        </Text>
      </Page>
    </Document>
  )
}
