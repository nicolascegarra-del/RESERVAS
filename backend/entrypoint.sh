#!/bin/sh
set -e

echo "Ejecutando migraciones de base de datos..."
alembic upgrade head
echo "Migraciones completadas. Arrancando servidor..."

exec uvicorn app.main:app --host 0.0.0.0 --port 8000
