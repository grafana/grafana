# CMake mingw32 cross compile toolchain file

# the name of the target operating system
SET(CMAKE_SYSTEM_NAME Windows)

# which compilers to use for C and C++
SET(CMAKE_C_COMPILER i586-mingw32msvc-gcc)
SET(CMAKE_CXX_COMPILER i586-mingw32msvc-g++)
SET(CMAKE_RC_COMPILER i586-mingw32msvc-windres)

# here is the target environment located
SET(CMAKE_FIND_ROOT_PATH /usr/i586-mingw32msvc)

# adjust the default behaviour of the FIND_XXX() commands:
# search headers and libraries in the target environment, search
# programs in the host environment
set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)
set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE ONLY)

set(BUILD_SHARED_LIBS OFF)
SET(CMAKE_EXE_LINKER_FLAGS "-static")
set(CMAKE_C_FLAGS ${CMAKE_C_FLAGS} "-static-libgcc")
set(CMAKE_CXX_FLAGS ${CMAKE_CXX_FLAGS} "-static-libstdc++")
