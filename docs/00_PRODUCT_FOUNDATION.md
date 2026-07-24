# Rotina Pet — Product Foundation

> Este documento representa a base do produto.
>
> Seu objetivo é consolidar todas as decisões, funcionalidades, hipóteses e ideias discutidas até o momento.
>
> Ele é a fonte de verdade do projeto. Todo novo requisito deve ser registrado aqui antes de ser implementado.

---

# Legenda

| Ícone | Significado |
|-------|-------------|
| ✅ | Definição (decisão tomada) |
| 📅 | Capacidades (implementar) |
| 🧪 | Hipótese (precisa ser validada) |
| 💡 | Ideia futura |

---

# 1. Visão do Produto

## ✅ Definição

O Rotina Pet é uma plataforma de acompanhamento nutricional de pets.

Ela conecta o plano alimentar definido pelo veterinário à rotina real do tutor, permitindo que ambos acompanhem a evolução do tratamento.

O produto possui dois modos de utilização:

- Tutor Solo
- Profissional (Veterinários e Clínicas)

O foco estratégico do produto é o mercado profissional, sem impedir o uso independente por tutores.

---

# 2. Modelo de Negócio

## ✅ Definição

Existem dois tipos de clientes.

### Tutor Solo

- utiliza o aplicativo de forma independente;
- paga sua própria assinatura (modelo ainda será definido).

### Veterinário

- assina a plataforma;
- gerencia pacientes;
- convida tutores.

O tutor vinculado a um veterinário não paga pela plataforma.

---

# 3. Papéis

## ✅ Tutor

Responsável pela execução da rotina.

Pode:

- registrar refeições;
- registrar peso;
- alterar horários;
- alterar número de porções.

Não pode alterar a prescrição profissional.

---

## ✅ Veterinário

Responsável pelo tratamento.

Pode:

- criar planos;
- alterar planos;
- acompanhar evolução;
- acompanhar adesão;
- gerenciar pacientes.

---

## ✅ Pet

Paciente acompanhado dentro da plataforma.

---

# 4. Conceitos Fundamentais

## ✅ Plano Nutricional ≠ Rotina

Plano Nutricional

- definido pelo veterinário;
- representa o tratamento.

Rotina

- definida pelo tutor;
- representa como o tratamento será executado.

---

# 5. Princípios do Produto

## ✅ O tutor controla

- horários;
- quantidade de porções;
- organização da rotina.

---

## ✅ O veterinário controla

- plano alimentar;
- quantidade diária;
- objetivos nutricionais.

---

## ✅ O aplicativo deve transmitir calma

Não deve parecer um sistema administrativo.

Referências visuais:

- Apple Health
- Things 3
- Structured
- Gentler Streak

---

## ✅ A primeira tela deve responder imediatamente

- Qual a próxima refeição?
- Que horas?
- Quanto oferecer?
- O que oferecer?

Sem navegação desnecessária.

---

## ✅ Linguagem

Evitar termos administrativos ou ambíguos, como:

- administrada;
- registrar consumo, quando usado como ação principal sem contexto.

Preferir estados e ações concretas:

- Pendente;
- Atrasada;
- Comeu tudo;
- Não comeu tudo;
- Não foi servida.

Ícones de estado nunca devem aparecer sozinhos: precisam estar acompanhados por uma label textual.

---

# 6. Funcionalidades do Tutor

## 📅 Capacidades

- Cadastro de pets
- Cadastro de alimentos
- Plano alimentar
- Múltiplos alimentos por refeição
- Lembretes
- Histórico de refeições por data
- Tela "Hoje"
- Histórico de peso
- Sincronização entre dispositivos
- Compartilhamento entre cuidadores

---

## 📅 Capacidades

O tutor pode reorganizar:

- horários;
- quantidade de porções.

Sem alterar a quantidade diária prescrita.

---


## ✅ Histórico por data

A visualização de refeições não deve ficar restrita ao dia atual.

O tutor precisa conseguir navegar por datas anteriores para consultar:

- o que estava programado em cada dia;
- o que foi concluído;
- o que ficou pendente;
- se a refeição não foi servida;
- se o animal não comeu tudo.

A navegação histórica pode coexistir dentro da própria tela **Hoje**, desde que a troca de data seja simples e visível.

## ✅ Notificações confiáveis exigem infraestrutura

As notificações não dependem de temporizadores locais, da aba aberta ou de o tutor ter acessado a tela **Hoje** naquele dia.

Arquitetura aprovada:

- cliente inscrito em Web Push pelo OneSignal;
- identidade do usuário vinculada ao ID da conta no Supabase;
- Cron no Supabase executado a cada minuto;
- Edge Function para gerar ocorrências necessárias, localizar refeições elegíveis e enviar os lembretes;
- banco como fonte de verdade para horários, estados e prevenção de duplicidades.

Essa arquitetura deve atender iPhone, Android e navegadores desktop compatíveis.

## ✅ Refeições simultâneas geram uma única notificação

Refeições do mesmo tutor programadas para o mesmo instante são agrupadas antes do envio. O sistema não deve enviar um push separado para cada animal.

A identificação do grupo considera:

- tutor;
- data e horário locais da rotina;
- tipo da notificação.

O banco faz uma reserva atômica do grupo e mantém uma chave única. O envio ao OneSignal também usa uma chave de idempotência. A combinação dessas duas proteções deve impedir duplicidades inclusive em reexecuções, timeouts ou chamadas simultâneas.

## ✅ O conteúdo da notificação é adaptativo

A notificação utiliza o emoji escolhido para cada animal e prioriza:

1. nome e emoji dos animais;
2. primeiro item de cada refeição;
3. demais itens, enquanto houver espaço útil.

Quando o conteúdo completo ficar longo, o texto informa `+ 1 item`, `+ 2 itens` ou equivalente. Os detalhes integrais permanecem no card da tela **Hoje**.

Observações clínicas, informações sensíveis e textos extensos não devem ser exibidos na tela bloqueada.

## ✅ O toque abre o grupo correspondente na tela Hoje

Cada push contém um deep link com a data e o horário da rotina. Ao tocar, o aplicativo deve:

- abrir a tela **Hoje**;
- selecionar a data indicada;
- localizar o grupo de horário;
- rolar até ele;
- destacá-lo temporariamente;
- abrir a primeira refeição ainda pendente, ou a primeira do grupo quando nenhuma estiver pendente.

Como uma notificação pode representar vários animais, o destino principal é o grupo do horário, e não um único card individual.

## ✅ Notificações de refeição têm validade limitada

O TTL padrão das notificações de refeição é de **30 minutos**. Após esse período, um push ainda não entregue deve expirar, evitando lembretes antigos e fora de contexto.

A expiração do push não altera o estado da refeição. A tela **Hoje** continua sendo a fonte de verdade e mostra normalmente refeições pendentes ou atrasadas.

## ✅ O fuso horário pertence à rotina da conta

Cada conta possui um fuso horário IANA, como `America/Sao_Paulo`.

Regras:

- o fuso é detectado inicialmente no dispositivo e salvo na conta;
- a rotina segue o fuso configurado na conta;
- uma viagem não altera silenciosamente os horários;
- a pessoa pode atualizar o fuso nas Configurações;
- datas e horários são convertidos no servidor, e não pelo relógio local do navegador;
- a geração das ocorrências ocorre no servidor, inclusive quando o aplicativo não foi aberto no dia.

Notificações são um canal auxiliar e não substituem os estados e registros persistidos no aplicativo.

## ✅ Horários podem mudar sem refazer a prescrição

Alterar os horários da rotina não deve obrigar o tutor a recriar o plano nutricional.

Na edição rápida de horários:

- alimentos permanecem iguais;
- quantidades diárias permanecem iguais;
- unidades permanecem iguais;
- divisão dos alimentos entre as refeições permanece igual;
- a quantidade de refeições permanece fixa;
- o tutor escolhe a data de início da nova rotina.

A implementação pode criar uma nova versão técnica da rotina para preservar o histórico, mas essa complexidade não deve ser exposta como trabalho adicional para o tutor.

Se já houver refeições concluídas ou marcadas como não servidas na data escolhida, a alteração deve começar em uma data posterior.

## ✅ Registro de consumo sem etapa obrigatória

O registro principal oferece três ações mutuamente claras:

- **Comeu tudo**;
- **Não comeu tudo**;
- **Não foi servida**.

Tocar em **Comeu tudo** encerra o registro imediatamente, sem pergunta adicional.

Tocar em **Não comeu tudo** abre uma escolha aproximada:

- Quase tudo;
- Metade;
- Pouco;
- Nada.

**Nada** significa que a comida foi oferecida, mas o animal não comeu. **Não foi servida** significa que a refeição não chegou a ser oferecida. Essa diferença deve permanecer preservada nos dados e na interface.

A escala é deliberadamente descritiva e humana. Percentuais ou quantidades exatas continuam como possibilidades futuras para validação com veterinários.

---

## 💡 Ideia futura

Permitir informar que a sobra será reaproveitada na próxima refeição.

---

# 7. Funcionalidades do Veterinário

## 📅 Capacidades

- Cadastro de pacientes
- Lista de pacientes
- Histórico de peso
- Histórico de planos
- Criação de planos
- Atualização remota
- Convite de tutores

---

## 📅 Capacidades

Acompanhar:

- adesão ao tratamento;
- evolução do peso;
- histórico alimentar.

---

## 💡 Ideia futura

Dashboard profissional.

---

## 💡 Ideia futura

Gestão de clínicas.

---

# 8. Comunicação

## 📅 Capacidades

Notificar tutor quando houver alteração no plano.

---

## 📅 Capacidades

Comunicação contextual baseada em eventos.

Exemplos:

- plano atualizado;
- peso registrado;
- recusa alimentar.

---

## 💡 Ideia futura

Chat completo.

No momento entendemos que não faz parte do MVP.

---

# 9. Onboarding

## ✅ Definição

O usuário deve experimentar valor antes de criar uma conta.

---

## 🧪 Hipótese

Criar automaticamente uma conta anônima sincronizada com o banco.

Posteriormente o usuário apenas adiciona e-mail e senha.

Precisamos validar a arquitetura.

---

# 10. Diferencial Competitivo

## 🧪 Hipótese

O maior diferencial do Rotina Pet não é montar planos alimentares.

É permitir que o veterinário acompanhe a adesão real ao tratamento.

Essa hipótese deverá ser validada com profissionais.

---

# 11. Product Inbox

## 💡 Ideias futuras

- cálculo nutricional assistido;
- QR Code para convites;
- IA de apoio ao veterinário;
- integração de pagamentos;
- exportação de relatórios;
- múltiplos veterinários;
- equipes;
- suplementos;
- medicamentos;
- gráficos avançados.

---

# Regras de manutenção

Sempre que uma conversa gerar:

- uma decisão;
- uma nova funcionalidade;
- uma hipótese;
- uma mudança de visão;

este documento deverá ser atualizado antes da implementação.

Este documento é a fonte oficial de verdade do produto.

---

# 12. Definições consolidadas durante os testes do protótipo

## ✅ A visão Hoje reúne todos os animais

A visão principal não deve ser separada por pet.

As refeições de todos os animais ativos aparecem juntas e agrupadas por horário. O tutor pode filtrar por um ou vários animais por meio das pílulas de seleção.

Regras do filtro:

- todos os animais começam selecionados;
- quando todos estão selecionados, tocar em um animal passa a mostrar apenas ele;
- depois disso, outros animais podem ser adicionados ao filtro;
- o filtro não deve permanecer vazio.

---

## ✅ Cada refeição deve identificar claramente o animal

O card mostra o ícone e o nome do animal, além dos alimentos e respectivas quantidades.

Quando há mais de um alimento na mesma refeição, cada item deve possuir separação visual suficiente para não parecer uma única linha de conteúdo.

---

## ✅ O cadastro de alimento não interrompe a criação do plano

Durante a criação de um plano, o tutor pode cadastrar um alimento que ainda não existe.

O formulário do plano permanece preenchido e, após o cadastro, o novo alimento é adicionado automaticamente à composição diária.

---

## ✅ Arquivamento é reversível

Arquivar um animal não apaga pesos, planos, refeições ou demais dados históricos.

Animais arquivados devem permanecer acessíveis em uma área própria e podem ser restaurados.

---

## ✅ A conta é acessada diretamente pelas iniciais do usuário

Enquanto existir apenas um destino de conta e configurações, tocar nas iniciais do usuário abre diretamente essa tela.

Não será criado um menu intermediário sem necessidade real.

---



## ✅ A tela Hoje privilegia a leitura rápida dos horários

O card de resumo apresenta uma faixa horizontal rolável com todos os horários do dia.

Regras:

- cada horário funciona como atalho para o grupo correspondente na lista;
- os horários têm espaçamento suficiente para serem diferenciados;
- o horário é o título visual do grupo, sem a frase “Refeição das…”;
- cada grupo informa quantas refeições já foram registradas.

As refeições de um mesmo horário aparecem como linhas compactas em acordeão:

- ícone do animal;
- nome do animal;
- ícone de estado acompanhado por label;
- controle de expandir ou recolher.

Ao expandir, são exibidos alimentos, quantidades e ações de registro. Apenas uma refeição fica aberta por vez dentro de cada horário. Após registrar uma ação, o card se fecha automaticamente.

---

## ✅ Configurações não exibe seletor de animais sem função

Os chips de animais são ocultados na tela Configurações. Um seletor não deve aparecer em uma tela na qual não altera nenhum conteúdo ou comportamento.

---

## ✅ Registros do dia medem informação preenchida

Com a existência da opção **Não foi servida**, o progresso diário passa a contar refeições **registradas**, e não apenas refeições consumidas ou concluídas.

Uma refeição está registrada quando o tutor informa qualquer resultado válido. Estados pendentes e atrasados ainda não entram no progresso.

---

## ✅ Compatibilidade móvel não deve impedir acessibilidade

Para reduzir ocorrências de zoom ou corte indevido no PWA do iPhone:

- a viewport usa a área segura do aparelho;
- a aplicação impede overflow horizontal acidental;
- campos de formulário mantêm fonte mínima de 16 px;
- o ajuste automático do tamanho do texto é estabilizado.

Não será desabilitado o zoom manual do usuário, pois isso prejudicaria acessibilidade.

---

# 13. Estado de implementação do protótipo

| Capacidade | Status |
|---|---|
| Cadastro de animais | ✅ Implementado |
| Edição de animais | ✅ Implementado |
| Arquivamento reversível de animais | ✅ Implementado |
| Cadastro de alimentos | ✅ Implementado |
| Cadastro de alimento dentro do plano | ✅ Implementado |
| Plano com múltiplos alimentos | ✅ Implementado |
| Divisão automática da quantidade diária | ✅ Implementado |
| Visão Hoje com todos os animais | ✅ Implementado |
| Agrupamento das refeições por horário | ✅ Implementado |
| Atalhos de horários no resumo do dia | ✅ Implementado |
| Cards compactos em acordeão | ✅ Implementado |
| Ícones de estado com labels | ✅ Implementado |
| Filtro por um ou vários animais | ✅ Implementado |
| Registro “Comeu tudo” | ✅ Implementado |
| Fluxo “Não comeu tudo” | ✅ Implementado |
| Registro “Não foi servida” | ✅ Implementado |
| Registro e histórico de peso | ✅ Implementado |
| Sincronização pelo Supabase | ✅ Implementado |
| PWA instalável | ✅ Implementado |
| Lembretes com o app ativo | ✅ Implementado |
| Notificações em segundo plano | ✅ Implementado |
| Agrupamento e prevenção de duplicidade dos pushes | ✅ Implementado |
| Deep link para o grupo de horário na tela Hoje | ✅ Implementado |
| Fuso horário da rotina por conta | ✅ Implementado |
| Consumo aproximado (quase tudo, metade, pouco ou nada) | ✅ Implementado |
| Onboarding sem login obrigatório | 🧪 Hipótese |
| Produto profissional para veterinários | 📅 Capacidade futura |


## Decisão de produto — registros antecipados (v0.6.1)

O Rotina Pet mantém flexibilidade total: o tutor pode registrar uma refeição antes do horário programado. Para reduzir erros sem impor bloqueios, a interface mostra uma confirmação com o horário e o tempo restante.

Notificações de refeição são enviadas apenas para ocorrências `pending`. A Edge Function revalida o status imediatamente antes do envio para cobrir alterações concorrentes.

## Decisão de produto — reconciliação de refeições ao alterar o plano (v0.6.2)

Quando um plano alimentar é substituído, ou quando apenas seus horários são alterados, a data escolhida define o início da nova versão da rotina.

A partir dessa data:

- ocorrências ainda `pending` são removidas e recriadas conforme o plano vigente;
- ocorrências `completed` e `skipped` permanecem intactas como histórico;
- uma ocorrência já registrada para a mesma sequência da refeição impede a criação de uma nova ocorrência pendente equivalente;
- a edição exclusiva de horários mantém alimentos, quantidades diárias e distribuição por refeição.

Essa regra evita cards inválidos do plano anterior na tela Hoje sem apagar ações já registradas pelo tutor.


## ✅ Temas visuais de marca no MVP

O MVP oferece duas variações cromáticas da mesma identidade visual:

- **Clínica Serena** — tema padrão, com base porcelana, teal e damasco;
- **Editorial Acolhedora** — alternativa com base creme, ameixa e pêssego.

Regras:

- os temas não representam modo claro e escuro;
- não alteram funcionalidades, permissões ou o papel do usuário;
- o seletor fica na barra superior, próximo ao avatar;
- a preferência é persistida inicialmente no dispositivo;
- a interface mantém a mesma estrutura, tipografia, componentes e linguagem nos dois temas;
- a tipografia principal do produto passa a ser **Manrope**;
- cores de estado preservam significado sem depender apenas da cor.

A existência dos dois temas no MVP serve também como instrumento de aprendizado antes da definição final da identidade visual.
