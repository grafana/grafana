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


set(CMAKE_DEBUG_POSTFIX "d" CACHE STRING "Set debug library postfix" FORCE)


macro(ADD_LIBRARY_THRIFT name)

if(WITH_SHARED_LIB)
    add_library(${name} SHARED ${ARGN})
    set_target_properties(${name} PROPERTIES
        OUTPUT_NAME ${name}
        VERSION ${thrift_VERSION}
        SOVERSION ${thrift_VERSION} )
    #set_target_properties(${name} PROPERTIES PUBLIC_HEADER "${thriftcpp_HEADERS}")
    install(TARGETS ${name}
        RUNTIME DESTINATION "${BIN_INSTALL_DIR}"
        LIBRARY DESTINATION "${LIB_INSTALL_DIR}"
        ARCHIVE DESTINATION "${LIB_INSTALL_DIR}"
        PUBLIC_HEADER DESTINATION "${INCLUDE_INSTALL_DIR}")
endif()

if(WITH_STATIC_LIB)
    add_library(${name}_static STATIC ${ARGN})
    set_target_properties(${name}_static PROPERTIES
        OUTPUT_NAME ${name}${STATIC_POSTFIX}
        VERSION ${thrift_VERSION}
        SOVERSION ${thrift_VERSION} )
    install(TARGETS ${name}_static
        RUNTIME DESTINATION "${BIN_INSTALL_DIR}"
        LIBRARY DESTINATION "${LIB_INSTALL_DIR}"
        ARCHIVE DESTINATION "${LIB_INSTALL_DIR}"
        PUBLIC_HEADER DESTINATION "${INCLUDE_INSTALL_DIR}")
endif()

endmacro(ADD_LIBRARY_THRIFT)


macro(TARGET_INCLUDE_DIRECTORIES_THRIFT name)

if(WITH_SHARED_LIB)
    target_include_directories(${name} ${ARGN})
endif()

if(WITH_STATIC_LIB)
    target_include_directories(${name}_static ${ARGN})
endif()

endmacro(TARGET_INCLUDE_DIRECTORIES_THRIFT)


macro(TARGET_LINK_LIBRARIES_THRIFT name)

if(WITH_SHARED_LIB)
    target_link_libraries(${name} ${ARGN})
endif()

if(WITH_STATIC_LIB)
    target_link_libraries(${name}_static ${ARGN})
endif()

endmacro(TARGET_LINK_LIBRARIES_THRIFT)


macro(LINK_AGAINST_THRIFT_LIBRARY target libname)

if (WITH_SHARED_LIB)
    target_link_libraries(${target} ${libname})
elseif (WITH_STATIC_LIB)
    target_link_libraries(${target} ${libname}_static)
else()
    message(FATAL "Not linking with shared or static libraries?")
endif()

endmacro(LINK_AGAINST_THRIFT_LIBRARY)


macro(TARGET_LINK_LIBRARIES_THRIFT_AGAINST_THRIFT_LIBRARY target libname)

if(WITH_SHARED_LIB)
    target_link_libraries(${target} ${ARGN} ${libname})
endif()

if(WITH_STATIC_LIB)
    target_link_libraries(${target}_static ${ARGN} ${libname}_static)
endif()

endmacro(TARGET_LINK_LIBRARIES_THRIFT_AGAINST_THRIFT_LIBRARY)
