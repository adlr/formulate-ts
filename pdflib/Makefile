all: ../out/main.js

PDFIUM=/home/adlr/Code/FN/repo_stable/pdfium.git@d080048b1c862d222f4893936f48a65405397723

CFLAGS=\
	-std=c++17 \
	-g -Os -Wall -Werror -Wno-unused-private-field

INC=\
	-I$(PDFIUM)/

CLEANOBJS=\
	main.o

OBJS=\
	$(CLEANOBJS) \
	$(PDFIUM)/out/Debug/obj/libpdfium.a

%.o : %.cc
	em++ --bind -c $(CFLAGS) -MMD $(INC) -o $@ $<

../out/main.js: $(OBJS)
	em++ $(CFLAGS) -o $@ $(OBJS) \
	  --bind \
		-s "EXTRA_EXPORTED_RUNTIME_METHODS=['cwrap']" \
		-s ALLOW_MEMORY_GROWTH=1 \
		-s DEMANGLE_SUPPORT=1 \
		-s MODULARIZE=1 \
		-s 'EXPORT_NAME="createPDFLib"' \
		-s "EXPORTED_FUNCTIONS=[ \
		  '_FPDFPage_CountObjects', \
			'_FPDFPage_GetObject', \
			'_FPDFPage_RemoveObject' \
			]" \
		-s TOTAL_MEMORY=268435456
