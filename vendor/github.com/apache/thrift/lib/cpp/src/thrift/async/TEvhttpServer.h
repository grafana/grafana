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

#ifndef _THRIFT_TEVHTTP_SERVER_H_
#define _THRIFT_TEVHTTP_SERVER_H_ 1

#include <boost/shared_ptr.hpp>

struct event_base;
struct evhttp;
struct evhttp_request;

namespace apache {
namespace thrift {
namespace async {

class TAsyncBufferProcessor;

class TEvhttpServer {
public:
  /**
   * Create a TEvhttpServer for use with an external evhttp instance.
   * Must be manually installed with evhttp_set_cb, using
   * TEvhttpServer::request as the callback and the
   * address of the server as the extra arg.
   * Do not call "serve" on this server.
   */
  TEvhttpServer(boost::shared_ptr<TAsyncBufferProcessor> processor);

  /**
   * Create a TEvhttpServer with an embedded event_base and evhttp,
   * listening on port and responding on the endpoint "/".
   * Call "serve" on this server to serve forever.
   */
  TEvhttpServer(boost::shared_ptr<TAsyncBufferProcessor> processor, int port);

  ~TEvhttpServer();

  static void request(struct evhttp_request* req, void* self);
  int serve();

  struct event_base* getEventBase();

private:
  struct RequestContext;

  void process(struct evhttp_request* req);
  void complete(RequestContext* ctx, bool success);

  boost::shared_ptr<TAsyncBufferProcessor> processor_;
  struct event_base* eb_;
  struct evhttp* eh_;
};
}
}
} // apache::thrift::async

#endif // #ifndef _THRIFT_TEVHTTP_SERVER_H_
