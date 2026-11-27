import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, FileText } from 'lucide-react'

// Dados de quem opera o serviço. ATENÇÃO: confirme antes de publicar (nome, CNPJ se houver, e-mail que exista).
const OPERATOR = 'Murillo Ferrari'
const CONTACT_EMAIL = 'contato@orcafacil.murilloferrari.tech'
const UPDATED = '26 de novembro de 2026'
const REPO = 'https://github.com/murillo-ferrari/orca-facil'

function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-slate-800">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6 sticky top-0 z-50 backdrop-blur">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
            <FileText size={16} aria-hidden />
          </span>
          <span className="font-semibold tracking-tight text-slate-900">Orçafácil</span>
        </Link>
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft size={16} aria-hidden /> Início
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-4 pt-6 pb-16 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">Atualizado em {UPDATED}.</p>
        <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-slate-700 [&_a]:font-medium [&_a]:text-brand-700 [&_a]:underline [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-900 [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_p+p]:mt-3 [&_ul+p]:mt-3 [&_ul]:mt-2 [&_ul]:space-y-1">
          {children}
        </div>
      </main>
      <footer className="border-t border-slate-200 bg-slate-50">
        <nav
          aria-label="Documentos"
          className="mx-auto flex max-w-3xl flex-wrap gap-x-6 gap-y-2 px-4 py-6 text-sm text-slate-600 sm:px-6"
        >
          <Link to="/termos" className="underline">
            Termos de Uso
          </Link>
          <Link to="/privacidade" className="underline">
            Política de Privacidade
          </Link>
        </nav>
      </footer>
    </div>
  )
}

const Mail = () => <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>

export function Termos() {
  return (
    <Page title="Termos de Uso">
      <section>
        <h2>1. O serviço</h2>
        <p>
          O Orçafácil ajuda profissionais autônomos e pequenas empresas a criar orçamentos de serviços e exportá-los em
          PDF. Ele é oferecido em duas formas: a <strong>edição grátis</strong>, que roda no seu aparelho e guarda os
          dados só nele, e a <strong>edição na nuvem (plano Pro)</strong>, com conta, sincronização entre aparelhos e
          cópia dos dados nos nossos servidores. O serviço é operado por {OPERATOR}. O código é aberto, sob a licença
          AGPL-3.0 (<a href={REPO}>repositório no GitHub</a>).
        </p>
      </section>
      <section>
        <h2>2. Conta</h2>
        <ul>
          <li>Para usar a edição na nuvem você entra com um código enviado ao seu e-mail ou com a sua conta Google.</li>
          <li>Você é responsável por manter o acesso ao seu e-mail seguro e por tudo o que é feito na sua conta.</li>
          <li>Informe dados verdadeiros e use o serviço de forma lícita.</li>
        </ul>
      </section>
      <section>
        <h2>3. Plano Pro e pagamento</h2>
        <ul>
          <li>
            O plano Pro custa R$ 9,99 por mês ou R$ 99,99 por ano. Os valores vigentes aparecem na página de planos
            antes da contratação.
          </li>
          <li>
            O pagamento é feito pelo Mercado Pago, e a assinatura renova sozinha no período escolhido. O Orçafácil não
            recebe nem guarda os dados do seu cartão.
          </li>
          <li>
            Você pode cancelar a qualquer momento, em Ajustes. O Pro continua valendo até o fim do período já pago, e
            não há nova cobrança depois disso.
          </li>
          <li>
            Se o pagamento falhar, o Pro continua por até 7 dias. Depois disso a conta fica sem plano: você continua
            vendo e exportando seus dados, mas novas alterações deixam de ser salvas na nuvem até regularizar.
          </li>
          <li>
            Conforme o Código de Defesa do Consumidor (art. 49), você pode desistir da contratação em até 7 dias e pedir
            o valor de volta. Escreva para <Mail />.
          </li>
        </ul>
      </section>
      <section>
        <h2>4. Os seus dados</h2>
        <p>
          Os orçamentos, clientes e demais informações que você cadastra são seus. Você é o responsável por esse
          conteúdo, inclusive pelos dados dos seus clientes, e por ter o direito de tratá-los. Nós só os guardamos e
          processamos para prestar o serviço, como explicado na <Link to="/privacidade">Política de Privacidade</Link>.
        </p>
        <p>Você pode exportar tudo em um arquivo de backup a qualquer momento e excluir a conta quando quiser.</p>
      </section>
      <section>
        <h2>5. O que o Orçafácil não é</h2>
        <ul>
          <li>
            Os documentos gerados são <strong>orçamentos</strong>: não são nota fiscal nem contrato.
          </li>
          <li>
            O cálculo dos valores é uma ajuda. Confira os totais antes de enviar ao seu cliente: a responsabilidade pelo
            que você emite é sua.
          </li>
        </ul>
      </section>
      <section>
        <h2>6. Disponibilidade</h2>
        <p>
          Trabalhamos para manter o serviço no ar, mas ele é oferecido como está, sem garantia de funcionamento
          ininterrupto. Podem ocorrer manutenções e falhas. Por isso, recomendamos exportar um backup de tempos em
          tempos.
        </p>
      </section>
      <section>
        <h2>7. Limite de responsabilidade</h2>
        <p>
          Dentro do que a lei permite, não respondemos por lucros cessantes, perda de negócios ou danos indiretos
          decorrentes do uso (ou da impossibilidade de uso) do serviço. Nada aqui limita direitos que a lei garante ao
          consumidor.
        </p>
      </section>
      <section>
        <h2>8. Encerramento</h2>
        <p>
          Você pode parar de usar o serviço e excluir a conta quando quiser; os dados são apagados, como descrito na
          Política de Privacidade. Podemos suspender contas usadas para fraude, abuso ou violação destes Termos.
        </p>
      </section>
      <section>
        <h2>9. Mudanças e lei aplicável</h2>
        <p>
          Podemos atualizar estes Termos. Mudanças relevantes serão avisadas no app ou por e-mail, e a data no topo
          desta página mostra a última atualização. Aplica-se a lei brasileira. Dúvidas: <Mail />.
        </p>
      </section>
    </Page>
  )
}

export function Privacidade() {
  return (
    <Page title="Política de Privacidade">
      <section>
        <h2>1. Quem somos</h2>
        <p>
          O Orçafácil é operado por {OPERATOR}. Para os dados da sua conta, somos o <strong>controlador</strong>{' '}
          (decidimos como são usados). Para os dados dos <strong>seus clientes</strong> que você cadastra (nome,
          telefone, CPF/CNPJ, endereço), você é o controlador e nós somos o <strong>operador</strong>: tratamos esses
          dados só para prestar o serviço a você. Contato sobre privacidade: <Mail />.
        </p>
      </section>
      <section>
        <h2>2. Edição grátis (no seu aparelho)</h2>
        <p>
          Na edição grátis <strong>não recebemos nenhum dado seu</strong>: tudo fica no navegador do aparelho que você
          usa, e não há conta. Só dois serviços externos são acionados por uma ação sua: a busca de endereço pelo CEP
          (enviamos só o CEP digitado ao ViaCEP) e o botão de cobrança, que abre o WhatsApp.
        </p>
      </section>
      <section>
        <h2>3. Edição na nuvem (plano Pro): o que guardamos</h2>
        <ul>
          <li>
            <strong>Conta:</strong> seu e-mail e, se entrar com o Google, o identificador da conta Google.
          </li>
          <li>
            <strong>Seu conteúdo:</strong> empresas, clientes, catálogo, unidades e orçamentos que você cadastra.
          </li>
          <li>
            <strong>Assinatura:</strong> plano, situação, período e identificadores da assinatura no Mercado Pago. Não
            temos os dados do seu cartão.
          </li>
          <li>
            <strong>Dados técnicos:</strong> registros de acesso e de erros mantidos pelos provedores de infraestrutura
            (como endereço IP e horário), usados para segurança e funcionamento.
          </li>
        </ul>
        <p>Não usamos cookies de publicidade nem de rastreamento, e não vendemos dados.</p>
      </section>
      <section>
        <h2>4. Para que usamos</h2>
        <ul>
          <li>Entregar o serviço: sincronizar seus dados entre aparelhos e gerar seus PDFs.</li>
          <li>Autenticar você e proteger a conta contra abuso (por exemplo, a verificação anti-robô no login).</li>
          <li>Cobrar a assinatura e liberar o plano Pro.</li>
          <li>Responder às suas mensagens e cumprir obrigações legais.</li>
        </ul>
        <p>
          As bases legais são a execução do contrato (prestar o serviço que você contratou), o cumprimento de obrigação
          legal e o legítimo interesse em manter o serviço seguro.
        </p>
      </section>
      <section>
        <h2>5. Com quem compartilhamos</h2>
        <p>Usamos prestadores que tratam dados em nosso nome, só para o que é necessário:</p>
        <ul>
          <li>
            <strong>Supabase:</strong> banco de dados, login e funções do servidor. Ambiente de produção na região de
            São Paulo (Brasil).
          </li>
          <li>
            <strong>Resend:</strong> envio do e-mail com o código de login.
          </li>
          <li>
            <strong>Google:</strong> apenas se você escolher entrar com a sua conta Google.
          </li>
          <li>
            <strong>Cloudflare:</strong> hospedagem do site e a verificação anti-robô (Turnstile) no login.
          </li>
          <li>
            <strong>Mercado Pago:</strong> processamento do pagamento da assinatura.
          </li>
          <li>
            <strong>ViaCEP e WhatsApp:</strong> acionados só por uma ação sua (buscar um CEP; abrir uma conversa pelo
            botão de cobrança, que leva o telefone e a mensagem ao WhatsApp).
          </li>
        </ul>
        <p>
          Alguns desses prestadores podem tratar dados fora do Brasil (por exemplo, o Google e o Cloudflare). Nesses
          casos eles seguem as próprias políticas e contratos de proteção de dados. Também podemos divulgar dados quando
          a lei ou uma ordem judicial exigir.
        </p>
      </section>
      <section>
        <h2>6. Onde ficam no seu aparelho</h2>
        <p>
          No navegador guardamos a sessão de login e uma cópia dos seus dados (para o app funcionar sem internet). Use
          &quot;Sair e apagar dados deste dispositivo&quot;, em Ajustes, em computadores compartilhados.
        </p>
      </section>
      <section>
        <h2>7. Por quanto tempo guardamos</h2>
        <p>
          Enquanto sua conta existir. Ao excluir a conta (Ajustes › Conta › Excluir conta), apagamos seus dados da conta
          e do conteúdo na nuvem. Cópias de segurança do provedor podem manter os dados por um curto período (até 7
          dias) antes de serem sobrescritas. Os registros de pagamento ficam com o Mercado Pago, que responde por eles.
        </p>
      </section>
      <section>
        <h2>8. Seus direitos</h2>
        <p>Pela LGPD (Lei 13.709/2018) você pode, a qualquer momento:</p>
        <ul>
          <li>confirmar que tratamos seus dados e acessá-los;</li>
          <li>corrigi-los (você mesmo edita no app);</li>
          <li>exportá-los (Ajustes › Dados › Exportar backup, em arquivo aberto);</li>
          <li>excluí-los (excluindo a conta, direto no app);</li>
          <li>saber com quem compartilhamos e revogar o consentimento, quando for essa a base.</li>
        </ul>
        <p>
          Para qualquer pedido, escreva para <Mail />. Você também pode reclamar à Autoridade Nacional de Proteção de
          Dados (ANPD).
        </p>
      </section>
      <section>
        <h2>9. Segurança</h2>
        <p>
          Cada conta só enxerga os próprios dados (regras de acesso no banco, testadas automaticamente), a comunicação é
          criptografada, e as chaves secretas ficam só no servidor. Se houver um incidente que possa afetar você,
          avisamos você e a ANPD nos termos da lei.
        </p>
      </section>
      <section>
        <h2>10. Crianças e mudanças</h2>
        <p>
          O serviço é para profissionais e não se destina a menores de 18 anos. Se esta Política mudar, avisaremos no
          app ou por e-mail, e a data no topo mostra a última atualização.
        </p>
      </section>
    </Page>
  )
}
