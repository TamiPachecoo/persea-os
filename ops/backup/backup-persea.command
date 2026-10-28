#!/bin/bash
# Backup mensal da plataforma PERSEA (banco de dados + arquivos), num disco
# criptografado (.dmg, AES-256) guardado fora do Supabase. Para usar: dê dois
# cliques neste arquivo no Mac. Instruções completas em LEIA-ME.md.
set -euo pipefail
cd "$(dirname "$0")"

CONFIG="$HOME/.persea-backup.env"
KEYCHAIN_ITEM="persea-backup"
PROJECT_URL="https://bletlyuptkppacjcbcvw.supabase.co"
KEEP=12   # quantos backups manter na pasta de destino

say() { printf '\n\033[1m%s\033[0m\n' "$1"; }
fail() { printf '\n\033[31m%s\033[0m\n' "$1"; read -r -p "Pressione Enter para fechar." _; exit 1; }

# pg_dump 17+ (Homebrew: brew install libpq)
PG_DUMP=""
for p in /opt/homebrew/opt/libpq/bin/pg_dump /usr/local/opt/libpq/bin/pg_dump "$(command -v pg_dump || true)"; do
  [ -n "$p" ] && [ -x "$p" ] && PG_DUMP="$p" && break
done
[ -n "$PG_DUMP" ] || fail "Falta o pg_dump. Instale com:  brew install libpq   e rode de novo."
PG_MAJOR=$("$PG_DUMP" --version | sed -E 's/[^0-9]*([0-9]+).*/\1/')
[ "$PG_MAJOR" -ge 17 ] || fail "O pg_dump é a versão $PG_MAJOR; o banco usa a 17. Rode:  brew upgrade libpq"
command -v python3 >/dev/null || fail "Falta o python3. Instale as ferramentas do Xcode:  xcode-select --install"

# Primeira vez: pergunta e guarda a configuração (só você consegue ler o arquivo).
if [ ! -f "$CONFIG" ]; then
  say "Primeira configuração do backup PERSEA"
  echo "1) Supabase → Connect → Session pooler → copie a URI (troque [YOUR-PASSWORD] pela senha do banco)."
  read -r -p "   URI do banco: " DB_URL
  echo "2) Supabase → Project Settings → API Keys → Secret key (começa com sb_secret_)."
  read -r -s -p "   Secret key: " SECRET; echo
  echo "3) Pasta onde guardar os backups (ex.: a pasta do Google Drive no Finder). Pode arrastar a pasta para cá."
  read -r -p "   Pasta: " DEST
  DEST="${DEST%/}"; DEST="${DEST//\\ / }"; DEST="${DEST#\'}"; DEST="${DEST%\'}"
  umask 077
  printf 'DB_URL=%q\nSUPABASE_SECRET_KEY=%q\nDEST=%q\n' "$DB_URL" "$SECRET" "$DEST" > "$CONFIG"
  echo "   Configuração salva em $CONFIG"
fi
# shellcheck disable=SC1090
source "$CONFIG"
[ -d "$DEST" ] || fail "A pasta de destino não existe: $DEST  (apague $CONFIG para configurar de novo)"

# Senha do disco criptografado: fica no Chaves (Keychain) do Mac.
PASS=$(security find-generic-password -s "$KEYCHAIN_ITEM" -w 2>/dev/null || true)
if [ -z "$PASS" ]; then
  say "Crie a senha dos backups"
  echo "Ela abre todos os backups. Guarde também no seu gerenciador de senhas: sem ela, não há como abrir os arquivos."
  read -r -s -p "   Senha: " P1; echo
  read -r -s -p "   Repita: " P2; echo
  [ -n "$P1" ] && [ "$P1" = "$P2" ] || fail "As senhas não conferem."
  security add-generic-password -s "$KEYCHAIN_ITEM" -a "$USER" -w "$P1"
  PASS="$P1"
fi

STAMP=$(date +%Y-%m-%d)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/PERSEA-backup-$STAMP"
OUT="$WORK/PERSEA-backup-$STAMP"

say "1/3 Banco de dados"
"$PG_DUMP" "$DB_URL" --format=custom --no-owner --no-privileges \
  --schema=public --schema=private --schema=auth --schema=storage \
  --file="$OUT/banco.dump" 2>"$WORK/pg.err" || {
    # Some Supabase-managed schemas can refuse a read; keep the app's own data.
    echo "  Aviso: cópia completa falhou ($(head -1 "$WORK/pg.err")). Copiando só os dados da plataforma."
    "$PG_DUMP" "$DB_URL" --format=custom --no-owner --no-privileges --schema=public --schema=private \
      --file="$OUT/banco.dump" || fail "Não foi possível copiar o banco. Confira a URI e a senha em $CONFIG."
  }
"$PG_DUMP" "$DB_URL" --schema-only --no-owner --no-privileges \
  --schema=public --schema=private --file="$OUT/estrutura.sql" || true
echo "  banco.dump: $(du -h "$OUT/banco.dump" | cut -f1)"

say "2/3 Arquivos (fotos, contratos, documentos)"
SUPABASE_URL="$PROJECT_URL" SUPABASE_SECRET_KEY="$SUPABASE_SECRET_KEY" \
  python3 baixar_arquivos.py "$OUT/arquivos" || fail "Os arquivos não baixaram por completo (veja acima)."

cat > "$OUT/LEIA-ME.txt" <<TXT
Backup da plataforma PERSEA de $STAMP.
banco.dump    banco de dados completo (restaurar com pg_restore --no-owner --no-privileges -d <URI> banco.dump)
estrutura.sql só a estrutura das tabelas, para consulta
arquivos/     fotos, contratos e documentos, uma pasta por bucket
TXT

say "3/3 Criptografando e guardando"
DMG="$DEST/PERSEA-backup-$STAMP.dmg"
rm -f "$DMG"
printf '%s' "$PASS" | hdiutil create -quiet -encryption AES-256 -stdinpass -fs APFS \
  -volname "PERSEA-backup-$STAMP" -srcfolder "$OUT" -format UDZO "$DMG" || fail "Não foi possível criar o disco criptografado."
echo "  $(du -h "$DMG" | cut -f1)  →  $DMG"

# Mantém só os $KEEP backups mais recentes.
ls -1t "$DEST"/PERSEA-backup-*.dmg 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r old; do rm -f "$old"; echo "  removido backup antigo: $(basename "$old")"; done

say "Backup concluído."
read -r -p "Pressione Enter para fechar." _
