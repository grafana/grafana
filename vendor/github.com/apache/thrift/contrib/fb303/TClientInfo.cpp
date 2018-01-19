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

#include <thrift/server/TClientInfo.h>

namespace apache { namespace thrift { namespace server {

using namespace apache::thrift;
using namespace apache::thrift::transport;

TClientInfoConnection::TClientInfoConnection() {
  call_[kNameLen - 1] = '\0';    // insure NUL terminator is there
  eraseAddr();
  eraseCall();
}

void TClientInfoConnection::recordAddr(const sockaddr* addr) {
  eraseAddr();
  initTime();
  ncalls_ = 0;
  if (addr != NULL) {
    if (addr->sa_family == AF_INET) {
      memcpy((void*)&addr_.ipv4, (const void *)addr, sizeof(sockaddr_in));
    }
    else if (addr->sa_family == AF_INET6) {
      memcpy((void*)&addr_.ipv6, (const void *)addr, sizeof(sockaddr_in6));
    }
  }
}

void TClientInfoConnection::eraseAddr() {
  addr_.ipv4.sin_family = AF_UNSPEC;
}

const char* TClientInfoConnection::getAddr(char* buf, int len) const {
  switch (addr_.ipv4.sin_family) {
  case AF_INET:
    return inet_ntop(AF_INET, &addr_.ipv4.sin_addr, buf, len);
  case AF_INET6:
    return inet_ntop(AF_INET6, &addr_.ipv6.sin6_addr, buf, len);
  default:
    return NULL;
  }
}

void TClientInfoConnection::recordCall(const char* name) {
  strncpy(call_, name, kNameLen - 1);   // NUL terminator set in constructor
  ncalls_++;
}

void TClientInfoConnection::eraseCall() {
  call_[0] = '\0';
}

const char* TClientInfoConnection::getCall() const {
  if (call_[0] == '\0') {
      return NULL;
  }
  return call_;
}

void TClientInfoConnection::getTime(timespec* time) const {
  *time = time_;
}

uint64_t TClientInfoConnection::getNCalls() const {
  return ncalls_;
}

void TClientInfoConnection::initTime() {
  clock_gettime(CLOCK_REALTIME, &time_);
}


TClientInfoConnection* TClientInfo::getConnection(int fd, bool grow) {
  if (fd < 0 || (!grow && fd >= info_.size())) {
    return NULL;
  }
  return &info_[fd];
}

size_t TClientInfo::size() const {
    return info_.size();
}

void* TClientInfoServerHandler::createContext(boost::shared_ptr<TProtocol> input,
                                              boost::shared_ptr<TProtocol> output) {
  (void)input;
  (void)output;
  return (void*) new Connect(&clientInfo_);
}

void TClientInfoServerHandler::deleteContext(void* connectionContext,
                                             boost::shared_ptr<TProtocol> input,
                                             boost::shared_ptr<TProtocol> output) {
  Connect* call = static_cast<Connect*>(connectionContext);
  if (call->callInfo_) {
    call->callInfo_->eraseCall();
  }
  delete call;
}

void TClientInfoServerHandler::processContext(void* connectionContext,
                                              shared_ptr<TTransport> transport) {
  Connect* call = static_cast<Connect*>(connectionContext);
  if (call->callInfo_ == NULL) {
    if (typeid(*(transport.get())) == typeid(TSocket)) {
      TSocket* tsocket = static_cast<TSocket*>(transport.get());
      int fd = tsocket->getSocketFD();
      if (fd < 0) {
        return;
      }
      call->callInfo_ = call->clientInfo_->getConnection(fd, true);
      assert(call->callInfo_ != NULL);
      socklen_t len;
        call->callInfo_->recordAddr(tsocket->getCachedAddress(&len));
    }
  }
}

void TClientInfoServerHandler::getStatsStrings(vector<string>& result) {
  result.clear();
  timespec now;
  clock_gettime(CLOCK_REALTIME, &now);

  for (int i = 0; i < clientInfo_.size(); ++i) {
    TClientInfoConnection* info = clientInfo_.getConnection(i, false);
    const char* callStr = info->getCall();
    if (callStr == NULL) {
      continue;
    }

    char addrBuf[INET6_ADDRSTRLEN];
    const char* addrStr = info->getAddr(addrBuf, sizeof addrBuf);
    if (addrStr == NULL) {
      // cerr << "no addr!" << endl;
      continue;
    }

    timespec start;
    info->getTime(&start);
    double secs = (double)(now.tv_sec - start.tv_sec) + (now.tv_nsec - start.tv_nsec)*0.000000001;

    char buf[256];
    snprintf(buf, sizeof buf, "%d %s %s %.3f %llu", i, addrStr, callStr, secs,
             (uint64_t)info->getNCalls());
               
    result.push_back(buf);
  }
}

void* TClientInfoCallHandler::getContext(const char* fn_name, void* serverContext) {
  if (serverContext) {
    TClientInfoConnection* callInfo =  static_cast<TClientInfoServerHandler::Connect*>(serverContext)->callInfo_;
    if (callInfo != NULL) {
      callInfo->recordCall(fn_name);
    }
  }
  return NULL;
}

} } } // namespace apache::thrift::server
