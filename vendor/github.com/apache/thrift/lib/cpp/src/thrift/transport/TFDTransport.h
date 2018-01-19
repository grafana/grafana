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

#ifndef _THRIFT_TRANSPORT_TFDTRANSPORT_H_
#define _THRIFT_TRANSPORT_TFDTRANSPORT_H_ 1

#include <string>
#ifdef HAVE_SYS_TIME_H
#include <sys/time.h>
#endif

#include <thrift/transport/TTransport.h>
#include <thrift/transport/TVirtualTransport.h>

namespace apache {
namespace thrift {
namespace transport {

/**
 * Dead-simple wrapper around a file descriptor.
 *
 */
class TFDTransport : public TVirtualTransport<TFDTransport> {
public:
  enum ClosePolicy { NO_CLOSE_ON_DESTROY = 0, CLOSE_ON_DESTROY = 1 };

  TFDTransport(int fd, ClosePolicy close_policy = NO_CLOSE_ON_DESTROY)
    : fd_(fd), close_policy_(close_policy) {}

  ~TFDTransport() {
    if (close_policy_ == CLOSE_ON_DESTROY) {
      try {
        close();
      } catch (TTransportException& ex) {
        GlobalOutput.printf("~TFDTransport TTransportException: '%s'", ex.what());
      }
    }
  }

  bool isOpen() { return fd_ >= 0; }

  void open() {}

  void close();

  uint32_t read(uint8_t* buf, uint32_t len);

  void write(const uint8_t* buf, uint32_t len);

  void setFD(int fd) { fd_ = fd; }
  int getFD() { return fd_; }

protected:
  int fd_;
  ClosePolicy close_policy_;
};
}
}
} // apache::thrift::transport

#endif // #ifndef _THRIFT_TRANSPORT_TFDTRANSPORT_H_
