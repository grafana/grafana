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

#ifndef _THRIFT_TRANSPORT_THTTPTRANSPORT_H_
#define _THRIFT_TRANSPORT_THTTPTRANSPORT_H_ 1

#include <thrift/transport/TBufferTransports.h>
#include <thrift/transport/TVirtualTransport.h>

namespace apache {
namespace thrift {
namespace transport {

/**
 * HTTP implementation of the thrift transport. This was irritating
 * to write, but the alternatives in C++ land are daunting. Linking CURL
 * requires 23 dynamic libraries last time I checked (WTF?!?). All we have
 * here is a VERY basic HTTP/1.1 client which supports HTTP 100 Continue,
 * chunked transfer encoding, keepalive, etc. Tested against Apache.
 */
class THttpTransport : public TVirtualTransport<THttpTransport> {
public:
  THttpTransport(boost::shared_ptr<TTransport> transport);

  virtual ~THttpTransport();

  void open() { transport_->open(); }

  bool isOpen() { return transport_->isOpen(); }

  bool peek() { return transport_->peek(); }

  void close() { transport_->close(); }

  uint32_t read(uint8_t* buf, uint32_t len);

  uint32_t readEnd();

  void write(const uint8_t* buf, uint32_t len);

  virtual void flush() = 0;

  virtual const std::string getOrigin();

protected:
  boost::shared_ptr<TTransport> transport_;
  std::string origin_;

  TMemoryBuffer writeBuffer_;
  TMemoryBuffer readBuffer_;

  bool readHeaders_;
  bool chunked_;
  bool chunkedDone_;
  uint32_t chunkSize_;
  uint32_t contentLength_;

  char* httpBuf_;
  uint32_t httpPos_;
  uint32_t httpBufLen_;
  uint32_t httpBufSize_;

  virtual void init();

  uint32_t readMoreData();
  char* readLine();

  void readHeaders();
  virtual void parseHeader(char* header) = 0;
  virtual bool parseStatusLine(char* status) = 0;

  uint32_t readChunked();
  void readChunkedFooters();
  uint32_t parseChunkSize(char* line);

  uint32_t readContent(uint32_t size);

  void refill();
  void shift();

  static const char* CRLF;
  static const int CRLF_LEN;
};
}
}
} // apache::thrift::transport

#endif // #ifndef _THRIFT_TRANSPORT_THTTPCLIENT_H_
