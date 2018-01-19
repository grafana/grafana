#
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements. See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership. The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License. You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied. See the License for the
# specific language governing permissions and limitations
# under the License.
#
AUTOMAKE_OPTIONS = subdir-objects serial-tests

SUBDIRS =

BUILT_SOURCES = \
        gen-c_glib/t_test_container_test_types.c \
        gen-c_glib/t_test_container_test_types.h \
        gen-c_glib/t_test_debug_proto_test_types.h \
        gen-c_glib/t_test_empty_service.h \
        gen-c_glib/t_test_inherited.h \
        gen-c_glib/t_test_optional_required_test_types.h \
        gen-c_glib/t_test_reverse_order_service.h \
        gen-c_glib/t_test_second_service.h \
        gen-c_glib/t_test_service_for_exception_with_a_map.h \
        gen-c_glib/t_test_container_service.c \
        gen-c_glib/t_test_container_service.h \
        gen-c_glib/t_test_srv.h \
        gen-c_glib/t_test_thrift_test.h \
        gen-c_glib/t_test_thrift_test_types.h

AM_CPPFLAGS = -I../src -I./gen-c_glib
AM_CFLAGS = -g -Wall -Wextra -pedantic $(GLIB_CFLAGS) $(GOBJECT_CFLAGS) \
	@GCOV_CFLAGS@
AM_CXXFLAGS = $(AM_CFLAGS)
AM_LDFLAGS = $(GLIB_LIBS) $(GOBJECT_LIBS) @GCOV_LDFLAGS@

check_PROGRAMS = \
  testserialization \
  testapplicationexception \
  testcontainertest \
  testtransportsocket \
  testbinaryprotocol \
  testcompactprotocol \
  testbufferedtransport \
  testframedtransport \
  testfdtransport \
  testmemorybuffer \
  teststruct \
  testsimpleserver \
  testdebugproto \
  testoptionalrequired \
  testthrifttest

if WITH_CPP
  BUILT_SOURCES += gen-cpp/ThriftTest_types.cpp
  check_PROGRAMS += testthrifttestclient
endif

testserialization_SOURCES = testserialization.c
testserialization_LDADD = \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/protocol/libthrift_c_glib_la-thrift_protocol.o \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/transport/libthrift_c_glib_la-thrift_transport.o \
    libtestgenc.la

testapplicationexception_SOURCES = testapplicationexception.c
testapplicationexception_LDADD = \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/libthrift_c_glib_la-thrift_application_exception.o \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/protocol/libthrift_c_glib_la-thrift_protocol.o \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/libthrift_c_glib_la-thrift_struct.o \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/transport/libthrift_c_glib_la-thrift_transport.o

testcontainertest_SOURCES = testcontainertest.c
testcontainertest_LDADD = \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/libthrift_c_glib_la-thrift_struct.o \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/protocol/libthrift_c_glib_la-thrift_protocol.o \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/transport/libthrift_c_glib_la-thrift_transport.o \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/transport/libthrift_c_glib_la-thrift_transport_factory.o \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/processor/libthrift_c_glib_la-thrift_processor.o \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/protocol/libthrift_c_glib_la-thrift_protocol_factory.o \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/protocol/libthrift_c_glib_la-thrift_binary_protocol.o \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/protocol/libthrift_c_glib_la-thrift_binary_protocol_factory.o \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/transport/libthrift_c_glib_la-thrift_socket.o \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/transport/libthrift_c_glib_la-thrift_server_transport.o \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/transport/libthrift_c_glib_la-thrift_server_socket.o \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/server/libthrift_c_glib_la-thrift_server.o \
	  libtestgenc.la

testtransportsocket_SOURCES = testtransportsocket.c
testtransportsocket_LDADD = \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/transport/libthrift_c_glib_la-thrift_transport.o \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/transport/libthrift_c_glib_la-thrift_buffered_transport.o \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/transport/libthrift_c_glib_la-thrift_server_transport.o \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/transport/libthrift_c_glib_la-thrift_server_socket.o

testbinaryprotocol_SOURCES = testbinaryprotocol.c
testbinaryprotocol_LDADD = \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/protocol/libthrift_c_glib_la-thrift_protocol.o \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/transport/libthrift_c_glib_la-thrift_transport.o \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/transport/libthrift_c_glib_la-thrift_framed_transport.o \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/transport/libthrift_c_glib_la-thrift_socket.o \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/transport/libthrift_c_glib_la-thrift_server_transport.o \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/transport/libthrift_c_glib_la-thrift_server_socket.o

testcompactprotocol_SOURCES = testcompactprotocol.c
testcompactprotocol_LDADD = \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/protocol/libthrift_c_glib_la-thrift_protocol.o \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/transport/libthrift_c_glib_la-thrift_transport.o \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/transport/libthrift_c_glib_la-thrift_framed_transport.o \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/transport/libthrift_c_glib_la-thrift_socket.o \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/transport/libthrift_c_glib_la-thrift_server_transport.o \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/transport/libthrift_c_glib_la-thrift_server_socket.o

testbufferedtransport_SOURCES = testbufferedtransport.c
testbufferedtransport_LDADD = \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/transport/libthrift_c_glib_la-thrift_transport.o \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/transport/libthrift_c_glib_la-thrift_socket.o \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/transport/libthrift_c_glib_la-thrift_server_transport.o \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/transport/libthrift_c_glib_la-thrift_server_socket.o

testframedtransport_SOURCES = testframedtransport.c
testframedtransport_LDADD = \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/transport/libthrift_c_glib_la-thrift_transport.o \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/transport/libthrift_c_glib_la-thrift_socket.o \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/transport/libthrift_c_glib_la-thrift_server_transport.o \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/transport/libthrift_c_glib_la-thrift_server_socket.o

testfdtransport_SOURCES = testfdtransport.c
testfdtransport_LDADD = \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/transport/libthrift_c_glib_la-thrift_transport.o \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/transport/libthrift_c_glib_la-thrift_fd_transport.o

testmemorybuffer_SOURCES = testmemorybuffer.c
testmemorybuffer_LDADD = \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/transport/libthrift_c_glib_la-thrift_transport.o

teststruct_SOURCES = teststruct.c
teststruct_LDADD = \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/protocol/libthrift_c_glib_la-thrift_protocol.o \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/transport/libthrift_c_glib_la-thrift_transport.o

testsimpleserver_SOURCES = testsimpleserver.c
testsimpleserver_LDADD = \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/protocol/libthrift_c_glib_la-thrift_protocol.o \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/transport/libthrift_c_glib_la-thrift_transport.o \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/transport/libthrift_c_glib_la-thrift_transport_factory.o \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/processor/libthrift_c_glib_la-thrift_processor.o \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/protocol/libthrift_c_glib_la-thrift_protocol_factory.o \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/protocol/libthrift_c_glib_la-thrift_binary_protocol.o \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/protocol/libthrift_c_glib_la-thrift_binary_protocol_factory.o \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/transport/libthrift_c_glib_la-thrift_socket.o \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/transport/libthrift_c_glib_la-thrift_server_transport.o \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/transport/libthrift_c_glib_la-thrift_server_socket.o \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/server/libthrift_c_glib_la-thrift_server.o

testdebugproto_SOURCES = testdebugproto.c
testdebugproto_LDADD = libtestgenc.la

testoptionalrequired_SOURCES = testoptionalrequired.c
testoptionalrequired_LDADD = \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/protocol/libthrift_c_glib_la-thrift_protocol.o \
    $(top_builddir)/lib/c_glib/src/thrift/c_glib/transport/libthrift_c_glib_la-thrift_transport.o \
    libtestgenc.la

testthrifttest_SOURCES = testthrifttest.c
testthrifttest_LDADD = libtestgenc.la \
    $(top_builddir)/test/c_glib/src/thrift_test_handler.o
testthrifttest_CFLAGS = -I$(top_srcdir)/test/c_glib/src -I./gen-c_glib $(GLIB_CFLAGS)

testthrifttestclient_SOURCES = testthrifttestclient.cpp
testthrifttestclient_CPPFLAGS = -I../../cpp/src $(BOOST_CPPFLAGS) -I./gen-cpp -I../src -I./gen-c_glib $(GLIB_CFLAGS)
testthrifttestclient_LDADD = ../../cpp/.libs/libthrift.la ../libthrift_c_glib.la libtestgenc.la libtestgencpp.la
testthrifttestclient_LDFLAGS = -L../.libs -L../../cpp/.libs $(GLIB_LIBS) $(GOBJECT_LIBS)

check_LTLIBRARIES = libtestgenc.la

if WITH_CPP
  check_LTLIBRARIES += libtestgencpp.la
endif

nodist_libtestgenc_la_SOURCES = \
        gen-c_glib/t_test_container_test_types.c \
        gen-c_glib/t_test_debug_proto_test_types.c \
        gen-c_glib/t_test_enum_test_types.c \
        gen-c_glib/t_test_enum_test_service.c \
        gen-c_glib/t_test_empty_service.c \
        gen-c_glib/t_test_inherited.c \
        gen-c_glib/t_test_optional_required_test_types.c \
        gen-c_glib/t_test_reverse_order_service.c \
        gen-c_glib/t_test_second_service.c \
        gen-c_glib/t_test_service_for_exception_with_a_map.c \
        gen-c_glib/t_test_srv.c \
        gen-c_glib/t_test_container_service.c \
        gen-c_glib/t_test_thrift_test.c \
        gen-c_glib/t_test_thrift_test_types.c \
        gen-c_glib/t_test_container_test_types.h \
        gen-c_glib/t_test_debug_proto_test_types.h \
        gen-c_glib/t_test_enum_test_types.h \
        gen-c_glib/t_test_enum_test_service.h \
        gen-c_glib/t_test_empty_service.h \
        gen-c_glib/t_test_inherited.h \
        gen-c_glib/t_test_optional_required_test_types.h \
        gen-c_glib/t_test_reverse_order_service.h \
        gen-c_glib/t_test_second_service.h \
        gen-c_glib/t_test_service_for_exception_with_a_map.h \
        gen-c_glib/t_test_srv.h \
        gen-c_glib/t_test_container_service.h \
        gen-c_glib/t_test_thrift_test.h \
        gen-c_glib/t_test_thrift_test_types.h
libtestgenc_la_LIBADD = $(top_builddir)/lib/c_glib/libthrift_c_glib.la
libtestgenc_la_CPPFLAGS = $(AM_CPPFLAGS) -Wno-unused-function

nodist_libtestgencpp_la_SOURCES = \
        gen-cpp/ThriftTest.cpp \
        gen-cpp/ThriftTest_constants.cpp \
        gen-cpp/ThriftTest_types.cpp \
        gen-cpp/ThriftTest.h \
        gen-cpp/ThriftTest_constants.h \
        gen-cpp/ThriftTest_types.h
libtestgencpp_la_CPPFLAGS = -I../../cpp/src $(BOOST_CPPFLAGS) -I./gen-cpp

THRIFT = $(top_builddir)/compiler/cpp/thrift

gen-c_glib/t_test_container_test_types.c gen-c_glib/t_test_container_test_types.h gen-c_glib/t_test_container_service.c gen-c_glib/t_test_container_service.h: ContainerTest.thrift $(THRIFT)
	$(THRIFT) --gen c_glib $<

gen-c_glib/t_test_debug_proto_test_types.c gen-c_glib/t_test_debug_proto_test_types.h gen-c_glib/t_test_empty_service.c gen-c_glib/t_test_empty_service.h gen-c_glib/t_test_inherited.c gen-c_glib/t_test_inherited.h gen-c_glib/t_test_reverse_order_service.c gen-c_glib/t_test_reverse_order_service.h gen-c_glib/t_test_service_for_exception_with_a_map.c gen-c_glib/t_test_service_for_exception_with_a_map.h gen-c_glib/t_test_srv.c gen-c_glib/t_test_srv.h: ../../../test/DebugProtoTest.thrift $(THRIFT)
	$(THRIFT) --gen c_glib $<

gen-c_glib/t_test_enum_test_types.c gen-c_glib/t_test_enum_test_types.h gen-c_glib/t_test_enum_test_service.c gen-c_glib/t_test_enum_test_service.h : ../../../test/EnumTest.thrift $(THRIFT)
	$(THRIFT) --gen c_glib $<

gen-c_glib/t_test_optional_required_test_types.c gen-c_glib/t_test_optional_required_test_types.h: ../../../test/OptionalRequiredTest.thrift $(THRIFT)
	$(THRIFT) --gen c_glib $<

gen-c_glib/t_test_second_service.c gen-c_glib/t_test_thrift_test.c gen-c_glib/t_test_thrift_test_types.c gen-c_glib/t_test_second_service.h gen-c_glib/t_test_thrift_test.h gen-c_glib/t_test_thrift_test_types.h: ../../../test/ThriftTest.thrift $(THRIFT)
	$(THRIFT) --gen c_glib $<

gen-cpp/ThriftTest.cpp gen-cpp/ThriftTest_constants.cpp gen-cpp/ThriftTest_types.cpp: ../../../test/ThriftTest.thrift $(THRIFT)
	$(THRIFT) --gen cpp $<

TESTS = \
  $(check_PROGRAMS) \
  $(check_SCRIPTS)

# globally added to all instances of valgrind calls
# VALGRIND_OPTS = --suppressions=glib.suppress
VALGRIND_OPTS =

# globally added to all memcheck calls
VALGRIND_MEM_OPTS = --tool=memcheck \
                    --num-callers=10 \
                    ${myextravalgrindmemopts}

# globally added to all leakcheck calls
VALGRIND_LEAK_OPTS = --tool=memcheck \
                     --num-callers=10 \
                     --leak-check=full \
                     --leak-resolution=high \
                     ${myextravalgrindleakopts}

memcheck: $(check_PROGRAMS)
	@for x in $(check_PROGRAMS);                                     \
	  do                                                             \
	    $(MAKE) memcheck-$$x;                                        \
	  done

leakcheck: $(check_PROGRAMS)
	@for x in $(check_PROGRAMS);                                     \
	  do                                                             \
	    $(MAKE) leakcheck-$$x;                                       \
	done

memcheck-%: %
	@echo "*****************************************";               \
	echo "MEMCHECK: $<";                                             \
	echo "ARGS: ${VALGRIND_OPTS} ${VALGRIND_MEM_OPTS} ${$<_VALGRIND_MEM_OPTS}";                                                                      \
	$(LIBTOOL) --mode=execute                                        \
	  valgrind                                                       \
	    ${VALGRIND_OPTS}                                             \
	    ${VALGRIND_MEM_OPTS}                                         \
	    ${$<_VALGRIND_MEM_OPTS} ./$<

leakcheck-%: %
	@echo "*****************************************";              \
	echo "LEAKCHECK: $<";                                           \
	echo "ARGS: ${VALGRIND_OPTS} ${VALGRIND_LEAK_OPTS} ${$<_VALGRIND_LEAK_OPTS}";                                                                   \
	G_SLICE=always-malloc $(LIBTOOL) --mode=execute                 \
	  valgrind                                                      \
	    ${VALGRIND_OPTS}                                            \
	    ${VALGRIND_LEAK_OPTS}                                       \
	    ${$<_VALGRIND_LEAK_OPTS}  ./$<

clean-local:
	$(RM) gen-c_glib/* gen-cpp/*

CLEANFILES =                            \
    *.bb                                \
    *.bbg                               \
    *.da                                \
    *.gcno                              \
    *.gcda                              \
    *.gcov

EXTRA_DIST = \
             CMakeLists.txt \
             ContainerTest.thrift

