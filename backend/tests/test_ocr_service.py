"""
Tests unitarios del parseo de la MRZ.

Estas funciones son puras y no requieren el motor OCR (passporteye),
por lo que se pueden testear de forma aislada y rápida.

Convención: test_[qué]_cuando_[condición]_entonces_[resultado]
"""

from app.services.ocr_service import map_doc_type, parse_mrz_date


def test_parse_mrz_date_cuando_anio_bajo_entonces_siglo_xxi():
    """YYMMDD con año <= 30 se interpreta como 20xx."""
    assert parse_mrz_date("250115") == "2025-01-15"
    assert parse_mrz_date("000229") == "2000-02-29"


def test_parse_mrz_date_cuando_anio_alto_entonces_siglo_xx():
    """YYMMDD con año > 30 se interpreta como 19xx (p. ej. fecha de nacimiento)."""
    assert parse_mrz_date("850720") == "1985-07-20"
    assert parse_mrz_date("991231") == "1999-12-31"


def test_parse_mrz_date_cuando_invalida_entonces_none():
    """Entradas no válidas devuelven None sin lanzar excepción."""
    assert parse_mrz_date(None) is None
    assert parse_mrz_date("") is None
    assert parse_mrz_date("12345") is None  # longitud incorrecta
    assert parse_mrz_date("ABCDEF") is None  # no numérica
    assert parse_mrz_date("251301") is None  # mes 13 inválido
    assert parse_mrz_date("250132") is None  # día 32 inválido


def test_map_doc_type_cuando_td1_entonces_dni():
    """TD1 (DNI/NIE) mapea a 'dni'; TD3/MRV mapean a 'passport'."""
    assert map_doc_type("TD1") == "dni"
    assert map_doc_type("td1") == "dni"
    assert map_doc_type("TD3") == "passport"
    assert map_doc_type("MRVA") == "passport"


def test_map_doc_type_cuando_desconocido_entonces_passport_por_defecto():
    """Tipos no reconocidos o vacíos caen en 'passport' (caso más común)."""
    assert map_doc_type(None) == "passport"
    assert map_doc_type("") == "passport"
    assert map_doc_type("XXX") == "passport"
