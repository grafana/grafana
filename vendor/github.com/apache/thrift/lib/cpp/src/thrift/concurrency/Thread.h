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

#ifndef _THRIFT_CONCURRENCY_THREAD_H_
#define _THRIFT_CONCURRENCY_THREAD_H_ 1

#include <stdint.h>
#include <boost/shared_ptr.hpp>
#include <boost/weak_ptr.hpp>

#include <thrift/thrift-config.h>

#if USE_BOOST_THREAD
#include <boost/thread.hpp>
#elif USE_STD_THREAD
#include <thread>
#else
#ifdef HAVE_PTHREAD_H
#include <pthread.h>
#endif
#endif

namespace apache {
namespace thrift {
namespace concurrency {

class Thread;

/**
 * Minimal runnable class.  More or less analogous to java.lang.Runnable.
 *
 * @version $Id:$
 */
class Runnable {

public:
  virtual ~Runnable(){};
  virtual void run() = 0;

  /**
   * Gets the thread object that is hosting this runnable object  - can return
   * an empty boost::shared pointer if no references remain on that thread object
   */
  virtual boost::shared_ptr<Thread> thread() { return thread_.lock(); }

  /**
   * Sets the thread that is executing this object.  This is only meant for
   * use by concrete implementations of Thread.
   */
  virtual void thread(boost::shared_ptr<Thread> value) { thread_ = value; }

private:
  boost::weak_ptr<Thread> thread_;
};

/**
 * Minimal thread class. Returned by thread factory bound to a Runnable object
 * and ready to start execution.  More or less analogous to java.lang.Thread
 * (minus all the thread group, priority, mode and other baggage, since that
 * is difficult to abstract across platforms and is left for platform-specific
 * ThreadFactory implemtations to deal with
 *
 * @see apache::thrift::concurrency::ThreadFactory)
 */
class Thread {

public:
#if USE_BOOST_THREAD
  typedef boost::thread::id id_t;

  static inline bool is_current(id_t t) { return t == boost::this_thread::get_id(); }
  static inline id_t get_current() { return boost::this_thread::get_id(); }
#elif USE_STD_THREAD
  typedef std::thread::id id_t;

  static inline bool is_current(id_t t) { return t == std::this_thread::get_id(); }
  static inline id_t get_current() { return std::this_thread::get_id(); }
#else
  typedef pthread_t id_t;

  static inline bool is_current(id_t t) { return pthread_equal(pthread_self(), t); }
  static inline id_t get_current() { return pthread_self(); }
#endif

  virtual ~Thread(){};

  /**
   * Starts the thread. Does platform specific thread creation and
   * configuration then invokes the run method of the Runnable object bound
   * to this thread.
   */
  virtual void start() = 0;

  /**
   * Join this thread. If this thread is joinable, the calling thread blocks
   * until this thread completes.  If the target thread is not joinable, then
   * nothing happens.
   */
  virtual void join() = 0;

  /**
   * Gets the thread's platform-specific ID
   */
  virtual id_t getId() = 0;

  /**
   * Gets the runnable object this thread is hosting
   */
  virtual boost::shared_ptr<Runnable> runnable() const { return _runnable; }

protected:
  virtual void runnable(boost::shared_ptr<Runnable> value) { _runnable = value; }

private:
  boost::shared_ptr<Runnable> _runnable;
};

/**
 * Factory to create platform-specific thread object and bind them to Runnable
 * object for execution
 */
class ThreadFactory {
protected:
  ThreadFactory(bool detached) : detached_(detached) { }

public:
  virtual ~ThreadFactory() { }

  /**
   * Gets current detached mode
   */
  bool isDetached() const { return detached_; }

  /**
   * Sets the detached disposition of newly created threads.
   */
  void setDetached(bool detached) { detached_ = detached; }

  /**
   * Create a new thread.
   */
  virtual boost::shared_ptr<Thread> newThread(boost::shared_ptr<Runnable> runnable) const = 0;

  /**
   * Gets the current thread id or unknown_thread_id if the current thread is not a thrift thread
   */
  virtual Thread::id_t getCurrentThreadId() const = 0;

  /**
   * For code readability define the unknown/undefined thread id
   */
  static const Thread::id_t unknown_thread_id;

private:
  bool detached_;
};

}
}
} // apache::thrift::concurrency

#endif // #ifndef _THRIFT_CONCURRENCY_THREAD_H_
