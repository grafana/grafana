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

#include <thrift/async/TEvhttpClientChannel.h>
#include <evhttp.h>
#include <event2/buffer.h>
#include <event2/buffer_compat.h>
#include <thrift/transport/TBufferTransports.h>
#include <thrift/protocol/TProtocolException.h>

#include <iostream>
#include <sstream>

using namespace apache::thrift::protocol;
using apache::thrift::transport::TTransportException;

namespace apache {
namespace thrift {
namespace async {

TEvhttpClientChannel::TEvhttpClientChannel(const std::string& host,
                                           const std::string& path,
                                           const char* address,
                                           int port,
                                           struct event_base* eb)
  : host_(host), path_(path), conn_(NULL) {
  conn_ = evhttp_connection_new(address, port);
  if (conn_ == NULL) {
    throw TException("evhttp_connection_new failed");
  }
  evhttp_connection_set_base(conn_, eb);
}

TEvhttpClientChannel::~TEvhttpClientChannel() {
  if (conn_ != NULL) {
    evhttp_connection_free(conn_);
  }
}

void TEvhttpClientChannel::sendAndRecvMessage(const VoidCallback& cob,
                                              apache::thrift::transport::TMemoryBuffer* sendBuf,
                                              apache::thrift::transport::TMemoryBuffer* recvBuf) {
  struct evhttp_request* req = evhttp_request_new(response, this);
  if (req == NULL) {
    throw TException("evhttp_request_new failed");
  }

  int rv;

  rv = evhttp_add_header(req->output_headers, "Host", host_.c_str());
  if (rv != 0) {
    throw TException("evhttp_add_header failed");
  }

  rv = evhttp_add_header(req->output_headers, "Content-Type", "application/x-thrift");
  if (rv != 0) {
    throw TException("evhttp_add_header failed");
  }

  uint8_t* obuf;
  uint32_t sz;
  sendBuf->getBuffer(&obuf, &sz);
  rv = evbuffer_add(req->output_buffer, obuf, sz);
  if (rv != 0) {
    throw TException("evbuffer_add failed");
  }

  rv = evhttp_make_request(conn_, req, EVHTTP_REQ_POST, path_.c_str());
  if (rv != 0) {
    throw TException("evhttp_make_request failed");
  }

  completionQueue_.push(Completion(cob, recvBuf));
}

void TEvhttpClientChannel::sendMessage(const VoidCallback& cob,
                                       apache::thrift::transport::TMemoryBuffer* message) {
  (void)cob;
  (void)message;
  throw TProtocolException(TProtocolException::NOT_IMPLEMENTED,
                           "Unexpected call to TEvhttpClientChannel::sendMessage");
}

void TEvhttpClientChannel::recvMessage(const VoidCallback& cob,
                                       apache::thrift::transport::TMemoryBuffer* message) {
  (void)cob;
  (void)message;
  throw TProtocolException(TProtocolException::NOT_IMPLEMENTED,
                           "Unexpected call to TEvhttpClientChannel::recvMessage");
}

void TEvhttpClientChannel::finish(struct evhttp_request* req) {
  assert(!completionQueue_.empty());
  Completion completion = completionQueue_.front();
  completionQueue_.pop();
  if (req == NULL) {
    try {
      completion.first();
    } catch (const TTransportException& e) {
      if (e.getType() == TTransportException::END_OF_FILE)
        throw TException("connect failed");
      else
        throw;
    }
    return;
  } else if (req->response_code != 200) {
    try {
      completion.first();
    } catch (const TTransportException& e) {
      std::stringstream ss;
      ss << "server returned code " << req->response_code;
      if (req->response_code_line)
        ss << ": " << req->response_code_line;
      if (e.getType() == TTransportException::END_OF_FILE)
        throw TException(ss.str());
      else
        throw;
    }
    return;
  }
  completion.second->resetBuffer(EVBUFFER_DATA(req->input_buffer),
                        static_cast<uint32_t>(EVBUFFER_LENGTH(req->input_buffer)));
  completion.first();
  return;
}

/* static */ void TEvhttpClientChannel::response(struct evhttp_request* req, void* arg) {
  TEvhttpClientChannel* self = (TEvhttpClientChannel*)arg;
  try {
    self->finish(req);
  } catch (std::exception& e) {
    // don't propagate a C++ exception in C code (e.g. libevent)
    std::cerr << "TEvhttpClientChannel::response exception thrown (ignored): " << e.what()
              << std::endl;
  }
}
}
}
} // apache::thrift::async
