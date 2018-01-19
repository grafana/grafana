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

#ifndef _THRIFT_ASYNC_TASYNCCHANNEL_H_
#define _THRIFT_ASYNC_TASYNCCHANNEL_H_ 1

#include <thrift/cxxfunctional.h>
#include <thrift/Thrift.h>

namespace apache {
namespace thrift {
namespace transport {
class TMemoryBuffer;
}
}
}

namespace apache {
namespace thrift {
namespace async {
using apache::thrift::transport::TMemoryBuffer;

class TAsyncChannel {
public:
  typedef apache::thrift::stdcxx::function<void()> VoidCallback;

  virtual ~TAsyncChannel() {}

  // is the channel in a good state?
  virtual bool good() const = 0;
  virtual bool error() const = 0;
  virtual bool timedOut() const = 0;

  /**
   * Send a message over the channel.
   */
  virtual void sendMessage(const VoidCallback& cob,
                           apache::thrift::transport::TMemoryBuffer* message) = 0;

  /**
   * Receive a message from the channel.
   */
  virtual void recvMessage(const VoidCallback& cob,
                           apache::thrift::transport::TMemoryBuffer* message) = 0;

  /**
   * Send a message over the channel and receive a response.
   */
  virtual void sendAndRecvMessage(const VoidCallback& cob,
                                  apache::thrift::transport::TMemoryBuffer* sendBuf,
                                  apache::thrift::transport::TMemoryBuffer* recvBuf);
};
}
}
} // apache::thrift::async

#endif // #ifndef _THRIFT_ASYNC_TASYNCCHANNEL_H_
