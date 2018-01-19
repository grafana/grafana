# Apache Thrift - CMake build

## Goal
Extend Apache Thrift's *make cross* approach to the build system.

Due to growing the field of operating system support, a proper executable
and library detection mechanism running on as much platforms as possible
becomes required. The other aspect to simplify the release process and
package generation process.

As nice side benefit of CMake is the generation of development environment
specific soultion files. => No solution files within source tree.


## Usage
just do this:

    mkdir cmake-build && cd cmake-build
    cmake ..

if you use a specific toolchain pass it to cmake, the same for options:

    cmake -DCMAKE_TOOLCHAIN_FILE=../build/cmake/mingw32-toolchain.cmake ..
    cmake -DCMAKE_C_COMPILER=clang-3.5 -DCMAKE_CXX_COMPILER=clang++-3.5 ..
    cmake -DTHRIFT_COMPILER_HS=OFF ..
    cmake -DWITH_ZLIB=ON ..

or on Windows

    cmake -G "Visual Studio 12 2013 Win64" \
    -DBOOST_ROOT=C:/3rdparty/boost_1_58_0 \
    -DZLIB_ROOT=C:/3rdparty/zlib128-dll \
    -DWITH_SHARED_LIB=off -DWITH_BOOSTTHREADS=ON ..

and open the development environment you like with the solution or do this:

    make
    make check
    make cross
    make dist

to generate an installer and distribution package do this:

    cpack

## TODO
* git hash or tag based versioning depending on source state
* build tutorial
* build test
* with/without language lib/<lang>/
* enable/disable
* make cross
* make dist (create an alias to make package_source)
* make doc
* cpack (C++ and make dist only ?)
  * thrift-compiler
  * libthrift
  * tutorial
  * test
* merge into /README.md
