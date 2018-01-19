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

# Find required packages
find_package(GLIB REQUIRED COMPONENTS gobject)
include_directories(${GLIB_INCLUDE_DIRS})

include_directories(src)

# SYSLIBS contains libraries that need to be linked to all lib targets
set(SYSLIBS ${GLIB_LIBRARIES} ${GLIB_GOBJECT_LIBRARIES})

# Create the thrift C glib library
set(thrift_c_glib_SOURCES
    src/thrift/c_glib/thrift.c
    src/thrift/c_glib/thrift_struct.c
    src/thrift/c_glib/thrift_application_exception.c
    src/thrift/c_glib/processor/thrift_processor.c
    src/thrift/c_glib/processor/thrift_dispatch_processor.c
    src/thrift/c_glib/protocol/thrift_protocol.c
    src/thrift/c_glib/protocol/thrift_protocol_factory.c
    src/thrift/c_glib/protocol/thrift_binary_protocol.c
    src/thrift/c_glib/protocol/thrift_binary_protocol_factory.c
    src/thrift/c_glib/protocol/thrift_compact_protocol.c
    src/thrift/c_glib/protocol/thrift_compact_protocol_factory.c
    src/thrift/c_glib/transport/thrift_transport.c
    src/thrift/c_glib/transport/thrift_transport_factory.c
    src/thrift/c_glib/transport/thrift_buffered_transport_factory.c
    src/thrift/c_glib/transport/thrift_framed_transport_factory.c
    src/thrift/c_glib/transport/thrift_socket.c
    src/thrift/c_glib/transport/thrift_server_transport.c
    src/thrift/c_glib/transport/thrift_server_socket.c
    src/thrift/c_glib/transport/thrift_buffered_transport.c
    src/thrift/c_glib/transport/thrift_fd_transport.c
    src/thrift/c_glib/transport/thrift_framed_transport.c
    src/thrift/c_glib/transport/thrift_memory_buffer.c
    src/thrift/c_glib/server/thrift_server.c
    src/thrift/c_glib/server/thrift_simple_server.c
)

# Contains the thrift specific ADD_LIBRARY_THRIFT and TARGET_LINK_LIBRARIES_THRIFT
include(ThriftMacros)

ADD_LIBRARY_THRIFT(thrift_c_glib ${thrift_c_glib_SOURCES})
TARGET_LINK_LIBRARIES_THRIFT(thrift_c_glib ${SYSLIBS})

# Install the headers
install(DIRECTORY "src/thrift" DESTINATION "${INCLUDE_INSTALL_DIR}"
    FILES_MATCHING PATTERN "*.h")
# Copy config.h file
install(DIRECTORY "${CMAKE_BINARY_DIR}/thrift" DESTINATION "${INCLUDE_INSTALL_DIR}"
    FILES_MATCHING PATTERN "*.h")

if(BUILD_TESTING)
    add_subdirectory(test)
endif()
