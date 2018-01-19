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

#ifndef _THRIFT_CONCURRENCY_TIMERMANAGER_H_
#define _THRIFT_CONCURRENCY_TIMERMANAGER_H_ 1

#include <thrift/concurrency/Exception.h>
#include <thrift/concurrency/Monitor.h>
#include <thrift/concurrency/Thread.h>

#include <boost/shared_ptr.hpp>
#include <map>
#include <time.h>

namespace apache {
namespace thrift {
namespace concurrency {

/**
 * Timer Manager
 *
 * This class dispatches timer tasks when they fall due.
 *
 * @version $Id:$
 */
class TimerManager {

public:
  TimerManager();

  virtual ~TimerManager();

  virtual boost::shared_ptr<const ThreadFactory> threadFactory() const;

  virtual void threadFactory(boost::shared_ptr<const ThreadFactory> value);

  /**
   * Starts the timer manager service
   *
   * @throws IllegalArgumentException Missing thread factory attribute
   */
  virtual void start();

  /**
   * Stops the timer manager service
   */
  virtual void stop();

  virtual size_t taskCount() const;

  /**
   * Adds a task to be executed at some time in the future by a worker thread.
   *
   * @param task The task to execute
   * @param timeout Time in milliseconds to delay before executing task
   */
  virtual void add(boost::shared_ptr<Runnable> task, int64_t timeout);

  /**
   * Adds a task to be executed at some time in the future by a worker thread.
   *
   * @param task The task to execute
   * @param timeout Absolute time in the future to execute task.
   */
  virtual void add(boost::shared_ptr<Runnable> task, const struct THRIFT_TIMESPEC& timeout);

  /**
   * Adds a task to be executed at some time in the future by a worker thread.
   *
   * @param task The task to execute
   * @param timeout Absolute time in the future to execute task.
   */
  virtual void add(boost::shared_ptr<Runnable> task, const struct timeval& timeout);

  /**
   * Removes a pending task
   *
   * @throws NoSuchTaskException Specified task doesn't exist. It was either
   *                             processed already or this call was made for a
   *                             task that was never added to this timer
   *
   * @throws UncancellableTaskException Specified task is already being
   *                                    executed or has completed execution.
   */
  virtual void remove(boost::shared_ptr<Runnable> task);

  enum STATE { UNINITIALIZED, STARTING, STARTED, STOPPING, STOPPED };

  virtual STATE state() const;

private:
  boost::shared_ptr<const ThreadFactory> threadFactory_;
  class Task;
  friend class Task;
  std::multimap<int64_t, boost::shared_ptr<Task> > taskMap_;
  size_t taskCount_;
  Monitor monitor_;
  STATE state_;
  class Dispatcher;
  friend class Dispatcher;
  boost::shared_ptr<Dispatcher> dispatcher_;
  boost::shared_ptr<Thread> dispatcherThread_;
  typedef std::multimap<int64_t, boost::shared_ptr<TimerManager::Task> >::iterator task_iterator;
  typedef std::pair<task_iterator, task_iterator> task_range;
};
}
}
} // apache::thrift::concurrency

#endif // #ifndef _THRIFT_CONCURRENCY_TIMERMANAGER_H_
