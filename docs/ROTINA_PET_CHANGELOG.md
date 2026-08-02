# ROTINA_PET_CHANGELOG.md


> Histórico cronológico de releases.


Versão do documento: 1.6


> Atualizar este arquivo a cada release.
> O ChatGPT deve informar quando esta nova versão precisar substituir a anterior no Projeto.


## Modelo
- Objetivo
- Arquivos modificados
- Migração SQL
- Status (Gerado / Publicado / Testado / Confirmado)


## Histórico


### v0.7.6
- **Objetivo:** eliminar o recarregamento visual da tela Hoje ao registrar refeições e preservar o contexto de rolagem do tutor.
- **Experiência:** concluir, alterar ou desfazer uma refeição atualiza a ocorrência sem desmontar a tela; o grupo do horário permanece na mesma posição quando o card se fecha.
- **Navegação:** adicionado botão flutuante discreto para voltar ao topo, exibido somente após rolagem longa e posicionado acima da navegação inferior no celular.
- **Implementação:** atualização local imediata seguida de sincronização silenciosa com o servidor; mantidos o deep link, o destaque de horários e o carregamento global nos fluxos que realmente trocam o conteúdo da tela.
- **Arquivos modificados:** `src/App.tsx`, `src/components/TodayPage.tsx`, `src/styles.css`, `package.json`, `package-lock.json`, `README.md`, `docs/00_PRODUCT_FOUNDATION.md`, `docs/ROTINA_PET_CHANGELOG.md` e `docs/ROTINA_PET_CONTEXTO.md`.
- **Arquivo criado:** `docs/01_RELEASE_v0.7.6.md`.
- **Migração SQL:** não necessária.
- **Status:** implementação e documentação atualizadas no código-fonte; build, deploy e validação visual ainda devem ser confirmados.

### v0.7.5
- **Objetivo:** corrigir o aproveitamento horizontal do card Hoje no desktop e personalizar a notificação de boas-vindas do opt-in.
- **Interface:** o grid interno do card Hoje passa a ocupar toda a largura disponível; os botões de horário permanecem compactos e o scroll horizontal é preservado.
- **Notificações:** `welcomeNotification` foi configurada no `OneSignal.init` com título e mensagem alinhados ao tom de voz da marca.
- **Arquivos modificados:** `src/App.tsx`, `src/lib/push.ts`, `src/styles.css`, `package.json`, `package-lock.json`, `README.md`, `docs/00_PRODUCT_FOUNDATION.md`, `docs/ROTINA_PET_CHANGELOG.md` e `docs/ROTINA_PET_CONTEXTO.md`.
- **Arquivo criado:** `docs/01_RELEASE_v0.7.5.md`.
- **Migração SQL:** não necessária.
- **Status:** implementação gerada e arquivos-fonte atualizados; build, deploy e validação visual ainda devem ser confirmados.

### v0.7.4
- **Objetivo:** restaurar o scroll vertical da página no desktop.
- **Causa:** `overflow-y:auto` aplicado simultaneamente em `html` e `body`, criando dois contêineres de rolagem concorrentes no Chrome desktop.
- **Arquivos modificados:** `src/App.tsx`, `src/styles.css`, `package.json`, `package-lock.json`, `README.md`, `docs/ROTINA_PET_CHANGELOG.md` e `docs/ROTINA_PET_CONTEXTO.md`.
- **Arquivo criado:** `docs/01_RELEASE_v0.7.4.md`.
- **Migração SQL:** não necessária.
- **Validação:** teste automatizado em Chromium confirmou o retorno do scroll vertical; build/deploy no GitHub deve ser confirmado.
- **Manutenção:** lockfile normalizado para o registro público e salvo sem BOM.

### v0.7.3
- **Objetivo:** corrigir a sobreposição visual da barra de status, ampliar o espaçamento do cabeçalho e restaurar a navegação horizontal dos horários no desktop.
- **Arquivos modificados:** `src/App.tsx`, `src/components/TodayPage.tsx`, `src/styles.css`, `package.json`, `package-lock.json`, `.github/workflows/deploy-pages.yml`, `README.md`, `docs/ROTINA_PET_CHANGELOG.md` e `docs/ROTINA_PET_CONTEXTO.md`.
- **Arquivo criado:** `docs/01_RELEASE_v0.7.3.md`.
- **Migração SQL:** não necessária.
- **Status:** build da v0.7.3 confirmado pelo usuário; publicação/deploy final deve ser confirmada separadamente.
- **Correção do build:** o workflow normaliza no runner as URLs do proxy npm interno para o registro público e usa apenas `npm ci`; o fallback para pnpm foi removido.
- **Segunda correção do build:** o `package.json` continha BOM UTF-8; o arquivo foi salvo sem BOM e o workflow passou a validar e normalizar o encoding dos JSONs antes da instalação.
- **Pendência técnica:** regenerar o `package-lock.json` diretamente em um ambiente público para eliminar as URLs internas do arquivo-fonte, embora o deploy já não dependa disso.
- **Escopo não incluído:** restauração de alimentos arquivados.


### v0.7.2
- **Objetivo:** priorizar visualmente a próxima refeição e refinar cabeçalho, seletor de fuso e atualização dos ícones da PWA.
- **Arquivos modificados:** `src/components/TodayPage.tsx`, `src/components/SettingsPage.tsx`, `src/App.tsx`, `src/styles.css`, `index.html`, `vite.config.ts`, `package.json`, `package-lock.json`, `README.md`, `docs/ROTINA_PET_CHANGELOG.md` e `docs/ROTINA_PET_CONTEXTO.md`.
- **Arquivo criado:** `docs/01_RELEASE_v0.7.2.md`.
- **Migração SQL:** não necessária.
- **Status:** gerado e salvo no código-fonte; publicação e validação visual no iOS devem ser confirmadas.
- **Correção antes da publicação:** os ícones voltaram a usar nomes estáveis; as cópias `*-v072.png` foram descartadas.
- **Ajuste de interface:** o fundo da barra de status foi limitado à safe area para não sobrepor o cabeçalho.
- **Correção de asset:** o logo do cabeçalho deixou de apontar para `icon-192-v072.png` removido e voltou a usar `icon-192.png`; os demais ícones foram auditados sem novas referências quebradas.
- **Polimento do cabeçalho:** o degradê foi encurtado e movido para trás do conteúdo; o gap entre o seletor de tema e o avatar aumentou no mobile.
- **Limitação documentada:** alimentos arquivados ainda não possuem restauração pela interface.


### v0.7.1
- Auto-scroll da faixa de horários planejado, mas a versão não foi salva/publicada separadamente. A alteração foi incorporada à v0.7.2.


### v0.7.0
- Navegação diária, pendências de ontem, seletor completo de fusos, toggle de notificações e nova identidade de ícones.


### v0.6.5
- Temas Clínica Serena e Editorial Acolhedora, tipografia Manrope e refinamentos de identidade visual.


### v0.6.1
Infraestrutura de notificações estabilizada.


### v0.6.2
Correções planejadas para troca de planos e horários. Status a confirmar.


### v0.6.3
Melhorias visuais planejadas. Status a confirmar.


### v0.6.4
Pull-to-refresh recarregando o index.html. Status a confirmar.