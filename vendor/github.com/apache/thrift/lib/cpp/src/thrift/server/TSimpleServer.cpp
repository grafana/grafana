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

#include <thrift/server/TSimpleServer.h>

namespace apache {
namespace thrift {
namespace server {

using apache::thrift::protocol::TProtocol;
using apache::thrift::protocol::TProtocolFactory;
using apache::thrift::transport::TServerTransport;
using apache::thrift::transport::TTransport;
using apache::thrift::transport::TTransportException;
using apache::thrift::transport::TTransportFactory;
using boost::shared_ptr;
using std::string;

TSimpleServer::TSimpleServer(const shared_ptr<TProcessorFactory>& processorFactory,
                             const shared_ptr<TServerTransport>& serverTransport,
                             const shared_ptr<TTransportFactory>& transportFactory,
                             const shared_ptr<TProtocolFactory>& protocolFactory)
  : TServerFramework(processorFactory, serverTransport, transportFactory, protocolFactory) {
  TServerFramework::setConcurrentClientLimit(1);
}

TSimpleServer::TSimpleServer(const shared_ptr<TProcessor>& processor,
                             const shared_ptr<TServerTransport>& serverTransport,
                             const shared_ptr<TTransportFactory>& transportFactory,
                             const shared_ptr<TProtocolFactory>& protocolFactory)
  : TServerFramework(processor, serverTransport, transportFactory, protocolFactory) {
  TServerFramework::setConcurrentClientLimit(1);
}

TSimpleServer::TSimpleServer(const shared_ptr<TProcessorFactory>& processorFactory,
                             const shared_ptr<TServerTransport>& serverTransport,
                             const shared_ptr<TTransportFactory>& inputTransportFactory,
                             const shared_ptr<TTransportFactory>& outputTransportFactory,
                             const shared_ptr<TProtocolFactory>& inputProtocolFactory,
                             const shared_ptr<TProtocolFactory>& outputProtocolFactory)
  : TServerFramework(processorFactory,
                     serverTransport,
                     inputTransportFactory,
                     outputTransportFactory,
                     inputProtocolFactory,
                     outputProtocolFactory) {
  TServerFramework::setConcurrentClientLimit(1);
}

TSimpleServer::TSimpleServer(const shared_ptr<TProcessor>& processor,
                             const shared_ptr<TServerTransport>& serverTransport,
                             const shared_ptr<TTransportFactory>& inputTransportFactory,
                             const shared_ptr<TTransportFactory>& outputTransportFactory,
                             const shared_ptr<TProtocolFactory>& inputProtocolFactory,
                             const shared_ptr<TProtocolFactory>& outputProtocolFactory)
  : TServerFramework(processor,
                     serverTransport,
                     inputTransportFactory,
                     outputTransportFactory,
                     inputProtocolFactory,
                     outputProtocolFactory) {
  TServerFramework::setConcurrentClientLimit(1);
}

TSimpleServer::~TSimpleServer() {
}

/**
 * The main body of customized implementation for TSimpleServer is quite simple:
 * When a client connects, use the serve() thread to drive it to completion thus
 * blocking new connections.
 */
void TSimpleServer::onClientConnected(const shared_ptr<TConnectedClient>& pClient) {
  pClient->run();
}

/**
 * TSimpleServer does not track clients so there is nothing to do here.
 */
void TSimpleServer::onClientDisconnected(TConnectedClient*) {
}

/**
 * This makes little sense to the simple server because it is not capable
 * of having more than one client at a time, so we hide it.
 */
void TSimpleServer::setConcurrentClientLimit(int64_t) {
}
}
}
} // apache::thrift::server
