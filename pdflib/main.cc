// Copyright...

#include <algorithm>
#include <memory>
#include <stdio.h>
#include <vector>

#include <emscripten.h>

#include "public/fpdfview.h"
#include "public/cpp/fpdf_scopers.h"

namespace {

FPDF_DOCUMENT g_doc_;

// For now, just keep all pages opened forever.
std::vector<ScopedFPDFPage>* pages_ = nullptr;

FPDF_PAGE GetPage(int pageno) {
  if (!pages_) {
    fprintf(stderr, "Missing pages cache\n");
    return nullptr;
  }
  if (!g_doc_) {
    fprintf(stderr, "Missing doc\n");
    return nullptr;
  }
  if (pageno < 0) {
    fprintf(stderr, "Can't load negative page\n");
    return nullptr;
  }
  if (pages_->size() > pageno && (*pages_)[pageno].get())
    return (*pages_)[pageno].get();
  // Load the page
  if (FPDF_GetPageCount(g_doc_) <= pageno) {
    fprintf(stderr, "Load Page %d is out of range\n", pageno);
    return nullptr;
  }
  pages_->resize(std::max(pages_->size(), static_cast<size_t>(pageno + 1)));
  (*pages_)[pageno] = ScopedFPDFPage(FPDF_LoadPage(g_doc_, pageno));
  if (!(*pages_)[pageno].get()) {
    fprintf(stderr, "Failed to load page %d\n", pageno);
  }
  return (*pages_)[pageno].get();
}

}  // namespace {}

extern "C" {

EMSCRIPTEN_KEEPALIVE
void OpenFile(char* bytes, size_t length) {
  // Init pdfium
  FPDF_LIBRARY_CONFIG config;
  config.version = 2;
  config.m_pUserFontPaths = NULL;
  config.m_pIsolate = NULL;
  config.m_v8EmbedderSlot = 0;

  FPDF_InitLibraryWithConfig(&config);

  pages_ = new std::vector<ScopedFPDFPage>();
  
  g_doc_ = FPDF_LoadMemDocument(bytes, length, nullptr);
}

EMSCRIPTEN_KEEPALIVE
int GetPageCount() {
  return FPDF_GetPageCount(g_doc_);
}

EMSCRIPTEN_KEEPALIVE
double GetPageWidth(int pageno) {
  FPDF_PAGE page = GetPage(pageno);
  if (!page) {
    return -1.0;
  }

  return FPDF_GetPageWidth(page);
}

EMSCRIPTEN_KEEPALIVE
double GetPageHeight(int pageno) {
  FPDF_PAGE page = GetPage(pageno);
  if (!page) {
    return -1.0;
  }

  return FPDF_GetPageHeight(page);
}

EMSCRIPTEN_KEEPALIVE
char* Render(int pageno, int out_width, int out_height,
             float a, float b, float c, float d, float e, float f) {
  const size_t buf_len = out_width * out_height * 4;
  char* raw_buf = static_cast<char*>(malloc(buf_len));
  if (!raw_buf) {
    fprintf(stderr, "Failed to allocate render buffer");
    return nullptr;
  }
  memset(raw_buf, 0xff, buf_len);
  // for (int x = 0; x < out_width; x++) {
  //   for (int y = 0; y < out_height; y++) {
  //     raw_buf[(out_width * y + x) * 4] = (x + y) & 0xff;
  //   }
  // }

  FPDF_PAGE page = GetPage(pageno);
  if (!page) {
    free(raw_buf);
    return nullptr;
  }

  ScopedFPDFBitmap
      bitmap(FPDFBitmap_CreateEx(out_width, out_height,
                                 FPDFBitmap_BGRx,
                                 raw_buf, static_cast<int>(out_width * 4)));
  if (!bitmap) {
    fprintf(stderr, "failed to create PDFbitmap\n");
    free(raw_buf);
    return nullptr;
  }

  FS_MATRIX pdfmatrix = {a, b, c, d, e, f};
  FS_RECTF clip = {0, 0, static_cast<float>(out_width),
                   static_cast<float>(out_height)};
  FPDF_RenderPageBitmapWithMatrix(bitmap.get(), page, &pdfmatrix,
				  &clip, FPDF_ANNOT | FPDF_REVERSE_BYTE_ORDER);
  return raw_buf;
}

EMSCRIPTEN_KEEPALIVE
void FreeBuf(char* buf) {
  free(buf);
}

}  // extern "C"
