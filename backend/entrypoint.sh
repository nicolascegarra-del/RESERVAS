#!/bin/sh
set -e

echo "Inicializando esquema base de la base de datos..."
python -c "import asyncio; from app.core.database import init_db; asyncio.run(init_db())"

echo "Ejecutando migraciones incrementales..."
alembic upgrade head

echo "Migraciones completadas. Arrancando servidor..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
