# 📜 Constituição do Projeto: Zero 1

Este documento define os invariantes, regras comportamentais e esquemas de dados da aplicação **Zero 1**. Ele é a lei máxima do projeto e não deve ser alterado sem justificativa de mudança arquitetural.

---

## 🎯 Regras Comportamentais

1. **Camadas Técnicas (A.N.T.):**
   * **Camada 1 (Arquitetura):** POPs em markdown descrevem a lógica de negócios e as instruções técnicas.
   * **Camada 2 (Navegação):** O modelo orquestra os dados e decide quais ferramentas chamar.
   * **Camada 3 (Ferramentas):** Scripts Python ou blocos de código atômicos e testáveis.
2. **Protocolo VLAEG (n8n-mcp Overwrite Guard):**
   * Nunca atualizar um workflow do n8n inteiro de forma automatizada por código. 
   * Apenas instruir o usuário ou fornecer JSON de nós isolados para edição manual, preservando as customizações dele.
3. **Padrão Estético (Taste & Style):**
   * Tema escuro profundo com base em `#1A1A2E`.
   * Destaques de marca em dourado `#C9A84C`.
   * Layout responsivo (mobile-first), com micro-animações suaves e design premium.

---

## 🗄️ Esquema de Dados (Database Schema - Supabase)

### Perfis de Usuário (`profiles`)
```sql
create table profiles (
  id uuid references auth.users primary key,
  nome text not null,
  role text check (role in ('admin','funcionario')) default 'funcionario',
  telefone text,
  ativo boolean default true,
  created_at timestamptz default now()
);
```

### Bolsas / Produtos (`bolsas`)
```sql
create table bolsas (
  id uuid primary key default gen_random_uuid(),
  codigo text unique not null,        -- código da etiqueta/OCR
  nome text not null,
  marca text,
  cor text,
  tamanho text,
  material text,
  foto_url text,                       -- URL da foto no Supabase Storage
  preco_custo numeric(10,2),
  preco_venda numeric(10,2) not null,
  preco_desconto numeric(10,2),        -- preço promocional (null = sem desconto)
  desconto_ativo boolean default false,
  quantidade int default 0,
  quantidade_minima int default 1,
  status text check (status in ('disponivel','vendida','trocada','reservada')) default 'disponivel',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### Entradas de Estoque (`entradas`)
```sql
create table entradas (
  id uuid primary key default gen_random_uuid(),
  bolsa_id uuid references bolsas(id),
  quantidade int not null,
  preco_custo numeric(10,2),
  data date default current_date,
  funcionario_id uuid references profiles(id),
  observacao text,
  created_at timestamptz default now()
);
```

### Clientes (`clientes`)
```sql
create table clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text,
  email text,
  cpf text unique,
  created_at timestamptz default now()
);
```

### Vendas (`vendas`)
```sql
create table vendas (
  id uuid primary key default gen_random_uuid(),
  bolsa_id uuid references bolsas(id),
  cliente_id uuid references clientes(id),
  funcionario_id uuid references profiles(id),
  preco_vendido numeric(10,2) not null,
  tinha_desconto boolean default false,
  desconto_valor numeric(10,2),
  data date default current_date,
  observacao text,
  created_at timestamptz default now()
);
```

### Trocas (`trocas`)
```sql
create table trocas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id),
  bolsa_devolvida_id uuid references bolsas(id),
  bolsa_nova_id uuid references bolsas(id),
  funcionario_id uuid references profiles(id),
  motivo text,
  diferenca_valor numeric(10,2) default 0,
  status text check (status in ('pendente','concluida','cancelada')) default 'pendente',
  data date default current_date,
  created_at timestamptz default now()
);
```

---

## 🔒 Invariantes de Segurança & RLS (Row Level Security)

* RLS ativado em todas as tabelas.
* Apenas usuários com `role = 'admin'` na tabela `profiles` podem realizar operações de gravação (insert, update, delete) em `bolsas` e gerenciar contas de funcionários.
* Funcionários têm permissão de leitura em `bolsas` e permissão de escrita e leitura em `vendas`, `trocas`, `entradas` e `clientes`.
