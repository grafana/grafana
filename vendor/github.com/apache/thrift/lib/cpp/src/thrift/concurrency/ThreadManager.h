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

#ifndef _THRIFT_CONCURRENCY_THREADMANAGER_H_
#define _THRIFT_CONCURRENCY_THREADMANAGER_H_ 1

#include <boost/shared_ptr.hpp>
#include <thrift/cxxfunctional.h>
#include <sys/types.h>
#include <thrift/concurrency/Thread.h>

namespace apache {
namespace thrift {
namespace concurrency {

/**
 * Thread Pool Manager and related classes
 *
 * @version $Id:$
 */
class ThreadManager;

/**
 * ThreadManager class
 *
 * This class manages a pool of threads. It uses a ThreadFactory to create
 * threads. It never actually creates or destroys worker threads, rather
 * it maintains statistics on number of idle threads, number of active threads,
 * task backlog, and average wait and service times and informs the PoolPolicy
 * object bound to instances of this manager of interesting transitions. It is
 * then up the PoolPolicy object to decide if the thread pool size needs to be
 * adjusted and call this object addWorker and removeWorker methods to make
 * changes.
 *
 * This design allows different policy implementations to use this code to
 * handle basic worker thread management and worker task execution and focus on
 * policy issues. The simplest policy, StaticPolicy, does nothing other than
 * create a fixed number of threads.
 */
class ThreadManager {

protected:
  ThreadManager() {}

public:
  typedef apache::thrift::stdcxx::function<void(boost::shared_ptr<Runnable>)> ExpireCallback;

  virtual ~ThreadManager() {}

  /**
   * Starts the thread manager. Verifies all attributes have been properly
   * initialized, then allocates necessary resources to begin operation
   */
  virtual void start() = 0;

  /**
   * Stops the thread manager. Aborts all remaining unprocessed task, shuts
   * down all created worker threads, and releases all allocated resources.
   * This method blocks for all worker threads to complete, thus it can
   * potentially block forever if a worker thread is running a task that
   * won't terminate.
   *
   * Worker threads will be joined depending on the threadFactory's detached
   * disposition.
   */
  virtual void stop() = 0;

  enum STATE { UNINITIALIZED, STARTING, STARTED, JOINING, STOPPING, STOPPED };

  virtual STATE state() const = 0;

  /**
   * \returns the current thread factory
   */
  virtual boost::shared_ptr<ThreadFactory> threadFactory() const = 0;

  /**
   * Set the thread factory.
   * \throws InvalidArgumentException if the new thread factory has a different
   *                                  detached disposition than the one replacing it
   */
  virtual void threadFactory(boost::shared_ptr<ThreadFactory> value) = 0;

  /**
   * Adds worker thread(s).
   */
  virtual void addWorker(size_t value = 1) = 0;

  /**
   * Removes worker thread(s).
   * Threads are joined if the thread factory detached disposition allows it.
   * Blocks until the number of worker threads reaches the new limit.
   * \param[in]  value  the number to remove
   * \throws InvalidArgumentException if the value is greater than the number
   *                                  of workers
   */
  virtual void removeWorker(size_t value = 1) = 0;

  /**
   * Gets the current number of idle worker threads
   */
  virtual size_t idleWorkerCount() const = 0;

  /**
   * Gets the current number of total worker threads
   */
  virtual size_t workerCount() const = 0;

  /**
   * Gets the current number of pending tasks
   */
  virtual size_t pendingTaskCount() const = 0;

  /**
   * Gets the current number of pending and executing tasks
   */
  virtual size_t totalTaskCount() const = 0;

  /**
   * Gets the maximum pending task count.  0 indicates no maximum
   */
  virtual size_t pendingTaskCountMax() const = 0;

  /**
   * Gets the number of tasks which have been expired without being run
   * since start() was called.
   */
  virtual size_t expiredTaskCount() = 0;

  /**
   * Adds a task to be executed at some time in the future by a worker thread.
   *
   * This method will block if pendingTaskCountMax() in not zero and pendingTaskCount()
   * is greater than or equalt to pendingTaskCountMax().  If this method is called in the
   * context of a ThreadManager worker thread it will throw a
   * TooManyPendingTasksException
   *
   * @param task  The task to queue for execution
   *
   * @param timeout Time to wait in milliseconds to add a task when a pending-task-count
   * is specified. Specific cases:
   * timeout = 0  : Wait forever to queue task.
   * timeout = -1 : Return immediately if pending task count exceeds specified max
   * @param expiration when nonzero, the number of milliseconds the task is valid
   * to be run; if exceeded, the task will be dropped off the queue and not run.
   *
   * @throws TooManyPendingTasksException Pending task count exceeds max pending task count
   */
  virtual void add(boost::shared_ptr<Runnable> task,
                   int64_t timeout = 0LL,
                   int64_t expiration = 0LL) = 0;

  /**
   * Removes a pending task
   */
  virtual void remove(boost::shared_ptr<Runnable> task) = 0;

  /**
   * Remove the next pending task which would be run.
   *
   * @return the task removed.
   */
  virtual boost::shared_ptr<Runnable> removeNextPending() = 0;

  /**
   * Remove tasks from front of task queue that have expired.
   */
  virtual void removeExpiredTasks() = 0;

  /**
   * Set a callback to be called when a task is expired and not run.
   *
   * @param expireCallback a function called with the shared_ptr<Runnable> for
   * the expired task.
   */
  virtual void setExpireCallback(ExpireCallback expireCallback) = 0;

  static boost::shared_ptr<ThreadManager> newThreadManager();

  /**
   * Creates a simple thread manager the uses count number of worker threads and has
   * a pendingTaskCountMax maximum pending tasks. The default, 0, specified no limit
   * on pending tasks
   */
  static boost::shared_ptr<ThreadManager> newSimpleThreadManager(size_t count = 4,
                                                                 size_t pendingTaskCountMax = 0);

  class Task;

  class Worker;

  class Impl;
};
}
}
} // apache::thrift::concurrency

#endif // #ifndef _THRIFT_CONCURRENCY_THREADMANAGER_H_
