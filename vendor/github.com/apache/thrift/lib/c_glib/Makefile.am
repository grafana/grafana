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
AUTOMAKE_OPTIONS = serial-tests
SUBDIRS = . test

pkgconfigdir = $(libdir)/pkgconfig

lib_LTLIBRARIES = libthrift_c_glib.la
pkgconfig_DATA = thrift_c_glib.pc

AM_CPPFLAGS = -Isrc -I src/thrift/c_glib
AM_CFLAGS = -Wall -Wextra -pedantic

# Define the source files for the module

libthrift_c_glib_la_SOURCES = src/thrift/c_glib/thrift.c \
                              src/thrift/c_glib/thrift_struct.c \
                              src/thrift/c_glib/thrift_application_exception.c \
                              src/thrift/c_glib/processor/thrift_processor.c \
                              src/thrift/c_glib/processor/thrift_dispatch_processor.c \
                              src/thrift/c_glib/protocol/thrift_protocol.c \
                              src/thrift/c_glib/protocol/thrift_protocol_factory.c \
                              src/thrift/c_glib/protocol/thrift_binary_protocol.c \
                              src/thrift/c_glib/protocol/thrift_binary_protocol_factory.c \
                              src/thrift/c_glib/protocol/thrift_compact_protocol.c \
                              src/thrift/c_glib/protocol/thrift_compact_protocol_factory.c \
                              src/thrift/c_glib/transport/thrift_transport.c \
                              src/thrift/c_glib/transport/thrift_transport_factory.c \
                              src/thrift/c_glib/transport/thrift_buffered_transport_factory.c \
                              src/thrift/c_glib/transport/thrift_framed_transport_factory.c \
                              src/thrift/c_glib/transport/thrift_socket.c \
                              src/thrift/c_glib/transport/thrift_server_transport.c \
                              src/thrift/c_glib/transport/thrift_server_socket.c \
                              src/thrift/c_glib/transport/thrift_buffered_transport.c \
                              src/thrift/c_glib/transport/thrift_fd_transport.c \
                              src/thrift/c_glib/transport/thrift_framed_transport.c \
                              src/thrift/c_glib/transport/thrift_memory_buffer.c \
                              src/thrift/c_glib/server/thrift_server.c \
                              src/thrift/c_glib/server/thrift_simple_server.c

libthrift_c_glib_la_CFLAGS = $(AM_CFLAGS) $(GLIB_CFLAGS)

include_thriftdir = $(includedir)/thrift/c_glib
include_thrift_HEADERS = \
                         $(top_builddir)/config.h \
                         src/thrift/c_glib/thrift.h \
                         src/thrift/c_glib/thrift_application_exception.h \
                         src/thrift/c_glib/thrift_struct.h

include_protocoldir = $(include_thriftdir)/protocol
include_protocol_HEADERS = src/thrift/c_glib/protocol/thrift_protocol.h \
                           src/thrift/c_glib/protocol/thrift_protocol_factory.h \
                           src/thrift/c_glib/protocol/thrift_binary_protocol.h \
                           src/thrift/c_glib/protocol/thrift_binary_protocol_factory.h \
                           src/thrift/c_glib/protocol/thrift_compact_protocol.h \
                           src/thrift/c_glib/protocol/thrift_compact_protocol_factory.h

include_transportdir = $(include_thriftdir)/transport
include_transport_HEADERS = src/thrift/c_glib/transport/thrift_buffered_transport.h \
                            src/thrift/c_glib/transport/thrift_fd_transport.h \
                            src/thrift/c_glib/transport/thrift_framed_transport.h \
                            src/thrift/c_glib/transport/thrift_memory_buffer.h \
                            src/thrift/c_glib/transport/thrift_server_socket.h \
                            src/thrift/c_glib/transport/thrift_server_transport.h \
                            src/thrift/c_glib/transport/thrift_socket.h \
                            src/thrift/c_glib/transport/thrift_transport.h \
                            src/thrift/c_glib/transport/thrift_transport_factory.h \
                            src/thrift/c_glib/transport/thrift_buffered_transport_factory.h \
                            src/thrift/c_glib/transport/thrift_framed_transport_factory.h

include_serverdir = $(include_thriftdir)/server
include_server_HEADERS = src/thrift/c_glib/server/thrift_server.h \
                         src/thrift/c_glib/server/thrift_simple_server.h

include_processordir = $(include_thriftdir)/processor
include_processor_HEADERS = src/thrift/c_glib/processor/thrift_processor.h \
                            src/thrift/c_glib/processor/thrift_dispatch_processor.h


EXTRA_DIST = \
             CMakeLists.txt \
             coding_standards.md \
             README.md \
             test/glib.suppress \
             thrift_c_glib.pc.in

CLEANFILES = \
             *.gcno \
             *.gcda
