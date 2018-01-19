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

#if USE_BOOST_THREAD

#include <thrift/concurrency/BoostThreadFactory.h>
#include <thrift/concurrency/Exception.h>

#include <cassert>

#include <boost/weak_ptr.hpp>
#include <boost/thread.hpp>

namespace apache {
namespace thrift {
namespace concurrency {

using boost::shared_ptr;
using boost::weak_ptr;

/**
 * The boost thread class.
 *
 * @version $Id:$
 */
class BoostThread : public Thread {
public:
  enum STATE { uninitialized, starting, started, stopping, stopped };

  static void* threadMain(void* arg);

private:
  std::auto_ptr<boost::thread> thread_;
  STATE state_;
  weak_ptr<BoostThread> self_;
  bool detached_;

public:
  BoostThread(bool detached, shared_ptr<Runnable> runnable)
    : state_(uninitialized), detached_(detached) {
    this->Thread::runnable(runnable);
  }

  ~BoostThread() {
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

    // Create reference
    shared_ptr<BoostThread>* selfRef = new shared_ptr<BoostThread>();
    *selfRef = self_.lock();

    state_ = starting;

    thread_
        = std::auto_ptr<boost::thread>(new boost::thread(boost::bind(threadMain, (void*)selfRef)));

    if (detached_)
      thread_->detach();
  }

  void join() {
    if (!detached_ && state_ != uninitialized) {
      thread_->join();
    }
  }

  Thread::id_t getId() { return thread_.get() ? thread_->get_id() : boost::thread::id(); }

  shared_ptr<Runnable> runnable() const { return Thread::runnable(); }

  void runnable(shared_ptr<Runnable> value) { Thread::runnable(value); }

  void weakRef(shared_ptr<BoostThread> self) {
    assert(self.get() == this);
    self_ = weak_ptr<BoostThread>(self);
  }
};

void* BoostThread::threadMain(void* arg) {
  shared_ptr<BoostThread> thread = *(shared_ptr<BoostThread>*)arg;
  delete reinterpret_cast<shared_ptr<BoostThread>*>(arg);

  if (!thread) {
    return (void*)0;
  }

  if (thread->state_ != starting) {
    return (void*)0;
  }

  thread->state_ = started;
  thread->runnable()->run();

  if (thread->state_ != stopping && thread->state_ != stopped) {
    thread->state_ = stopping;
  }
  return (void*)0;
}

BoostThreadFactory::BoostThreadFactory(bool detached)
  : ThreadFactory(detached) {
}

shared_ptr<Thread> BoostThreadFactory::newThread(shared_ptr<Runnable> runnable) const {
  shared_ptr<BoostThread> result = shared_ptr<BoostThread>(new BoostThread(isDetached(), runnable));
  result->weakRef(result);
  runnable->thread(result);
  return result;
}

Thread::id_t BoostThreadFactory::getCurrentThreadId() const {
  return boost::this_thread::get_id();
}
}
}
} // apache::thrift::concurrency

#endif // USE_BOOST_THREAD
