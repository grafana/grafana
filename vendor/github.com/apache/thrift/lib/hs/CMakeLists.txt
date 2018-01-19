#
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements. See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership. The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License. You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied. See the License for the
# specific language governing permissions and limitations
# under the License.
#

# Rebuild when any of these files changes
set(haskell_sources
    src/Thrift.hs
    src/Thrift/Arbitraries.hs
    src/Thrift/Protocol.hs
    src/Thrift/Protocol/Binary.hs
    src/Thrift/Protocol/Compact.hs
    src/Thrift/Protocol/JSON.hs
    src/Thrift/Server.hs
    src/Thrift/Transport.hs
    src/Thrift/Transport/Empty.hs
    src/Thrift/Transport/Framed.hs
    src/Thrift/Transport/Handle.hs
    src/Thrift/Transport/HttpClient.hs
    src/Thrift/Transport/IOBuffer.hs
    src/Thrift/Types.hs
    Thrift.cabal
)

if(BUILD_TESTING)
    list(APPEND haskell_soruces
        test/Spec.hs
        test/BinarySpec.hs
        test/CompactSpec.hs
        test/JSONSpec.hs
    )
    set(hs_enable_test "--enable-tests")
endif()

set(haskell_artifacts thrift_cabal.stamp)
# Adding *.hi files so that any missing file triggers the build
foreach(SRC ${haskell_sources})
    get_filename_component(EX ${SRC} EXT)
    if(${EX} STREQUAL ".hs")
        file(RELATIVE_PATH REL ${CMAKE_CURRENT_SOURCE_DIR}/src ${CMAKE_CURRENT_SOURCE_DIR}/${SRC})
        get_filename_component(DIR ${REL} DIRECTORY)
        get_filename_component(BASE ${REL} NAME_WE)
        list(APPEND haskell_artifacts dist/build/${DIR}/${BASE}.hi)
    endif()
endforeach()

if(CMAKE_BUILD_TYPE STREQUAL "Debug")
    set(hs_optimize -O0)
elseif(CMAKE_BUILD_TYPE STREQUAL "Release")
    set(hs_optimize -O1)
endif()

add_custom_command(
    OUTPUT ${haskell_artifacts}
    COMMAND ${CABAL} update
    # Build dependencies first without --builddir, otherwise it fails.
    COMMAND ${CABAL} install --only-dependencies ${hs_enable_test}
    COMMAND ${CABAL} configure ${hs_optimize} ${hs_enable_test} --builddir=${CMAKE_CURRENT_BINARY_DIR}/dist
    COMMAND ${CABAL} build --builddir=${CMAKE_CURRENT_BINARY_DIR}/dist
    COMMAND ${CABAL} install --builddir=${CMAKE_CURRENT_BINARY_DIR}/dist
    COMMAND ${CMAKE_COMMAND} -E touch ${CMAKE_CURRENT_BINARY_DIR}/thrift_cabal.stamp
    WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
    DEPENDS ${haskell_sources}
    COMMENT "Building Haskell library")

add_custom_target(haskell_library ALL
    DEPENDS ${haskell_artifacts})

if(BUILD_TESTING)
    add_test(NAME HaskellCabalCheck
            COMMAND ${CABAL} check
            WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR})
    add_test(NAME HaskellCabalTest
            # Cabal fails to find built executable when --builddir is specified.
            # So we invoke the executable directly.
            # COMMAND ${CABAL} test --builddir=${CMAKE_CURRENT_BINARY_DIR}/dist
            # WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR})
            COMMAND dist/build/spec/spec)
endif()
