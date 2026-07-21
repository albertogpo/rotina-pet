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

Evitar termos como:

- administrada

Preferir:

- Concluída
- Pendente
- Atrasada
- Não realizada

---

# 6. Funcionalidades do Tutor

## 📅 Capacidades

- Cadastro de pets
- Cadastro de alimentos
- Plano alimentar
- Múltiplos alimentos por refeição
- Lembretes
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

## 🧪 Hipótese

Registrar consumo parcial.

Possíveis abordagens:

- porcentagem;
- quantidade em gramas;
- níveis aproximados de consumo.

Precisamos validar com veterinários.

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
