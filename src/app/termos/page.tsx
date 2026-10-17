import { Documento } from '@/components/legal/Documento'
import { PENDENTES } from '@/lib/legal/dados'

export const metadata = { title: 'Termos de uso' }

export default function TermosPage() {
  return (
    <Documento titulo="Termos de uso">
      <p>
        Estes termos regem o uso do crTOUR, sistema de gestão de clientes para agências de turismo. Ao criar uma conta você declara
        que leu e concorda com eles e com a <a href="/privacidade" className="text-primaria underline">política de privacidade</a>.
      </p>

      <h2>1. O serviço</h2>
      <p>
        O crTOUR permite cadastrar e organizar clientes, etiquetas e anotações, importar e exportar planilhas e abrir conversas no
        WhatsApp com mensagem pronta. O serviço está em <strong>fase piloto</strong>: pode mudar, ter falhas e ficar indisponível, e
        não há garantia de disponibilidade contínua.
      </p>

      <p>
        Também permite cadastrar passeios e saídas com vagas, registrar reservas, acompanhantes, pagamentos e cobranças, e gerar a lista
        de passageiros. O crTOUR <strong>não processa pagamentos</strong> (não cobra Pix nem cartão): ele registra o que a agência
        informa. Esses registros servem de controle interno e não substituem contabilidade, recibo ou nota fiscal.
      </p>

      <h2>2. Conta e acesso</h2>
      <ul>
        <li>Quem cria a conta é o dono da agência e responde pelos usuários que tiverem acesso a ela.</li>
        <li>Mantenha sua senha em sigilo e avise-nos se suspeitar de acesso indevido.</li>
        <li>As informações do cadastro devem ser verdadeiras e atualizadas.</li>
      </ul>

      <h2>3. Uso permitido</h2>
      <ul>
        <li>Use o sistema apenas para a atividade da sua agência e dentro da lei.</li>
        <li>Cadastre somente dados que você tem o direito de tratar e mantenha o consentimento dos clientes para receber mensagens.</li>
        <li>É proibido usar o sistema para spam, golpes, assédio, para tentar acessar dados de outras agências ou para sobrecarregar o serviço.</li>
        <li>Você é o responsável pelas mensagens que envia pelo WhatsApp e por cumprir as regras do próprio WhatsApp.</li>
        <li>
          A capacidade de cada saída, os valores e os pagamentos são informados por você. O sistema impede vender acima da capacidade
          cadastrada e receber acima do saldo, mas conferir se esses dados estão certos é responsabilidade da agência.
        </li>
      </ul>

      <h2>4. Seus dados</h2>
      <p>
        Os dados cadastrados são da agência. Você pode exportá-los e excluí-los a qualquer momento nas Configurações. Tratamos os
        dados conforme a política de privacidade. Recomendamos exportar uma cópia periodicamente.
      </p>

      <h2>5. Preço</h2>
      <p>
        Durante o piloto o uso é gratuito. Antes de cobrar qualquer valor, avisaremos com antecedência e você poderá escolher
        continuar ou encerrar a conta, levando seus dados.
      </p>

      <h2>6. Limitação de responsabilidade</h2>
      <p>
        Fazemos o possível para manter o serviço seguro e funcionando, mas, no limite permitido pela lei, não respondemos por perdas
        indiretas, lucros cessantes ou prejuízos causados por indisponibilidade, por decisões tomadas com base nos dados do sistema ou
        por uso indevido pela agência. {PENDENTES.responsabilidade}
      </p>

      <h2>7. Encerramento</h2>
      <p>
        Você pode encerrar a conta quando quiser. Podemos suspender ou encerrar contas que violem estes termos ou coloquem o serviço
        ou outros usuários em risco, avisando sempre que possível.
      </p>

      <h2>8. Mudanças nos termos</h2>
      <p>Podemos atualizar estes termos. Mudanças relevantes serão avisadas no sistema antes de valerem. Continuar usando depois do aviso significa concordar.</p>

      <h2>9. Contato e foro</h2>
      <p>
        Dúvidas: {PENDENTES.contato}. Responsável: {PENDENTES.controlador}. Fica eleito o foro da comarca {PENDENTES.foro} para resolver
        conflitos, ressalvadas as regras legais de competência.
      </p>
    </Documento>
  )
}
