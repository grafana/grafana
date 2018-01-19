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

#include "TZmqServer.h"
#include <thrift/transport/TBufferTransports.h>
#include <boost/scoped_ptr.hpp>

using boost::shared_ptr;
using apache::thrift::transport::TMemoryBuffer;
using apache::thrift::protocol::TProtocol;

namespace apache { namespace thrift { namespace server {

bool TZmqServer::serveOne(int recv_flags) {
  zmq::message_t msg;
  bool received = sock_.recv(&msg, recv_flags);
  if (!received) {
    return false;
  }
  shared_ptr<TMemoryBuffer> inputTransport(new TMemoryBuffer((uint8_t*)msg.data(), msg.size()));
  shared_ptr<TMemoryBuffer> outputTransport(new TMemoryBuffer());
  shared_ptr<TProtocol> inputProtocol(
      inputProtocolFactory_->getProtocol(inputTransport));
  shared_ptr<TProtocol> outputProtocol(
      outputProtocolFactory_->getProtocol(outputTransport));
  shared_ptr<TMemoryBuffer> transport(new TMemoryBuffer);

  processor_->process(inputProtocol, outputProtocol, NULL);

  if (zmq_type_ == ZMQ_REP) {
    uint8_t* buf;
    uint32_t size;
    outputTransport->getBuffer(&buf, &size);
    msg.rebuild(size);
    std::memcpy(msg.data(), buf, size);
    (void)sock_.send(msg);
  }

  return true;
}


void TZmqMultiServer::serveOne(long timeout) {
  boost::scoped_ptr<zmq::pollitem_t> items(setupPoll());
  serveActive(items.get(), timeout);
}


void TZmqMultiServer::serveForever() {
  boost::scoped_ptr<zmq::pollitem_t> items(setupPoll());
  while (true) {
    serveActive(items.get(), -1);
  }
}


zmq::pollitem_t* TZmqMultiServer::setupPoll() {
  zmq::pollitem_t* items = new zmq::pollitem_t[servers_.size()];
  for (int i = 0; i < servers_.size(); ++i) {
    items[i].socket = servers_[i]->getSocket();
    items[i].events = ZMQ_POLLIN;
  }
  return items;
}

void TZmqMultiServer::serveActive(zmq::pollitem_t* items, long timeout) {
  int rc = zmq::poll(items, servers_.size(), timeout);
  if (rc == 0) {
    return;
  }
  for (int i = 0; i < servers_.size(); ++i) {
    if ((items[i].revents & ZMQ_POLLIN) != 0) {
      // Should we pass ZMQ_NOBLOCK here to be safe?
      servers_[i]->serveOne();
    }
  }
}


}}} // apache::thrift::server
