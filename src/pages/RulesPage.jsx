import { useState } from 'react'

function Section({ title, children }) {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-bold text-gray-800 mb-3 pb-2 border-b border-gray-200">{title}</h2>
      {children}
    </div>
  )
}

function Ul({ children }) {
  return <ul className="space-y-1.5 text-sm text-gray-700">{children}</ul>
}

function Li({ children }) {
  return (
    <li className="flex gap-2">
      <span className="text-red-500 mt-0.5 shrink-0">•</span>
      <span>{children}</span>
    </li>
  )
}

function Tag({ color, children }) {
  const colors = {
    green: 'bg-green-100 text-green-800 border border-green-300',
    'green-solid': 'bg-green-500 text-white',
    yellow: 'bg-yellow-100 text-yellow-800 border border-yellow-300',
    blue: 'bg-blue-100 text-blue-800 border border-blue-300',
    red: 'bg-red-100 text-red-700 border border-red-200',
  }
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${colors[color]}`}>
      {children}
    </span>
  )
}

function Regras() {
  return (
    <div className="max-w-2xl space-y-2">
      <Section title="Quadras">
        <Ul>
          <Li>O clube dispõe de <strong>3 quadras</strong>. Quadra 1 e Quadra 2 são adequadas para simples e duplas. <strong>Quadra 3 é exclusiva para simples</strong> — não possui o corredor lateral de duplas.</Li>
          <Li>Horário de funcionamento: <strong>segunda a sexta das 08h às 22h</strong>, <strong>sábados e domingos das 09h às 20h</strong>.</Li>
          <Li>Cada reserva tem duração de <strong>1 hora</strong>.</Li>
          <Li>É possível reservar com até <strong>7 dias de antecedência</strong>.</Li>
        </Ul>
      </Section>

      <Section title="Como funciona uma reserva">
        <Ul>
          <Li>Toda reserva requer <strong>exatamente dois jogadores</strong>. Não é possível reservar sozinho.</Li>
          <Li>O <strong>primeiro jogador</strong> cria uma solicitação de jogo no horário desejado.</Li>
          <Li>O <strong>segundo jogador</strong> encontra a solicitação no calendário, aceita e <strong>escolhe a quadra disponível</strong> no momento da confirmação.</Li>
          <Li>A reserva só é confirmada após o segundo jogador aceitar. Até lá, a solicitação permanece pendente.</Li>
          <Li>A quadra é escolhida pelo segundo jogador — isso evita dois jogadores escolhendo a mesma quadra ao mesmo tempo.</Li>
        </Ul>
      </Section>

      <Section title="Tipos de solicitação">
        <div className="space-y-4 text-sm text-gray-700">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="font-semibold text-green-800 mb-1">Solicitação Aberta</p>
            <p>Fica visível no calendário para <strong>todos os sócios</strong>. Qualquer sócio disponível pode aceitar e confirmar o jogo.</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="font-semibold text-blue-800 mb-1">Solicitação Nominada</p>
            <p>Você convida <strong>sócios específicos</strong>. Apenas os convidados veem e podem aceitar. O primeiro a aceitar confirma o jogo — os demais convites são automaticamente cancelados.</p>
          </div>
        </div>
      </Section>

      <Section title="Limites por sócio">
        <Ul>
          <Li>Cada sócio pode ter no máximo <strong>3 solicitações pendentes</strong> ao mesmo tempo.</Li>
          <Li>Cada sócio pode ter no máximo <strong>1 reserva confirmada futura</strong> por vez.</Li>
          <Li>Ao confirmar uma reserva, todas as demais solicitações pendentes de <strong>ambos os jogadores</strong> são automaticamente canceladas.</Li>
        </Ul>
      </Section>

      <Section title="Cancelamentos">
        <div className="space-y-3 text-sm text-gray-700">
          <div className="bg-gray-50 border rounded-xl p-4">
            <p className="font-semibold text-gray-800 mb-1">Cancelamento antecipado <span className="font-normal text-gray-500">(até meia-noite do dia anterior)</span></p>
            <Ul>
              <Li>A reserva é cancelada sem penalidade.</Li>
              <Li>Ambos os jogadores ficam <strong>imediatamente livres</strong> para criar novas reservas.</Li>
            </Ul>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="font-semibold text-red-800 mb-1">Cancelamento tardio <span className="font-normal text-red-500">(mesmo dia, após meia-noite)</span></p>
            <Ul>
              <Li>O cancelamento é permitido, mas há uma <strong>penalidade</strong>.</Li>
              <Li>Ambos os jogadores ficam <strong>bloqueados</strong> para novas reservas até o horário original da partida terminar.</Li>
              <Li>O bloqueio é visível em "Minhas Reservas" com o horário exato de liberação.</Li>
            </Ul>
          </div>
        </div>
      </Section>

      <Section title="Slot completo">
        <Ul>
          <Li>Se as 3 quadras estiverem ocupadas em um horário, o slot aparece como <Tag color="red">Completo</Tag> no calendário.</Li>
          <Li>Todas as solicitações pendentes para aquele horário são <strong>automaticamente canceladas</strong> quando o último court é confirmado.</Li>
        </Ul>
      </Section>

      <Section title="Indicadores do calendário">
        <div className="space-y-2 text-sm text-gray-700">
          {[
            { tag: <Tag color="green">Verde (contorno)</Tag>, desc: 'Horário disponível para reserva.' },
            { tag: <Tag color="green-solid">Verde (sólido)</Tag>, desc: 'Você tem uma reserva confirmada neste horário.' },
            { tag: <Tag color="yellow">Amarelo</Tag>, desc: 'Você tem uma solicitação pendente neste horário (aberta ou nominada).' },
            { tag: <Tag color="blue">Azul</Tag>, desc: 'Há jogos em aberto para qualquer sócio ou convites para você neste horário.' },
            { tag: <Tag color="red">Vermelho</Tag>, desc: 'Horário completo — todas as quadras estão ocupadas.' },
          ].map(({ tag, desc }, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-36 shrink-0 pt-0.5">{tag}</div>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}

function FAQ() {
  const items = [
    {
      q: 'Como faço para reservar uma quadra?',
      a: 'Acesse a aba "Quadras" e clique em um horário disponível (borda verde). Escolha entre criar uma solicitação aberta — visível para todos os sócios — ou nominada, convidando sócios específicos. A reserva é confirmada quando outro sócio aceitar e escolher a quadra.',
    },
    {
      q: 'Qual a diferença entre solicitação aberta e nominada?',
      a: 'Na aberta, qualquer sócio ativo pode ver e aceitar. Na nominada, você seleciona os sócios que deseja convidar e apenas eles recebem o convite. O primeiro a aceitar confirma o jogo — os demais convites são cancelados automaticamente.',
    },
    {
      q: 'Quem escolhe a quadra?',
      a: 'O segundo jogador — quem aceita a solicitação — escolhe a quadra no momento da confirmação. Assim garantimos que a quadra selecionada está de fato disponível no instante em que a reserva é criada.',
    },
    {
      q: 'Posso reservar para jogar sozinho ou com uma equipe?',
      a: 'Não. O sistema exige exatamente dois jogadores por reserva. Não é possível reservar sem um parceiro confirmado.',
    },
    {
      q: 'Quantas solicitações pendentes posso ter ao mesmo tempo?',
      a: 'Até 3 solicitações pendentes simultâneas. Quando uma delas for confirmada, as outras são canceladas automaticamente.',
    },
    {
      q: 'Posso ter mais de uma reserva confirmada?',
      a: 'Não. Cada sócio pode ter apenas uma reserva confirmada futura de cada vez. Confirmar uma nova reserva cancela automaticamente as demais solicitações pendentes suas e do seu parceiro.',
    },
    {
      q: 'Posso cancelar uma reserva?',
      a: 'Sim, sempre. Se cancelar antes da meia-noite do dia anterior, não há penalidade. Se cancelar no mesmo dia da partida, você e seu parceiro ficam bloqueados para novas reservas até o horário original da partida terminar.',
    },
    {
      q: 'Por que não consigo fazer uma nova reserva depois de cancelar?',
      a: 'Você cancelou no mesmo dia da partida. O sistema aplica um bloqueio temporário como penalidade — ele dura até o fim do horário que havia sido reservado. Acesse "Minhas Reservas" para ver o horário exato de liberação, listado em "Reservas canceladas".',
    },
    {
      q: 'O que acontece se as 3 quadras forem reservadas para um horário?',
      a: 'O horário fica marcado como "Completo" e todas as solicitações pendentes para aquele slot são canceladas automaticamente. Esses cancelamentos não geram penalidade para os sócios afetados.',
    },
    {
      q: 'A Quadra 3 pode ser usada para duplas?',
      a: 'Não. A Quadra 3 é exclusiva para partidas de simples — ela não possui os corredores laterais de duplas. Ao selecionar a quadra, o sistema exibe a indicação "simples" para que não haja confusão.',
    },
    {
      q: 'Com quanto tempo de antecedência posso reservar?',
      a: 'O calendário exibe os próximos 7 dias. Não é possível fazer reservas fora desse período.',
    },
    {
      q: 'Não vejo nenhum sócio na lista de convites. O que acontece?',
      a: 'A lista exibe apenas sócios com conta ativa. Se um sócio não aparece, provavelmente a conta está inativa. Contate o administrador do clube.',
    },
  ]

  return (
    <div className="max-w-2xl space-y-4">
      {items.map(({ q, a }, i) => (
        <div key={i} className="bg-white border rounded-xl p-5">
          <p className="font-semibold text-gray-800 mb-2">{q}</p>
          <p className="text-sm text-gray-600 leading-relaxed">{a}</p>
        </div>
      ))}
    </div>
  )
}

export default function RulesPage() {
  const [tab, setTab] = useState('rules')

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Regras</h1>
      <div className="flex gap-1 mb-6 border-b">
        {[
          { id: 'rules', label: 'Regras de marcação' },
          { id: 'faq',   label: 'FAQ' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id ? 'border-red-600 text-red-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'rules' ? <Regras /> : <FAQ />}
    </div>
  )
}
