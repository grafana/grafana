ifeq ($(OS),Windows_NT)
EXE=extension.exe
EXT=sqlite3_mod_vtable.dll
RM=cmd /c del
LIBCURL=-lcurldll
LDFLAG=
else
EXE=extension
EXT=sqlite3_mod_vtable.so
RM=rm
LDFLAG=-fPIC
LIBCURL=-lcurl
endif

all : $(EXE) $(EXT)

$(EXE) : extension.go
	go build $<

$(EXT) : sqlite3_mod_vtable.cc
	g++ $(LDFLAG) -shared -o $@ $< -lsqlite3 $(LIBCURL)

clean :
	@-$(RM) $(EXE) $(EXT)
