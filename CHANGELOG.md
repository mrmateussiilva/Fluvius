# Changelog
Todas as mudanças notáveis para o projeto **Fluvius** serão documentadas neste arquivo.

O formato é baseado no [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/) e este projeto segue o [Versionamento Semântico](https://semver.org/spec/v2.0.0.html).

---

## [1.2.9] - 2026-05-21

### Adicionado
- **Integração Compacta do Copiloto**: Painel do Copiloto agora possui uma variante `compact` e foi movido para dentro da barra de navegação/menu lateral esquerdo (tanto na visualização colapsada quanto expandida).
- **Separadores de Data Dinâmicos**: O histórico de mensagens agora agrupa conversas exibindo rótulos como "Hoje", "Ontem" ou "21 de maio" no estilo do WhatsApp Web.
- **Identidade do Contato no Header**: O número de telefone do contato agora é exibido abaixo do nome na conversa ativa se for diferente do nome.

### Modificado
- **Redesign Visual do Chat**: Fundo do chat ajustado para o clássico doodle do WhatsApp Web (`#efeae2`), e bolhas de mensagem atualizadas com sombras sutis e cantos arredondados fiéis à identidade do aplicativo.
- **Visual de Empty State**: A tela inicial exibida antes de escolher uma conversa foi inteiramente redesenhada com ícones da identidade visual do WhatsApp, dicas de atalho para respostas rápidas e rodapé de privacidade.
- **Segurança de Mídia (CORS)**: Remoção do parâmetro `crossOrigin="anonymous"` de todos os elementos de mídia (`<audio>`, `<video>` e `<img>`), garantindo que áudios, imagens e mídias de servidores externos (como a Evolution API) toquem e carreguem nativamente sem restrições de domínios.

### Corrigido
- **Navegação Sem Reload**: O `AgentProvider` foi movido para o escopo global no `App.tsx` para evitar que a troca de páginas (ex: Inbox para Configurações) destrua o estado global do agente e recarregue toda a página.
- **Preservação de Scroll**: A lógica de scroll automático na área de mensagens foi aprimorada para preservar a posição do scroll ao ler conversas antigas no histórico, ativando a rolagem até o final de maneira inteligente apenas na abertura de chats ou novas mensagens recebidas.
- **Mensagens Internas Indesejadas**: O `CopilotService` no backend foi ajustado para não inserir notas internas automáticas no histórico da conversa, enviando apenas notificações em tempo real pelo WebSocket.
- **Problema de Parse no Vite (Vite OXC)**: Correção de caracteres e formatação em strings do JSX (como caminhos e barras) que confundiam o compilador e geravam erros de regex inacabados (`Unterminated regular expression`).
