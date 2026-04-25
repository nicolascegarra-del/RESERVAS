FROM python:3.12-slim

# Usuario no root por seguridad (estándar Klyp)
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

WORKDIR /app

# Instalar dependencias del sistema necesarias para bcrypt y asyncpg
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copiar dependencias primero para aprovechar la caché de Docker
COPY pyproject.toml .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -e .

# Copiar el código de la aplicación
COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini .

# Cambiar al usuario no privilegiado
USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
