# 🔍 Descobertas e Pesquisas: Zero 1

Compilado de informações e decisões técnicas coletadas para o desenvolvimento do sistema **Zero 1**.

---

## 💡 Informações Coletadas do Planejamento

1. **OCR / Reconhecimento de Código:**
   * O sistema requer que o funcionário possa usar a câmera do celular para ler a etiqueta da bolsa.
   * Alternativas: **Tesseract.js** (executado no cliente/navegador) ou a API nativa do dispositivo para leitura de código de barras/QR Code.
   * Como a aplicação será Web rodando em dispositivos móveis, utilizaremos bibliotecas JavaScript robustas executadas no navegador (como `html5-qrcode` para ler códigos de barras/QR Code, e `tesseract.js` como fallback para ler texto plano da etiqueta).

2. **Supabase & Storage:**
   * As fotos das bolsas serão salvas no Supabase Storage em um bucket público chamado `bolsas-fotos`.
   * Chaves e conexões do Supabase configuradas em variáveis locais (`.env`).

3. **Perfis de Usuário:**
   * `admin` -> Acesso a relatórios financeiros, controle de descontos, gerenciamento de funcionários.
   * `funcionario` -> Acesso a entradas via câmera, vendas, trocas, busca de estoque e clientes.
   * Ambos os acessos são validados pelas regras de segurança RLS aplicadas no banco de dados.

4. **Visual:**
   * Tema escuro com base `#1A1A2E` e detalhes em ouro `#C9A84C`.
