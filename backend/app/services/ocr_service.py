"""
OCR de la MRZ (Machine Readable Zone) de documentos de identidad.

Usa passporteye para localizar y extraer la zona MRZ de la imagen y su
parser interno (basado en la librería `mrz`) para decodificar los campos.
Completamente gratuito y local — sin APIs externas ni claves.

Documentos soportados:
  - DNI español / NIE  → MRZ TD1 (3 líneas) en el REVERSO
  - Pasaporte          → MRZ TD3 (2 líneas) en la página de datos (frontal)

Si la MRZ no se puede leer (foto borrosa, recortada, etc.) se devuelve
None y el flujo continúa con corrección manual de los campos.

Las funciones puras de parseo (`parse_mrz_date`, `map_doc_type`) se exponen
para poder testearlas sin cargar el motor OCR.
"""

import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# Mapeo del tipo de documento MRZ → tipo de negocio Klyp.
# TD1 cubre DNI y NIE; no es posible distinguirlos solo por el tipo MRZ,
# así que el huésped/recepción puede ajustarlo manualmente después.
_DOC_TYPE_MAP: dict[str, str] = {
    "TD1": "dni",
    "TD2": "passport",
    "TD3": "passport",
    "MRVA": "passport",
    "MRVB": "passport",
}

# Umbral de confianza de passporteye para considerar la lectura fiable.
_VALID_SCORE_THRESHOLD = 70


@dataclass
class MRZData:
    """Datos extraídos de la MRZ. Las fechas vienen ya como YYYY-MM-DD."""

    first_name: str | None = None
    last_name: str | None = None
    doc_number: str | None = None
    nationality: str | None = None  # ISO 3166-1 alpha-3 (ESP, FRA, ...)
    date_of_birth: str | None = None  # YYYY-MM-DD
    sex: str | None = None  # 'M' | 'F'
    doc_expiry_date: str | None = None  # YYYY-MM-DD
    doc_type: str | None = None  # 'dni' | 'passport' | 'nie'
    mrz_raw: str | None = None
    confidence: float = 0.0


def map_doc_type(mrz_type: str | None) -> str:
    """Mapea el código de tipo MRZ al tipo de documento de negocio."""
    if not mrz_type:
        return "passport"
    return _DOC_TYPE_MAP.get(mrz_type.upper().strip(), "passport")


def parse_mrz_date(value: str | None) -> str | None:
    """
    Convierte una fecha MRZ 'YYMMDD' a 'YYYY-MM-DD'.

    Heurística de siglo: en la MRZ el año es de 2 dígitos. Se asume que
    años > 30 pertenecen al siglo XX (19xx) y el resto al XXI (20xx).
    Esto es suficiente para fechas de nacimiento y de caducidad de
    documentos en uso. Devuelve None si la cadena no es válida.
    """
    if not value or len(value) != 6 or not value.isdigit():
        return None
    try:
        yy, mm, dd = int(value[:2]), int(value[2:4]), int(value[4:6])
        if not (1 <= mm <= 12 and 1 <= dd <= 31):
            return None
        year = 1900 + yy if yy > 30 else 2000 + yy
        return f"{year:04d}-{mm:02d}-{dd:02d}"
    except (ValueError, TypeError):
        return None


def _clean(value: str | None) -> str | None:
    """Normaliza un campo MRZ: quita '<', espacios sobrantes."""
    if not value:
        return None
    cleaned = value.replace("<", " ").strip()
    return cleaned or None


def extract_mrz(image_path: str) -> MRZData | None:
    """
    Extrae los datos de la MRZ de una imagen de documento.

    Args:
        image_path: Ruta absoluta del fichero de imagen.

    Returns:
        MRZData con los campos detectados, o None si no hay MRZ legible.
    """
    try:
        # Import perezoso — passporteye arrastra scikit-image / pytesseract
        from passporteye import read_mrz
    except ImportError:
        logger.error(
            "passporteye no está instalado — OCR deshabilitado, "
            "el flujo continúa con corrección manual."
        )
        return None

    try:
        mrz = read_mrz(image_path, save_roi=False)
    except Exception as exc:  # noqa: BLE001 — cualquier fallo del motor OCR
        logger.warning("OCR MRZ falló al leer %s: %s", image_path, exc)
        return None

    if mrz is None:
        logger.info("No se detectó MRZ en %s", image_path)
        return None

    data = mrz.to_dict()
    valid_score = data.get("valid_score", 0) or 0

    surname = _clean(data.get("surname"))
    given_names = _clean(data.get("names"))
    doc_number = _clean(data.get("number"))
    nationality = _clean(data.get("nationality"))

    return MRZData(
        first_name=given_names,
        last_name=surname,
        doc_number=doc_number.replace(" ", "") if doc_number else None,
        nationality=nationality.replace(" ", "")[:3] if nationality else None,
        date_of_birth=parse_mrz_date(data.get("date_of_birth")),
        sex=(data.get("sex") or "").strip().upper()[:1] or None,
        doc_expiry_date=parse_mrz_date(data.get("expiration_date")),
        doc_type=map_doc_type(data.get("type")),
        mrz_raw=str(data.get("raw_text") or data),
        confidence=1.0 if valid_score >= _VALID_SCORE_THRESHOLD else 0.5,
    )
