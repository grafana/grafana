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

SUBDIRS = . test/Multiplex

THRIFTCODE = \
            src/Collections/THashSet.cs \
            src/Collections/TCollections.cs \
            src/Properties/AssemblyInfo.cs \
            src/Protocol/TAbstractBase.cs \
            src/Protocol/TBase.cs \
            src/Protocol/TBase64Utils.cs \
            src/Protocol/TJSONProtocol.cs \
            src/Protocol/TProtocolException.cs \
            src/Protocol/TProtocolFactory.cs \
            src/Protocol/TList.cs \
            src/Protocol/TSet.cs \
            src/Protocol/TMap.cs \
            src/Protocol/TProtocolUtil.cs \
            src/Protocol/TMessageType.cs \
            src/Protocol/TProtocol.cs \
            src/Protocol/TProtocolDecorator.cs \
            src/Protocol/TMultiplexedProtocol.cs \
            src/Protocol/TMultiplexedProcessor.cs \
            src/Protocol/TType.cs \
            src/Protocol/TField.cs \
            src/Protocol/TMessage.cs \
            src/Protocol/TStruct.cs \
            src/Protocol/TBinaryProtocol.cs \
            src/Protocol/TCompactProtocol.cs \
            src/Server/TThreadedServer.cs \
            src/Server/TThreadPoolServer.cs \
            src/Server/TSimpleServer.cs \
            src/Server/TServer.cs \
            src/Server/TServerEventHandler.cs \
            src/Transport/TBufferedTransport.cs \
            src/Transport/TTransport.cs \
            src/Transport/TSocket.cs \
            src/Transport/TTransportException.cs \
            src/Transport/TStreamTransport.cs \
            src/Transport/TFramedTransport.cs \
            src/Transport/TServerTransport.cs \
            src/Transport/TServerSocket.cs \
            src/Transport/TTransportFactory.cs \
            src/Transport/THttpClient.cs \
            src/Transport/THttpHandler.cs \
            src/Transport/TMemoryBuffer.cs \
            src/Transport/TNamedPipeClientTransport.cs \
            src/Transport/TNamedPipeServerTransport.cs \
            src/Transport/TTLSSocket.cs \
            src/Transport/TTLSServerSocket.cs \
            src/TProcessor.cs \
            src/TProcessorFactory.cs \
            src/TSingletonProcessorFactory.cs \
            src/TPrototypeProcessorFactory.cs \
            src/TControllingHandler.cs \
            src/TException.cs \
            src/TApplicationException.cs

if MONO_MCS
export CSC = mcs
else
export CSC = gmcs
endif

if NET_2_0
export CSC_DEFINES = -d:NET_2_0
endif

all-local: Thrift.dll

Thrift.dll: $(THRIFTCODE)
	$(CSC) $(CSC_DEFINES) -out:$@ -target:library -reference:System.Web $(THRIFTCODE)

clean-local:
	$(RM) Thrift.dll

EXTRA_DIST = \
             $(THRIFTCODE) \
             ThriftMSBuildTask \
             src/Thrift.csproj \
             src/Thrift.45.csproj \
             src/Thrift.sln \
             src/Transport/TSilverlightSocket.cs \
             src/Transport/THttpTaskAsyncHandler.cs \
             src/TAsyncProcessor.cs \
             test \
             coding_standards.md \
             README.md
