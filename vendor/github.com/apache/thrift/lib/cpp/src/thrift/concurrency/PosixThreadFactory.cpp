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

#include <thrift/concurrency/PosixThreadFactory.h>
#include <thrift/concurrency/Exception.h>

#if GOOGLE_PERFTOOLS_REGISTER_THREAD
#include <google/profiler.h>
#endif

#include <assert.h>
#include <pthread.h>

#include <iostream>

#include <boost/weak_ptr.hpp>

namespace apache {
namespace thrift {
namespace concurrency {

using boost::shared_ptr;
using boost::weak_ptr;

/**
 * The POSIX thread class.
 *
 * @version $Id:$
 */
class PthreadThread : public Thread {
public:
  enum STATE { uninitialized, starting, started, stopping, stopped };

  static const int MB = 1024 * 1024;

  static void* threadMain(void* arg);

private:
  pthread_t pthread_;
  STATE state_;
  int policy_;
  int priority_;
  int stackSize_;
  weak_ptr<PthreadThread> self_;
  bool detached_;

public:
  PthreadThread(int policy,
                int priority,
                int stackSize,
                bool detached,
                shared_ptr<Runnable> runnable)
    :

#ifndef _WIN32
      pthread_(0),
#endif // _WIN32

      state_(uninitialized),
      policy_(policy),
      priority_(priority),
      stackSize_(stackSize),
      detached_(detached) {

    this->Thread::runnable(runnable);
  }

  ~PthreadThread() {
    /* Nothing references this thread, if is is not detached, do a join
       now, otherwise the thread-id and, possibly, other resources will
       be leaked. */
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

    pthread_attr_t thread_attr;
    if (pthread_attr_init(&thread_attr) != 0) {
      throw SystemResourceException("pthread_attr_init failed");
    }

    if (pthread_attr_setdetachstate(&thread_attr,
                                    detached_ ? PTHREAD_CREATE_DETACHED : PTHREAD_CREATE_JOINABLE)
        != 0) {
      throw SystemResourceException("pthread_attr_setdetachstate failed");
    }

    // Set thread stack size
    if (pthread_attr_setstacksize(&thread_attr, MB * stackSize_) != 0) {
      throw SystemResourceException("pthread_attr_setstacksize failed");
    }

// Set thread policy
#ifdef _WIN32
    // WIN32 Pthread implementation doesn't seem to support sheduling policies other then
    // PosixThreadFactory::OTHER - runtime error
    policy_ = PosixThreadFactory::OTHER;
#endif

#if _POSIX_THREAD_PRIORITY_SCHEDULING > 0
    if (pthread_attr_setschedpolicy(&thread_attr, policy_) != 0) {
      throw SystemResourceException("pthread_attr_setschedpolicy failed");
    }
#endif

    struct sched_param sched_param;
    sched_param.sched_priority = priority_;

    // Set thread priority
    if (pthread_attr_setschedparam(&thread_attr, &sched_param) != 0) {
      throw SystemResourceException("pthread_attr_setschedparam failed");
    }

    // Create reference
    shared_ptr<PthreadThread>* selfRef = new shared_ptr<PthreadThread>();
    *selfRef = self_.lock();

    state_ = starting;

    if (pthread_create(&pthread_, &thread_attr, threadMain, (void*)selfRef) != 0) {
      throw SystemResourceException("pthread_create failed");
    }
  }

  void join() {
    if (!detached_ && state_ != uninitialized) {
      void* ignore;
      /* XXX
         If join fails it is most likely due to the fact
         that the last reference was the thread itself and cannot
         join.  This results in leaked threads and will eventually
         cause the process to run out of thread resources.
         We're beyond the point of throwing an exception.  Not clear how
         best to handle this. */
      int res = pthread_join(pthread_, &ignore);
      detached_ = (res == 0);
      if (res != 0) {
        GlobalOutput.printf("PthreadThread::join(): fail with code %d", res);
      }
    } else {
      GlobalOutput.printf("PthreadThread::join(): detached thread");
    }
  }

  Thread::id_t getId() {

#ifndef _WIN32
    return (Thread::id_t)pthread_;
#else
    return (Thread::id_t)pthread_.p;
#endif // _WIN32
  }

  shared_ptr<Runnable> runnable() const { return Thread::runnable(); }

  void runnable(shared_ptr<Runnable> value) { Thread::runnable(value); }

  void weakRef(shared_ptr<PthreadThread> self) {
    assert(self.get() == this);
    self_ = weak_ptr<PthreadThread>(self);
  }
};

void* PthreadThread::threadMain(void* arg) {
  shared_ptr<PthreadThread> thread = *(shared_ptr<PthreadThread>*)arg;
  delete reinterpret_cast<shared_ptr<PthreadThread>*>(arg);

  if (thread == NULL) {
    return (void*)0;
  }

  if (thread->state_ != starting) {
    return (void*)0;
  }

#if GOOGLE_PERFTOOLS_REGISTER_THREAD
  ProfilerRegisterThread();
#endif

  thread->state_ = started;
  thread->runnable()->run();
  if (thread->state_ != stopping && thread->state_ != stopped) {
    thread->state_ = stopping;
  }

  return (void*)0;
}

/**
 * Converts generic posix thread schedule policy enums into pthread
 * API values.
 */
static int toPthreadPolicy(PosixThreadFactory::POLICY policy) {
  switch (policy) {
  case PosixThreadFactory::OTHER:
    return SCHED_OTHER;
  case PosixThreadFactory::FIFO:
    return SCHED_FIFO;
  case PosixThreadFactory::ROUND_ROBIN:
    return SCHED_RR;
  }
  return SCHED_OTHER;
}

/**
 * Converts relative thread priorities to absolute value based on posix
 * thread scheduler policy
 *
 *  The idea is simply to divide up the priority range for the given policy
 * into the correpsonding relative priority level (lowest..highest) and
 * then pro-rate accordingly.
 */
static int toPthreadPriority(PosixThreadFactory::POLICY policy, PosixThreadFactory::PRIORITY priority) {
  int pthread_policy = toPthreadPolicy(policy);
  int min_priority = 0;
  int max_priority = 0;
#ifdef HAVE_SCHED_GET_PRIORITY_MIN
  min_priority = sched_get_priority_min(pthread_policy);
#endif
#ifdef HAVE_SCHED_GET_PRIORITY_MAX
  max_priority = sched_get_priority_max(pthread_policy);
#endif
  int quanta = (PosixThreadFactory::HIGHEST - PosixThreadFactory::LOWEST) + 1;
  float stepsperquanta = (float)(max_priority - min_priority) / quanta;

  if (priority <= PosixThreadFactory::HIGHEST) {
    return (int)(min_priority + stepsperquanta * priority);
  } else {
    // should never get here for priority increments.
    assert(false);
    return (int)(min_priority + stepsperquanta * PosixThreadFactory::NORMAL);
  }
}

PosixThreadFactory::PosixThreadFactory(POLICY policy,
                                       PRIORITY priority,
                                       int stackSize,
                                       bool detached)
  : ThreadFactory(detached),
    policy_(policy),
    priority_(priority),
    stackSize_(stackSize) {
}

PosixThreadFactory::PosixThreadFactory(bool detached)
  : ThreadFactory(detached),
    policy_(ROUND_ROBIN),
    priority_(NORMAL),
    stackSize_(1) {
}

shared_ptr<Thread> PosixThreadFactory::newThread(shared_ptr<Runnable> runnable) const {
  shared_ptr<PthreadThread> result
      = shared_ptr<PthreadThread>(new PthreadThread(toPthreadPolicy(policy_),
                                                    toPthreadPriority(policy_, priority_),
                                                    stackSize_,
                                                    isDetached(),
                                                    runnable));
  result->weakRef(result);
  runnable->thread(result);
  return result;
}

int PosixThreadFactory::getStackSize() const {
  return stackSize_;
}

void PosixThreadFactory::setStackSize(int value) {
  stackSize_ = value;
}

PosixThreadFactory::PRIORITY PosixThreadFactory::getPriority() const {
  return priority_;
}

void PosixThreadFactory::setPriority(PRIORITY value) {
  priority_ = value;
}

Thread::id_t PosixThreadFactory::getCurrentThreadId() const {
#ifndef _WIN32
  return (Thread::id_t)pthread_self();
#else
  return (Thread::id_t)pthread_self().p;
#endif // _WIN32
}

}
}
} // apache::thrift::concurrency
