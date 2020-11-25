// Copyright...

#include <algorithm>
#include <memory>
#include <stdio.h>
#include <vector>

#include <emscripten.h>
#include <emscripten/bind.h>

#include "public/fpdfview.h"
#include "public/fpdf_ppo.h"
#include "public/fpdf_save.h"
#include "public/cpp/fpdf_scopers.h"

namespace {

FPDF_DOCUMENT g_doc_;

// For now, just keep all pages opened forever.
std::vector<ScopedFPDFPage>* pages_ = nullptr;

EMSCRIPTEN_KEEPALIVE
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
void GeneragePageContent(int pageno) {
  FPDF_PAGE page = GetPage(pageno);
  if (!page) {
    fprintf(stderr, "Can't find page %d", pageno);
    return;
  }
  FPDFPage_GenerateContent(page);
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

EMSCRIPTEN_KEEPALIVE
void AddTextOverlayToPage(int pageno, char* bytes, size_t length, float left, float bottom, const char* html, int width) {
  FPDF_PAGE page = GetPage(pageno);
  if (!page) {
    fprintf(stderr, "can't open page %d\n", pageno);
    return;
  }
  ScopedFPDFDocument src(FPDF_LoadMemDocument(
      bytes,
      static_cast<int>(length),
      nullptr));
  if (!src) {
    fprintf(stderr, "Can't open temp PDF in pdfium\n");
    return;
  }
  ScopedFPDFPageObject form_object(
      FPDF_ImportPageToXObject(g_doc_, src.get(), 1));
  if (!form_object) {
    fprintf(stderr, "failed to import pdf to form xobject\n");
    return;
  }

  // Set marked content value on the object
  FPDF_PAGEOBJECTMARK mark = FPDFPageObj_AddMark(form_object.get(),
                                                 "FN:RichText");
  if (!mark) {
    fprintf(stderr, "failed to create mark\n");
    return;
  }
  if (!FPDFPageObjMark_SetStringParam(
          g_doc_, form_object.get(), mark, "V", html)) {
    fprintf(stderr, "failed to set mark str value\n");
    return;
  }
  if (width > 0) {
    if (!FPDFPageObjMark_SetIntParam(
            g_doc_, form_object.get(), mark, "W", width)) {
      fprintf(stderr, "failed to set mark int value\n");
      return;
    }
  }

  // Position the object on the page and add to the page
  double page_height = FPDF_GetPageHeight(page);
  double y_bottom = page_height - bottom;
  FPDFPageObj_Transform(form_object.get(), 1, 0, 0, 1, left, y_bottom);
  FPDFPage_InsertObject(page, form_object.release());
}

EMSCRIPTEN_KEEPALIVE
int PageCountObjects(int pageno) {
  FPDF_PAGE page = GetPage(pageno);
  if (!page) {
    fprintf(stderr, "Can't find page %d", pageno);
    return 0;
  }
  return FPDFPage_CountObjects(page);
}

// Reduce the total number of objects in the page to `final_pageobj_count`
EMSCRIPTEN_KEEPALIVE
void ReducePageObjects(int pageno, int final_pageobj_count) {
  FPDF_PAGE page = GetPage(pageno);
  if (!page) {
    fprintf(stderr, "Can't find page %d", pageno);
    return;
  }
  while (true) {
    int obj_cnt = FPDFPage_CountObjects(page);
    if (obj_cnt <= final_pageobj_count)
      return;
    FPDF_PAGEOBJECT pageobj = FPDFPage_GetObject(page, obj_cnt - 1);
    if (!pageobj) {
      fprintf(stderr, "Unable to get page obj\n");
      return;
    }
    if (!FPDFPage_RemoveObject(page, pageobj)) {
      fprintf(stderr, "Unable to remove object\n");
      return;
    }
  }
}

}  // extern "C"

class FileSaver : public FPDF_FILEWRITE {
 public:
  FileSaver() {
    version = 1;
    WriteBlock = StaticWriteBlock;
  }
  static int StaticWriteBlock(FPDF_FILEWRITE* pthis,
                              const void* data,
                              unsigned long size) {
    FileSaver* fs = static_cast<FileSaver*>(pthis);
    const char* cdata = static_cast<const char*>(data);
    fs->data_.insert(fs->data_.end(), cdata, cdata + size);
    return 1;  // success
  }
  std::vector<char> data_;
  emscripten::val getData() {
    return emscripten::val(emscripten::typed_memory_view(data_.size(), &data_[0]));
  }
};

std::unique_ptr<FileSaver> SaveDoc() {
  std::unique_ptr<FileSaver> fs(new FileSaver);
  if (!FPDF_SaveAsCopy(g_doc_, fs.get(), FPDF_REMOVE_SECURITY)) {
    fprintf(stderr, "FPDF_SaveAsCopy failed\n");
    return nullptr;
  }
  return fs;
}

EMSCRIPTEN_BINDINGS(file_saver) {
  emscripten::class_<FileSaver>("FileSaver")
    .function("getData", &FileSaver::getData)
    ;
  emscripten::function("SaveDoc", &SaveDoc);
}