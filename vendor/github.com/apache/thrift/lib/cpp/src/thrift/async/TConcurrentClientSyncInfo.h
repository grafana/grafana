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
#ifndef _THRIFT_TCONCURRENTCLIENTSYNCINFO_H_
#define _THRIFT_TCONCURRENTCLIENTSYNCINFO_H_ 1

#include <thrift/protocol/TProtocol.h>
#include <thrift/concurrency/Mutex.h>
#include <thrift/concurrency/Monitor.h>
#include <boost/shared_ptr.hpp>
#include <vector>
#include <string>
#include <map>

namespace apache {
namespace thrift {
namespace async {

class TConcurrentClientSyncInfo;

class TConcurrentSendSentry {
public:
  explicit TConcurrentSendSentry(TConcurrentClientSyncInfo* sync);
  ~TConcurrentSendSentry();

  void commit();

private:
  TConcurrentClientSyncInfo& sync_;
  bool committed_;
};

class TConcurrentRecvSentry {
public:
  TConcurrentRecvSentry(TConcurrentClientSyncInfo* sync, int32_t seqid);
  ~TConcurrentRecvSentry();

  void commit();

private:
  TConcurrentClientSyncInfo& sync_;
  int32_t seqid_;
  bool committed_;
};

class TConcurrentClientSyncInfo {
private: // typedefs
  typedef boost::shared_ptr< ::apache::thrift::concurrency::Monitor> MonitorPtr;
  typedef std::map<int32_t, MonitorPtr> MonitorMap;

public:
  TConcurrentClientSyncInfo();

  int32_t generateSeqId();

  bool getPending(std::string& fname,
                  ::apache::thrift::protocol::TMessageType& mtype,
                  int32_t& rseqid); /* requires readMutex_ */

  void updatePending(const std::string& fname,
                     ::apache::thrift::protocol::TMessageType mtype,
                     int32_t rseqid); /* requires readMutex_ */

  void waitForWork(int32_t seqid); /* requires readMutex_ */

  ::apache::thrift::concurrency::Mutex& getReadMutex() { return readMutex_; }
  ::apache::thrift::concurrency::Mutex& getWriteMutex() { return writeMutex_; }

private: // constants
  enum { MONITOR_CACHE_SIZE = 10 };

private: // functions
  MonitorPtr newMonitor_(
      const ::apache::thrift::concurrency::Guard& seqidGuard); /* requires seqidMutex_ */
  void deleteMonitor_(const ::apache::thrift::concurrency::Guard& seqidGuard, MonitorPtr& m);
      /*noexcept*/ /* requires seqidMutex_ */
  void wakeupAnyone_(
      const ::apache::thrift::concurrency::Guard& seqidGuard);           /* requires seqidMutex_ */
  void markBad_(const ::apache::thrift::concurrency::Guard& seqidGuard); /* requires seqidMutex_ */
  void throwBadSeqId_();
  void throwDeadConnection_();

private: // data members
  volatile bool stop_;

  ::apache::thrift::concurrency::Mutex seqidMutex_;
  // begin seqidMutex_ protected members
  int32_t nextseqid_;
  MonitorMap seqidToMonitorMap_;
  std::vector<MonitorPtr> freeMonitors_;
  // end seqidMutex_ protected members

  ::apache::thrift::concurrency::Mutex writeMutex_;

  ::apache::thrift::concurrency::Mutex readMutex_;
  // begin readMutex_ protected members
  bool recvPending_;
  bool wakeupSomeone_;
  int32_t seqidPending_;
  std::string fnamePending_;
  ::apache::thrift::protocol::TMessageType mtypePending_;
  // end readMutex_ protected members

  friend class TConcurrentSendSentry;
  friend class TConcurrentRecvSentry;
};
}
}
} // apache::thrift::async

#endif // _THRIFT_TCONCURRENTCLIENTSYNCINFO_H_
