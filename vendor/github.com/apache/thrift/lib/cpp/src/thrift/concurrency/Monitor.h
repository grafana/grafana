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

#ifndef _THRIFT_CONCURRENCY_MONITOR_H_
#define _THRIFT_CONCURRENCY_MONITOR_H_ 1

#ifdef HAVE_SYS_TIME_H
#include <sys/time.h>
#endif

#include <thrift/concurrency/Exception.h>
#include <thrift/concurrency/Mutex.h>

#include <boost/utility.hpp>

namespace apache {
namespace thrift {
namespace concurrency {

/**
 * A monitor is a combination mutex and condition-event.  Waiting and
 * notifying condition events requires that the caller own the mutex.  Mutex
 * lock and unlock operations can be performed independently of condition
 * events.  This is more or less analogous to java.lang.Object multi-thread
 * operations.
 *
 * Note the Monitor can create a new, internal mutex; alternatively, a
 * separate Mutex can be passed in and the Monitor will re-use it without
 * taking ownership.  It's the user's responsibility to make sure that the
 * Mutex is not deallocated before the Monitor.
 *
 * Note that all methods are const.  Monitors implement logical constness, not
 * bit constness.  This allows const methods to call monitor methods without
 * needing to cast away constness or change to non-const signatures.
 *
 * @version $Id:$
 */
class Monitor : boost::noncopyable {
public:
  /** Creates a new mutex, and takes ownership of it. */
  Monitor();

  /** Uses the provided mutex without taking ownership. */
  explicit Monitor(Mutex* mutex);

  /** Uses the mutex inside the provided Monitor without taking ownership. */
  explicit Monitor(Monitor* monitor);

  /** Deallocates the mutex only if we own it. */
  virtual ~Monitor();

  Mutex& mutex() const;

  virtual void lock() const;

  virtual void unlock() const;

  /**
   * Waits a maximum of the specified timeout in milliseconds for the condition
   * to occur, or waits forever if timeout_ms == 0.
   *
   * Returns 0 if condition occurs, THRIFT_ETIMEDOUT on timeout, or an error code.
   */
  int waitForTimeRelative(int64_t timeout_ms) const;

  /**
   * Waits until the absolute time specified using struct THRIFT_TIMESPEC.
   * Returns 0 if condition occurs, THRIFT_ETIMEDOUT on timeout, or an error code.
   */
  int waitForTime(const THRIFT_TIMESPEC* abstime) const;

  /**
   * Waits until the absolute time specified using struct timeval.
   * Returns 0 if condition occurs, THRIFT_ETIMEDOUT on timeout, or an error code.
   */
  int waitForTime(const struct timeval* abstime) const;

  /**
   * Waits forever until the condition occurs.
   * Returns 0 if condition occurs, or an error code otherwise.
   */
  int waitForever() const;

  /**
   * Exception-throwing version of waitForTimeRelative(), called simply
   * wait(int64) for historical reasons.  Timeout is in milliseconds.
   *
   * If the condition occurs,  this function returns cleanly; on timeout or
   * error an exception is thrown.
   */
  void wait(int64_t timeout_ms = 0LL) const;

  /** Wakes up one thread waiting on this monitor. */
  virtual void notify() const;

  /** Wakes up all waiting threads on this monitor. */
  virtual void notifyAll() const;

private:
  class Impl;

  Impl* impl_;
};

class Synchronized {
public:
  Synchronized(const Monitor* monitor) : g(monitor->mutex()) {}
  Synchronized(const Monitor& monitor) : g(monitor.mutex()) {}

private:
  Guard g;
};
}
}
} // apache::thrift::concurrency

#endif // #ifndef _THRIFT_CONCURRENCY_MONITOR_H_
