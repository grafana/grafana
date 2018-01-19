ifeq ($(OS),Windows_NT)
EXE=extension.exe
EXT=sqlite3_mod_regexp.dll
RM=cmd /c del
LDFLAG=
else
EXE=extension
EXT=sqlite3_mod_regexp.so
RM=rm
LDFLAG=-fPIC
endif

all : $(EXE) $(EXT)

$(EXE) : extension.go
	go build $<

$(EXT) : sqlite3_mod_regexp.c
	gcc $(LDFLAG) -shared -o $@ $< -lsqlite3 -lpcre

clean :
	@-$(RM) $(EXE) $(EXT)
