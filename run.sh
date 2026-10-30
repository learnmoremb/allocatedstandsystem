#!/usr/bin/env bash
# Runs the whole Stand Allocation system (mongo, pricing, backend, frontend) with Docker.
#
#   ./run.sh            build and start everything, wait until healthy (same as: ./run.sh start)
#   ./run.sh stop       stop everything (data is kept)
#   ./run.sh restart    stop, then start again
#   ./run.sh update     git pull, then rebuild and restart
#   ./run.sh status     show container status
#   ./run.sh logs [svc] follow logs (all services, or one: mongo|pricing|backend|frontend)
set -euo pipefail

cd "$(dirname "$0")"

info() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m✔\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m✘\033[0m %s\n' "$*" >&2; exit 1; }

case ${1:-} in
  -h|--help|help) sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
esac

# ---- docker / compose -------------------------------------------------------
command -v docker >/dev/null 2>&1 || die "Docker is not installed. See https://docs.docker.com/engine/install/"

DOCKER=(docker)
if ! docker info >/dev/null 2>&1; then
  if sudo -n docker info >/dev/null 2>&1 || sudo docker info >/dev/null 2>&1; then
    DOCKER=(sudo docker)
  else
    die "Cannot talk to the Docker daemon. Is it running? (sudo systemctl start docker)"
  fi
fi

if "${DOCKER[@]}" compose version >/dev/null 2>&1; then
  COMPOSE=("${DOCKER[@]}" compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
  [[ ${DOCKER[0]} == sudo ]] && COMPOSE=(sudo docker-compose)
else
  die "Docker Compose is not installed (sudo apt install docker-compose-plugin)"
fi

# ---- .env -------------------------------------------------------------------
rand() { openssl rand -hex "$1" 2>/dev/null || head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'; }

server_ip() {
  hostname -I 2>/dev/null | awk '{print $1}' || true
}

env_get() { grep -E "^$1=" .env | head -n1 | cut -d= -f2- | sed 's/[[:space:]]*#.*$//; s/[[:space:]]*$//'; }

env_set() {
  local key=$1 value=$2
  if grep -qE "^$key=" .env; then
    sed -i "s|^$key=.*|$key=$value|" .env
  else
    echo "$key=$value" >> .env
  fi
}

prepare_env() {
  if [[ ! -f .env ]]; then
    [[ -f .env.example ]] || die ".env.example is missing"
    info "No .env found, creating one from .env.example with random secrets"
    cp .env.example .env
    chmod 600 .env
    # Safe to randomise: Mongo has not been initialised with a password yet
    env_set MONGO_ROOT_PASSWORD "$(rand 16)"
    env_set JWT_SECRET "$(rand 32)"
    env_set ADMIN_PASSWORD "$(rand 6)"
    warn "Admin login: $(env_get ADMIN_EMAIL) / $(env_get ADMIN_PASSWORD)  (you must change it at first login)"
  fi

  if [[ $(env_get PUBLIC_URL) == *YOUR_SERVER_IP* || -z $(env_get PUBLIC_URL) ]]; then
    local ip
    ip=$(server_ip)
    [[ -n $ip ]] || ip=localhost
    env_set PUBLIC_URL "http://$ip:$(env_get APP_PORT || echo 8080)"
    info "Set PUBLIC_URL=$(env_get PUBLIC_URL) in .env"
  fi

  local bad=()
  for key in MONGO_ROOT_PASSWORD JWT_SECRET ADMIN_PASSWORD; do
    [[ $(env_get "$key") == change-me || -z $(env_get "$key") ]] && bad+=("$key")
  done
  if ((${#bad[@]})); then
    die "Set these in .env before starting: ${bad[*]}  (e.g. openssl rand -hex 32)"
  fi
}

# ---- actions ----------------------------------------------------------------
wait_healthy() {
  local timeout=${1:-300} waited=0 services
  mapfile -t services < <("${COMPOSE[@]}" config --services)
  info "Waiting for services to become healthy (up to ${timeout}s)"
  while :; do
    local pending=()
    for svc in "${services[@]}"; do
      local id state
      id=$("${COMPOSE[@]}" ps -q "$svc" 2>/dev/null || true)
      [[ -n $id ]] || { pending+=("$svc(not created)"); continue; }
      state=$("${DOCKER[@]}" inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id")
      case $state in
        healthy|running) ;;
        unhealthy|exited|dead) "${COMPOSE[@]}" logs --tail 40 "$svc"; die "$svc is $state (logs above)" ;;
        *) pending+=("$svc($state)") ;;
      esac
    done
    ((${#pending[@]} == 0)) && break
    ((waited >= timeout)) && { "${COMPOSE[@]}" ps; die "Timed out waiting for: ${pending[*]}"; }
    printf '   still waiting: %s\r' "${pending[*]}"
    sleep 5; waited=$((waited + 5))
  done
  printf '\n'
  ok "All services are healthy"
}

start() {
  prepare_env
  info "Building and starting containers (first build can take a few minutes)"
  "${COMPOSE[@]}" up -d --build --remove-orphans
  wait_healthy 600
  "${COMPOSE[@]}" ps
  local app_port api_port
  app_port=$(env_get APP_PORT); app_port=${app_port:-8080}
  api_port=$(env_get API_PORT); api_port=${api_port:-5000}
  if curl -fsS "http://localhost:$app_port/api/health" >/dev/null 2>&1; then
    ok "API reachable through the frontend"
  else
    warn "http://localhost:$app_port/api/health did not answer; check: ./run.sh logs backend"
  fi
  echo
  ok "System is running"
  echo "   App:  $(env_get PUBLIC_URL)"
  echo "   API:  http://$(server_ip):$api_port/api/health"
  echo "   Logs: ./run.sh logs [backend|frontend|pricing|mongo]"
  echo "   If the app is not reachable from other machines, open the port: sudo ufw allow $app_port/tcp"
}

case ${1:-start} in
  start|up)  start ;;
  stop|down) info "Stopping (data is kept)"; "${COMPOSE[@]}" down; ok "Stopped" ;;
  restart)   "${COMPOSE[@]}" down; start ;;
  update)    info "Pulling latest code"; git pull --ff-only; start ;;
  status|ps) "${COMPOSE[@]}" ps ;;
  logs)      shift; "${COMPOSE[@]}" logs -f --tail 100 "$@" ;;
  *) die "Unknown command: $1 (try ./run.sh help)" ;;
esac
