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

#include "TZmqClient.h"
#include <cstring>

namespace apache { namespace thrift { namespace transport {

uint32_t TZmqClient::read_virt(uint8_t* buf, uint32_t len) {
  if (rbuf_.available_read() == 0) {
    (void)sock_.recv(&msg_);
    rbuf_.resetBuffer((uint8_t*)msg_.data(), msg_.size());
  }
  return rbuf_.read(buf, len);
}

void TZmqClient::write_virt(const uint8_t* buf, uint32_t len) {
  return wbuf_.write(buf, len);
}

uint32_t TZmqClient::writeEnd() {
  uint8_t* buf;
  uint32_t size;
  wbuf_.getBuffer(&buf, &size);
  zmq::message_t msg(size);
  std::memcpy(msg.data(), buf, size);
  (void)sock_.send(msg);
  wbuf_.resetBuffer(true);
  return size;
}

}}} // apache::thrift::transport
