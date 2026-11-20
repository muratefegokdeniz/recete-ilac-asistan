#!/bin/bash
# APK'yi Supabase Storage'daki kalıcı linke yükler (aynı dosya adının üzerine yazar).
# Kullanım: SUPABASE_SERVICE_ROLE_KEY=xxx ./scripts/upload-apk.sh /path/to/app.apk
set -euo pipefail

APK_PATH="${1:?Kullanım: SUPABASE_SERVICE_ROLE_KEY=xxx ./scripts/upload-apk.sh /path/to/app.apk}"
SUPABASE_URL="https://vkyevamhzdkwaiclrloj.supabase.co"
BUCKET="builds"
OBJECT_PATH="ilac-asistani-latest.apk"

if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  echo "Hata: SUPABASE_SERVICE_ROLE_KEY env değişkeni gerekli (Supabase Dashboard > Project Settings > API)." >&2
  exit 1
fi

curl -sSf -X POST "${SUPABASE_URL}/storage/v1/object/${BUCKET}/${OBJECT_PATH}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/vnd.android.package-archive" \
  -H "x-upsert: true" \
  --data-binary "@${APK_PATH}"

echo ""
echo "Yüklendi. Kalıcı link:"
echo "${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${OBJECT_PATH}"
