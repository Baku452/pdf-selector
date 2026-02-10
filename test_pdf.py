#!/usr/bin/env python3
"""Test PDF extraction"""

from pdf_processor import PDFProcessor
import json
import sys

pdf_path = r'c:\Users\aldai\Downloads\SKM_368e26013117570.pdf'

print(f"Testing PDF: {pdf_path}\n")
print("=" * 60)

p = PDFProcessor()
result = p.analyze(pdf_path, verbose=True)

print("\n" + "=" * 60)
print("=== ANALYSIS RESULT ===")
print("=" * 60)
print(f"\nSuccess: {result['success']}")
print(f"Suggested name: {result['suggested_name']}")
print(f"\nCandidates:")
print(json.dumps(result['candidates'], indent=2, ensure_ascii=False))
print(f"\nDefaults:")
print(json.dumps(result['defaults'], indent=2, ensure_ascii=False))
print(f"\nText chars extracted: {result['text_chars']}")
print(f"Notes: {result['notes']}")
