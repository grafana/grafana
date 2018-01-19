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
	gen-csharp/Thrift/Test/Bonk.cs \
	gen-csharp/Thrift/Test/Bools.cs \
	gen-csharp/Thrift/Test/BoolTest.cs \
	gen-csharp/Thrift/Test/CrazyNesting.cs \
	gen-csharp/Thrift/Test/EmptyStruct.cs \
	gen-csharp/Thrift/Test/GuessProtocolStruct.cs \
	gen-csharp/Thrift/Test/Insanity.cs \
	gen-csharp/Thrift/Test/LargeDeltas.cs \
	gen-csharp/Thrift/Test/ListBonks.cs \
	gen-csharp/Thrift/Test/ListTypeVersioningV1.cs \
	gen-csharp/Thrift/Test/ListTypeVersioningV2.cs \
	gen-csharp/Thrift/Test/NestedListsBonk.cs \
	gen-csharp/Thrift/Test/NestedListsI32x2.cs \
	gen-csharp/Thrift/Test/NestedListsI32x3.cs \
	gen-csharp/Thrift/Test/NestedMixedx2.cs \
	gen-csharp/Thrift/Test/Numberz.cs \
	gen-csharp/Thrift/Test/OneField.cs \
	gen-csharp/Thrift/Test/SecondService.cs \
	gen-csharp/Thrift/Test/StructA.cs \
	gen-csharp/Thrift/Test/StructB.cs \
	gen-csharp/Thrift/Test/ThriftTest.Constants.cs \
	gen-csharp/Thrift/Test/ThriftTest.cs \
	gen-csharp/Thrift/Test/VersioningTestV1.cs \
	gen-csharp/Thrift/Test/VersioningTestV2.cs \
	gen-csharp/Thrift/Test/Xception.cs \
	gen-csharp/Thrift/Test/Xception2.cs \
	gen-csharp/Thrift/Test/Xtruct.cs \
	gen-csharp/Thrift/Test/Xtruct2.cs \
	gen-csharp/Thrift/Test/Xtruct3.cs

BUILT_SOURCES = $(GENERATED)

if MONO_MCS
CSC = mcs
else
CSC = gmcs
endif

if NET_2_0
CSC_DEFINES = -d:NET_2_0
endif

LIBDIR = $(top_builddir)/lib/csharp

THRIFT = $(top_builddir)/compiler/cpp/thrift

$(GENERATED): $(top_srcdir)/test/ThriftTest.thrift $(THRIFT)
	$(THRIFT) --gen csharp -o . $<

precross: TestClientServer.exe

ThriftImpl.dll: $(GENERATED) $(LIBDIR)/Thrift.dll
	$(CSC) $(CSC_DEFINES) -t:library -out:$@ -reference:$(LIBDIR)/Thrift.dll $(GENERATED)

SRCS = TestClient.cs TestServer.cs Program.cs

TestClientServer.exe: $(SRCS) ThriftImpl.dll
	$(CSC) $(CSC_DEFINES) -out:$@ -reference:$(LIBDIR)/Thrift.dll -reference:ThriftImpl.dll $(SRCS)

clean-local:
	$(RM) -rf gen-csharp *.exe *.dll

TESTPORT = 9500
check-local: TestClientServer.exe
	MONO_PATH=$(LIBDIR) timeout 10 mono TestClientServer.exe server --port=$(TESTPORT) &
	sleep 1
	MONO_PATH=$(LIBDIR) mono TestClientServer.exe client --port=$(TESTPORT)
