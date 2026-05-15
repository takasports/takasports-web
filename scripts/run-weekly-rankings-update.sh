#!/bin/bash
# run-weekly-rankings-update.sh
#
# Pipeline completo semanal del Índice Taka.
# Orden: rendimiento (4 deportes) → contexto (3 deportes) → mediático → decay → snapshot
#
# Programado por launchd (~/Library/LaunchAgents/com.taka.weekly-rankings-update.plist)
# para domingo 23:45 — después de que WF-11 (22:00) y WF-12 (23:15) hayan corrido.
#
# Logs: /tmp/taka-rankings-weekly-YYYYMMDD.log

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

LOG="/tmp/taka-rankings-weekly-$(date +%Y%m%d-%H%M%S).log"
NODE_BIN="$(command -v node || echo /opt/homebrew/bin/node)"

run() {
  local label="$1"; shift
  echo "▶ ${label}..."
  "$NODE_BIN" "$@" --apply
  local rc=$?
  echo "  → exit ${rc}"
  echo
  return $rc
}

{
  echo "================================================"
  echo "  Taka rankings weekly update"
  echo "  Started: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "  Node: $NODE_BIN ($("$NODE_BIN" --version))"
  echo "================================================"
  echo

  # ── RENDIMIENTO (factor 40%) ──────────────────────
  run "Tenis — Elo (rendimiento)"         scripts/ingest-tennis-elo.mjs;    TENIS_RC=$?
  run "F1 — DPC (rendimiento)"            scripts/ingest-f1-dpc.mjs;        F1_RC=$?
  run "NBA — PER (rendimiento)"           scripts/ingest-nba-per.mjs;       NBA_RC=$?
  run "Fútbol — xG+xA Understat (rend.)" scripts/ingest-football-fbref.mjs; FUTBOL_RC=$?

  # ── CONTEXTO (factor 20%) ─────────────────────────
  run "Fútbol — posición liga (contexto)" scripts/ingest-football-context.mjs; FCTX_RC=$?
  run "NBA — seed conferencia (contexto)" scripts/ingest-nba-context.mjs;      NCTX_RC=$?
  run "Tenis — ranking ATP/WTA (contexto)" scripts/ingest-tennis-context.mjs;  TCTX_RC=$?

  # ── MEDIÁTICO (factor 25%) ────────────────────────
  run "Wikipedia pageviews (mediático)"   scripts/ingest-wikipedia-views.mjs;  MEDIA_RC=$?

  # ── NARRATIVA — decay temporal (factor 15%) ───────
  run "Narrativa decay"                   scripts/ingest-narrativa-decay.mjs;  NARR_RC=$?

  # ── SNAPSHOT histórico ────────────────────────────
  run "Snapshot histórico"                scripts/capture-score-snapshot.mjs;  SNAP_RC=$?

  echo "================================================"
  echo "  Finished: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "  rendimiento: tenis=$TENIS_RC f1=$F1_RC nba=$NBA_RC futbol=$FUTBOL_RC"
  echo "  contexto:    futbol=$FCTX_RC nba=$NCTX_RC tenis=$TCTX_RC"
  echo "  mediático:   wikipedia=$MEDIA_RC"
  echo "  narrativa:   decay=$NARR_RC"
  echo "  snapshot:    $SNAP_RC"
  echo "================================================"
} 2>&1 | tee "$LOG"
