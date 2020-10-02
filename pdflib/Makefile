all: main.js

PDFIUM=/home/adlr/Code/FN/repo/pdfium

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
	em++ -c $(CFLAGS) -MMD $(INC) -o $@ $<

main.js: $(OBJS)
	em++ $(CFLAGS) -o $@ $(OBJS) \
		-s "EXTRA_EXPORTED_RUNTIME_METHODS=['cwrap']" \
		-s ALLOW_MEMORY_GROWTH=1 \
		-s DEMANGLE_SUPPORT=1 \
		-s MODULARIZE=1 \
		-s TOTAL_MEMORY=268435456
