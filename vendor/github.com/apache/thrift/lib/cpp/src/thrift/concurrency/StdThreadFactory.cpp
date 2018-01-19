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

#include <thrift/thrift-config.h>

#if USE_STD_THREAD

#include <thrift/concurrency/StdThreadFactory.h>
#include <thrift/concurrency/Exception.h>

#include <cassert>

#include <boost/enable_shared_from_this.hpp>
#include <boost/weak_ptr.hpp>
#include <thread>

namespace apache {
namespace thrift {
namespace concurrency {

/**
 * The C++11 thread class.
 *
 * Note that we use boost shared_ptr rather than std shared_ptrs here
 * because the Thread/Runnable classes use those and we don't want to
 * mix them.
 *
 * @version $Id:$
 */
class StdThread : public Thread, public boost::enable_shared_from_this<StdThread> {
public:
  enum STATE { uninitialized, starting, started, stopping, stopped };

  static void threadMain(boost::shared_ptr<StdThread> thread);

private:
  std::unique_ptr<std::thread> thread_;
  STATE state_;
  bool detached_;

public:
  StdThread(bool detached, boost::shared_ptr<Runnable> runnable)
    : state_(uninitialized), detached_(detached) {
    this->Thread::runnable(runnable);
  }

  ~StdThread() {
    if (!detached_) {
      try {
        join();
      } catch (...) {
        // We're really hosed.
      }
    }
  }

  void start() {
    if (state_ != uninitialized) {
      return;
    }

    boost::shared_ptr<StdThread> selfRef = shared_from_this();
    state_ = starting;

    thread_ = std::unique_ptr<std::thread>(new std::thread(threadMain, selfRef));

    if (detached_)
      thread_->detach();
  }

  void join() {
    if (!detached_ && state_ != uninitialized) {
      thread_->join();
    }
  }

  Thread::id_t getId() { return thread_.get() ? thread_->get_id() : std::thread::id(); }

  boost::shared_ptr<Runnable> runnable() const { return Thread::runnable(); }

  void runnable(boost::shared_ptr<Runnable> value) { Thread::runnable(value); }
};

void StdThread::threadMain(boost::shared_ptr<StdThread> thread) {
  if (thread == NULL) {
    return;
  }

  if (thread->state_ != starting) {
    return;
  }

  thread->state_ = started;
  thread->runnable()->run();

  if (thread->state_ != stopping && thread->state_ != stopped) {
    thread->state_ = stopping;
  }

  return;
}

StdThreadFactory::StdThreadFactory(bool detached) : ThreadFactory(detached) {
}

boost::shared_ptr<Thread> StdThreadFactory::newThread(boost::shared_ptr<Runnable> runnable) const {
  boost::shared_ptr<StdThread> result = boost::shared_ptr<StdThread>(new StdThread(isDetached(), runnable));
  runnable->thread(result);
  return result;
}

Thread::id_t StdThreadFactory::getCurrentThreadId() const {
  return std::this_thread::get_id();
}
}
}
} // apache::thrift::concurrency

#endif // USE_STD_THREAD
