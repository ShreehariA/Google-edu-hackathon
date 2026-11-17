"""Split the SLP3 textbook PDF into per-chapter PDFs for the Vertex AI RAG corpus.

Importing the whole 626-page PDF fails with "An internal error occurred";
chapter-sized files import cleanly. Chapters are read from the PDF outline
(top level = book parts, second level = chapters). The subject index is skipped.

Usage:
    uv run --no-project --with pypdf python RAG_Pipeline/split_textbook.py <book.pdf> <outdir>
"""
import os
import re
import sys

from pypdf import PdfReader, PdfWriter


def collect(reader, outline, depth=0):
    """Flatten the outline into (depth, page, title); nested lists are children."""
    out = []
    for item in outline:
        if isinstance(item, list):
            out.extend(collect(reader, item, depth + 1))
            continue
        try:
            out.append((depth, reader.get_destination_page_number(item), item.title.strip()))
        except Exception:
            pass
    return out


def main(src, outdir):
    reader = PdfReader(src)
    entries = collect(reader, reader.outline)
    starts = sorted((page, title) for depth, page, title in entries if depth == 1)
    os.makedirs(outdir, exist_ok=True)

    for i, (page, title) in enumerate(starts):
        end = starts[i + 1][0] if i + 1 < len(starts) else len(reader.pages)
        if end <= page or "index" in title.lower():
            continue
        slug = re.sub(r"[^A-Za-z0-9]+", "_", title).strip("_")[:60]
        name = f"slp3_{i + 1:02d}_{slug}.pdf"
        writer = PdfWriter()
        for p in range(page, end):
            writer.add_page(reader.pages[p])
        with open(os.path.join(outdir, name), "wb") as f:
            writer.write(f)
        print(f"{name}  pages {page}-{end - 1}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
