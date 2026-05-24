import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ygqhyjqljodshlktunqu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlncWh5anFsam9kc2hsa3R1bnF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyODQzMDUsImV4cCI6MjA5NDg2MDMwNX0.LqMkaAGy4iyXZVo2b-NKe6_RB-Gzuzxo8AvnHleniyc';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data: vendas, error: errV } = await supabase
    .from('vendas')
    .select('id, data, created_at, funcionario_id, preco_vendido, profiles(nome)')
    .limit(10);
  if (errV) {
    console.error("Erro vendas:", errV);
  } else {
    console.log("Vendas:", JSON.stringify(vendas, null, 2));
  }

  const { data: profiles, error: errP } = await supabase
    .from('profiles')
    .select('id, nome, role, ativo');
  if (errP) {
    console.error("Erro profiles:", errP);
  } else {
    console.log("Profiles:", JSON.stringify(profiles, null, 2));
  }
}
run();
