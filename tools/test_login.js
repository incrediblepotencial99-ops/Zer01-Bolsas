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

const testEmail = "inexistente@zero1test.com";
const testPassword = "senha123";

console.log(`Tentando efetuar login para: ${testEmail}...`);

async function run() {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });

    if (error) {
      console.error("❌ Erro no login retornado pelo Supabase:");
      console.error(error);
      process.exit(1);
    }

    console.log("✅ Login efetuado com sucesso programaticamente!");
    console.log("User ID:", data.user?.id);
    console.log("Email:", data.user?.email);
    console.log("Session token length:", data.session?.access_token.length);

    // Buscar perfil
    console.log("Buscando perfil correspondente na tabela profiles...");
    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profErr) {
      console.error("❌ Erro ao ler a tabela profiles com o token do usuário logado:");
      console.error(profErr);
    } else {
      console.log("✅ Perfil recuperado com sucesso!");
      console.log(profile);
    }

  } catch (err) {
    console.error("❌ Erro inesperado durante o teste de login:");
    console.error(err);
  }
}

run();
