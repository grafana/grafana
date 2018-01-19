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

#ifndef _THRIFT_SERVER_TZMQSERVER_H_
#define _THRIFT_SERVER_TZMQSERVER_H_ 1

#include <zmq.hpp>
#include <thrift/server/TServer.h>

namespace apache { namespace thrift { namespace server {

class TZmqServer : public TServer {
 public:
  TZmqServer(
      boost::shared_ptr<TProcessor> processor,
      zmq::context_t& ctx, const std::string& endpoint, int type)
    : TServer(processor)
    , processor_(processor)
    , zmq_type_(type)
    , sock_(ctx, type)
  {
    if(zmq_type_ == ZMQ_SUB) {
      sock_.setsockopt(ZMQ_SUBSCRIBE, "", 0) ; // listen to all messages
      sock_.connect(endpoint.c_str()) ;
    }
    else {
      sock_.bind(endpoint.c_str());
    }
  }

  bool serveOne(int recv_flags = 0);
  void serve() {
    while (true) {
      serveOne();
    }
  }

  zmq::socket_t& getSocket() {
    return sock_;
  }

 private:
  boost::shared_ptr<TProcessor> processor_;
  int zmq_type_;
  zmq::socket_t sock_;
};


class TZmqMultiServer {
 public:
  void serveOne(long timeout = -1);
  void serveForever();

  std::vector<TZmqServer*>& servers() {
    return servers_;
  }

 private:
  zmq::pollitem_t* setupPoll();
  void serveActive(zmq::pollitem_t* items, long timeout);
  std::vector<TZmqServer*> servers_;
};


}}} // apache::thrift::server

#endif // #ifndef _THRIFT_SERVER_TZMQSERVER_H_
