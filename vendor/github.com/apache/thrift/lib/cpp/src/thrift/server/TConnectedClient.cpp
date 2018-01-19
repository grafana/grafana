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

#include <thrift/server/TConnectedClient.h>

namespace apache {
namespace thrift {
namespace server {

using apache::thrift::TProcessor;
using apache::thrift::protocol::TProtocol;
using apache::thrift::server::TServerEventHandler;
using apache::thrift::transport::TTransport;
using apache::thrift::transport::TTransportException;
using boost::shared_ptr;
using std::string;

TConnectedClient::TConnectedClient(const shared_ptr<TProcessor>& processor,
                                   const shared_ptr<TProtocol>& inputProtocol,
                                   const shared_ptr<TProtocol>& outputProtocol,
                                   const shared_ptr<TServerEventHandler>& eventHandler,
                                   const shared_ptr<TTransport>& client)

  : processor_(processor),
    inputProtocol_(inputProtocol),
    outputProtocol_(outputProtocol),
    eventHandler_(eventHandler),
    client_(client),
    opaqueContext_(0) {
}

TConnectedClient::~TConnectedClient() {
}

void TConnectedClient::run() {
  if (eventHandler_) {
    opaqueContext_ = eventHandler_->createContext(inputProtocol_, outputProtocol_);
  }

  for (bool done = false; !done;) {
    if (eventHandler_) {
      eventHandler_->processContext(opaqueContext_, client_);
    }

    try {
      if (!processor_->process(inputProtocol_, outputProtocol_, opaqueContext_)) {
        break;
      }
    } catch (const TTransportException& ttx) {
      switch (ttx.getType()) {
        case TTransportException::END_OF_FILE:
        case TTransportException::INTERRUPTED:
        case TTransportException::TIMED_OUT:
          // Client disconnected or was interrupted or did not respond within the receive timeout.
          // No logging needed.  Done.
          done = true;
          break;

        default: {
          // All other transport exceptions are logged.
          // State of connection is unknown.  Done.
          string errStr = string("TConnectedClient died: ") + ttx.what();
          GlobalOutput(errStr.c_str());
          done = true;
          break;
        }
      }
    } catch (const TException& tex) {
      string errStr = string("TConnectedClient processing exception: ") + tex.what();
      GlobalOutput(errStr.c_str());
      // Disconnect from client, because we could not process the message.
      done = true;
    }
  }

  cleanup();
}

void TConnectedClient::cleanup() {
  if (eventHandler_) {
    eventHandler_->deleteContext(opaqueContext_, inputProtocol_, outputProtocol_);
  }

  try {
    inputProtocol_->getTransport()->close();
  } catch (const TTransportException& ttx) {
    string errStr = string("TConnectedClient input close failed: ") + ttx.what();
    GlobalOutput(errStr.c_str());
  }

  try {
    outputProtocol_->getTransport()->close();
  } catch (const TTransportException& ttx) {
    string errStr = string("TConnectedClient output close failed: ") + ttx.what();
    GlobalOutput(errStr.c_str());
  }

  try {
    client_->close();
  } catch (const TTransportException& ttx) {
    string errStr = string("TConnectedClient client close failed: ") + ttx.what();
    GlobalOutput(errStr.c_str());
  }
}
}
}
} // apache::thrift::server
