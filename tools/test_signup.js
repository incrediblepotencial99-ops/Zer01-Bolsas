import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read .env manually
const envPath = join(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing environment variables!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const testEmail = `teste-${Date.now()}@zero1test.com`;
const testPassword = "SenhaTeste123!";

console.log(`Tentando criar conta de teste para: ${testEmail}...`);

async function run() {
  try {
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          nome: "Administrador Teste",
          telefone: "11999999999"
        }
      }
    });

    if (error) {
      console.error("❌ Erro retornado pelo Auth do Supabase:");
      console.error(error);
      process.exit(1);
    }

    console.log("✅ Cadastro no Auth com sucesso!");
    console.log("User ID:", data.user?.id);
    console.log("Session:", data.session ? "Ativa" : "Pendente de confirmação");

    // Verificar se o profile correspondente foi criado no banco
    console.log("Buscando profile criado na tabela public.profiles...");
    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profErr) {
      console.error("❌ Erro ao ler a tabela profiles:");
      console.error(profErr);
    } else if (profile) {
      console.log("✅ Profile encontrado com sucesso no banco de dados!");
      console.log(profile);
    } else {
      console.warn("⚠️ O cadastro no Auth funcionou, mas o perfil correspondente NÃO foi encontrado em public.profiles. O trigger pode ter falhado.");
    }

  } catch (err) {
    console.error("❌ Erro inesperado:");
    console.error(err);
  }
}

run();
