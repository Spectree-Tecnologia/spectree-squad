#!/usr/bin/env bash
# Wizard gerado pelo squad Spectree. A biblioteca abaixo do cabeçalho é
# idêntica em todo wizard — edite apenas o bloco STAGES no fim do arquivo.
set -euo pipefail

TOTAL_STAGES=0          # ajuste para o número de stages que você escreveu
STAGE_N=0
ENV_FILE="${ENV_FILE:-.env}"

c_dim=$'\033[2m'; c_b=$'\033[1m'; c_g=$'\033[32m'; c_y=$'\033[33m'; c_0=$'\033[0m'

stage() {                                    # stage "Título da etapa"
  STAGE_N=$((STAGE_N + 1))
  clear 2>/dev/null || true
  printf '%s[%d/%d]%s %s%s%s\n\n' "$c_dim" "$STAGE_N" "$TOTAL_STAGES" "$c_0" "$c_b" "$1" "$c_0"
}
say()  { printf '%s\n' "$1"; }
step() { printf '  %s→%s %s\n' "$c_y" "$c_0" "$1"; }
ok()   { printf '  %s✔%s %s\n' "$c_g" "$c_0" "$1"; }

open_url() {                                 # open_url "https://..."
  step "Abrindo: $1"
  if   command -v wslview  >/dev/null 2>&1; then wslview "$1" >/dev/null 2>&1 || true
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$1" >/dev/null 2>&1 || true
  elif command -v open     >/dev/null 2>&1; then open "$1"     >/dev/null 2>&1 || true
  elif command -v cmd.exe  >/dev/null 2>&1; then cmd.exe /c start "" "$1" >/dev/null 2>&1 || true
  else say "  (abra manualmente: $1)"; fi
}

ask() {                                      # ask VAR "Pergunta"
  local __v=$1 __r=""
  while [ -z "$__r" ]; do read -r -p "  $2: " __r </dev/tty; done
  printf -v "$__v" '%s' "$__r"
}

ask_secret() {                               # ask_secret VAR "Pergunta"
  local __v=$1 __r=""
  while [ -z "$__r" ]; do read -r -s -p "  $2: " __r </dev/tty; echo; done
  printf -v "$__v" '%s' "$__r"
}

write_env() {                                # write_env NOME "valor"  (upsert idempotente)
  local k=$1 v=$2
  touch "$ENV_FILE"
  if grep -qE "^${k}=" "$ENV_FILE"; then
    grep -vE "^${k}=" "$ENV_FILE" > "${ENV_FILE}.tmp" && mv "${ENV_FILE}.tmp" "$ENV_FILE"
  fi
  printf '%s=%s\n' "$k" "$v" >> "$ENV_FILE"
  ok "$k gravado em $ENV_FILE"
}

set_secret() {                               # set_secret NOME "valor"  (GitHub Actions)
  local k=$1 v=$2
  printf '%s' "$v" | gh secret set "$k" --body - >/dev/null && ok "secret $k publicado"
}

set_var() {                                  # set_var NOME "valor"
  local k=$1 v=$2
  printf '%s' "$v" | gh variable set "$k" --body - >/dev/null && ok "variable $k publicada"
}

pause()   { read -r -p "  ${1:-Enter para continuar} " _ </dev/tty; }

confirm() {                                  # confirm "Ação irreversível?"  -> aborta se não
  local r=""
  read -r -p "  $1 [s/N]: " r </dev/tty
  case "$r" in s|S|y|Y) : ;; *) say "Abortado."; exit 1 ;; esac
}

finish() {
  clear 2>/dev/null || true
  printf '%s✔ Concluído.%s\n\n' "$c_g" "$c_0"
  printf '%s\n' "${1:-}"
}

# ─────────────────────────── STAGES ───────────────────────────
# Substitua o exemplo abaixo por uma chamada `stage` por etapa, em ordem de
# dependência, e ajuste TOTAL_STAGES no topo.

stage "Exemplo — remova esta etapa"
say "Descreva aqui o que a pessoa precisa fazer nesta tela."
open_url "https://exemplo.com/dashboard"
step "Dashboard → Developers → API keys → Reveal → copiar"
ask_secret CHAVE "Cole a chave"
write_env "EXEMPLO_API_KEY" "$CHAVE"

finish "Rode 'npm run dev' para conferir o ambiente."
