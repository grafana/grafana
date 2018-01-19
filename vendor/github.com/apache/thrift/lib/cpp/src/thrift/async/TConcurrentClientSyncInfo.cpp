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

#include <thrift/async/TConcurrentClientSyncInfo.h>
#include <thrift/TApplicationException.h>
#include <thrift/transport/TTransportException.h>
#include <limits>

namespace apache { namespace thrift { namespace async {

using namespace ::apache::thrift::concurrency;

TConcurrentClientSyncInfo::TConcurrentClientSyncInfo() :
  stop_(false),
  seqidMutex_(),
  // test rollover all the time
  nextseqid_((std::numeric_limits<int32_t>::max)()-10),
  seqidToMonitorMap_(),
  freeMonitors_(),
  writeMutex_(),
  readMutex_(),
  recvPending_(false),
  wakeupSomeone_(false),
  seqidPending_(0),
  fnamePending_(),
  mtypePending_(::apache::thrift::protocol::T_CALL)
{
  freeMonitors_.reserve(MONITOR_CACHE_SIZE);
}

bool TConcurrentClientSyncInfo::getPending(
  std::string &fname,
  ::apache::thrift::protocol::TMessageType &mtype,
  int32_t &rseqid)
{
  if(stop_)
    throwDeadConnection_();
  wakeupSomeone_ = false;
  if(recvPending_)
  {
    recvPending_ = false;
    rseqid = seqidPending_;
    fname  = fnamePending_;
    mtype  = mtypePending_;
    return true;
  }
  return false;
}

void TConcurrentClientSyncInfo::updatePending(
  const std::string &fname,
  ::apache::thrift::protocol::TMessageType mtype,
  int32_t rseqid)
{
  recvPending_ = true;
  seqidPending_ = rseqid;
  fnamePending_ = fname;
  mtypePending_ = mtype;
  MonitorPtr monitor;
  {
    Guard seqidGuard(seqidMutex_);
    MonitorMap::iterator i = seqidToMonitorMap_.find(rseqid);
    if(i == seqidToMonitorMap_.end())
      throwBadSeqId_();
    monitor = i->second;
  }
  monitor->notify();
}

void TConcurrentClientSyncInfo::waitForWork(int32_t seqid)
{
  MonitorPtr m;
  {
    Guard seqidGuard(seqidMutex_);
    m = seqidToMonitorMap_[seqid];
  }
  while(true)
  {
    // be very careful about setting state in this loop that affects waking up.  You may exit
    // this function, attempt to grab some work, and someone else could have beaten you (or not
    // left) the read mutex, and that will put you right back in this loop, with the mangled
    // state you left behind.
    if(stop_)
      throwDeadConnection_();
    if(wakeupSomeone_)
      return;
    if(recvPending_ && seqidPending_ == seqid)
      return;
    m->waitForever();
  }
}

void TConcurrentClientSyncInfo::throwBadSeqId_()
{
  throw apache::thrift::TApplicationException(
    TApplicationException::BAD_SEQUENCE_ID,
    "server sent a bad seqid");
}

void TConcurrentClientSyncInfo::throwDeadConnection_()
{
  throw apache::thrift::transport::TTransportException(
    apache::thrift::transport::TTransportException::NOT_OPEN,
    "this client died on another thread, and is now in an unusable state");
}

void TConcurrentClientSyncInfo::wakeupAnyone_(const Guard &)
{
  wakeupSomeone_ = true;
  if(!seqidToMonitorMap_.empty())
  {
    // The monitor map maps integers to monitors.  Larger integers are more recent
    // messages.  Since this is ordered, it means that the last element is the most recent.
    // We are trying to guess which thread will have its message complete next, so we are picking
    // the most recent. The oldest message is likely to be some polling, long lived message.
    // If we guess right, the thread we wake up will handle the message that comes in.
    // If we guess wrong, the thread we wake up will hand off the work to the correct thread,
    // costing us an extra context switch.
    seqidToMonitorMap_.rbegin()->second->notify();
  }
}

void TConcurrentClientSyncInfo::markBad_(const Guard &)
{
  wakeupSomeone_ = true;
  stop_ = true;
  for(MonitorMap::iterator i = seqidToMonitorMap_.begin(); i != seqidToMonitorMap_.end(); ++i)
    i->second->notify();
}

TConcurrentClientSyncInfo::MonitorPtr
TConcurrentClientSyncInfo::newMonitor_(const Guard &)
{
  if(freeMonitors_.empty())
    return MonitorPtr(new Monitor(&readMutex_));
  MonitorPtr retval;
  //swapping to avoid an atomic operation
  retval.swap(freeMonitors_.back());
  freeMonitors_.pop_back();
  return retval;
}

void TConcurrentClientSyncInfo::deleteMonitor_(
  const Guard &,
  TConcurrentClientSyncInfo::MonitorPtr &m) /*noexcept*/
{
  if(freeMonitors_.size() > MONITOR_CACHE_SIZE)
  {
    m.reset();
    return;
  }
  //freeMonitors_ was reserved up to MONITOR_CACHE_SIZE in the ctor,
  //so this shouldn't throw
  freeMonitors_.push_back(TConcurrentClientSyncInfo::MonitorPtr());
  //swapping to avoid an atomic operation
  m.swap(freeMonitors_.back());
}

int32_t TConcurrentClientSyncInfo::generateSeqId()
{
  Guard seqidGuard(seqidMutex_);
  if(stop_)
    throwDeadConnection_();

  if(!seqidToMonitorMap_.empty())
    if(nextseqid_ == seqidToMonitorMap_.begin()->first)
      throw apache::thrift::TApplicationException(
        TApplicationException::BAD_SEQUENCE_ID,
        "about to repeat a seqid");
  int32_t newSeqId = nextseqid_++;
  seqidToMonitorMap_[newSeqId] = newMonitor_(seqidGuard);
  return newSeqId;
}

TConcurrentRecvSentry::TConcurrentRecvSentry(TConcurrentClientSyncInfo *sync, int32_t seqid) :
  sync_(*sync),
  seqid_(seqid),
  committed_(false)
{
  sync_.getReadMutex().lock();
}

TConcurrentRecvSentry::~TConcurrentRecvSentry()
{
  {
    Guard seqidGuard(sync_.seqidMutex_);
    sync_.deleteMonitor_(seqidGuard, sync_.seqidToMonitorMap_[seqid_]);

    sync_.seqidToMonitorMap_.erase(seqid_);
    if(committed_)
      sync_.wakeupAnyone_(seqidGuard);
    else
      sync_.markBad_(seqidGuard);
  }
  sync_.getReadMutex().unlock();
}

void TConcurrentRecvSentry::commit()
{
  committed_ = true;
}

TConcurrentSendSentry::TConcurrentSendSentry(TConcurrentClientSyncInfo *sync) :
  sync_(*sync),
  committed_(false)
{
  sync_.getWriteMutex().lock();
}

TConcurrentSendSentry::~TConcurrentSendSentry()
{
  if(!committed_)
  {
    Guard seqidGuard(sync_.seqidMutex_);
    sync_.markBad_(seqidGuard);
  }
  sync_.getWriteMutex().unlock();
}

void TConcurrentSendSentry::commit()
{
  committed_ = true;
}


}}} // apache::thrift::async
