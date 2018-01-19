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
#include <thrift/concurrency/Thread.h>
#include <thrift/concurrency/PlatformThreadFactory.h>
#include <thrift/concurrency/Monitor.h>
#include <thrift/concurrency/Util.h>

#include <assert.h>
#include <iostream>
#include <set>

namespace apache {
namespace thrift {
namespace concurrency {
namespace test {

using boost::shared_ptr;
using namespace apache::thrift::concurrency;

/**
 * ThreadManagerTests class
 *
 * @version $Id:$
 */
class ThreadFactoryTests {

public:
  /**
   * Reap N threads
   */
  class ReapNTask : public Runnable {

  public:
    ReapNTask(Monitor& monitor, int& activeCount) : _monitor(monitor), _count(activeCount) {}

    void run() {
      Synchronized s(_monitor);

      _count--;

      // std::cout << "\t\t\tthread count: " << _count << std::endl;

      if (_count == 0) {
        _monitor.notify();
      }
    }

    Monitor& _monitor;

    int& _count;
  };

  bool reapNThreads(int loop = 1, int count = 10) {

    PlatformThreadFactory threadFactory = PlatformThreadFactory();

    shared_ptr<Monitor> monitor(new Monitor);

    for (int lix = 0; lix < loop; lix++) {

      int* activeCount = new int(count);

      std::set<shared_ptr<Thread> > threads;

      int tix;

      for (tix = 0; tix < count; tix++) {
        try {
          threads.insert(
              threadFactory.newThread(shared_ptr<Runnable>(new ReapNTask(*monitor, *activeCount))));
        } catch (SystemResourceException& e) {
          std::cout << "\t\t\tfailed to create " << lix* count + tix << " thread " << e.what()
                    << std::endl;
          throw e;
        }
      }

      tix = 0;
      for (std::set<shared_ptr<Thread> >::const_iterator thread = threads.begin();
           thread != threads.end();
           tix++, ++thread) {

        try {
          (*thread)->start();
        } catch (SystemResourceException& e) {
          std::cout << "\t\t\tfailed to start  " << lix* count + tix << " thread " << e.what()
                    << std::endl;
          throw e;
        }
      }

      {
        Synchronized s(*monitor);
        while (*activeCount > 0) {
          monitor->wait(1000);
        }
      }
      delete activeCount;
      std::cout << "\t\t\treaped " << lix* count << " threads" << std::endl;
    }

    std::cout << "\t\t\tSuccess!" << std::endl;

    return true;
  }

  class SynchStartTask : public Runnable {

  public:
    enum STATE { UNINITIALIZED, STARTING, STARTED, STOPPING, STOPPED };

    SynchStartTask(Monitor& monitor, volatile STATE& state) : _monitor(monitor), _state(state) {}

    void run() {
      {
        Synchronized s(_monitor);
        if (_state == SynchStartTask::STARTING) {
          _state = SynchStartTask::STARTED;
          _monitor.notify();
        }
      }

      {
        Synchronized s(_monitor);
        while (_state == SynchStartTask::STARTED) {
          _monitor.wait();
        }

        if (_state == SynchStartTask::STOPPING) {
          _state = SynchStartTask::STOPPED;
          _monitor.notifyAll();
        }
      }
    }

  private:
    Monitor& _monitor;
    volatile STATE& _state;
  };

  bool synchStartTest() {

    Monitor monitor;

    SynchStartTask::STATE state = SynchStartTask::UNINITIALIZED;

    shared_ptr<SynchStartTask> task
        = shared_ptr<SynchStartTask>(new SynchStartTask(monitor, state));

    PlatformThreadFactory threadFactory = PlatformThreadFactory();

    shared_ptr<Thread> thread = threadFactory.newThread(task);

    if (state == SynchStartTask::UNINITIALIZED) {

      state = SynchStartTask::STARTING;

      thread->start();
    }

    {
      Synchronized s(monitor);
      while (state == SynchStartTask::STARTING) {
        monitor.wait();
      }
    }

    assert(state != SynchStartTask::STARTING);

    {
      Synchronized s(monitor);

      try {
        monitor.wait(100);
      } catch (TimedOutException&) {
      }

      if (state == SynchStartTask::STARTED) {

        state = SynchStartTask::STOPPING;

        monitor.notify();
      }

      while (state == SynchStartTask::STOPPING) {
        monitor.wait();
      }
    }

    assert(state == SynchStartTask::STOPPED);

    bool success = true;

    std::cout << "\t\t\t" << (success ? "Success" : "Failure") << "!" << std::endl;

    return true;
  }

  /**
   * The only guarantee a monitor timeout can give you is that
   * it will take "at least" as long as the timeout, no less.
   * There is absolutely no guarantee around regaining execution
   * near the timeout.  On a busy system (like inside a third party
   * CI environment) it could take quite a bit longer than the
   * requested timeout, and that's ok.
   */

  bool monitorTimeoutTest(int64_t count = 1000, int64_t timeout = 2) {

    Monitor monitor;

    int64_t startTime = Util::currentTime();

    for (int64_t ix = 0; ix < count; ix++) {
      {
        Synchronized s(monitor);
        try {
          monitor.wait(timeout);
        } catch (TimedOutException&) {
        }
      }
    }

    int64_t endTime = Util::currentTime();

  bool success = (endTime - startTime) >= (count * timeout);

    std::cout << "\t\t\t" << (success ? "Success" : "Failure")
              << ": minimum required time to elapse " << count * timeout
              << "ms; actual elapsed time " << endTime - startTime << "ms"
              << std::endl;

    return success;
  }

  class FloodTask : public Runnable {
  public:
    FloodTask(const size_t id) : _id(id) {}
    ~FloodTask() {
      if (_id % 10000 == 0) {
        std::cout << "\t\tthread " << _id << " done" << std::endl;
      }
    }

    void run() {
      if (_id % 10000 == 0) {
        std::cout << "\t\tthread " << _id << " started" << std::endl;
      }
    }
    const size_t _id;
  };

  void foo(PlatformThreadFactory* tf) { (void)tf; }

  bool floodNTest(size_t loop = 1, size_t count = 100000) {

    bool success = false;

    for (size_t lix = 0; lix < loop; lix++) {

      PlatformThreadFactory threadFactory = PlatformThreadFactory();
      threadFactory.setDetached(true);

      for (size_t tix = 0; tix < count; tix++) {

        try {

          shared_ptr<FloodTask> task(new FloodTask(lix * count + tix));

          shared_ptr<Thread> thread = threadFactory.newThread(task);

          thread->start();

        } catch (TException& e) {

          std::cout << "\t\t\tfailed to start  " << lix* count + tix << " thread " << e.what()
                    << std::endl;

          return success;
        }
      }

      std::cout << "\t\t\tflooded " << (lix + 1) * count << " threads" << std::endl;

      success = true;
    }

    return success;
  }
};

}
}
}
} // apache::thrift::concurrency::test
