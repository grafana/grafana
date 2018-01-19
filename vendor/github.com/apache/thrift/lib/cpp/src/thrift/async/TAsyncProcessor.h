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

#ifndef _THRIFT_TASYNCPROCESSOR_H_
#define _THRIFT_TASYNCPROCESSOR_H_ 1

#include <thrift/cxxfunctional.h>
#include <boost/shared_ptr.hpp>
#include <thrift/protocol/TProtocol.h>
#include <thrift/TProcessor.h>

namespace apache {
namespace thrift {
namespace async {

/**
 * Async version of a TProcessor.  It is not expected to complete by the time
 * the call to process returns.  Instead, it calls a cob to signal completion.
 */

class TAsyncProcessor {
public:
  virtual ~TAsyncProcessor() {}

  virtual void process(apache::thrift::stdcxx::function<void(bool success)> _return,
                       boost::shared_ptr<protocol::TProtocol> in,
                       boost::shared_ptr<protocol::TProtocol> out) = 0;

  void process(apache::thrift::stdcxx::function<void(bool success)> _return,
               boost::shared_ptr<apache::thrift::protocol::TProtocol> io) {
    return process(_return, io, io);
  }

  boost::shared_ptr<TProcessorEventHandler> getEventHandler() const { return eventHandler_; }

  void setEventHandler(boost::shared_ptr<TProcessorEventHandler> eventHandler) {
    eventHandler_ = eventHandler;
  }

protected:
  TAsyncProcessor() {}

  boost::shared_ptr<TProcessorEventHandler> eventHandler_;
};

class TAsyncProcessorFactory {
public:
  virtual ~TAsyncProcessorFactory() {}

  /**
   * Get the TAsyncProcessor to use for a particular connection.
   *
   * This method is always invoked in the same thread that the connection was
   * accepted on.  This generally means that this call does not need to be
   * thread safe, as it will always be invoked from a single thread.
   */
  virtual boost::shared_ptr<TAsyncProcessor> getProcessor(const TConnectionInfo& connInfo) = 0;
};
}
}
} // apache::thrift::async

// XXX I'm lazy for now
namespace apache {
namespace thrift {
using apache::thrift::async::TAsyncProcessor;
}
}

#endif // #ifndef _THRIFT_TASYNCPROCESSOR_H_
