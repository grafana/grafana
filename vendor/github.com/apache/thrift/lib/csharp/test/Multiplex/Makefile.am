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

GENERATED = \
	gen-csharp/Aggr.cs \
	gen-csharp/BenchmarkService.cs \
	gen-csharp/Error.cs

BUILT_SOURCES = $(GENERATED)

THRIFT = $(top_builddir)/compiler/cpp/thrift

gen-csharp/Aggr.cs: $(top_srcdir)/contrib/async-test/aggr.thrift
	$(THRIFT) --gen csharp $<

gen-csharp/BenchmarkService.cs gen-csharp/Error.cs: $(top_srcdir)/lib/rb/benchmark/Benchmark.thrift
	$(THRIFT) --gen csharp $<

ThriftImpl.dll: Multiplex.Test.Common.cs $(GENERATED) ../../Thrift.dll
	$(CSC) $(CSC_DEFINES) -t:library -out:./ThriftImpl.dll -reference:../../Thrift.dll $(GENERATED) $<

MultiplexClient.exe: Client/Multiplex.Test.Client.cs ThriftImpl.dll
	$(CSC) $(CSC_DEFINES) -out:$@ -reference:../../Thrift.dll -reference:ThriftImpl.dll $<

MultiplexServer.exe: Server/Multiplex.Test.Server.cs ThriftImpl.dll
	$(CSC) $(CSC_DEFINES) -out:$@ -reference:../../Thrift.dll -reference:ThriftImpl.dll $<

clean-local:
	$(RM) -rf gen-csharp *.exe *.dll

TESTPORT = 9501
check-local: MultiplexServer.exe MultiplexClient.exe
	echo $(TESTPORT)
	MONO_PATH=../../ timeout 10 mono MultiplexServer.exe $(TESTPORT) &
	sleep 1
	MONO_PATH=../../ mono MultiplexClient.exe $(TESTPORT)
