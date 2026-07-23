# Rotina Pet v0.6.4

## Atualização

- O gesto de puxar para atualizar agora remove apenas o service worker principal da PWA, preservando o worker do OneSignal.
- Em seguida, abre novamente a página com um parâmetro exclusivo, forçando a busca do `index.html` publicado no servidor em vez de reutilizar a versão em cache.
- Na nova carga, o service worker da PWA é registrado novamente automaticamente.
