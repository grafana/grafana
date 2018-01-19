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
AUTOMAKE_OPTIONS = subdir-objects serial-tests

noinst_LTLIBRARIES = libtestcglib.la
nodist_libtestcglib_la_SOURCES = \
	gen-c_glib/t_test_second_service.c \
	gen-c_glib/t_test_second_service.h \
	gen-c_glib/t_test_thrift_test.c \
	gen-c_glib/t_test_thrift_test.h \
	gen-c_glib/t_test_thrift_test_types.c \
	gen-c_glib/t_test_thrift_test_types.h

libtestcglib_la_LIBADD = $(top_builddir)/lib/c_glib/libthrift_c_glib.la

precross: libtestcglib.la test_client test_server

check_PROGRAMS = \
	test_client \
	test_server

test_client_SOURCES = \
	src/test_client.c

test_client_LDADD = \
	libtestcglib.la \
	$(top_builddir)/lib/c_glib/libthrift_c_glib.la

test_server_SOURCES = \
	src/thrift_test_handler.c \
	src/thrift_test_handler.h \
	src/test_server.c

test_server_LDADD = \
	libtestcglib.la \
	$(top_builddir)/lib/c_glib/libthrift_c_glib.la

#
# Common thrift code generation rules
#
THRIFT = $(top_builddir)/compiler/cpp/thrift

gen-c_glib/t_test_second_service.c  gen-c_glib/t_test_second_service.h  gen-c_glib/t_test_thrift_test.c  gen-c_glib/t_test_thrift_test.h  gen-c_glib/t_test_thrift_test_types.c  gen-c_glib/t_test_thrift_test_types.h: $(top_srcdir)/test/ThriftTest.thrift $(THRIFT)
	$(THRIFT) --gen c_glib -r $<

AM_CFLAGS = -g -Wall -Wextra $(GLIB_CFLAGS) $(GOBJECT_CFLAGS)
AM_CXXFLAGS = $(AM_CFLAGS)
AM_CPPFLAGS = -I$(top_srcdir)/lib/c_glib/src -Igen-c_glib
AM_LDFLAGS = $(GLIB_LIBS) $(GOBJECT_LIBS) @GCOV_LDFLAGS@

clean-local:
	$(RM) gen-c_glib/*

EXTRA_DIST = \
	src/test_client.c \
	src/thrift_test_handler.c \
	src/thrift_test_handler.h \
	src/test_server.c
