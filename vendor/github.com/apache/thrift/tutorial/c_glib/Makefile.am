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

BUILT_SOURCES = \
	gen-c_glib/calculator.h \
	gen-c_glib/shared_service.h \
	gen-c_glib/shared_types.h \
	gen-c_glib/tutorial_types.h

AM_CFLAGS = -g -Wall -Wextra -pedantic $(GLIB_CFLAGS) $(GOBJECT_CFLAGS) @GCOV_CFLAGS@
AM_CPPFLAGS = -I$(top_srcdir)/lib/c_glib/src -Igen-c_glib
AM_LDFLAGS = $(GLIB_LIBS) $(GOBJECT_LIBS) @GCOV_LDFLAGS@

THRIFT = $(top_builddir)/compiler/cpp/thrift

noinst_LTLIBRARIES = \
	libtutorialgencglib.la

nodist_libtutorialgencglib_la_SOURCES = \
	gen-c_glib/calculator.c \
	gen-c_glib/calculator.h \
	gen-c_glib/shared_service.c \
	gen-c_glib/shared_service.h \
	gen-c_glib/shared_types.c \
	gen-c_glib/shared_types.h \
	gen-c_glib/tutorial_types.c \
	gen-c_glib/tutorial_types.h

libtutorialgencglib_la_LIBADD = \
	$(top_builddir)/lib/c_glib/libthrift_c_glib.la

libtutorialgencglib_la_CFLAGS = \
	$(AM_CFLAGS) -Wno-unused-function

noinst_PROGRAMS = \
	tutorial_server \
	tutorial_client

tutorial_server_SOURCES = \
	c_glib_server.c

tutorial_server_LDADD = \
	libtutorialgencglib.la \
	$(top_builddir)/lib/c_glib/libthrift_c_glib.la

tutorial_client_SOURCES = \
	c_glib_client.c

tutorial_client_LDADD = \
	libtutorialgencglib.la \
	$(top_builddir)/lib/c_glib/libthrift_c_glib.la


gen-c_glib/calculator.c gen-c_glib/calculator.h gen-c_glib/shared_service.c gen-c_glib/shared_service.h gen-c_glib/shared_types.c gen-c_glib/shared_types.h gen-c_glib/tutorial_types.c gen-c_glib/tutorial_types.h: $(top_srcdir)/tutorial/tutorial.thrift
	$(THRIFT) --gen c_glib -r $<

clean-local:
	$(RM) gen-c_glib/*

tutorialserver: all
	./tutorial_server

tutorialclient: all
	./tutorial_client

EXTRA_DIST = \
	c_glib_server.c \
	c_glib_client.c
