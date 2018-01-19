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

#ifndef _THRIFT_TASYNC_BUFFER_PROCESSOR_H_
#define _THRIFT_TASYNC_BUFFER_PROCESSOR_H_ 1

#include <thrift/cxxfunctional.h>
#include <boost/shared_ptr.hpp>

#include <thrift/transport/TBufferTransports.h>

namespace apache {
namespace thrift {
namespace async {

class TAsyncBufferProcessor {
public:
  // Process data in "in", putting the result in "out".
  // Call _return(true) when done, or _return(false) to
  // forcefully close the connection (if applicable).
  // "in" and "out" should be TMemoryBuffer or similar,
  // not a wrapper around a socket.
  virtual void process(apache::thrift::stdcxx::function<void(bool healthy)> _return,
                       boost::shared_ptr<apache::thrift::transport::TBufferBase> ibuf,
                       boost::shared_ptr<apache::thrift::transport::TBufferBase> obuf) = 0;
  virtual ~TAsyncBufferProcessor() {}
};
}
}
} // apache::thrift::async

#endif // #ifndef _THRIFT_TASYNC_BUFFER_PROCESSOR_H_
