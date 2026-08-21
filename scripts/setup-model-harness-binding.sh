#!/usr/bin/env bash
# Wizard gerado pelo squad Spectree. A biblioteca abaixo do cabeçalho é
# idêntica em todo wizard — edite apenas o bloco STAGES no fim do arquivo.
set -euo pipefail

TOTAL_STAGES=3
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
# Binding físico da credencial calibrada da F9 (spec seções 13, 22, 92-93).
#
# A calibração aprovou o degrau mais estreito: resourceId canônico
# `claude/auth`, granularity `file`. O CAMINHO desse arquivo carrega o nome
# de usuário do host e por isso NUNCA entra no repositório (seção 13) — ele
# é configuração de HOST, e este wizard é quem a escreve.
#
#   bash scripts/setup-model-harness-binding.sh            # wizard completo
#   bash scripts/setup-model-harness-binding.sh --check P  # só o piso, sem gravar
#
# O wizard NUNCA mostra o conteúdo do arquivo de credencial: só caminho e
# tamanho.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
POLICY_MODULE="$REPO_ROOT/spectree-runtime/sandbox/sandbox-policy.js"
BINDINGS_FILE="$HOME/.claude/spectree/model-harness-bindings.json"
RESOURCE_ID="credential/claude/auth"

# O piso do INV-906 é o do runtime: este wizard CONSULTA
# `assertBindablePhysicalPath`, nunca reimplementa a regra — regra
# duplicada é regra que diverge. A normalização (realpath quando existe,
# resolve quando não) é a mesma de harness/credential-calibration.js.
# Sucesso: o caminho canônico em stdout. Recusa: a razão em stderr, exit 1.
floor_check() {
  node --input-type=module -e '
import { existsSync, realpathSync } from "node:fs";
import path from "node:path";
import { homedir } from "node:os";
import { pathToFileURL } from "node:url";
const [modulePath, candidate] = process.argv.slice(1);
const { assertBindablePhysicalPath } = await import(pathToFileURL(modulePath).href);
const physical = existsSync(candidate) ? realpathSync(candidate) : path.resolve(candidate);
try {
  assertBindablePhysicalPath(physical, { homePath: homedir(), label: "credential/claude/auth" });
} catch (error) {
  process.stderr.write("  RECUSADO pelo piso: " + error.message + "\n");
  process.exit(1);
}
process.stdout.write(physical);
' "$POLICY_MODULE" "$1"
}

write_binding() {                            # write_binding "<caminho canônico>"
  node --input-type=module -e '
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
const [file, key, value] = process.argv.slice(1);
const map = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
map[key] = value;
mkdirSync(path.dirname(file), { recursive: true });
writeFileSync(file, JSON.stringify(map, null, 2) + "\n", { mode: 0o600 });
' "$BINDINGS_FILE" "$RESOURCE_ID" "$1"
}

command -v node >/dev/null 2>&1 || { echo "node não está no PATH — o piso do INV-906 vive no runtime deste repositório e só o Node o responde." >&2; exit 1; }
[ -f "$POLICY_MODULE" ] || { echo "não encontrei $POLICY_MODULE — rode este wizard de dentro do checkout do repositório." >&2; exit 1; }

# Modo --check: exercita SÓ o piso, não grava nada e não pergunta nada.
# Não é um "sim para tudo": ele não escreve o binding em hipótese alguma.
if [ "${1:-}" = "--check" ]; then
  [ -n "${2:-}" ] || { echo "uso: $0 --check <caminho>" >&2; exit 1; }
  if canonical=$(floor_check "$2"); then
    printf 'ACEITO pelo piso: %s\n' "$canonical"
  else
    exit 1
  fi
  exit 0
fi

stage "Localizar a credencial do Claude neste host"
say "A calibração da F9 aprovou o degrau mais estreito: o ARQUIVO de"
say "credencial, nunca o diretório ~/.claude inteiro (seções 12 e 92-93)."
say ""
CANDIDATE=""
for guess in "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/.credentials.json" "$HOME/.claude/.credentials.json"; do
  if [ -f "$guess" ]; then CANDIDATE="$guess"; break; fi
done
if [ -n "$CANDIDATE" ]; then
  ok "encontrado: $CANDIDATE"
else
  step "Não achei o arquivo nos lugares conhecidos deste host."
  step "Informe o caminho RELATIVO ao seu HOME (ex.: .claude/.credentials.json)."
  while [ -z "$CANDIDATE" ]; do
    ask RELATIVE "Caminho relativo a \$HOME"
    case "$RELATIVE" in
      /*) say "  Caminho absoluto não: informe relativo ao HOME."; continue ;;
    esac
    if [ -f "$HOME/$RELATIVE" ]; then CANDIDATE="$HOME/$RELATIVE"; else say "  Não existe arquivo em \$HOME/$RELATIVE."; fi
  done
fi
SIZE_BYTES="$(wc -c < "$CANDIDATE" | tr -d ' ')"
ok "tamanho: ${SIZE_BYTES} bytes"      # tamanho e caminho — nunca o conteúdo

stage "Piso do binding físico (INV-906)"
say "Quem decide se este caminho pode virar binding é o runtime, não o"
say "wizard: sandbox-policy.js / assertBindablePhysicalPath."
say ""
if ! PHYSICAL_PATH=$(floor_check "$CANDIDATE"); then
  say ""
  say "O piso recusou este caminho. Nada foi gravado."
  say "Recusa do piso NUNCA se contorna ampliando o binding: se só o HOME"
  say "inteiro autenticaria, o resultado da calibração é C (seções 24-25)."
  exit 1
fi
ok "aceito pelo piso"
step "resourceId canônico: $RESOURCE_ID"
step "granularity: file"

stage "Gravar o binding na configuração de host"
say "O caminho carrega o nome de usuário deste host e por isso mora AQUI,"
say "fora do repositório (seção 13):"
say ""
step "$BINDINGS_FILE"
step "$RESOURCE_ID -> $PHYSICAL_PATH"
say ""
if [ -f "$BINDINGS_FILE" ]; then step "o arquivo já existe: a chave acima será sobrescrita, o resto fica."; fi
confirm "Gravar este binding?"
write_binding "$PHYSICAL_PATH"
ok "binding gravado"

finish "$(printf 'Binding de host: %s\nConfira com: cat %s\n\nO binding é caminho, não segredo — mas o que ele alcança é a credencial:\num harness confinado lê e pode exfiltrar TUDO o que o binding alcança\n(seções 92-93). Por isso o degrau é `file`, e nunca o diretório.' "$BINDINGS_FILE" "$BINDINGS_FILE")"
