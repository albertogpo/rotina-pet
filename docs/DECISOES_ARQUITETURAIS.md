# DECISOES_ARQUITETURAIS.md

> Documento de decisões permanentes do projeto.

Versão do documento: 1.1

## Filosofia
- Evolução incremental.
- Priorizar estabilidade.
- Evitar regressões.
- Discutir arquitetura antes da implementação.
- Trabalhar sempre sobre o código-fonte mais recente fornecido pelo usuário.

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

## Infraestrutura
- React + Vite + Supabase + OneSignal.
- Não alterar Edge Function sem necessidade.
- "from Rotina Pet" no iOS é limitação do Web Push.

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
