import { LegalPageLayout } from '@/components/legal/LegalPageLayout'

export default function TermsOfUse() {
  return (
    <LegalPageLayout title="Termos de Uso" lastUpdated="28 de agosto de 2026" altLangHref="/terms/en">
      <section>
        <h2>1. Aceitação</h2>
        <p>
          Ao criar uma conta ou usar o Ametista Conversões, você concorda com estes termos. Se não concordar, não
          use o app.
        </p>
      </section>

      <section>
        <h2>2. O que é o serviço</h2>
        <p>
          O Ametista Conversões é uma plataforma de gestão para agências de marketing de performance — centraliza a
          operação entre agência e cliente (projetos, tarefas, arquivos, comentários, reuniões, relatórios de
          desempenho). Não substitui as ferramentas de anúncio em si (Google Ads, Meta Ads) nem plataformas de
          automação de marketing — só organiza e reporta.
        </p>
      </section>

      <section>
        <h2>3. Contas e papéis de acesso</h2>
        <p>Existem 3 papéis: administrador e gestor (equipe da agência) e cliente (acesso ao próprio portal). Você é responsável por manter sua senha em sigilo e por tudo que acontecer usando sua conta.</p>
      </section>

      <section>
        <h2>4. Uso aceitável</h2>
        <ul>
          <li>Não tente acessar dados de outro cliente da agência além dos seus próprios.</li>
          <li>Não use o app para fins ilegais ou que violem direitos de terceiros.</li>
          <li>Não tente burlar as medidas de segurança do app.</li>
        </ul>
      </section>

      <section>
        <h2>5. Propriedade dos dados</h2>
        <p>
          Os dados que você ou seu cliente cadastram continuam pertencendo a vocês. Usamos esses dados só para
          operar o app, conforme descrito na Política de Privacidade.
        </p>
      </section>

      <section>
        <h2>6. Integrações de terceiros</h2>
        <p>
          Ao conectar Google Ads, Google Forms ou Meta Ads, você também está sujeito aos termos de uso dessas
          plataformas. Não somos responsáveis pela disponibilidade ou pelo funcionamento das APIs do Google e do
          Meta.
        </p>
      </section>

      <section>
        <h2>7. Disponibilidade do serviço</h2>
        <p>
          Fazemos o possível para manter o app disponível, mas ele é oferecido "como está", sem garantia de
          funcionamento ininterrupto. Manutenções e instabilidades podem acontecer.
        </p>
      </section>

      <section>
        <h2>8. Limitação de responsabilidade</h2>
        <p>
          Não somos responsáveis por decisões de negócio tomadas com base nos dados exibidos no app, nem por
          indisponibilidade ou erro de plataformas de terceiros (Google, Meta, Supabase, OpenAI) que estejam fora do
          nosso controle.
        </p>
      </section>

      <section>
        <h2>9. Encerramento de conta</h2>
        <p>Você pode pedir o encerramento da sua conta a qualquer momento. Podemos suspender ou encerrar contas que violem estes termos.</p>
      </section>

      <section>
        <h2>10. Alterações nestes termos</h2>
        <p>Podemos atualizar estes termos conforme o app evolui. A data no topo sempre indica a versão mais recente.</p>
      </section>

      <section>
        <h2>11. Lei aplicável</h2>
        <p>Estes termos são regidos pelas leis do Brasil.</p>
      </section>

      <section>
        <h2>12. Contato</h2>
        <p>Dúvidas sobre estes termos: ametistaconversoes@gmail.com</p>
      </section>
    </LegalPageLayout>
  )
}
