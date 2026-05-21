#!/bin/sh
set -e

# Si se pasan argumentos (ej: celery worker/beat), ejecutarlos directamente
if [ "$#" -gt 0 ]; then
    exec "$@"
fi

echo "Ejecutando migraciones..."
alembic upgrade head
echo "Migraciones completadas. Arrancando servidor..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
