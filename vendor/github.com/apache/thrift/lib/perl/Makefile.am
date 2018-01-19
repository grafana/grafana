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

SUBDIRS = test

Makefile-perl.mk : Makefile.PL
	$(PERL) Makefile.PL MAKEFILE=Makefile-perl.mk INSTALLDIRS=$(INSTALLDIRS) INSTALL_BASE=$(PERL_PREFIX)

all-local: Makefile-perl.mk
	$(MAKE) -f $<
	find blib -name 'Makefile*' -exec rm -f {} \;

install-exec-local: Makefile-perl.mk
	$(MAKE) -f $< install DESTDIR=$(DESTDIR)/

clean-local:
	if test -f Makefile-perl.mk ; then \
		$(MAKE) -f Makefile-perl.mk clean ; \
	fi
	$(RM) Makefile-perl.mk.old
	$(RM) -r gen-perl gen-perl2

EXTRA_DIST = \
	coding_standards.md \
	Makefile.PL \
	test.pl \
	lib/Thrift.pm \
	lib/Thrift.pm \
	lib/Thrift/BinaryProtocol.pm \
	lib/Thrift/BufferedTransport.pm \
	lib/Thrift/FramedTransport.pm \
	lib/Thrift/HttpClient.pm \
	lib/Thrift/MemoryBuffer.pm \
	lib/Thrift/MessageType.pm \
	lib/Thrift/MultiplexedProcessor.pm \
	lib/Thrift/MultiplexedProtocol.pm \
	lib/Thrift/Protocol.pm \
	lib/Thrift/ProtocolDecorator.pm \
	lib/Thrift/Server.pm \
	lib/Thrift/ServerSocket.pm \
	lib/Thrift/Socket.pm \
	lib/Thrift/SSLSocket.pm \
	lib/Thrift/SSLServerSocket.pm \
	lib/Thrift/UnixServerSocket.pm \
	lib/Thrift/UnixSocket.pm \
	lib/Thrift/Transport.pm \
	README.md

THRIFT = @top_builddir@/compiler/cpp/thrift
THRIFT_IF = @top_srcdir@/test/ThriftTest.thrift
NAME_BENCHMARKSERVICE =  @top_srcdir@/lib/rb/benchmark/Benchmark.thrift
NAME_AGGR = @top_srcdir@/contrib/async-test/aggr.thrift

THRIFTTEST_GEN = \
	gen-perl/ThriftTest/Constants.pm \
	gen-perl/ThriftTest/SecondService.pm \
	gen-perl/ThriftTest/ThriftTest.pm \
	gen-perl/ThriftTest/Types.pm

BENCHMARK_GEN = \
	gen-perl/BenchmarkService.pm \
	gen-perl/Constants.pm \
	gen-perl/Types.pm

AGGR_GEN = \
	gen-perl2/Aggr.pm \
	gen-perl2/Constants.pm \
	gen-perl2/Types.pm

PERL_GEN = \
	$(THRIFTTEST_GEN) \
	$(BENCHMARK_GEN) \
	$(AGGR_GEN)

BUILT_SOURCES = $(PERL_GEN)

check-local: $(PERL_GEN)
	$(PERL) -Iblib/lib -I@abs_srcdir@ -I@builddir@/gen-perl2 -I@builddir@/gen-perl \
		@abs_srcdir@/test.pl @abs_srcdir@/test/*.t

$(THRIFTTEST_GEN): $(THRIFT_IF) $(THRIFT)
	$(THRIFT) --gen perl $<

$(BENCHMARK_GEN): $(NAME_BENCHMARKSERVICE) $(THRIFT)
	$(THRIFT) --gen perl $<

$(AGGR_GEN): $(NAME_AGGR) $(THRIFT)
	$(MKDIR_P) gen-perl2
	$(THRIFT) -out gen-perl2 --gen perl $<
