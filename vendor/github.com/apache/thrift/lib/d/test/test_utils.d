/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/**
 * Various helpers used by more than a single test.
 */
module test_utils;

import std.parallelism : TaskPool;
import thrift.protocol.base;
import thrift.protocol.processor;
import thrift.server.base;
import thrift.server.nonblocking;
import thrift.server.simple;
import thrift.server.taskpool;
import thrift.server.threaded;
import thrift.server.transport.socket;
import thrift.transport.base;
import thrift.transport.buffered;
import thrift.transport.framed;
import thrift.transport.http;

// This is a likely victim of @@BUG4744@@ when used with command argument
// parsing.
enum ServerType {
  simple,
  nonblocking,
  pooledNonblocking,
  taskpool,
  threaded
}

TServer createServer(ServerType type, size_t taskPoolSize, size_t numIOThreads,
  TProcessor processor, TServerSocket serverTransport,
  TTransportFactory transportFactory, TProtocolFactory protocolFactory)
{
  final switch (type) {
    case ServerType.simple:
      return new TSimpleServer(processor, serverTransport,
        transportFactory, protocolFactory);
    case ServerType.nonblocking:
      auto nb = new TNonblockingServer(processor, serverTransport.port,
        transportFactory, protocolFactory);
      nb.numIOThreads = numIOThreads;
      return nb;
    case ServerType.pooledNonblocking:
      auto nb = new TNonblockingServer(processor, serverTransport.port,
        transportFactory, protocolFactory, new TaskPool(taskPoolSize));
      nb.numIOThreads = numIOThreads;
      return nb;
    case ServerType.taskpool:
      auto tps = new TTaskPoolServer(processor, serverTransport,
        transportFactory, protocolFactory);
      tps.taskPool = new TaskPool(taskPoolSize);
      return tps;
    case ServerType.threaded:
      return new TThreadedServer(processor, serverTransport,
        transportFactory, protocolFactory);
  }
}

enum TransportType {
  buffered,
  framed,
  http,
  raw
}

TTransportFactory createTransportFactory(TransportType type) {
  final switch (type) {
    case TransportType.buffered:
      return new TBufferedTransportFactory;
    case TransportType.framed:
      return new TFramedTransportFactory;
    case TransportType.http:
      return new TServerHttpTransportFactory;
    case TransportType.raw:
      return new TTransportFactory;
  }
}
