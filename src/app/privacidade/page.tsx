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
          <strong>Dados da sua conta</strong> (quem usa o sistema): o crTOUR é o <em>controlador</em>.
        </li>
        <li>
          <strong>Dados dos clientes da sua agência</strong> que você cadastra: a <em>agência é a controladora</em> e o crTOUR
          é <em>operador</em>, ou seja, trata esses dados apenas para prestar o serviço e seguindo as instruções da agência.
        </li>
      </ul>

      <h2>2. Quais dados tratamos</h2>
      <p><strong>Da conta:</strong> seu nome, e-mail, senha (guardada de forma protegida, nunca em texto legível), nome da agência
        e a data em que você aceitou estes documentos.</p>
      <p><strong>Dos clientes da agência (inseridos por vocês):</strong> nome, WhatsApp, e-mail, cidade, aniversário, origem do
        contato, destinos de interesse, faixa de orçamento, número de pessoas, restrições e observações, validade do passaporte,
        etiquetas, anotações, registro de consentimento para mensagens no WhatsApp e a data desse registro.</p>
      <p>
        <strong>O que não guardamos:</strong> número de passaporte ou de outros documentos, dados de cartão ou de pagamento.
      </p>

      <h2>3. Para que usamos</h2>
      <ul>
        <li>Criar e manter sua conta e permitir o acesso ao sistema (execução do contrato).</li>
        <li>Armazenar, organizar e exibir os clientes da agência, e gerar exportações e importações (execução do contrato).</li>
        <li>Proteger o sistema contra acessos indevidos e abusos (legítimo interesse e segurança).</li>
        <li>Cumprir obrigações legais, quando houver.</li>
      </ul>
      <p>Não vendemos dados, não usamos dados dos clientes da agência para publicidade e não os compartilhamos para fins próprios.</p>

      <h2>4. Responsabilidades da agência</h2>
      <ul>
        <li>Ter base legal para cadastrar cada cliente e para entrar em contato com ele.</li>
        <li>
          Enviar mensagens promocionais por WhatsApp somente a quem aceitou receber e parar de enviar a quem pediu para sair. O
          sistema ajuda registrando o consentimento, mas a decisão e a responsabilidade são da agência.
        </li>
        <li>
          Evitar registrar nos campos livres (restrições, observações, anotações) dados de saúde ou outros dados sensíveis além do
          estritamente necessário para a viagem. Se precisar registrá-los, faça-o apenas com o consentimento específico do titular.
        </li>
        <li>Se cadastrar dados de crianças e adolescentes, garantir o consentimento de um dos pais ou responsáveis.</li>
      </ul>

      <h2>5. Com quem compartilhamos</h2>
      <p>Usamos prestadores que tratam dados em nosso nome, apenas para operar o serviço:</p>
      <ul>
        <li><strong>Supabase</strong>: banco de dados e autenticação. Servidores: {PENDENTES.regiao}.</li>
        <li><strong>Vercel</strong>: hospedagem da aplicação.</li>
        <li><strong>Serviço de envio de e-mails</strong> (confirmação de conta e recuperação de senha): a definir antes do lançamento.</li>
      </ul>
      <p>
        Esses prestadores podem processar dados fora do Brasil. Nesses casos adotamos as garantias previstas na LGPD para a
        transferência internacional. Também podemos divulgar dados se uma lei ou ordem judicial exigir.
      </p>

      <h2>6. Quanto tempo guardamos</h2>
      <ul>
        <li>Os dados ficam enquanto a conta existir.</li>
        <li>Ao excluir a conta (Configurações), apagamos a agência e todos os seus dados do sistema, e removemos o acesso de todos os usuários.</li>
        <li>Cópias de segurança dos nossos prestadores podem manter os dados por um período limitado após a exclusão: {PENDENTES.backups}.</li>
      </ul>

      <h2>7. Seus direitos</h2>
      <p>
        Você pode pedir confirmação de que tratamos seus dados, acesso, correção, anonimização, portabilidade, eliminação, informação
        sobre compartilhamento e revogação de consentimento (LGPD, art. 18). No sistema você já pode:
      </p>
      <ul>
        <li>Corrigir qualquer dado na ficha do cliente e na sua conta.</li>
        <li>Baixar todos os dados em planilha (Configurações → Exportar seus dados).</li>
        <li>Excluir a conta e todos os dados (Configurações → Excluir conta; somente o dono da agência).</li>
      </ul>
      <p>
        Para outros pedidos, escreva para {PENDENTES.contato}. Se você é cliente de uma agência e quer exercer seus direitos, fale
        primeiro com a agência, que é a controladora dos seus dados; nós ajudamos a agência a atender o pedido.
      </p>

      <h2>8. Segurança</h2>
      <ul>
        <li>Conexão protegida (HTTPS) e senhas guardadas com proteção criptográfica.</li>
        <li>Cada agência só enxerga os próprios dados: o isolamento é garantido no banco de dados, não só na tela.</li>
        <li>Exclusão da conta exige a palavra de confirmação e a senha atual.</li>
        <li>Nenhum sistema é 100% seguro. Se houver um incidente que possa causar risco relevante, avisaremos a agência e as autoridades conforme a lei.</li>
      </ul>

      <h2>9. Cookies</h2>
      <p>Usamos apenas cookies essenciais para manter você conectado. Não usamos cookies de publicidade nem de rastreamento.</p>

      <h2>10. Mudanças</h2>
      <p>Podemos atualizar esta política. Mudanças relevantes serão avisadas no sistema antes de valerem.</p>
    </Documento>
  )
}
