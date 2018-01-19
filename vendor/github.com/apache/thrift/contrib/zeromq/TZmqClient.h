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

#ifndef _THRIFT_TRANSPORT_TZMQCLIENT_H_
#define _THRIFT_TRANSPORT_TZMQCLIENT_H_ 1

#include <zmq.hpp>
#include <thrift/transport/TBufferTransports.h>

namespace apache { namespace thrift { namespace transport {

class TZmqClient : public TTransport {
 public:
  TZmqClient(zmq::context_t& ctx, const std::string& endpoint, int type)
    : sock_(ctx, type)
    , endpoint_(endpoint)
    , wbuf_()
    , rbuf_()
    , msg_()
    , zmq_type_(type)
  {}

  void open() {
    if(zmq_type_ == ZMQ_PUB) {
      sock_.bind(endpoint_.c_str());
    }
    else {
      sock_.connect(endpoint_.c_str());
    }
  }

  uint32_t read_virt(uint8_t* buf, uint32_t len);

  void write_virt(const uint8_t* buf, uint32_t len);

  uint32_t writeEnd();

 protected:
  zmq::socket_t sock_;
  std::string endpoint_;
  TMemoryBuffer wbuf_;
  TMemoryBuffer rbuf_;
  zmq::message_t msg_;
  int zmq_type_;
};

}}} // apache::thrift::transport

#endif // #ifndef _THRIFT_TRANSPORT_TZMQCLIENT_H_
