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

#include <thrift/concurrency/ThreadManager.h>
#include <thrift/concurrency/Exception.h>
#include <thrift/concurrency/Monitor.h>
#include <thrift/concurrency/Util.h>

#include <boost/shared_ptr.hpp>

#include <stdexcept>
#include <deque>
#include <set>

#if defined(DEBUG)
#include <iostream>
#endif // defined(DEBUG)

namespace apache {
namespace thrift {
namespace concurrency {

using boost::shared_ptr;
using boost::dynamic_pointer_cast;

/**
 * ThreadManager class
 *
 * This class manages a pool of threads. It uses a ThreadFactory to create
 * threads.  It never actually creates or destroys worker threads, rather
 * it maintains statistics on number of idle threads, number of active threads,
 * task backlog, and average wait and service times.
 *
 * There are three different monitors used for signaling different conditions
 * however they all share the same mutex_.
 *
 * @version $Id:$
 */
class ThreadManager::Impl : public ThreadManager {

public:
  Impl()
    : workerCount_(0),
      workerMaxCount_(0),
      idleCount_(0),
      pendingTaskCountMax_(0),
      expiredCount_(0),
      state_(ThreadManager::UNINITIALIZED),
      monitor_(&mutex_),
      maxMonitor_(&mutex_),
      workerMonitor_(&mutex_) {}

  ~Impl() { stop(); }

  void start();
  void stop();

  ThreadManager::STATE state() const { return state_; }

  shared_ptr<ThreadFactory> threadFactory() const {
    Guard g(mutex_);
    return threadFactory_;
  }

  void threadFactory(shared_ptr<ThreadFactory> value) {
    Guard g(mutex_);
    if (threadFactory_ && threadFactory_->isDetached() != value->isDetached()) {
      throw InvalidArgumentException();
    }
    threadFactory_ = value;
  }

  void addWorker(size_t value);

  void removeWorker(size_t value);

  size_t idleWorkerCount() const { return idleCount_; }

  size_t workerCount() const {
    Guard g(mutex_);
    return workerCount_;
  }

  size_t pendingTaskCount() const {
    Guard g(mutex_);
    return tasks_.size();
  }

  size_t totalTaskCount() const {
    Guard g(mutex_);
    return tasks_.size() + workerCount_ - idleCount_;
  }

  size_t pendingTaskCountMax() const {
    Guard g(mutex_);
    return pendingTaskCountMax_;
  }

  size_t expiredTaskCount() {
    Guard g(mutex_);
    return expiredCount_;
  }

  void pendingTaskCountMax(const size_t value) {
    Guard g(mutex_);
    pendingTaskCountMax_ = value;
  }

  void add(shared_ptr<Runnable> value, int64_t timeout, int64_t expiration);

  void remove(shared_ptr<Runnable> task);

  shared_ptr<Runnable> removeNextPending();

  void removeExpiredTasks() {
    removeExpired(false);
  }

  void setExpireCallback(ExpireCallback expireCallback);

private:
  /**
   * Remove one or more expired tasks.
   * \param[in]  justOne  if true, try to remove just one task and return
   */
  void removeExpired(bool justOne);

  /**
   * \returns whether it is acceptable to block, depending on the current thread id
   */
  bool canSleep() const;

  /**
   * Lowers the maximum worker count and blocks until enough worker threads complete
   * to get to the new maximum worker limit.  The caller is responsible for acquiring
   * a lock on the class mutex_.
   */
  void removeWorkersUnderLock(size_t value);

  size_t workerCount_;
  size_t workerMaxCount_;
  size_t idleCount_;
  size_t pendingTaskCountMax_;
  size_t expiredCount_;
  ExpireCallback expireCallback_;

  ThreadManager::STATE state_;
  shared_ptr<ThreadFactory> threadFactory_;

  friend class ThreadManager::Task;
  typedef std::deque<shared_ptr<Task> > TaskQueue;
  TaskQueue tasks_;
  Mutex mutex_;
  Monitor monitor_;
  Monitor maxMonitor_;
  Monitor workerMonitor_;       // used to synchronize changes in worker count

  friend class ThreadManager::Worker;
  std::set<shared_ptr<Thread> > workers_;
  std::set<shared_ptr<Thread> > deadWorkers_;
  std::map<const Thread::id_t, shared_ptr<Thread> > idMap_;
};

class ThreadManager::Task : public Runnable {

public:
  enum STATE { WAITING, EXECUTING, TIMEDOUT, COMPLETE };

  Task(shared_ptr<Runnable> runnable, int64_t expiration = 0LL)
    : runnable_(runnable),
      state_(WAITING),
      expireTime_(expiration != 0LL ? Util::currentTime() + expiration : 0LL) {}

  ~Task() {}

  void run() {
    if (state_ == EXECUTING) {
      runnable_->run();
      state_ = COMPLETE;
    }
  }

  shared_ptr<Runnable> getRunnable() { return runnable_; }

  int64_t getExpireTime() const { return expireTime_; }

private:
  shared_ptr<Runnable> runnable_;
  friend class ThreadManager::Worker;
  STATE state_;
  int64_t expireTime_;
};

class ThreadManager::Worker : public Runnable {
  enum STATE { UNINITIALIZED, STARTING, STARTED, STOPPING, STOPPED };

public:
  Worker(ThreadManager::Impl* manager) : manager_(manager), state_(UNINITIALIZED) {}

  ~Worker() {}

private:
  bool isActive() const {
    return (manager_->workerCount_ <= manager_->workerMaxCount_)
           || (manager_->state_ == JOINING && !manager_->tasks_.empty());
  }

public:
  /**
   * Worker entry point
   *
   * As long as worker thread is running, pull tasks off the task queue and
   * execute.
   */
  void run() {
    Guard g(manager_->mutex_);

    /**
     * This method has three parts; one is to check for and account for
     * admitting a task which happens under a lock.  Then the lock is released
     * and the task itself is executed.  Finally we do some accounting
     * under lock again when the task completes.
     */

    /**
     * Admitting
     */

    /**
     * Increment worker semaphore and notify manager if worker count reached
     * desired max
     */
    bool active = manager_->workerCount_ < manager_->workerMaxCount_;
    if (active) {
      if (++manager_->workerCount_ == manager_->workerMaxCount_) {
        manager_->workerMonitor_.notify();
      }
    }

    while (active) {
      /**
        * While holding manager monitor block for non-empty task queue (Also
        * check that the thread hasn't been requested to stop). Once the queue
        * is non-empty, dequeue a task, release monitor, and execute. If the
        * worker max count has been decremented such that we exceed it, mark
        * ourself inactive, decrement the worker count and notify the manager
        * (technically we're notifying the next blocked thread but eventually
        * the manager will see it.
        */
      active = isActive();

      while (active && manager_->tasks_.empty()) {
        manager_->idleCount_++;
        manager_->monitor_.wait();
        active = isActive();
        manager_->idleCount_--;
      }

      shared_ptr<ThreadManager::Task> task;

      if (active) {
        if (!manager_->tasks_.empty()) {
          task = manager_->tasks_.front();
          manager_->tasks_.pop_front();
          if (task->state_ == ThreadManager::Task::WAITING) {
            // If the state is changed to anything other than EXECUTING or TIMEDOUT here
            // then the execution loop needs to be changed below.
            task->state_ =
                (task->getExpireTime() && task->getExpireTime() < Util::currentTime()) ?
                    ThreadManager::Task::TIMEDOUT :
                    ThreadManager::Task::EXECUTING;
          }
        }

        /* If we have a pending task max and we just dropped below it, wakeup any
            thread that might be blocked on add. */
        if (manager_->pendingTaskCountMax_ != 0
            && manager_->tasks_.size() <= manager_->pendingTaskCountMax_ - 1) {
          manager_->maxMonitor_.notify();
        }
      }

      /**
       * Execution - not holding a lock
       */
      if (task) {
        if (task->state_ == ThreadManager::Task::EXECUTING) {

          // Release the lock so we can run the task without blocking the thread manager
          manager_->mutex_.unlock();

          try {
            task->run();
          } catch (const std::exception& e) {
            GlobalOutput.printf("[ERROR] task->run() raised an exception: %s", e.what());
          } catch (...) {
            GlobalOutput.printf("[ERROR] task->run() raised an unknown exception");
          }

          // Re-acquire the lock to proceed in the thread manager
          manager_->mutex_.lock();

        } else if (manager_->expireCallback_) {
          // The only other state the task could have been in is TIMEDOUT (see above)
          manager_->expireCallback_(task->getRunnable());
          manager_->expiredCount_++;
        }
      }
    }

    /**
     * Final accounting for the worker thread that is done working
     */
    manager_->deadWorkers_.insert(this->thread());
    if (--manager_->workerCount_ == manager_->workerMaxCount_) {
      manager_->workerMonitor_.notify();
    }
  }

private:
  ThreadManager::Impl* manager_;
  friend class ThreadManager::Impl;
  STATE state_;
};

void ThreadManager::Impl::addWorker(size_t value) {
  std::set<shared_ptr<Thread> > newThreads;
  for (size_t ix = 0; ix < value; ix++) {
    shared_ptr<ThreadManager::Worker> worker
        = shared_ptr<ThreadManager::Worker>(new ThreadManager::Worker(this));
    newThreads.insert(threadFactory_->newThread(worker));
  }

  Guard g(mutex_);
  workerMaxCount_ += value;
  workers_.insert(newThreads.begin(), newThreads.end());

  for (std::set<shared_ptr<Thread> >::iterator ix = newThreads.begin(); ix != newThreads.end();
       ++ix) {
    shared_ptr<ThreadManager::Worker> worker
        = dynamic_pointer_cast<ThreadManager::Worker, Runnable>((*ix)->runnable());
    worker->state_ = ThreadManager::Worker::STARTING;
    (*ix)->start();
    idMap_.insert(std::pair<const Thread::id_t, shared_ptr<Thread> >((*ix)->getId(), *ix));
  }

  while (workerCount_ != workerMaxCount_) {
    workerMonitor_.wait();
  }
}

void ThreadManager::Impl::start() {
  Guard g(mutex_);
  if (state_ == ThreadManager::STOPPED) {
    return;
  }

  if (state_ == ThreadManager::UNINITIALIZED) {
    if (!threadFactory_) {
      throw InvalidArgumentException();
    }
    state_ = ThreadManager::STARTED;
    monitor_.notifyAll();
  }

  while (state_ == STARTING) {
    monitor_.wait();
  }
}

void ThreadManager::Impl::stop() {
  Guard g(mutex_);
  bool doStop = false;

  if (state_ != ThreadManager::STOPPING && state_ != ThreadManager::JOINING
      && state_ != ThreadManager::STOPPED) {
    doStop = true;
    state_ = ThreadManager::JOINING;
  }

  if (doStop) {
    removeWorkersUnderLock(workerCount_);
  }

  state_ = ThreadManager::STOPPED;
}

void ThreadManager::Impl::removeWorker(size_t value) {
  Guard g(mutex_);
  removeWorkersUnderLock(value);
}

void ThreadManager::Impl::removeWorkersUnderLock(size_t value) {
  if (value > workerMaxCount_) {
    throw InvalidArgumentException();
  }

  workerMaxCount_ -= value;

  if (idleCount_ > value) {
    // There are more idle workers than we need to remove,
    // so notify enough of them so they can terminate.
    for (size_t ix = 0; ix < value; ix++) {
      monitor_.notify();
    }
  } else {
    // There are as many or less idle workers than we need to remove,
    // so just notify them all so they can terminate.
    monitor_.notifyAll();
  }

  while (workerCount_ != workerMaxCount_) {
    workerMonitor_.wait();
  }

  for (std::set<shared_ptr<Thread> >::iterator ix = deadWorkers_.begin();
       ix != deadWorkers_.end();
       ++ix) {

    // when used with a joinable thread factory, we join the threads as we remove them
    if (!threadFactory_->isDetached()) {
      (*ix)->join();
    }

    idMap_.erase((*ix)->getId());
    workers_.erase(*ix);
  }

  deadWorkers_.clear();
}

bool ThreadManager::Impl::canSleep() const {
  const Thread::id_t id = threadFactory_->getCurrentThreadId();
  return idMap_.find(id) == idMap_.end();
}

void ThreadManager::Impl::add(shared_ptr<Runnable> value, int64_t timeout, int64_t expiration) {
  Guard g(mutex_, timeout);

  if (!g) {
    throw TimedOutException();
  }

  if (state_ != ThreadManager::STARTED) {
    throw IllegalStateException(
        "ThreadManager::Impl::add ThreadManager "
        "not started");
  }

  // if we're at a limit, remove an expired task to see if the limit clears
  if (pendingTaskCountMax_ > 0 && (tasks_.size() >= pendingTaskCountMax_)) {
    removeExpired(true);
  }

  if (pendingTaskCountMax_ > 0 && (tasks_.size() >= pendingTaskCountMax_)) {
    if (canSleep() && timeout >= 0) {
      while (pendingTaskCountMax_ > 0 && tasks_.size() >= pendingTaskCountMax_) {
        // This is thread safe because the mutex is shared between monitors.
        maxMonitor_.wait(timeout);
      }
    } else {
      throw TooManyPendingTasksException();
    }
  }

  tasks_.push_back(shared_ptr<ThreadManager::Task>(new ThreadManager::Task(value, expiration)));

  // If idle thread is available notify it, otherwise all worker threads are
  // running and will get around to this task in time.
  if (idleCount_ > 0) {
    monitor_.notify();
  }
}

void ThreadManager::Impl::remove(shared_ptr<Runnable> task) {
  Guard g(mutex_);
  if (state_ != ThreadManager::STARTED) {
    throw IllegalStateException(
        "ThreadManager::Impl::remove ThreadManager not "
        "started");
  }

  for (TaskQueue::iterator it = tasks_.begin(); it != tasks_.end(); ++it)
  {
    if ((*it)->getRunnable() == task)
    {
      tasks_.erase(it);
      return;
    }
  }
}

boost::shared_ptr<Runnable> ThreadManager::Impl::removeNextPending() {
  Guard g(mutex_);
  if (state_ != ThreadManager::STARTED) {
    throw IllegalStateException(
        "ThreadManager::Impl::removeNextPending "
        "ThreadManager not started");
  }

  if (tasks_.empty()) {
    return boost::shared_ptr<Runnable>();
  }

  shared_ptr<ThreadManager::Task> task = tasks_.front();
  tasks_.pop_front();

  return task->getRunnable();
}

void ThreadManager::Impl::removeExpired(bool justOne) {
  // this is always called under a lock
  int64_t now = 0LL;

  for (TaskQueue::iterator it = tasks_.begin(); it != tasks_.end(); )
  {
    if (now == 0LL) {
      now = Util::currentTime();
    }

    if ((*it)->getExpireTime() > 0LL && (*it)->getExpireTime() < now) {
      if (expireCallback_) {
        expireCallback_((*it)->getRunnable());
      }
      it = tasks_.erase(it);
      ++expiredCount_;
      if (justOne) {
        return;
      }
    }
    else
    {
      ++it;
    }
  }
}

void ThreadManager::Impl::setExpireCallback(ExpireCallback expireCallback) {
  Guard g(mutex_);
  expireCallback_ = expireCallback;
}

class SimpleThreadManager : public ThreadManager::Impl {

public:
  SimpleThreadManager(size_t workerCount = 4, size_t pendingTaskCountMax = 0)
    : workerCount_(workerCount), pendingTaskCountMax_(pendingTaskCountMax) {}

  void start() {
    ThreadManager::Impl::pendingTaskCountMax(pendingTaskCountMax_);
    ThreadManager::Impl::start();
    addWorker(workerCount_);
  }

private:
  const size_t workerCount_;
  const size_t pendingTaskCountMax_;
};

shared_ptr<ThreadManager> ThreadManager::newThreadManager() {
  return shared_ptr<ThreadManager>(new ThreadManager::Impl());
}

shared_ptr<ThreadManager> ThreadManager::newSimpleThreadManager(size_t count,
                                                                size_t pendingTaskCountMax) {
  return shared_ptr<ThreadManager>(new SimpleThreadManager(count, pendingTaskCountMax));
}
}
}
} // apache::thrift::concurrency
