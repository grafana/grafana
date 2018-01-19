How to use the test case:
----------------------------------------------
- copy and the template batch file
- open the batch file and adjust configuration as necessary
- run the batch


Configuration:
----------------------------------------------
SVNWORKDIR
should point to the Thrift working copy root

MY_THRIFT_FILES
can be set to point to a folder with more thrift IDL files.
If you don't have any such files, just leave the setting blank.

BIN
Local MSYS binary folder. Your THRIFT.EXE is installed here.

MINGW_BIN
Local MinGW bin folder. Contains DLL files required by THRIFT.EXE

DCC
Identifies the Delphi Command Line compiler (dcc32.exe)
To be configuired only, if the default is not suitable.

----------------------------------------------
*EOF*