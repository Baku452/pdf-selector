"""
pytest tests for PDFProcessor.

Run with:
    pytest tests/test_processor.py -v
"""

import json
import pytest
from pathlib import Path

from pdf_processor import PDFProcessor

# Known sample files (from project memory)
HUDBAY_PDF = Path(r"/Users/aldair/Proyectos Software/PDF SETTER FILES/SKM_368e26013117570.pdf")
OTHER_PDF  = Path(r"/Users/aldair/Proyectos Software/PDF SETTER FILES/SKM_368e26020616500.pdf")

processor = PDFProcessor()


# ------------------------------------------------------------------ #
# Helpers                                                             #
# ------------------------------------------------------------------ #

def _skip_if_missing(path: Path):
    if not path.is_file():
        pytest.skip(f"Sample PDF not found: {path}")


# ------------------------------------------------------------------ #
# Unit tests — pure logic, no file I/O                               #
# ------------------------------------------------------------------ #

class TestNormalizeDate:
    def test_dot_separator(self):
        assert processor._normalize_date("31.12.25") == "31-12-25"

    def test_slash_separator(self):
        assert processor._normalize_date("31/12/2025") == "31-12-2025"

    def test_empty(self):
        assert processor._normalize_date("") == ""

    def test_strips_non_date_chars(self):
        assert processor._normalize_date("  01.01.26  ") == "01-01-26"


class TestCleanSpaces:
    def test_collapses_spaces(self):
        assert processor._clean_spaces("  hello   world  ") == "hello world"

    def test_none_safe(self):
        assert processor._clean_spaces(None) == ""


class TestDateShort:
    def test_4digit_year(self):
        assert processor._date_to_short("31-12-2026") == "31.12.26"

    def test_2digit_year(self):
        assert processor._date_to_short("01-01-26") == "01.01.26"


class TestExtractDniCandidates:
    def test_labeled_dni(self):
        text = "DNI: 76248882\nOtro texto"
        result = processor.extract_dni_candidates(text)
        assert "76248882" in result

    def test_no_dni(self):
        assert processor.extract_dni_candidates("No hay numero aqui") == []

    def test_deduplication(self):
        text = "DNI: 12345678 y tambien 12345678"
        result = processor.extract_dni_candidates(text)
        assert result.count("12345678") == 1


class TestExtractDateCandidates:
    def test_labeled_date_wins(self):
        text = "FECHA DE EVALUACION: 15/03/26\nFECHA: 01/01/20"
        result = processor.extract_date_candidates(text)
        assert result[0] == "15-03-26"

    def test_fallback_date(self):
        text = "Emitido el 01.06.25"
        result = processor.extract_date_candidates(text)
        assert "01-06-25" in result


class TestExtractExamTypeCandidates:
    def test_labeled(self):
        text = "TIPO DE EXAMEN: PERIODICO"
        result = processor.extract_exam_type_candidates(text)
        assert "PERIODICO" in result

    def test_checkbox(self):
        text = "PERIODICO x\nPREOCUPACIONAL\nINGRESO"
        result = processor.extract_exam_type_candidates(text)
        assert result[0] == "PERIODICO"

    def test_fallback(self):
        text = "Se realizó examen de INGRESO al trabajador."
        result = processor.extract_exam_type_candidates(text)
        assert "INGRESO" in result


class TestBuildFilename:
    def test_hudbay_format(self):
        name = processor.build_filename(
            dni="76248882",
            nombre="HUAMAN POCCO JESUS",
            empresa="G4S PERU SAC",
            tipo_examen="PERIODICO",
            fecha="15-03-26",
            fmt="hudbay",
        )
        assert name.startswith("15.03.26")
        assert "76248882" in name
        assert name.endswith(".pdf")

    def test_standard_format(self):
        name = processor.build_filename(
            dni="45205399",
            nombre="INFANTE CHUQUIRUNA JULIO",
            empresa="KOMATSU",
            tipo_examen="PREOCUPACIONAL",
            fecha="02-02-26",
            fmt="standard",
        )
        assert name.startswith("45205399-")
        assert "CMESPINAR" in name
        assert name.endswith(".pdf")

    def test_empty_dni_returns_empty(self):
        assert processor.build_filename(fmt="hudbay") == ""


class TestDetectFormat:
    def test_standard_filename(self):
        fmt = processor.detect_format("45205399-INFANTE JULIO-KOMATSU-EMPO-CMESPINAR-02.02.26.pdf")
        assert fmt == "standard"

    def test_hudbay_filename(self):
        fmt = processor.detect_format("15.03.26 EMOA 76248882 HUAMAN POCCO-G4S.pdf")
        assert fmt == "hudbay"

    def test_unknown_filename(self):
        assert processor.detect_format("scan_001.pdf") is None


class TestDetectFormatFromContent:
    def test_detects_hudbay_keyword(self):
        assert processor.detect_format_from_content("HUDBAY MINERALS") == "hudbay"

    def test_detects_for_sso(self):
        assert processor.detect_format_from_content("FOR-SSO-293") == "hudbay"

    def test_returns_none_for_other(self):
        assert processor.detect_format_from_content("texto generico") is None


# ------------------------------------------------------------------ #
# Integration tests — require sample PDF files                       #
# ------------------------------------------------------------------ #

class TestAnalyzeHudbayPDF:
    def test_returns_success(self):
        _skip_if_missing(HUDBAY_PDF)
        result = processor.analyze(str(HUDBAY_PDF), original_filename=HUDBAY_PDF.name)
        assert result["detected_format"] == "hudbay"
        assert result["candidates"]["dni"], "Expected at least one DNI candidate"
        assert result["suggested_name"] is not None

    def test_result_shape(self):
        _skip_if_missing(HUDBAY_PDF)
        result = processor.analyze(str(HUDBAY_PDF))
        for key in ("success", "suggested_name", "candidates", "defaults", "notes", "text_chars"):
            assert key in result


class TestAnalyzeOtherPDF:
    def test_returns_result(self):
        _skip_if_missing(OTHER_PDF)
        result = processor.analyze(str(OTHER_PDF), original_filename=OTHER_PDF.name)
        assert isinstance(result["candidates"]["dni"], list)
        assert isinstance(result["candidates"]["fecha"], list)
