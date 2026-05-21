#!/bin/sh
set -e

# Si se pasan argumentos (ej: celery worker/beat), ejecutarlos directamente
if [ "$#" -gt 0 ]; then
    exec "$@"
fi

echo "Verificando estado de la base de datos..."

# Comprueba si alembic_version existe en la BD.
# Salida 0 → BD ya versionada por Alembic (upgrade normal).
# Salida 1 → BD nueva o vacía (inicializar con create_all + stamp).
cat > /tmp/check_alembic.py << 'PYEOF'
import asyncio, sys
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings

async def main():
    engine = create_async_engine(settings.database_url)
    try:
        async with engine.begin() as conn:
            result = await conn.execute(text(
                "SELECT 1 FROM information_schema.tables "
                "WHERE table_schema = 'public' AND table_name = 'alembic_version'"
            ))
            sys.exit(0 if result.scalar() else 1)
    finally:
        await engine.dispose()

asyncio.run(main())
PYEOF

if python3 /tmp/check_alembic.py; then
    echo "BD existente detectada. Ejecutando migraciones Alembic pendientes..."
    alembic upgrade head
else
    echo "BD nueva detectada. Inicializando esquema completo con create_all()..."
    python3 -c "
import asyncio
from app.core.database import init_db
asyncio.run(init_db())
print('Esquema creado.')
"
    echo "Sincronizando Alembic con el esquema actual (stamp head)..."
    alembic stamp head
fi

rm -f /tmp/check_alembic.py
echo "Base de datos lista. Arrancando servidor..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
