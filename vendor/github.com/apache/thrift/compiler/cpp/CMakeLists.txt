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

configure_file(${CMAKE_CURRENT_SOURCE_DIR}/src/thrift/version.h.in ${CMAKE_CURRENT_BINARY_DIR}/thrift/version.h)

find_package(FLEX REQUIRED)
find_package(BISON REQUIRED)

# Create flex and bison files and build the lib parse static library
BISON_TARGET(thrifty ${CMAKE_CURRENT_SOURCE_DIR}/src/thrift/thrifty.yy ${CMAKE_CURRENT_BINARY_DIR}/thrift/thrifty.cc)
FLEX_TARGET(thriftl ${CMAKE_CURRENT_SOURCE_DIR}/src/thrift/thriftl.ll ${CMAKE_CURRENT_BINARY_DIR}/thrift/thriftl.cc)
ADD_FLEX_BISON_DEPENDENCY(thriftl thrifty)

# HACK: Work around the fact that bison crates a .hh file but we need a .h file
add_custom_command(OUTPUT ${CMAKE_CURRENT_BINARY_DIR}/thrift/thrifty.h
                   COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_BINARY_DIR}/thrift/thrifty.hh ${CMAKE_CURRENT_BINARY_DIR}/thrift/thrifty.h
                   DEPENDS ${CMAKE_CURRENT_BINARY_DIR}/thrift/thrifty.hh
                   )

set(libparse_SOURCES
    ${CMAKE_CURRENT_BINARY_DIR}/thrift/thrifty.cc
    ${CMAKE_CURRENT_BINARY_DIR}/thrift/thriftl.cc
    ${CMAKE_CURRENT_BINARY_DIR}/thrift/thrifty.h
)

add_library(libparse STATIC ${libparse_SOURCES})

# Create the thrift compiler
set(compiler_core
    src/thrift/common.cc
    src/thrift/generate/t_generator.cc
    src/thrift/parse/t_typedef.cc
    src/thrift/parse/parse.cc
    ${CMAKE_CURRENT_BINARY_DIR}/thrift/version.h
)

set(thrift-compiler_SOURCES
    src/thrift/main.cc
    src/thrift/audit/t_audit.cpp
)

# This macro adds an option THRIFT_COMPILER_${NAME}
# that allows enabling or disabling certain languages
macro(THRIFT_ADD_COMPILER name description initial)
    string(TOUPPER "THRIFT_COMPILER_${name}" enabler)
    set(src "src/thrift/generate/t_${name}_generator.cc")
    option(${enabler} ${description} ${initial})
    if(${enabler})
        list(APPEND thrift-compiler_SOURCES ${src})
    endif()
endmacro()

# The following compiler can be enabled or disabled
THRIFT_ADD_COMPILER(c_glib  "Enable compiler for C with Glib" ON)
THRIFT_ADD_COMPILER(cpp     "Enable compiler for C++" ON)
THRIFT_ADD_COMPILER(java    "Enable compiler for Java"   ON)
THRIFT_ADD_COMPILER(as3     "Enable compiler for ActionScript 3" ON)
THRIFT_ADD_COMPILER(dart    "Enable compiler for Dart" ON)
THRIFT_ADD_COMPILER(haxe    "Enable compiler for Haxe" ON)
THRIFT_ADD_COMPILER(csharp  "Enable compiler for C#" ON)
THRIFT_ADD_COMPILER(py      "Enable compiler for Python 2.0" ON)
THRIFT_ADD_COMPILER(rb      "Enable compiler for Ruby" ON)
THRIFT_ADD_COMPILER(perl    "Enable compiler for Perl" ON)
THRIFT_ADD_COMPILER(php     "Enable compiler for PHP" ON)
THRIFT_ADD_COMPILER(erl     "Enable compiler for Erlang" ON)
THRIFT_ADD_COMPILER(cocoa   "Enable compiler for Cocoa Objective-C" ON)
THRIFT_ADD_COMPILER(swift   "Enable compiler for Cocoa Swift" ON)
THRIFT_ADD_COMPILER(st      "Enable compiler for Smalltalk" ON)
THRIFT_ADD_COMPILER(ocaml   "Enable compiler for OCaml" ON)
THRIFT_ADD_COMPILER(hs      "Enable compiler for Haskell" ON)
THRIFT_ADD_COMPILER(xsd     "Enable compiler for XSD" ON)
THRIFT_ADD_COMPILER(html    "Enable compiler for HTML Documentation" ON)
THRIFT_ADD_COMPILER(js      "Enable compiler for JavaScript" ON)
THRIFT_ADD_COMPILER(json    "Enable compiler for JSON" ON)
THRIFT_ADD_COMPILER(javame  "Enable compiler for Java ME" ON)
THRIFT_ADD_COMPILER(delphi  "Enable compiler for Delphi" ON)
THRIFT_ADD_COMPILER(go      "Enable compiler for Go" ON)
THRIFT_ADD_COMPILER(d       "Enable compiler for D" ON)
THRIFT_ADD_COMPILER(lua     "Enable compiler for Lua" ON)
THRIFT_ADD_COMPILER(gv      "Enable compiler for GraphViz" ON)
THRIFT_ADD_COMPILER(xml     "Enable compiler for XML" ON)

# Thrift is looking for include files in the src directory
# we also add the current binary directory for generated files
include_directories(${CMAKE_CURRENT_BINARY_DIR} src)

if(NOT ${WITH_PLUGIN})
    list(APPEND thrift-compiler_SOURCES ${compiler_core})
endif()
add_executable(thrift-compiler ${thrift-compiler_SOURCES})

if(${WITH_PLUGIN})
    add_executable(thrift-bootstrap ${compiler_core}
        src/thrift/main.cc
        src/thrift/audit/t_audit.cpp
        src/thrift/generate/t_cpp_generator.cc
    )
    target_link_libraries(thrift-bootstrap libparse)

    set(PLUGIN_GEN_SOURCES
        ${CMAKE_CURRENT_BINARY_DIR}/thrift/plugin/plugin_types.h
        ${CMAKE_CURRENT_BINARY_DIR}/thrift/plugin/plugin_types.cpp
        ${CMAKE_CURRENT_BINARY_DIR}/thrift/plugin/plugin_constants.h
        ${CMAKE_CURRENT_BINARY_DIR}/thrift/plugin/plugin_constants.cpp
    )

    file(MAKE_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}/thrift/plugin)
    add_custom_command(OUTPUT ${PLUGIN_GEN_SOURCES}
        DEPENDS thrift-bootstrap src/thrift/plugin/plugin.thrift
        COMMAND thrift-bootstrap -gen cpp
        -out ${CMAKE_CURRENT_BINARY_DIR}/thrift/plugin
        ${CMAKE_CURRENT_SOURCE_DIR}/src/thrift/plugin/plugin.thrift
    )

    include_directories(../../lib/cpp/src)

    include(ThriftMacros)
    ADD_LIBRARY_THRIFT(thriftc
        ${compiler_core}
        ${PLUGIN_GEN_SOURCES}
        src/thrift/logging.cc
        src/thrift/plugin/plugin_output.cc
        src/thrift/plugin/plugin.cc
    )
    TARGET_INCLUDE_DIRECTORIES_THRIFT(thriftc PUBLIC ${Boost_INCLUDE_DIRS})
    TARGET_LINK_LIBRARIES_THRIFT_AGAINST_THRIFT_LIBRARY(thriftc thrift PUBLIC)
    target_compile_definitions(thrift-compiler PUBLIC THRIFT_ENABLE_PLUGIN)
    LINK_AGAINST_THRIFT_LIBRARY(thrift-compiler thriftc)
endif()

set_target_properties(thrift-compiler PROPERTIES OUTPUT_NAME thrift)

target_link_libraries(thrift-compiler libparse)

install(TARGETS thrift-compiler DESTINATION "${BIN_INSTALL_DIR}")

if(${WITH_PLUGIN})
  # Install the headers
  install(FILES
      "src/thrift/common.h"
      "src/thrift/globals.h"
      "src/thrift/logging.h"
      "src/thrift/main.h"
      "src/thrift/platform.h"
      "${CMAKE_BINARY_DIR}/compiler/cpp/thrift/version.h"
      DESTINATION "${INCLUDE_INSTALL_DIR}/thrift")
  install(FILES
      "src/thrift/audit/t_audit.h"
      DESTINATION "${INCLUDE_INSTALL_DIR}/thrift/audit")
  install(FILES
      "src/thrift/generate/t_generator.h"
      "src/thrift/generate/t_generator_registry.h"
      "src/thrift/generate/t_html_generator.h"
      "src/thrift/generate/t_oop_generator.h"
      DESTINATION "${INCLUDE_INSTALL_DIR}/thrift/generate")
  install(FILES
      "src/thrift/parse/t_base_type.h"
      "src/thrift/parse/t_const.h"
      "src/thrift/parse/t_const_value.h"
      "src/thrift/parse/t_container.h"
      "src/thrift/parse/t_doc.h"
      "src/thrift/parse/t_enum.h"
      "src/thrift/parse/t_enum_value.h"
      "src/thrift/parse/t_field.h"
      "src/thrift/parse/t_function.h"
      "src/thrift/parse/t_list.h"
      "src/thrift/parse/t_map.h"
      "src/thrift/parse/t_program.h"
      "src/thrift/parse/t_scope.h"
      "src/thrift/parse/t_service.h"
      "src/thrift/parse/t_set.h"
      "src/thrift/parse/t_struct.h"
      "src/thrift/parse/t_typedef.h"
      "src/thrift/parse/t_type.h"
      DESTINATION "${INCLUDE_INSTALL_DIR}/thrift/parse")
  install(FILES
      "src/thrift/plugin/plugin.h"
      "src/thrift/plugin/plugin_output.h"
      "src/thrift/plugin/type_util.h"
      DESTINATION "${INCLUDE_INSTALL_DIR}/thrift/plugin")
if(MSVC)
  install(FILES
      "src/thrift/windows/config.h"
      DESTINATION "${INCLUDE_INSTALL_DIR}/thrift/windows")
endif()
endif()

if(BUILD_TESTING)
    add_subdirectory(test)
endif()
