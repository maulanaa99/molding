/**
 * Database Switcher Script for Molding MMS
 * Usage:
 *   node scripts/switch-db.js local     (switches to local SQLite dev.db)
 *   node scripts/switch-db.js cloud     (switches to cloud Supabase PostgreSQL)
 *   node scripts/switch-db.js status    (shows current active database)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const PRISMA_DIR = path.join(ROOT_DIR, 'prisma');
const SCHEMA_FILE = path.join(PRISMA_DIR, 'schema.prisma');
const SCHEMA_SQLITE = path.join(PRISMA_DIR, 'schema.sqlite.prisma');
const SCHEMA_POSTGRES = path.join(PRISMA_DIR, 'schema.postgresql.prisma');
const ENV_FILE = path.join(ROOT_DIR, '.env');

const CLOUD_DATABASE_URL =
  'postgresql://postgres.elyzxtuljyvagddhrclt:Bandungcoolz2.@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true';
const LOCAL_DATABASE_URL = 'file:./dev.db';

const target = (process.argv[2] || 'status').toLowerCase();

function getEnvContent() {
  if (!fs.existsSync(ENV_FILE)) {
    return 'AUTH_SECRET="mms-molding-traceability-secret-2026-key"\n';
  }
  return fs.readFileSync(ENV_FILE, 'utf8');
}

function updateEnv(newDbUrl) {
  let env = getEnvContent();
  if (env.includes('DATABASE_URL=')) {
    env = env.replace(/DATABASE_URL=.*/, `DATABASE_URL="${newDbUrl}"`);
  } else {
    env = `DATABASE_URL="${newDbUrl}"\n` + env;
  }
  fs.writeFileSync(ENV_FILE, env, 'utf8');
}

function getCurrentStatus() {
  let provider = 'unknown';
  let dbUrl = 'unknown';

  if (fs.existsSync(SCHEMA_FILE)) {
    const content = fs.readFileSync(SCHEMA_FILE, 'utf8');
    const match = content.match(/provider\s*=\s*"([^"]+)"/);
    if (match) provider = match[1];
  }

  if (fs.existsSync(ENV_FILE)) {
    const env = fs.readFileSync(ENV_FILE, 'utf8');
    const match = env.match(/DATABASE_URL="?([^"\n]+)"?/);
    if (match) dbUrl = match[1];
  }

  return { provider, dbUrl };
}

function ensureBaseSchemas() {
  if (!fs.existsSync(SCHEMA_FILE)) {
    console.error('Error: prisma/schema.prisma not found!');
    process.exit(1);
  }

  const currentContent = fs.readFileSync(SCHEMA_FILE, 'utf8');

  // If postgres schema doesn't exist, generate from current
  if (!fs.existsSync(SCHEMA_POSTGRES)) {
    const pgContent = currentContent.replace(
      /provider\s*=\s*"[^"]+"/,
      'provider = "postgresql"'
    );
    fs.writeFileSync(SCHEMA_POSTGRES, pgContent, 'utf8');
    console.log('[INIT] Created prisma/schema.postgresql.prisma');
  }

  // If sqlite schema doesn't exist, generate from current
  if (!fs.existsSync(SCHEMA_SQLITE)) {
    const sqliteContent = currentContent.replace(
      /provider\s*=\s*"[^"]+"/,
      'provider = "sqlite"'
    );
    fs.writeFileSync(SCHEMA_SQLITE, sqliteContent, 'utf8');
    console.log('[INIT] Created prisma/schema.sqlite.prisma');
  }
}

if (target === 'local' || target === 'sqlite' || target === 'dev') {
  ensureBaseSchemas();
  console.log('\n======================================================');
  console.log('🔄 Mengalihkan database ke: LOKAL (SQLite)');
  console.log('======================================================');

  // 1. Copy SQLite schema
  fs.copyFileSync(SCHEMA_SQLITE, SCHEMA_FILE);
  console.log('✓ prisma/schema.prisma diset ke SQLite');

  // 2. Update .env
  updateEnv(LOCAL_DATABASE_URL);
  console.log(`✓ .env DATABASE_URL diset ke: ${LOCAL_DATABASE_URL}`);

  // 3. Regenerate Prisma Client
  console.log('⏳ Menjalankan `npx prisma generate`...');
  try {
    execSync('npx prisma generate', { cwd: ROOT_DIR, stdio: 'inherit' });
    console.log('\n✅ BERHASIL: Sistem sekarang menggunakan SQLite LOKAL (prisma/dev.db)');
    console.log('   Jalankan: `npm run dev` untuk pengembangan cepat & offline.\n');
  } catch (err) {
    console.error('❌ Gagal menjalankan prisma generate:', err.message);
    process.exit(1);
  }
} else if (
  target === 'cloud' ||
  target === 'supabase' ||
  target === 'postgres' ||
  target === 'prod'
) {
  ensureBaseSchemas();
  console.log('\n======================================================');
  console.log('🔄 Mengalihkan database ke: CLOUD (Supabase PostgreSQL)');
  console.log('======================================================');

  // 1. Copy PostgreSQL schema
  fs.copyFileSync(SCHEMA_POSTGRES, SCHEMA_FILE);
  console.log('✓ prisma/schema.prisma diset ke PostgreSQL');

  // 2. Update .env
  updateEnv(CLOUD_DATABASE_URL);
  console.log(`✓ .env DATABASE_URL diset ke Cloud Supabase Pooler`);

  // 3. Regenerate Prisma Client
  console.log('⏳ Menjalankan `npx prisma generate`...');
  try {
    execSync('npx prisma generate', { cwd: ROOT_DIR, stdio: 'inherit' });
    console.log('\n✅ BERHASIL: Sistem sekarang menggunakan CLOUD SUPABASE (PostgreSQL)');
    console.log('   Host: aws-1-ap-southeast-2.pooler.supabase.com:6543');
    console.log('   Siap untuk Vercel / Production deployment.\n');
  } catch (err) {
    console.error('❌ Gagal menjalankan prisma generate:', err.message);
    process.exit(1);
  }
} else {
  // Show status
  const { provider, dbUrl } = getCurrentStatus();
  console.log('\n======================================================');
  console.log('📊 STATUS DATABASE AKTIF SAAT INI');
  console.log('======================================================');
  console.log(`- Provider Prisma : ${provider}`);
  console.log(`- Connection URL  : ${dbUrl}`);

  if (provider === 'sqlite' || dbUrl.startsWith('file:')) {
    console.log('- Mode Aktif      : 🟢 LOKAL (SQLite dev.db)');
  } else if (provider === 'postgresql' || dbUrl.includes('supabase')) {
    console.log('- Mode Aktif      : ☁️  CLOUD (Supabase PostgreSQL)');
  } else {
    console.log('- Mode Aktif      : ❓ Unknown / Custom');
  }

  console.log('------------------------------------------------------');
  console.log('Perintah perpindahan cepat:');
  console.log('  npm run db:local   -> Beralih ke SQLite lokal (offline)');
  console.log('  npm run db:cloud   -> Beralih ke Supabase PostgreSQL cloud');
  console.log('  npm run db:status  -> Cek database yang sedang aktif\n');
}
