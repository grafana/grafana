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

#include <thrift/async/TEvhttpServer.h>
#include <thrift/async/TAsyncBufferProcessor.h>
#include <thrift/transport/TBufferTransports.h>
#include <evhttp.h>
#include <event2/buffer.h>
#include <event2/buffer_compat.h>

#include <iostream>

#ifndef HTTP_INTERNAL // libevent < 2
#define HTTP_INTERNAL 500
#endif

using apache::thrift::transport::TMemoryBuffer;

namespace apache {
namespace thrift {
namespace async {

struct TEvhttpServer::RequestContext {
  struct evhttp_request* req;
  boost::shared_ptr<apache::thrift::transport::TMemoryBuffer> ibuf;
  boost::shared_ptr<apache::thrift::transport::TMemoryBuffer> obuf;

  RequestContext(struct evhttp_request* req);
};

TEvhttpServer::TEvhttpServer(boost::shared_ptr<TAsyncBufferProcessor> processor)
  : processor_(processor), eb_(NULL), eh_(NULL) {
}

TEvhttpServer::TEvhttpServer(boost::shared_ptr<TAsyncBufferProcessor> processor, int port)
  : processor_(processor), eb_(NULL), eh_(NULL) {
  // Create event_base and evhttp.
  eb_ = event_base_new();
  if (eb_ == NULL) {
    throw TException("event_base_new failed");
  }
  eh_ = evhttp_new(eb_);
  if (eh_ == NULL) {
    event_base_free(eb_);
    throw TException("evhttp_new failed");
  }

  // Bind to port.
  int ret = evhttp_bind_socket(eh_, NULL, port);
  if (ret < 0) {
    evhttp_free(eh_);
    event_base_free(eb_);
    throw TException("evhttp_bind_socket failed");
  }

  // Register a handler.  If you use the other constructor,
  // you will want to do this yourself.
  // Don't forget to unregister before destorying this TEvhttpServer.
  evhttp_set_cb(eh_, "/", request, (void*)this);
}

TEvhttpServer::~TEvhttpServer() {
  if (eh_ != NULL) {
    evhttp_free(eh_);
  }
  if (eb_ != NULL) {
    event_base_free(eb_);
  }
}

int TEvhttpServer::serve() {
  if (eb_ == NULL) {
    throw TException("Unexpected call to TEvhttpServer::serve");
  }
  return event_base_dispatch(eb_);
}

TEvhttpServer::RequestContext::RequestContext(struct evhttp_request* req)
  : req(req),
    ibuf(new TMemoryBuffer(EVBUFFER_DATA(req->input_buffer),
                           static_cast<uint32_t>(EVBUFFER_LENGTH(req->input_buffer)))),
    obuf(new TMemoryBuffer()) {
}

void TEvhttpServer::request(struct evhttp_request* req, void* self) {
  try {
    static_cast<TEvhttpServer*>(self)->process(req);
  } catch (std::exception& e) {
    evhttp_send_reply(req, HTTP_INTERNAL, e.what(), 0);
  }
}

void TEvhttpServer::process(struct evhttp_request* req) {
  RequestContext* ctx = new RequestContext(req);
  return processor_->process(apache::thrift::stdcxx::bind(&TEvhttpServer::complete,
                                                          this,
                                                          ctx,
                                                          apache::thrift::stdcxx::placeholders::_1),
                             ctx->ibuf,
                             ctx->obuf);
}

void TEvhttpServer::complete(RequestContext* ctx, bool success) {
  (void)success;
  std::auto_ptr<RequestContext> ptr(ctx);

  int code = success ? 200 : 400;
  const char* reason = success ? "OK" : "Bad Request";

  int rv = evhttp_add_header(ctx->req->output_headers, "Content-Type", "application/x-thrift");
  if (rv != 0) {
    // TODO: Log an error.
    std::cerr << "evhttp_add_header failed " << __FILE__ << ":" << __LINE__ << std::endl;
  }

  struct evbuffer* buf = evbuffer_new();
  if (buf == NULL) {
    // TODO: Log an error.
    std::cerr << "evbuffer_new failed " << __FILE__ << ":" << __LINE__ << std::endl;
  } else {
    uint8_t* obuf;
    uint32_t sz;
    ctx->obuf->getBuffer(&obuf, &sz);
    int ret = evbuffer_add(buf, obuf, sz);
    if (ret != 0) {
      // TODO: Log an error.
      std::cerr << "evhttp_add failed with " << ret << " " << __FILE__ << ":" << __LINE__
                << std::endl;
    }
  }

  evhttp_send_reply(ctx->req, code, reason, buf);
  if (buf != NULL) {
    evbuffer_free(buf);
  }
}

struct event_base* TEvhttpServer::getEventBase() {
  return eb_;
}
}
}
} // apache::thrift::async
