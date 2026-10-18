import { Documento } from '@/components/legal/Documento'
import { PENDENTES } from '@/lib/legal/dados'

export const metadata = { title: 'Política de privacidade' }

export default function PrivacidadePage() {
  return (
    <Documento titulo="Política de privacidade">
      <p>
        Esta política explica como o crTOUR, um sistema de gestão de clientes para agências de turismo, trata dados pessoais,
        conforme a Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018).
      </p>

      <h2>1. Quem é quem</h2>
      <p>
        <strong>Responsável pelo crTOUR:</strong> {PENDENTES.controlador}. <strong>Contato:</strong> {PENDENTES.contato}.
      </p>
      <ul>
        <li>
          <strong>Dados da sua conta e da sua equipe</strong> (quem usa o sistema): o crTOUR é o <em>controlador</em>.
        </li>
        <li>
          <strong>Dados dos clientes da sua agência</strong>, inclusive os que chegam pelo formulário público ou pelo WhatsApp: a
          <em> agência é a controladora</em> e o crTOUR é <em>operador</em>, ou seja, trata esses dados apenas para prestar o serviço e
          seguindo as instruções da agência.
        </li>
      </ul>

      <h2>2. Quais dados tratamos</h2>
      <p><strong>Da conta:</strong> seu nome, e-mail, senha (guardada de forma protegida, nunca em texto legível), nome da agência
        e a data em que você aceitou estes documentos.</p>
      <p><strong>Equipe e convites:</strong> nome, e-mail e papel (dono ou vendedor) de cada pessoa da equipe; para convidar alguém,
        o nome e o e-mail da pessoa convidada. O código do link de convite é guardado só como um resumo criptográfico e vale 7 dias.
        Também registramos quem vendeu cada reserva e, se a agência usar, a regra e os percentuais ou valores de comissão.</p>
      <p><strong>Dos clientes da agência (inseridos por vocês):</strong> nome, WhatsApp, e-mail, cidade, aniversário, origem do
        contato, destinos de interesse, faixa de orçamento, número de pessoas, restrições e observações, validade do passaporte,
        etiquetas, anotações, registro de consentimento para mensagens no WhatsApp e a data desse registro.</p>
      <p><strong>Das vendas e do atendimento:</strong> negociações (título, valor, etapa do funil, probabilidade, responsável, data
        esperada e, quando perdida, o motivo), o histórico de etapas, as atividades e lembretes de cada cliente (ligações, mensagens,
        reuniões, tarefas), os avisos ao dono e as metas da agência.</p>
      <p><strong>Das viagens e reservas (inseridas por vocês):</strong> passeios e datas das saídas, número de pessoas por reserva,
        valores combinados e pagos (data, tipo, como sinal ou parcela, e forma, como Pix ou dinheiro), vencimento do saldo e, para os
        acompanhantes, o nome e, se informado, o WhatsApp. Acompanhantes podem ser pessoas que nunca usaram o sistema, inclusive menores.
        Também os fornecedores da agência (nome, tipo e contato) e os custos de cada saída.</p>
      <p><strong>Formulário público:</strong> quando a agência liga o formulário de captação, quem o preenche informa nome, WhatsApp e,
        se quiser, destino, número de pessoas, data pretendida e uma mensagem, e escolhe se aceita receber mensagens. Guardamos também
        de onde a pessoa veio (por exemplo, o link da bio do Instagram) e a campanha indicada no link. Para impedir envios em massa,
        guardamos por pouco tempo um resumo criptográfico do endereço de internet de quem enviou, nunca o endereço em si: os registros com
        mais de 1 dia são apagados a cada novo envio do mesmo formulário. Se o WhatsApp já for de um cliente da agência, nada na ficha
        dele é alterado: o que a pessoa escreveu vira uma anotação.</p>
      <p><strong>Propostas:</strong> quando a agência cria uma proposta, guardamos uma cópia congelada do que ela mostra (nome da agência
        e do cliente, passeio, data da saída, número de pessoas, valores, prazos, o que inclui e não inclui, observações) e a validade. A
        proposta é aberta por um link com código aleatório, que funciona para quem tiver o link enquanto estiver válida e não for revogada,
        e não é indexada por buscadores.</p>
      <p><strong>Mensagens:</strong> quando alguém da agência registra o envio de uma mensagem pelo WhatsApp (pela ficha ou pela tela
        Hoje, mensagens do passeio, aniversário, 1 ano da viagem, remarketing ou proposta), guardamos o tipo, a data e o começo do texto na linha do tempo do
        cliente.</p>
      <p>
        <strong>O que não guardamos:</strong> número de passaporte ou de outros documentos, nem número de cartão ou de conta bancária.
        O crTOUR <em>não recebe nem processa pagamentos</em>: apenas registra o que a agência informa que foi pago. Se no futuro for
        ligado um provedor de pagamento, esta política será atualizada antes.
      </p>

      <h2>3. Para que usamos</h2>
      <ul>
        <li>Criar e manter sua conta e a da sua equipe, e permitir o acesso ao sistema (execução do contrato).</li>
        <li>Armazenar, organizar e exibir os clientes, as negociações e as atividades da agência, e gerar exportações e importações (execução do contrato).</li>
        <li>Controlar vagas, reservas, pagamentos, saldos, cobranças, custos e comissões, e gerar a lista de passageiros de cada saída (execução do contrato).</li>
        <li>Receber os contatos do formulário público e gerar as propostas que a agência envia (execução do contrato, a pedido da agência).</li>
        <li>Proteger o sistema contra acessos indevidos e abusos, inclusive limitar envios do formulário (legítimo interesse e segurança).</li>
        <li>Cumprir obrigações legais, quando houver.</li>
      </ul>
      <p>Não vendemos dados, não usamos dados dos clientes da agência para publicidade e não os compartilhamos para fins próprios.</p>

      <h2>4. Mensagens para os clientes da agência</h2>
      <p>
        Hoje o crTOUR <strong>não envia mensagens sozinho</strong>. Ele prepara o texto e abre o WhatsApp da própria agência, e a pessoa
        da equipe envia uma a uma. O sistema separa dois tipos:
      </p>
      <ul>
        <li>
          <strong>Mensagens de serviço</strong> (confirmação da reserva, lembrete da viagem, pedido de avaliação, cobrança de saldo e envio
          da proposta): tratam de uma reserva ou negociação que o cliente já tem. Podem ir para quem não informou o consentimento, nunca
          para quem pediu para sair.
        </li>
        <li>
          <strong>Mensagens de relacionamento</strong> (remarketing por segmento, aniversário e 1 ano da viagem): vão só para quem aceitou
          receber mensagens. O sistema não mostra o botão e o banco de dados recusa o registro para os demais.
        </li>
      </ul>
      <p>
        <strong>API do WhatsApp (ainda desligada):</strong> se a agência ligar a integração com a API oficial do WhatsApp, as mensagens
        trocadas com os clientes (texto, data e situação, como entregue e lida) passam a ser guardadas no sistema e ligadas ao cliente; uma
        mensagem de um número desconhecido cria um cliente sem consentimento para mensagens. O provedor da integração será{' '}
        {PENDENTES.whatsapp}. Esta política será atualizada antes de a integração ser ligada.
      </p>

      <h2>5. Responsabilidades da agência</h2>
      <ul>
        <li>Ter base legal para cadastrar cada cliente e para entrar em contato com ele.</li>
        <li>
          Enviar mensagens promocionais por WhatsApp somente a quem aceitou receber e parar de enviar a quem pediu para sair. O
          sistema ajuda registrando o consentimento e bloqueando o envio, mas a decisão e a responsabilidade são da agência.
        </li>
        <li>
          Evitar registrar nos campos livres (restrições, observações, anotações, mensagens) dados de saúde ou outros dados sensíveis além
          do estritamente necessário para a viagem. Se precisar registrá-los, faça-o apenas com o consentimento específico do titular.
        </li>
        <li>Se cadastrar dados de crianças e adolescentes, garantir o consentimento de um dos pais ou responsáveis.</li>
        <li>
          Informar aos acompanhantes que o nome (e o WhatsApp, se houver) deles consta na reserva. Se um acompanhante for cadastrado
          também como cliente, ele entra sem consentimento para receber promoções.
        </li>
        <li>Ao divulgar o formulário público, deixar claro quem é a agência e que os dados vão para ela; o formulário mostra o nome da agência e o link desta política.</li>
        <li>Enviar o link de uma proposta só ao próprio cliente, e revogar a proposta se o link for parar com outra pessoa.</li>
        <li>Dar acesso à equipe só a quem precisa e remover quem sair da agência (Configurações → Equipe).</li>
      </ul>

      <h2>6. Com quem compartilhamos</h2>
      <p>Usamos prestadores que tratam dados em nosso nome, apenas para operar o serviço:</p>
      <ul>
        <li><strong>Supabase</strong>: banco de dados e autenticação. Servidores: {PENDENTES.regiao}.</li>
        <li><strong>Vercel</strong>: hospedagem da aplicação.</li>
        <li><strong>Serviço de envio de e-mails</strong> (confirmação de conta e recuperação de senha): {PENDENTES.email}.</li>
        <li><strong>WhatsApp</strong>: hoje as mensagens saem do aplicativo de WhatsApp da própria agência, fora do crTOUR. Se a API for ligada, o provedor dela entra nesta lista.</li>
      </ul>
      <p>
        Esses prestadores podem processar dados fora do Brasil. Nesses casos adotamos as garantias previstas na LGPD para a
        transferência internacional. Também podemos divulgar dados se uma lei ou ordem judicial exigir.
      </p>

      <h2>7. Quanto tempo guardamos</h2>
      <ul>
        <li>Os dados ficam enquanto a conta existir. Negociações perdidas e propostas vencidas ou revogadas continuam no histórico.</li>
        <li>Ao excluir a conta (Configurações), apagamos a agência e todos os seus dados do sistema, inclusive reservas, pagamentos, acompanhantes, negociações, propostas, mensagens e o formulário, e removemos o acesso de todos os usuários.</li>
        <li>
          Os pagamentos nunca são editados nem apagados um a um: uma correção é um novo registro (estorno), para manter o histórico
          financeiro. Por isso, um cliente que já tem reserva não pode ser apagado individualmente; a eliminação completa é feita
          pela exclusão da conta. {PENDENTES.eliminacao}
        </li>
        <li>Os resumos criptográficos usados para limitar envios do formulário público são apagados depois de 1 dia, como descrito acima.</li>
        <li>Cópias de segurança dos nossos prestadores podem manter os dados por um período limitado após a exclusão: {PENDENTES.backups}.</li>
      </ul>

      <h2>8. Seus direitos</h2>
      <p>
        Você pode pedir confirmação de que tratamos seus dados, acesso, correção, anonimização, portabilidade, eliminação, informação
        sobre compartilhamento e revogação de consentimento (LGPD, art. 18). No sistema você já pode:
      </p>
      <ul>
        <li>Corrigir qualquer dado na ficha do cliente e na sua conta, e marcar que um cliente pediu para não receber mensagens.</li>
        <li>Baixar em planilha os clientes, anotações, reservas, pagamentos e acompanhantes (Configurações → Exportar seus dados). Os demais dados são entregues a pedido.</li>
        <li>Excluir a conta e todos os dados (Configurações → Excluir conta; somente o dono da agência).</li>
      </ul>
      <p>
        Para outros pedidos, escreva para {PENDENTES.contato}. Se você é cliente de uma agência (inclusive se preencheu o formulário dela
        ou recebeu uma proposta) e quer exercer seus direitos, fale primeiro com a agência, que é a controladora dos seus dados; nós
        ajudamos a agência a atender o pedido.
      </p>

      <h2>9. Segurança</h2>
      <ul>
        <li>Conexão protegida (HTTPS) e senhas guardadas com proteção criptográfica.</li>
        <li>Cada agência só enxerga os próprios dados: o isolamento é garantido no banco de dados, não só na tela.</li>
        <li>O formulário público e a página da proposta não mostram nenhum outro dado da agência, e os seus códigos são aleatórios e longos.</li>
        <li>Quem acessa a página pública não lê o banco de dados: só funções limitadas, que conferem cada dado recebido.</li>
        <li>Exclusão da conta exige a palavra de confirmação e a senha atual.</li>
        <li>Nenhum sistema é 100% seguro. Se houver um incidente que possa causar risco relevante, avisaremos a agência e as autoridades conforme a lei.</li>
      </ul>

      <h2>10. Cookies</h2>
      <p>
        Usamos apenas cookies essenciais para manter você conectado e um cookie de preferência que lembra se o menu lateral está recolhido.
        Não usamos cookies de publicidade nem de rastreamento, nem no formulário público nem na página da proposta.
      </p>

      <h2>11. Mudanças</h2>
      <p>Podemos atualizar esta política. Mudanças relevantes serão avisadas no sistema antes de valerem.</p>
    </Documento>
  )
}
