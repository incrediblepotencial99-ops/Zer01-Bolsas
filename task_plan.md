# 📅 Plano de Tarefas: Zero 1

Plano de desenvolvimento do Sistema de Estoque de Bolsas baseado no protocolo **V.L.A.E.G.**

---

## Checklist de Fases

- [x] **Fase 0: Inicialização (Atual)**
  - [x] Ler os documentos fornecidos pelo usuário (`protocolo_vlaeg.md` e `Zero1_Planejamento_Projeto.docx`).
  - [x] Criar arquivos de memória (`gemini.md`, `task_plan.md`, `findings.md`, `progress.md`).
  - [x] Validar as **5 Perguntas de Descoberta** com o usuário.
  - [x] Obter aprovação do Blueprint inicial de execução.

- [x] **Fase 1: V - Visão (Definições)**
  - [x] Consolidar chaves e configurações em `.env`.
  - [x] Definir o design system visual completo (Paleta `#1A1A2E` + Dourado `#C9A84C`).
  - [x] Mapear as rotas da aplicação web React/Vite.

- [x] **Fase 2: L - Link (Conexões)**
  - [x] Testar credenciais e conectividade com o Supabase.
  - [x] Executar script de teste de conexão com o banco de dados.

- [x] **Fase 3: A - Arquitetura (Construção)**
  - [x] Criar estrutura do projeto Frontend React/Vite no diretório `./` (mobile-first).
  - [x] Criar as tabelas no Supabase através do editor SQL.
  - [x] Configurar o Supabase Storage (bucket público `bolsas-fotos`).
  - [x] Implementar a autenticação de usuários (Admin e Funcionário) integrada ao Supabase.
  - [x] Desenvolver as páginas da aplicação:
    - [x] Login (redirecionamento com base em `role`).
    - [x] Dashboard (Admin - relatórios de estoque, vendas e descontos).
    - [x] Estoque (lista com busca por código, filtros e fotos).
    - [x] Nova Entrada (Integração de câmera + Upload de Imagem + OCR de código de barras/texto).
    - [x] Registrar Venda.
    - [x] Registrar Troca.
    - [x] Gerenciamento de Clientes.
    - [x] Controle de Descontos (Admin).
    - [x] Relatórios e Gerenciamento de Funcionários (Admin).

- [x] **Fase 4: E - Estilo (UI/UX Premium)**
  - [x] Refinar CSS/HTML com paletas refinadas HSL e transições suaves.
  - [x] Adicionar micro-animações interativas e otimizar para experiência de smartphone (mobile-first).

- [x] **Fase 5: G - Gatilho (Implantação e Entregas)**
  - [x] Realizar testes de ponta a ponta (login -> entrada -> venda -> troca).
  - [x] Documentar o log de manutenção final no `gemini.md`.
