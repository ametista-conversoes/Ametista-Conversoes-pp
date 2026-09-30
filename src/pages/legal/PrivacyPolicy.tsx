import { LegalPageLayout } from '@/components/legal/LegalPageLayout'

export default function PrivacyPolicy() {
  return (
    <LegalPageLayout title="Política de Privacidade" lastUpdated="28 de setembro de 2026" altLangHref="/privacy/en">
      <section>
        <h2>1. Quem somos</h2>
        <p>
          O Ametista Conversões é a plataforma interna da agência Ametista Conversões ("nós", "nossa agência"),
          usada para gerir os projetos dos nossos clientes e reportar a eles os resultados das campanhas que
          administramos. Esta política explica quais dados o app coleta, para que os usamos, com quem
          compartilhamos e quais direitos você tem sobre eles, em conformidade com a Lei Geral de Proteção de Dados
          (LGPD — Lei nº 13.709/2018).
        </p>
      </section>

      <section>
        <h2>2. Quais dados coletamos</h2>
        <p>Dependendo de como você usa o app, coletamos:</p>
        <ul>
          <li>
            <strong>Dados da sua conta</strong>: nome, e-mail, telefone e papel de acesso (administrador, gestor ou
            cliente).
          </li>
          <li>
            <strong>Dados cadastrados sobre clientes da agência</strong>: nome, empresa, e-mail, telefone, plano,
            mensalidade, notas internas, e premissas de negócio usadas para calcular receita estimada (ex: leads
            necessários para 1 venda, ticket médio).
          </li>
          <li>
            <strong>Métricas de campanhas de anúncio</strong>: investimento, cliques, impressões e conversões,
            sincronizados automaticamente das contas de Google Ads e Meta Ads que você conectar — sempre dados
            agregados da campanha, nunca dados pessoais de quem viu ou clicou no anúncio.
          </li>
          <li>
            <strong>Respostas de Google Forms</strong>: quando um formulário de captação de leads é conectado,
            sincronizamos as perguntas e respostas desse formulário — que podem incluir dados pessoais de quem
            respondeu (nome, e-mail, telefone, respostas abertas). Esse dado pertence ao cliente da agência que
            criou o formulário; processamos em nome dele.
          </li>
          <li>
            <strong>Conversas com a Cassie (assistente de IA)</strong> e com a ferramenta de Comunicação Persuasiva —
            o conteúdo das mensagens trocadas, incluindo, quando relevante, trechos de respostas de formulário usados
            como contexto.
          </li>
          <li>
            <strong>Arquivos e comentários</strong> enviados pelo Portal do Cliente ou pelo Portal do Gestor,
            incluindo mensagens de áudio.
          </li>
          <li>
            <strong>Inscrição de notificação push</strong>: um identificador técnico do seu navegador/aparelho,
            usado só para entregar notificações — não conseguimos ler nada além disso a partir dele.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Dados de usuário do Google (Google Ads e Google Forms)</h2>
        <p>
          Ao conectar uma conta do Google, o app pede 3 permissões (escopos), sempre com o consentimento explícito
          de quem conecta:
        </p>
        <ul>
          <li>
            <strong>forms.body.readonly</strong> e <strong>forms.responses.readonly</strong>: quando um cliente
            compartilha o formulário de captação de leads com a conta da agência como editor, o app lê as perguntas
            (escopo "body") e as respostas (escopo "responses") desse formulário para montar a análise de público e
            o funil de leads no relatório daquele cliente. Os dois são somente leitura; sozinho, o escopo de
            perguntas não traz nenhuma resposta, e o escopo de respostas sozinho não traz o texto das perguntas
            necessário para identificar o que cada resposta significa — por isso os dois são usados juntos.
          </li>
          <li>
            <strong>adwords</strong>: conectamos nossa conta administradora (MCC) uma única vez; a partir dela o app
            lista as contas de cliente vinculadas e lê campanhas, grupos de anúncios e métricas (investimento,
            cliques, impressões, conversões) para montar os relatórios. A API do Google Ads não oferece um escopo
            mais restrito ou somente leitura — <strong>adwords</strong> é a única opção disponível — e o app nunca
            cria, edita ou exclui nada dentro do Google Ads.
          </li>
        </ul>
        <p>
          Esses dados são exibidos só para a nossa agência e para o respectivo cliente, protegidos por controle de
          acesso no banco de dados (Row Level Security — ver seção 6), e nunca são vendidos ou compartilhados fora
          dos prestadores de serviço listados na seção 5.
        </p>
        <p>
          O uso e a transferência de informações recebidas das APIs do Google pelo Ametista Conversões seguirão a{' '}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noreferrer"
            className="text-purple-400 hover:underline"
          >
            Política de Dados do Usuário dos Serviços de API do Google
          </a>
          , incluindo os requisitos de Uso Limitado ("Limited Use").
        </p>
        <p>
          Você pode revogar esse acesso a qualquer momento — pelo próprio app (Ativos Digitais → Integrações →
          "Desconectar integração") ou diretamente na sua Conta Google, em{' '}
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noreferrer"
            className="text-purple-400 hover:underline"
          >
            myaccount.google.com/permissions
          </a>
          .
        </p>
      </section>

      <section>
        <h2>4. Para que usamos esses dados</h2>
        <ul>
          <li>Operar o app: mostrar dashboards, tarefas, projetos, relatórios e permitir a comunicação entre agência e cliente.</li>
          <li>Sincronizar métricas reais de campanhas para os relatórios de desempenho.</li>
          <li>Gerar respostas da Cassie e sugestões de comunicação persuasiva, usando IA.</li>
          <li>Enviar notificações relevantes (reuniões, tarefas, alertas, incidentes).</li>
          <li>Manter um registro de auditoria de ações importantes, por segurança.</li>
        </ul>
      </section>

      <section>
        <h2>5. Com quem compartilhamos</h2>
        <p>Não vendemos dados. Compartilhamos só com prestadores de serviço que operam o app, cada um recebendo só o necessário para sua função:</p>
        <ul>
          <li><strong>Supabase</strong> — hospeda o banco de dados, autenticação, arquivos enviados e a lógica do servidor.</li>
          <li>
            <strong>OpenAI</strong> — recebe o conteúdo das mensagens trocadas com a Cassie e com a Comunicação
            Persuasiva, para gerar as respostas. Esses dados, incluindo qualquer trecho de resposta de formulário
            usado como contexto, não são usados para treinar modelos de IA — nem pela Ametista Conversões, nem pela
            OpenAI.
          </li>
          <li><strong>Google</strong> — quando você conecta uma conta (login, Google Ads, Google Forms), trocamos dados de autenticação e sincronizamos métricas/respostas com a API do Google.</li>
          <li><strong>Meta</strong> — mesma lógica, para contas de Meta Ads conectadas.</li>
          <li><strong>Vercel</strong> — hospeda o site do app.</li>
          <li>Provedores de notificação push do seu navegador (ex: Google/Mozilla) — só entregam a notificação, não conseguem ler o conteúdo.</li>
        </ul>
      </section>

      <section>
        <h2>6. Como protegemos os dados</h2>
        <ul>
          <li>Cada cliente da agência só enxerga os próprios dados — reforçado por regras de acesso no banco de dados (Row Level Security), não só na tela.</li>
          <li>Tokens de acesso às contas de Google/Meta Ads ficam criptografados, nunca em texto puro.</li>
          <li>Toda comunicação entre seu navegador e o app é feita por HTTPS.</li>
        </ul>
      </section>

      <section>
        <h2>7. Por quanto tempo guardamos</h2>
        <p>
          Mantemos os dados enquanto sua conta ou a relação com a agência estiver ativa. Ao encerrar uma conta ou
          contrato, os dados podem ser apagados mediante solicitação, respeitando prazos legais de guarda quando
          aplicável (ex: registros fiscais).
        </p>
      </section>

      <section>
        <h2>8. Seus direitos (LGPD)</h2>
        <p>Você pode, a qualquer momento, solicitar:</p>
        <ul>
          <li>Confirmação de quais dados seus temos e acesso a eles.</li>
          <li>Correção de dados incompletos, desatualizados ou incorretos.</li>
          <li>Exclusão dos seus dados, quando não houver base legal para mantê-los.</li>
          <li>Portabilidade dos dados a outro fornecedor.</li>
          <li>Revogação de consentimento, quando o tratamento depender dele.</li>
        </ul>
        <p>Pedidos podem ser feitos pelo e-mail no final desta página.</p>
      </section>

      <section>
        <h2>9. Cookies</h2>
        <p>
          Usamos apenas o armazenamento local necessário para manter você conectado (sessão de login). Não usamos
          cookies de rastreamento ou de publicidade de terceiros.
        </p>
      </section>

      <section>
        <h2>10. Menores de idade</h2>
        <p>O app é uma ferramenta de uso profissional/empresarial, não é direcionado a menores de 18 anos.</p>
      </section>

      <section>
        <h2>11. Alterações nesta política</h2>
        <p>Podemos atualizar esta página conforme o app evolui. A data no topo sempre indica a versão mais recente.</p>
      </section>

      <section>
        <h2>12. Contato</h2>
        <p>Dúvidas ou pedidos sobre seus dados: ametistaconversoes@gmail.com</p>
      </section>
    </LegalPageLayout>
  )
}
