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

BUILT_SOURCES = gen-cpp/DebugProtoTest_types.h \
                gen-cpp/EnumTest_types.h \
                gen-cpp/OptionalRequiredTest_types.h \
                gen-cpp/Recursive_types.h \
                gen-cpp/ThriftTest_types.h \
                gen-cpp/TypedefTest_types.h \
                gen-cpp/ChildService.h \
                gen-cpp/EmptyService.h \
                gen-cpp/ParentService.h \
                gen-cpp/proc_types.h

noinst_LTLIBRARIES = libtestgencpp.la libprocessortest.la
nodist_libtestgencpp_la_SOURCES = \
	gen-cpp/DebugProtoTest_types.cpp \
	gen-cpp/DebugProtoTest_types.h \
	gen-cpp/EnumTest_types.cpp \
	gen-cpp/EnumTest_types.h \
	gen-cpp/OptionalRequiredTest_types.cpp \
	gen-cpp/OptionalRequiredTest_types.h \
	gen-cpp/Recursive_types.cpp \
	gen-cpp/Recursive_types.h \
	gen-cpp/ThriftTest_types.cpp \
	gen-cpp/ThriftTest_types.h \
	gen-cpp/ThriftTest_constants.cpp \
	gen-cpp/ThriftTest_constants.h \
	gen-cpp/TypedefTest_types.cpp \
	gen-cpp/TypedefTest_types.h \
	ThriftTest_extras.cpp \
	DebugProtoTest_extras.cpp

nodist_libprocessortest_la_SOURCES = \
	gen-cpp/ChildService.cpp \
	gen-cpp/ChildService.h \
	gen-cpp/EmptyService.cpp \
	gen-cpp/EmptyService.h \
	gen-cpp/ParentService.cpp \
	gen-cpp/ParentService.h \
	gen-cpp/proc_types.cpp \
	gen-cpp/proc_types.h

ThriftTest_extras.o: gen-cpp/ThriftTest_types.h
DebugProtoTest_extras.o: gen-cpp/DebugProtoTest_types.h

libtestgencpp_la_LIBADD = $(top_builddir)/lib/cpp/libthrift.la

noinst_PROGRAMS = Benchmark \
	concurrency_test

Benchmark_SOURCES = \
	Benchmark.cpp

Benchmark_LDADD = libtestgencpp.la

check_PROGRAMS = \
	UnitTests \
	TFDTransportTest \
	TPipedTransportTest \
	DebugProtoTest \
	JSONProtoTest \
	OptionalRequiredTest \
	RecursiveTest \
	SpecializationTest \
	AllProtocolsTest \
	TransportTest \
	TInterruptTest \
	TServerIntegrationTest \
	SecurityTest \
	ZlibTest \
	TFileTransportTest \
	link_test \
	OpenSSLManualInitTest \
	EnumTest

if AMX_HAVE_LIBEVENT
noinst_PROGRAMS += \
	processor_test
check_PROGRAMS += \
	TNonblockingServerTest
endif

TESTS_ENVIRONMENT= \
	BOOST_TEST_LOG_SINK=tests.xml \
	BOOST_TEST_LOG_LEVEL=test_suite \
	BOOST_TEST_LOG_FORMAT=XML

TESTS = \
	$(check_PROGRAMS)

UnitTests_SOURCES = \
	UnitTestMain.cpp \
	TMemoryBufferTest.cpp \
	TBufferBaseTest.cpp \
	Base64Test.cpp \
	ToStringTest.cpp \
	TypedefTest.cpp \
	TServerSocketTest.cpp \
	TServerTransportTest.cpp \
	TTransportCheckThrow.h

if !WITH_BOOSTTHREADS
UnitTests_SOURCES += \
    RWMutexStarveTest.cpp
endif

UnitTests_LDADD = \
  libtestgencpp.la \
  $(BOOST_TEST_LDADD)

TInterruptTest_SOURCES = \
	TSocketInterruptTest.cpp \
	TSSLSocketInterruptTest.cpp

TInterruptTest_LDADD = \
  libtestgencpp.la \
  $(BOOST_TEST_LDADD) \
  $(BOOST_FILESYSTEM_LDADD) \
  $(BOOST_CHRONO_LDADD) \
  $(BOOST_SYSTEM_LDADD) \
  $(BOOST_THREAD_LDADD)

TServerIntegrationTest_SOURCES = \
	TServerIntegrationTest.cpp

TServerIntegrationTest_LDADD = \
  libtestgencpp.la \
  libprocessortest.la \
  $(BOOST_TEST_LDADD) \
  $(BOOST_SYSTEM_LDADD) \
  $(BOOST_THREAD_LDADD)

SecurityTest_SOURCES = \
	SecurityTest.cpp

SecurityTest_LDADD = \
  libtestgencpp.la \
  libprocessortest.la \
  $(BOOST_TEST_LDADD) \
  $(BOOST_FILESYSTEM_LDADD) \
  $(BOOST_SYSTEM_LDADD) \
  $(BOOST_THREAD_LDADD)

TransportTest_SOURCES = \
	TransportTest.cpp

TransportTest_LDADD = \
  libtestgencpp.la \
  $(top_builddir)/lib/cpp/libthriftz.la \
  $(BOOST_TEST_LDADD) \
  -lz

ZlibTest_SOURCES = \
	ZlibTest.cpp

ZlibTest_LDADD = \
  libtestgencpp.la \
  $(top_builddir)/lib/cpp/libthriftz.la \
  $(BOOST_TEST_LDADD) \
  -lz

EnumTest_SOURCES = \
  EnumTest.cpp

EnumTest_LDADD = \
  libtestgencpp.la \
  $(BOOST_TEST_LDADD)

TFileTransportTest_SOURCES = \
	TFileTransportTest.cpp

TFileTransportTest_LDADD = \
  libtestgencpp.la \
  $(BOOST_TEST_LDADD)

#
# TFDTransportTest
#
TFDTransportTest_SOURCES = \
	TFDTransportTest.cpp

TFDTransportTest_LDADD =  \
	$(top_builddir)/lib/cpp/libthrift.la \
	$(BOOST_TEST_LDADD)


#
# TPipedTransportTest
#
TPipedTransportTest_SOURCES = \
	TPipedTransportTest.cpp \
	TPipeInterruptTest.cpp

TPipedTransportTest_LDADD = \
	libtestgencpp.la \
	$(top_builddir)/lib/cpp/libthrift.la \
	$(BOOST_TEST_LDADD) \
	$(BOOST_SYSTEM_LDADD) \
	$(BOOST_THREAD_LDADD)

#
# AllProtocolsTest
#
AllProtocolsTest_SOURCES = \
	AllProtocolTests.cpp \
	AllProtocolTests.tcc \
	GenericHelpers.h

AllProtocolsTest_LDADD = \
  libtestgencpp.la \
  $(BOOST_TEST_LDADD)

#
# DebugProtoTest
#
DebugProtoTest_SOURCES = \
	DebugProtoTest.cpp

DebugProtoTest_LDADD = \
	libtestgencpp.la \
	$(BOOST_TEST_LDADD)


#
# JSONProtoTest
#
JSONProtoTest_SOURCES = \
	JSONProtoTest.cpp

JSONProtoTest_LDADD = \
	libtestgencpp.la \
	$(BOOST_TEST_LDADD)

#
# TNonblockingServerTest
#
TNonblockingServerTest_SOURCES = TNonblockingServerTest.cpp

TNonblockingServerTest_LDADD = libprocessortest.la \
                               $(top_builddir)/lib/cpp/libthrift.la \
                               $(top_builddir)/lib/cpp/libthriftnb.la \
                               $(BOOST_TEST_LDADD) \
                               $(BOOST_LDFLAGS) \
                               $(LIBEVENT_LIBS)

#
# OptionalRequiredTest
#
OptionalRequiredTest_SOURCES = \
	OptionalRequiredTest.cpp

OptionalRequiredTest_LDADD = \
	libtestgencpp.la \
	$(BOOST_TEST_LDADD)

#
# OptionalRequiredTest
#
RecursiveTest_SOURCES = \
	RecursiveTest.cpp

RecursiveTest_LDADD = \
	libtestgencpp.la \
	$(BOOST_TEST_LDADD)

#
# SpecializationTest
#
SpecializationTest_SOURCES = \
	SpecializationTest.cpp

SpecializationTest_LDADD = \
	libtestgencpp.la \
	$(BOOST_TEST_LDADD)

concurrency_test_SOURCES = \
	concurrency/Tests.cpp \
	concurrency/ThreadFactoryTests.h \
	concurrency/ThreadManagerTests.h \
	concurrency/TimerManagerTests.h

concurrency_test_LDADD = \
  $(top_builddir)/lib/cpp/libthrift.la

link_test_SOURCES = \
  link/LinkTest.cpp \
  link/TemplatedService1.cpp \
  link/TemplatedService2.cpp

processor_test_SOURCES = \
	processor/ProcessorTest.cpp \
	processor/EventLog.cpp \
	processor/ServerThread.cpp \
	processor/EventLog.h \
	processor/Handlers.h \
	processor/ServerThread.h

processor_test_LDADD = libprocessortest.la \
                       $(top_builddir)/lib/cpp/libthrift.la \
                       $(top_builddir)/lib/cpp/libthriftnb.la \
                       $(BOOST_TEST_LDADD) \
                       $(BOOST_LDFLAGS) \
                       $(LIBEVENT_LIBS)

OpenSSLManualInitTest_SOURCES = \
	OpenSSLManualInitTest.cpp

OpenSSLManualInitTest_LDADD = \
	$(top_builddir)/lib/cpp/libthrift.la \
	$(BOOST_TEST_LDADD) \
	$(OPENSSL_LDFLAGS) \
	$(OPENSSL_LIBS)

#
# Common thrift code generation rules
#
THRIFT = $(top_builddir)/compiler/cpp/thrift

gen-cpp/DebugProtoTest_types.cpp gen-cpp/DebugProtoTest_types.h gen-cpp/EmptyService.cpp gen-cpp/EmptyService.h: $(top_srcdir)/test/DebugProtoTest.thrift
	$(THRIFT) --gen cpp $<

gen-cpp/EnumTest_types.cpp gen-cpp/EnumTest_types.h: $(top_srcdir)/test/EnumTest.thrift
	$(THRIFT) --gen cpp $<

gen-cpp/TypedefTest_types.cpp gen-cpp/TypedefTest_types.h: $(top_srcdir)/test/TypedefTest.thrift
	$(THRIFT) --gen cpp $<

gen-cpp/OptionalRequiredTest_types.cpp gen-cpp/OptionalRequiredTest_types.h: $(top_srcdir)/test/OptionalRequiredTest.thrift
	$(THRIFT) --gen cpp $<

gen-cpp/Recursive_types.cpp gen-cpp/Recursive_types.h: $(top_srcdir)/test/Recursive.thrift
	$(THRIFT) --gen cpp $<

gen-cpp/Service.cpp gen-cpp/StressTest_types.cpp: $(top_srcdir)/test/StressTest.thrift
	$(THRIFT) --gen cpp $<

gen-cpp/SecondService.cpp gen-cpp/ThriftTest_constants.cpp gen-cpp/ThriftTest.cpp gen-cpp/ThriftTest_types.cpp gen-cpp/ThriftTest_types.h: $(top_srcdir)/test/ThriftTest.thrift
	$(THRIFT) --gen cpp $<

gen-cpp/ChildService.cpp gen-cpp/ChildService.h gen-cpp/ParentService.cpp gen-cpp/ParentService.h gen-cpp/proc_types.cpp gen-cpp/proc_types.h: processor/proc.thrift
	$(THRIFT) --gen cpp:templates,cob_style $<

AM_CPPFLAGS = $(BOOST_CPPFLAGS) -I$(top_srcdir)/lib/cpp/src -D__STDC_LIMIT_MACROS -I.
AM_LDFLAGS = $(BOOST_LDFLAGS)
AM_CXXFLAGS = -Wall -Wextra -pedantic

clean-local:
	$(RM) gen-cpp/*

EXTRA_DIST = \
	concurrency \
	processor \
	qt \
	CMakeLists.txt \
	DebugProtoTest_extras.cpp \
	ThriftTest_extras.cpp
