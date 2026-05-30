-- 1. Criar a tabela de mensagens de chat
CREATE TABLE IF NOT EXISTS mensagens_chat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  remetente_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  loja_id uuid REFERENCES lojas(id) ON DELETE SET NULL,
  texto text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 2. Habilitar RLS (Row Level Security)
ALTER TABLE mensagens_chat ENABLE ROW LEVEL SECURITY;

-- 3. Criar Políticas RLS
CREATE POLICY "Permitir leitura para usuários autenticados" 
ON mensagens_chat FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Permitir inserção para usuários autenticados" 
ON mensagens_chat FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = remetente_id);

-- 4. Adicionar coluna de status de presença na tabela de perfis (opcional, para persistência)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status_presenca text DEFAULT 'online' CHECK (status_presenca IN ('online', 'ocupado', 'offline'));

-- 5. Habilitar replicação em tempo real (Realtime) para a tabela mensagens_chat
alter publication supabase_realtime add table mensagens_chat;
