# Build compiler using CMake

Use the following steps to build using cmake:

    mkdir cmake-build
    cd cmake-build
    cmake ..
    make


### Create an eclipse project

    mkdir cmake-ec && cd cmake-ec
    cmake -G "Eclipse CDT4 - Unix Makefiles" ..
    make

Now open the folder cmake-ec using eclipse.


### Cross compile using mingw32 and generate a Windows Installer with CPack

    mkdir cmake-mingw32 && cd cmake-mingw32
    cmake -DCMAKE_TOOLCHAIN_FILE=../build/cmake/mingw32-toolchain.cmake -DBUILD_COMPILER=ON -DBUILD_LIBRARIES=OFF -DBUILD_TESTING=OFF -DBUILD_EXAMPLES=OFF ..
    cpack

## Build on windows

### using Git Bash
Git Bash provides flex and bison, so you just need to do this:

    mkdir cmake-vs && cd cmake-vs
    cmake -DWITH_SHARED_LIB=off ..

### using Win flex-bison

In order to build on windows with winflexbison a few additional steps are necessary:

1. Download winflexbison from http://sourceforge.net/projects/winflexbison/
2. Extract the winflex bison files to for e.g. C:\winflexbison
3. Make the CMake variables point to the correct binaries.
  * FLEX_EXECUTABLE = C:/winbuild/win_flex.exe
  * BISON_EXECUTABLE = C:/winbuild/win_bison.exe
4. Generate a Visual Studio project:
```
mkdir cmake-vs && cd cmake-vs
cmake -G "Visual Studio 12" -DWITH_SHARED_LIB=off ..
```
5. Now open the folder build_vs using Visual Studio 2013.

# Building the Thrift IDL compiler in Windows

If you don't want to use CMake you can use the already available Visual Studio
2010 solution.
The Visual Studio project contains pre-build commands to generate the
thriftl.cc, thrifty.cc and thrifty.hh files which are necessary to build
the compiler. These depend on bison, flex and their dependencies to
work properly.
Download flex & bison as described above.
Place these binaries somewhere in the path and
rename win_flex.exe and win_bison.exe to flex.exe and bison.exe respectively.

If this doesn't work on a system, try these manual pre-build steps.

Open compiler.sln and remove the Pre-build commands under the project's
 Properties -> Build Events -> Pre-Build Events.

From a command prompt:
> cd thrift/compiler/cpp
> flex -osrc\thrift\thriftl.cc src\thrift\thriftl.ll
In the generated thriftl.cc, comment out #include <unistd.h>

Place a copy of bison.simple in thrift/compiler/cpp
> bison -y -o "src/thrift/thrifty.cc" --defines src/thrift/thrifty.yy
> move src\thrift\thrifty.cc.hh  src\thrift\thrifty.hh

Bison might generate the yacc header file "thrifty.cc.h" with just one h ".h" extension; in this case you'll have to rename to "thrifty.h".

> move src\thrift\version.h.in src\thrift\version.h

Download inttypes.h from the interwebs and place it in an include path
location (e.g. thrift/compiler/cpp/src).

Build the compiler in Visual Studio.
