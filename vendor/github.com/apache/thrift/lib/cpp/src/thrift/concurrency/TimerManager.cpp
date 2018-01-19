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

#include <thrift/concurrency/TimerManager.h>
#include <thrift/concurrency/Exception.h>
#include <thrift/concurrency/Util.h>

#include <assert.h>
#include <iostream>
#include <set>

namespace apache {
namespace thrift {
namespace concurrency {

using boost::shared_ptr;

/**
 * TimerManager class
 *
 * @version $Id:$
 */
class TimerManager::Task : public Runnable {

public:
  enum STATE { WAITING, EXECUTING, CANCELLED, COMPLETE };

  Task(shared_ptr<Runnable> runnable) : runnable_(runnable), state_(WAITING) {}

  ~Task() {}

  void run() {
    if (state_ == EXECUTING) {
      runnable_->run();
      state_ = COMPLETE;
    }
  }

private:
  shared_ptr<Runnable> runnable_;
  friend class TimerManager::Dispatcher;
  STATE state_;
};

class TimerManager::Dispatcher : public Runnable {

public:
  Dispatcher(TimerManager* manager) : manager_(manager) {}

  ~Dispatcher() {}

  /**
   * Dispatcher entry point
   *
   * As long as dispatcher thread is running, pull tasks off the task taskMap_
   * and execute.
   */
  void run() {
    {
      Synchronized s(manager_->monitor_);
      if (manager_->state_ == TimerManager::STARTING) {
        manager_->state_ = TimerManager::STARTED;
        manager_->monitor_.notifyAll();
      }
    }

    do {
      std::set<shared_ptr<TimerManager::Task> > expiredTasks;
      {
        Synchronized s(manager_->monitor_);
        task_iterator expiredTaskEnd;
        int64_t now = Util::currentTime();
        while (manager_->state_ == TimerManager::STARTED
               && (expiredTaskEnd = manager_->taskMap_.upper_bound(now))
                  == manager_->taskMap_.begin()) {
          int64_t timeout = 0LL;
          if (!manager_->taskMap_.empty()) {
            timeout = manager_->taskMap_.begin()->first - now;
          }
          assert((timeout != 0 && manager_->taskCount_ > 0)
                 || (timeout == 0 && manager_->taskCount_ == 0));
          try {
            manager_->monitor_.wait(timeout);
          } catch (TimedOutException&) {
          }
          now = Util::currentTime();
        }

        if (manager_->state_ == TimerManager::STARTED) {
          for (task_iterator ix = manager_->taskMap_.begin(); ix != expiredTaskEnd; ix++) {
            shared_ptr<TimerManager::Task> task = ix->second;
            expiredTasks.insert(task);
            if (task->state_ == TimerManager::Task::WAITING) {
              task->state_ = TimerManager::Task::EXECUTING;
            }
            manager_->taskCount_--;
          }
          manager_->taskMap_.erase(manager_->taskMap_.begin(), expiredTaskEnd);
        }
      }

      for (std::set<shared_ptr<Task> >::iterator ix = expiredTasks.begin();
           ix != expiredTasks.end();
           ++ix) {
        (*ix)->run();
      }

    } while (manager_->state_ == TimerManager::STARTED);

    {
      Synchronized s(manager_->monitor_);
      if (manager_->state_ == TimerManager::STOPPING) {
        manager_->state_ = TimerManager::STOPPED;
        manager_->monitor_.notify();
      }
    }
    return;
  }

private:
  TimerManager* manager_;
  friend class TimerManager;
};

#if defined(_MSC_VER)
#pragma warning(push)
#pragma warning(disable : 4355) // 'this' used in base member initializer list
#endif

TimerManager::TimerManager()
  : taskCount_(0),
    state_(TimerManager::UNINITIALIZED),
    dispatcher_(shared_ptr<Dispatcher>(new Dispatcher(this))) {
}

#if defined(_MSC_VER)
#pragma warning(pop)
#endif

TimerManager::~TimerManager() {

  // If we haven't been explicitly stopped, do so now.  We don't need to grab
  // the monitor here, since stop already takes care of reentrancy.

  if (state_ != STOPPED) {
    try {
      stop();
    } catch (...) {
      // We're really hosed.
    }
  }
}

void TimerManager::start() {
  bool doStart = false;
  {
    Synchronized s(monitor_);
    if (!threadFactory_) {
      throw InvalidArgumentException();
    }
    if (state_ == TimerManager::UNINITIALIZED) {
      state_ = TimerManager::STARTING;
      doStart = true;
    }
  }

  if (doStart) {
    dispatcherThread_ = threadFactory_->newThread(dispatcher_);
    dispatcherThread_->start();
  }

  {
    Synchronized s(monitor_);
    while (state_ == TimerManager::STARTING) {
      monitor_.wait();
    }
    assert(state_ != TimerManager::STARTING);
  }
}

void TimerManager::stop() {
  bool doStop = false;
  {
    Synchronized s(monitor_);
    if (state_ == TimerManager::UNINITIALIZED) {
      state_ = TimerManager::STOPPED;
    } else if (state_ != STOPPING && state_ != STOPPED) {
      doStop = true;
      state_ = STOPPING;
      monitor_.notifyAll();
    }
    while (state_ != STOPPED) {
      monitor_.wait();
    }
  }

  if (doStop) {
    // Clean up any outstanding tasks
    taskMap_.clear();

    // Remove dispatcher's reference to us.
    dispatcher_->manager_ = NULL;
  }
}

shared_ptr<const ThreadFactory> TimerManager::threadFactory() const {
  Synchronized s(monitor_);
  return threadFactory_;
}

void TimerManager::threadFactory(shared_ptr<const ThreadFactory> value) {
  Synchronized s(monitor_);
  threadFactory_ = value;
}

size_t TimerManager::taskCount() const {
  return taskCount_;
}

void TimerManager::add(shared_ptr<Runnable> task, int64_t timeout) {
  int64_t now = Util::currentTime();
  timeout += now;

  {
    Synchronized s(monitor_);
    if (state_ != TimerManager::STARTED) {
      throw IllegalStateException();
    }

    // If the task map is empty, we will kick the dispatcher for sure. Otherwise, we kick him
    // if the expiration time is shorter than the current value. Need to test before we insert,
    // because the new task might insert at the front.
    bool notifyRequired = (taskCount_ == 0) ? true : timeout < taskMap_.begin()->first;

    taskCount_++;
    taskMap_.insert(
        std::pair<int64_t, shared_ptr<Task> >(timeout, shared_ptr<Task>(new Task(task))));

    // If the task map was empty, or if we have an expiration that is earlier
    // than any previously seen, kick the dispatcher so it can update its
    // timeout
    if (notifyRequired) {
      monitor_.notify();
    }
  }
}

void TimerManager::add(shared_ptr<Runnable> task, const struct THRIFT_TIMESPEC& value) {

  int64_t expiration;
  Util::toMilliseconds(expiration, value);

  int64_t now = Util::currentTime();

  if (expiration < now) {
    throw InvalidArgumentException();
  }

  add(task, expiration - now);
}

void TimerManager::add(shared_ptr<Runnable> task, const struct timeval& value) {

  int64_t expiration;
  Util::toMilliseconds(expiration, value);

  int64_t now = Util::currentTime();

  if (expiration < now) {
    throw InvalidArgumentException();
  }

  add(task, expiration - now);
}

void TimerManager::remove(shared_ptr<Runnable> task) {
  (void)task;
  Synchronized s(monitor_);
  if (state_ != TimerManager::STARTED) {
    throw IllegalStateException();
  }
}

TimerManager::STATE TimerManager::state() const {
  return state_;
}
}
}
} // apache::thrift::concurrency
