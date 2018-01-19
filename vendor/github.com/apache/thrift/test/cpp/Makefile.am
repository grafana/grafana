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

BUILT_SOURCES = gen-cpp/ThriftTest.cpp \
                gen-cpp/ThriftTest_types.cpp \
                gen-cpp/ThriftTest_constants.cpp \
                gen-cpp/StressTest_types.cpp \
                gen-cpp/StressTest_constants.cpp \
                gen-cpp/Service.cpp

noinst_LTLIBRARIES = libtestgencpp.la libstresstestgencpp.la
nodist_libtestgencpp_la_SOURCES = \
	gen-cpp/ThriftTest_constants.cpp \
	gen-cpp/ThriftTest_constants.h \
	gen-cpp/ThriftTest_types.cpp \
	gen-cpp/ThriftTest_types.h \
	gen-cpp/ThriftTest_types.tcc \
	gen-cpp/ThriftTest.cpp \
	gen-cpp/ThriftTest.h \
	gen-cpp/ThriftTest.tcc \
	src/ThriftTest_extras.cpp

libtestgencpp_la_LIBADD = $(top_builddir)/lib/cpp/libthrift.la

nodist_libstresstestgencpp_la_SOURCES = \
	gen-cpp/StressTest_constants.cpp \
	gen-cpp/StressTest_types.cpp \
	gen-cpp/StressTest_constants.h \
	gen-cpp/StressTest_types.h \
	gen-cpp/Service.cpp \
	gen-cpp/Service.h

libstresstestgencpp_la_LIBADD = $(top_builddir)/lib/cpp/libthrift.la

precross: TestServer TestClient

check_PROGRAMS = \
	TestServer \
	TestClient \
	StressTest \
	StressTestNonBlocking

# we currently do not run the testsuite, stop c++ server issue
# TESTS = \
#	$(check_PROGRAMS)

TestServer_SOURCES = \
	src/TestServer.cpp

TestServer_LDADD = \
	libtestgencpp.la \
	$(top_builddir)/lib/cpp/libthrift.la \
	$(top_builddir)/lib/cpp/libthriftz.la \
	$(top_builddir)/lib/cpp/libthriftnb.la \
	-levent -lboost_program_options -lboost_system -lboost_filesystem $(ZLIB_LIBS)

TestClient_SOURCES = \
	src/TestClient.cpp

TestClient_LDADD = \
	libtestgencpp.la \
	$(top_builddir)/lib/cpp/libthrift.la \
	$(top_builddir)/lib/cpp/libthriftz.la \
	$(top_builddir)/lib/cpp/libthriftnb.la \
	-levent -lboost_program_options -lboost_system -lboost_filesystem $(ZLIB_LIBS)

StressTest_SOURCES = \
	src/StressTest.cpp

StressTest_LDADD = \
	libstresstestgencpp.la \
	$(top_builddir)/lib/cpp/libthrift.la

StressTestNonBlocking_SOURCES = \
	src/StressTestNonBlocking.cpp

StressTestNonBlocking_LDADD = \
	libstresstestgencpp.la \
	$(top_builddir)/lib/cpp/libthriftnb.la \
	-levent
#
# Common thrift code generation rules
#
THRIFT = $(top_builddir)/compiler/cpp/thrift

gen-cpp/ThriftTest.cpp gen-cpp/ThriftTest_types.cpp gen-cpp/ThriftTest_constants.cpp: $(top_srcdir)/test/ThriftTest.thrift $(THRIFT)
	$(THRIFT) --gen cpp:templates,cob_style -r $<

gen-cpp/StressTest_types.cpp gen-cpp/StressTest_constants.cpp gen-cpp/Service.cpp: $(top_srcdir)/test/StressTest.thrift $(THRIFT)
	$(THRIFT) --gen cpp $<

AM_CPPFLAGS = $(BOOST_CPPFLAGS) $(LIBEVENT_CPPFLAGS) -I$(top_srcdir)/lib/cpp/src -Igen-cpp
AM_CXXFLAGS = -Wall -Wextra -pedantic
AM_LDFLAGS = $(BOOST_LDFLAGS) $(LIBEVENT_LDFLAGS) $(ZLIB_LIBS)

clean-local:
	$(RM) gen-cpp/*

style-local:
	$(CPPSTYLE_CMD)

EXTRA_DIST = \
	src/TestClient.cpp \
	src/TestServer.cpp \
	src/StressTest.cpp \
	src/StressTestNonBlocking.cpp \
	realloc/realloc_test.c \
	realloc/Makefile
