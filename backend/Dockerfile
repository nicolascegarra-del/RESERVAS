FROM python:3.12-slim

# Usuario no root por seguridad (estándar Klyp)
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

WORKDIR /app

# Instalar dependencias del sistema:
#  - gcc, libpq-dev: necesarias para bcrypt y asyncpg
#  - tesseract-ocr: motor OCR usado por passporteye para leer la MRZ
#  - libgl1, libglib2.0-0: dependencias nativas de scikit-image / OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    tesseract-ocr \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copiar dependencias primero para aprovechar la caché de Docker
COPY pyproject.toml .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -e .

# Copiar el código de la aplicación
COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini .
COPY entrypoint.sh .
COPY create_superadmin.py .
RUN chmod +x entrypoint.sh

# Pre-crear directorios de media con permisos para appuser
RUN mkdir -p /app/media/logos /app/media/guest_docs && chown -R appuser:appgroup /app/media

# Cambiar al usuario no privilegiado
USER appuser

EXPOSE 8000

ENTRYPOINT ["./entrypoint.sh"]
