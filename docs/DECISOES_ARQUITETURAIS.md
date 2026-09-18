# DECISOES_ARQUITETURAIS.md


> Documento de decisões permanentes do projeto.


Versão do documento: 1.3


## Filosofia
- Evolução incremental.
- Priorizar estabilidade.
- Evitar regressões.
- Discutir arquitetura antes da implementação.
- Trabalhar sempre sobre o código-fonte mais recente disponível no Google Drive, sincronizado com o repositório.


## Regras de negócio
- Histórico nunca é alterado.
- Apenas refeições pendentes podem ser recriadas/removidas.
- Troca de plano remove somente ocorrências pendentes.


## Notificações
- Agrupadas por tutor + horário.
- Uma notificação por horário.
- Deep link para "Hoje".
- Timezone por usuário.
- TTL ~30 minutos.


## Professional Pilot
- A experiência Tutor Solo permanece estruturalmente independente das tabelas profissionais.
- `pets.id` identifica o animal globalmente; `professional_patients.id` identifica um episódio/caso profissional.
- `professional_relationships.professional_patient_id` representa o patient canônico daquele episódio de acompanhamento.
- Quando um novo patient/convite encontra o mesmo pet já acompanhado pelo mesmo profissional, o patient ativo e estruturalmente íntegro permanece canônico.
- O patient redundante é preservado para auditoria como `closed/duplicate` e aponta para o canônico por `duplicate_of_patient_id`.
- O convite redundante termina como `resolved`, não `accepted`, porque nenhuma nova autorização é criada.
- O caminho de duplicata não cria novo pet, relationship nem `weight_entry`; peso inicial do cadastro redundante permanece apenas como snapshot.
- Estados incoerentes entre patient e relationship não são reparados automaticamente durante o aceite; devem gerar erro de integridade.
- Integridade não depende da prevenção no frontend: locks, constraints e índices do banco continuam sendo a proteção final.
- Raw token de convite não é persistido no frontend nem no banco; o banco armazena apenas `token_hash`.


## Infraestrutura
- React + Vite + Supabase + OneSignal.
- Não alterar Edge Function sem necessidade.
- "from Rotina Pet" no iOS é limitação do Web Push.
- Ícones da PWA mantêm nomes e caminhos estáveis.
- Não criar cópias versionadas de ícones apenas para contornar cache do iOS; em instalações antigas, orientar reinstalação quando necessária.


## Releases
- Entregar apenas arquivos modificados.
- Preservar estrutura de pastas.
- Incluir CHANGELOG.md.
- Migrações SQL em arquivo separado.


## Manutenção da documentação


A documentação faz parte do projeto.


Ao gerar uma nova release, o ChatGPT deve:
- atualizar apenas os documentos afetados;
- informar exatamente quais documentos precisam ser substituídos no Projeto;
- evitar duplicação entre os documentos.


Responsabilidades:
- DECISOES_ARQUITETURAIS.md → decisões permanentes.
- ROTINA_PET_CONTEXTO.md → estado atual.
- ROTINA_PET_CHANGELOG.md → histórico de releases.