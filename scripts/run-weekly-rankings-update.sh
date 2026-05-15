#!/bin/bash
# run-weekly-rankings-update.sh
#
# Ejecuta los 3 scripts de ingesta avanzada (Tenis Elo, F1 DPC, NBA PER)
# y luego graba un snapshot histórico semanal.
#
# Programado por launchd (~/Library/LaunchAgents/com.taka.weekly-rankings-update.plist)
# para domingo 23:45 — después de que WF-11 (22:00) y WF-12 (23:15) hayan corrido.
#
# Logs: /tmp/taka-rankings-weekly-YYYYMMDD.log
# Salida también va a stdout/stderr (capturada por launchd).

set -uo pipefail

# Resolver el directorio del script aunque se llame con symlinks
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

LOG="/tmp/taka-rankings-weekly-$(date +%Y%m%d-%H%M%S).log"
NODE_BIN="$(command -v node || echo /opt/homebrew/bin/node)"

{
  echo "================================================"
  echo "  Taka rankings weekly update"
  echo "  Started: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "  PWD: $PROJECT_DIR"
  echo "  Node: $NODE_BIN ($("$NODE_BIN" --version))"
  echo "================================================"
  echo

  echo "▶ Tenis (Elo)..."
  "$NODE_BIN" scripts/ingest-tennis-elo.mjs --apply
  TENIS_RC=$?
  echo "  → exit $TENIS_RC"
  echo

  echo "▶ F1 (DPC)..."
  "$NODE_BIN" scripts/ingest-f1-dpc.mjs --apply
  F1_RC=$?
  echo "  → exit $F1_RC"
  echo

  echo "▶ NBA (PER)..."
  "$NODE_BIN" scripts/ingest-nba-per.mjs --apply
  NBA_RC=$?
  echo "  → exit $NBA_RC"
  echo

  echo "▶ Fútbol (xG+xA FBref)..."
  "$NODE_BIN" scripts/ingest-football-fbref.mjs --apply
  FUTBOL_RC=$?
  echo "  → exit $FUTBOL_RC"
  echo

  echo "▶ Snapshot histórico..."
  "$NODE_BIN" scripts/capture-score-snapshot.mjs
  SNAP_RC=$?
  echo "  → exit $SNAP_RC"
  echo

  echo "================================================"
  echo "  Finished: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "  Exit codes: tenis=$TENIS_RC f1=$F1_RC nba=$NBA_RC futbol=$FUTBOL_RC snapshot=$SNAP_RC"
  echo "================================================"
} 2>&1 | tee "$LOG"
