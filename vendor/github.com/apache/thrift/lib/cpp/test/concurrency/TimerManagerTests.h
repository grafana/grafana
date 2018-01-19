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
#include <thrift/concurrency/PlatformThreadFactory.h>
#include <thrift/concurrency/Monitor.h>
#include <thrift/concurrency/Util.h>

#include <assert.h>
#include <iostream>

namespace apache {
namespace thrift {
namespace concurrency {
namespace test {

using namespace apache::thrift::concurrency;

class TimerManagerTests {

public:
  class Task : public Runnable {
  public:
    Task(Monitor& monitor, int64_t timeout)
      : _timeout(timeout),
        _startTime(Util::currentTime()),
        _endTime(0),
        _monitor(monitor),
        _success(false),
        _done(false) {}

    ~Task() { std::cerr << this << std::endl; }

    void run() {

      _endTime = Util::currentTime();
      _success = (_endTime - _startTime) >= _timeout;

      {
        Synchronized s(_monitor);
        _done = true;
        _monitor.notifyAll();
      }
    }

    int64_t _timeout;
    int64_t _startTime;
    int64_t _endTime;
    Monitor& _monitor;
    bool _success;
    bool _done;
  };

  /**
   * This test creates two tasks and waits for the first to expire within 10%
   * of the expected expiration time. It then verifies that the timer manager
   * properly clean up itself and the remaining orphaned timeout task when the
   * manager goes out of scope and its destructor is called.
   */
  bool test00(int64_t timeout = 1000LL) {

    shared_ptr<TimerManagerTests::Task> orphanTask
        = shared_ptr<TimerManagerTests::Task>(new TimerManagerTests::Task(_monitor, 10 * timeout));

    {

      TimerManager timerManager;

      timerManager.threadFactory(shared_ptr<PlatformThreadFactory>(new PlatformThreadFactory()));

      timerManager.start();

      assert(timerManager.state() == TimerManager::STARTED);

      // Don't create task yet, because its constructor sets the expected completion time, and we
      // need to delay between inserting the two tasks into the run queue.
      shared_ptr<TimerManagerTests::Task> task;

      {
        Synchronized s(_monitor);

        timerManager.add(orphanTask, 10 * timeout);

        try {
          // Wait for 1 second in order to give timerManager a chance to start sleeping in response
          // to adding orphanTask. We need to do this so we can verify that adding the second task
          // kicks the dispatcher out of the current wait and starts the new 1 second wait.
          _monitor.wait(1000);
          assert(
              0 == "ERROR: This wait should time out. TimerManager dispatcher may have a problem.");
        } catch (TimedOutException&) {
        }

        task.reset(new TimerManagerTests::Task(_monitor, timeout));

        timerManager.add(task, timeout);

        _monitor.wait();
      }

      assert(task->_done);

      std::cout << "\t\t\t" << (task->_success ? "Success" : "Failure") << "!" << std::endl;
    }

    // timerManager.stop(); This is where it happens via destructor

    assert(!orphanTask->_done);

    return true;
  }

  friend class TestTask;

  Monitor _monitor;
};

}
}
}
} // apache::thrift::concurrency
