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
#include <thrift/concurrency/PlatformThreadFactory.h>
#include <thrift/concurrency/Monitor.h>
#include <thrift/concurrency/Util.h>

#include <assert.h>
#include <deque>
#include <set>
#include <iostream>
#include <stdint.h>

namespace apache {
namespace thrift {
namespace concurrency {
namespace test {

using namespace apache::thrift::concurrency;

static std::deque<boost::shared_ptr<Runnable> > m_expired;
static void expiredNotifier(boost::shared_ptr<Runnable> runnable)
{
  m_expired.push_back(runnable);
}

static void sleep_(int64_t millisec) {
  Monitor _sleep;
  Synchronized s(_sleep);

  try {
    _sleep.wait(millisec);
  } catch (TimedOutException&) {
    ;
  } catch (...) {
    assert(0);
  }
}

class ThreadManagerTests {

public:
  class Task : public Runnable {

  public:
    Task(Monitor& monitor, size_t& count, int64_t timeout)
      : _monitor(monitor), _count(count), _timeout(timeout), _startTime(0), _endTime(0), _done(false) {}

    void run() {

      _startTime = Util::currentTime();

      sleep_(_timeout);

      _endTime = Util::currentTime();

      _done = true;

      {
        Synchronized s(_monitor);

        // std::cout << "Thread " << _count << " completed " << std::endl;

        _count--;
        if (_count % 10000 == 0) {
          _monitor.notify();
        }
      }
    }

    Monitor& _monitor;
    size_t& _count;
    int64_t _timeout;
    int64_t _startTime;
    int64_t _endTime;
    bool _done;
    Monitor _sleep;
  };

  /**
   * Dispatch count tasks, each of which blocks for timeout milliseconds then
   * completes. Verify that all tasks completed and that thread manager cleans
   * up properly on delete.
   */
  bool loadTest(size_t count = 100, int64_t timeout = 100LL, size_t workerCount = 4) {

    Monitor monitor;

    size_t activeCount = count;

    shared_ptr<ThreadManager> threadManager = ThreadManager::newSimpleThreadManager(workerCount);

    shared_ptr<PlatformThreadFactory> threadFactory
        = shared_ptr<PlatformThreadFactory>(new PlatformThreadFactory());

#if !USE_BOOST_THREAD && !USE_STD_THREAD
    threadFactory->setPriority(PosixThreadFactory::HIGHEST);
#endif
    threadManager->threadFactory(threadFactory);

    threadManager->start();

    std::set<shared_ptr<ThreadManagerTests::Task> > tasks;

    for (size_t ix = 0; ix < count; ix++) {

      tasks.insert(shared_ptr<ThreadManagerTests::Task>(
          new ThreadManagerTests::Task(monitor, activeCount, timeout)));
    }

    int64_t time00 = Util::currentTime();

    for (std::set<shared_ptr<ThreadManagerTests::Task> >::iterator ix = tasks.begin();
         ix != tasks.end();
         ix++) {

      threadManager->add(*ix);
    }

    std::cout << "\t\t\t\tloaded " << count << " tasks to execute" << std::endl;

    {
      Synchronized s(monitor);

      while (activeCount > 0) {
        std::cout << "\t\t\t\tactiveCount = " << activeCount << std::endl;
        monitor.wait();
      }
    }

    int64_t time01 = Util::currentTime();

    int64_t firstTime = 9223372036854775807LL;
    int64_t lastTime = 0;

    double averageTime = 0;
    int64_t minTime = 9223372036854775807LL;
    int64_t maxTime = 0;

    for (std::set<shared_ptr<ThreadManagerTests::Task> >::iterator ix = tasks.begin();
         ix != tasks.end();
         ix++) {

      shared_ptr<ThreadManagerTests::Task> task = *ix;

      int64_t delta = task->_endTime - task->_startTime;

      assert(delta > 0);

      if (task->_startTime < firstTime) {
        firstTime = task->_startTime;
      }

      if (task->_endTime > lastTime) {
        lastTime = task->_endTime;
      }

      if (delta < minTime) {
        minTime = delta;
      }

      if (delta > maxTime) {
        maxTime = delta;
      }

      averageTime += delta;
    }

    averageTime /= count;

    std::cout << "\t\t\tfirst start: " << firstTime << " Last end: " << lastTime
              << " min: " << minTime << "ms max: " << maxTime << "ms average: " << averageTime
              << "ms" << std::endl;

    bool success = (time01 - time00) >= ((int64_t)count * timeout) / (int64_t)workerCount;

    std::cout << "\t\t\t" << (success ? "Success" : "Failure")
              << "! expected time: " << ((int64_t)count * timeout) / (int64_t)workerCount << "ms elapsed time: " << time01 - time00
              << "ms" << std::endl;

    return success;
  }

  class BlockTask : public Runnable {

  public:
    BlockTask(Monitor& entryMonitor, Monitor& blockMonitor, bool& blocked, Monitor& doneMonitor, size_t& count)
      : _entryMonitor(entryMonitor), _entered(false), _blockMonitor(blockMonitor), _blocked(blocked), _doneMonitor(doneMonitor), _count(count) {}

    void run() {
      {
        Synchronized s(_entryMonitor);
        _entered = true;
        _entryMonitor.notify();
      }

      {
        Synchronized s(_blockMonitor);
        while (_blocked) {
          _blockMonitor.wait();
        }
      }

      {
        Synchronized s(_doneMonitor);
        if (--_count == 0) {
          _doneMonitor.notify();
        }
      }
    }

    Monitor& _entryMonitor;
    bool _entered;
    Monitor& _blockMonitor;
    bool& _blocked;
    Monitor& _doneMonitor;
    size_t& _count;
  };

  /**
   * Block test.  Create pendingTaskCountMax tasks.  Verify that we block adding the
   * pendingTaskCountMax + 1th task.  Verify that we unblock when a task completes */

  bool blockTest(int64_t timeout = 100LL, size_t workerCount = 2) {
    (void)timeout;
    bool success = false;

    try {

      Monitor entryMonitor;   // not used by this test
      Monitor blockMonitor;
      bool blocked[] = {true, true, true};
      Monitor doneMonitor;

      size_t pendingTaskMaxCount = workerCount;

      size_t activeCounts[] = {workerCount, pendingTaskMaxCount, 1};

      shared_ptr<ThreadManager> threadManager
          = ThreadManager::newSimpleThreadManager(workerCount, pendingTaskMaxCount);

      shared_ptr<PlatformThreadFactory> threadFactory
          = shared_ptr<PlatformThreadFactory>(new PlatformThreadFactory());

#if !USE_BOOST_THREAD && !USE_STD_THREAD
      threadFactory->setPriority(PosixThreadFactory::HIGHEST);
#endif
      threadManager->threadFactory(threadFactory);

      threadManager->start();

      std::vector<shared_ptr<ThreadManagerTests::BlockTask> > tasks;
      tasks.reserve(workerCount + pendingTaskMaxCount);

      for (size_t ix = 0; ix < workerCount; ix++) {

        tasks.push_back(shared_ptr<ThreadManagerTests::BlockTask>(
            new ThreadManagerTests::BlockTask(entryMonitor, blockMonitor, blocked[0], doneMonitor, activeCounts[0])));
      }

      for (size_t ix = 0; ix < pendingTaskMaxCount; ix++) {

        tasks.push_back(shared_ptr<ThreadManagerTests::BlockTask>(
            new ThreadManagerTests::BlockTask(entryMonitor, blockMonitor, blocked[1], doneMonitor, activeCounts[1])));
      }

      for (std::vector<shared_ptr<ThreadManagerTests::BlockTask> >::iterator ix = tasks.begin();
           ix != tasks.end();
           ix++) {
        threadManager->add(*ix);
      }

      if (!(success = (threadManager->totalTaskCount() == pendingTaskMaxCount + workerCount))) {
        throw TException("Unexpected pending task count");
      }

      shared_ptr<ThreadManagerTests::BlockTask> extraTask(
          new ThreadManagerTests::BlockTask(entryMonitor, blockMonitor, blocked[2], doneMonitor, activeCounts[2]));

      try {
        threadManager->add(extraTask, 1);
        throw TException("Unexpected success adding task in excess of pending task count");
      } catch (TooManyPendingTasksException&) {
        throw TException("Should have timed out adding task in excess of pending task count");
      } catch (TimedOutException&) {
        // Expected result
      }

      try {
        threadManager->add(extraTask, -1);
        throw TException("Unexpected success adding task in excess of pending task count");
      } catch (TimedOutException&) {
        throw TException("Unexpected timeout adding task in excess of pending task count");
      } catch (TooManyPendingTasksException&) {
        // Expected result
      }

      std::cout << "\t\t\t"
                << "Pending tasks " << threadManager->pendingTaskCount() << std::endl;

      {
        Synchronized s(blockMonitor);
        blocked[0] = false;
        blockMonitor.notifyAll();
      }

      {
        Synchronized s(doneMonitor);
        while (activeCounts[0] != 0) {
          doneMonitor.wait();
        }
      }

      std::cout << "\t\t\t"
                << "Pending tasks " << threadManager->pendingTaskCount() << std::endl;

      try {
        threadManager->add(extraTask, 1);
      } catch (TimedOutException&) {
        std::cout << "\t\t\t"
                  << "add timed out unexpectedly" << std::endl;
        throw TException("Unexpected timeout adding task");

      } catch (TooManyPendingTasksException&) {
        std::cout << "\t\t\t"
                  << "add encountered too many pending exepctions" << std::endl;
        throw TException("Unexpected timeout adding task");
      }

      // Wake up tasks that were pending before and wait for them to complete

      {
        Synchronized s(blockMonitor);
        blocked[1] = false;
        blockMonitor.notifyAll();
      }

      {
        Synchronized s(doneMonitor);
        while (activeCounts[1] != 0) {
          doneMonitor.wait();
        }
      }

      // Wake up the extra task and wait for it to complete

      {
        Synchronized s(blockMonitor);
        blocked[2] = false;
        blockMonitor.notifyAll();
      }

      {
        Synchronized s(doneMonitor);
        while (activeCounts[2] != 0) {
          doneMonitor.wait();
        }
      }

      threadManager->stop();

      if (!(success = (threadManager->totalTaskCount() == 0))) {
        throw TException("Unexpected total task count");
      }

    } catch (TException& e) {
      std::cout << "ERROR: " << e.what() << std::endl;
    }

    std::cout << "\t\t\t" << (success ? "Success" : "Failure") << std::endl;
    return success;
  }


  bool apiTest() {

    // prove currentTime has milliseconds granularity since many other things depend on it
    int64_t a = Util::currentTime();
    sleep_(100);
    int64_t b = Util::currentTime();
    if (b - a < 50 || b - a > 150) {
      std::cerr << "\t\t\texpected 100ms gap, found " << (b-a) << "ms gap instead." << std::endl;
      return false;
    }

#if !USE_BOOST_THREAD && !USE_STD_THREAD
    // test once with a detached thread factory and once with a joinable thread factory

    shared_ptr<PosixThreadFactory> threadFactory
        = shared_ptr<PosixThreadFactory>(new PosixThreadFactory(false));

    std::cout << "\t\t\tapiTest with joinable thread factory" << std::endl;
    if (!apiTestWithThreadFactory(threadFactory)) {
      return false;
    }

    threadFactory.reset(new PosixThreadFactory(true));
    std::cout << "\t\t\tapiTest with detached thread factory" << std::endl;
    return apiTestWithThreadFactory(threadFactory);
#else
    return apiTestWithThreadFactory(shared_ptr<PlatformThreadFactory>(new PlatformThreadFactory()));
#endif

  }

  bool apiTestWithThreadFactory(shared_ptr<PlatformThreadFactory> threadFactory)
  {
    shared_ptr<ThreadManager> threadManager = ThreadManager::newSimpleThreadManager(1);
    threadManager->threadFactory(threadFactory);

#if !USE_BOOST_THREAD && !USE_STD_THREAD
    threadFactory->setPriority(PosixThreadFactory::HIGHEST);

    // verify we cannot change the thread factory to one with the opposite detached setting
    shared_ptr<PlatformThreadFactory> threadFactory2
        = shared_ptr<PosixThreadFactory>(new PlatformThreadFactory(
          PosixThreadFactory::ROUND_ROBIN,
          PosixThreadFactory::NORMAL,
          1,
          !threadFactory->isDetached()));
    try {
      threadManager->threadFactory(threadFactory2);
      // if the call succeeded we changed the thread factory to one that had the opposite setting for "isDetached()".
      // this is bad, because the thread manager checks with the thread factory to see if it should join threads
      // as they are leaving - so the detached status of new threads cannot change while there are existing threads.
      std::cerr << "\t\t\tShould not be able to change thread factory detached disposition" << std::endl;
      return false;
    }
    catch (InvalidArgumentException& ex) {
      /* expected */
    }
#endif

    std::cout << "\t\t\t\tstarting.. " << std::endl;

    threadManager->start();
    threadManager->setExpireCallback(expiredNotifier); // apache::thrift::stdcxx::bind(&ThreadManagerTests::expiredNotifier, this));

#define EXPECT(FUNC, COUNT) { size_t c = FUNC; if (c != COUNT) { std::cerr << "expected " #FUNC" to be " #COUNT ", but was " << c << std::endl; return false; } }

    EXPECT(threadManager->workerCount(), 1);
    EXPECT(threadManager->idleWorkerCount(), 1);
    EXPECT(threadManager->pendingTaskCount(), 0);

    std::cout << "\t\t\t\tadd 2nd worker.. " << std::endl;

    threadManager->addWorker();

    EXPECT(threadManager->workerCount(), 2);
    EXPECT(threadManager->idleWorkerCount(), 2);
    EXPECT(threadManager->pendingTaskCount(), 0);

    std::cout << "\t\t\t\tremove 2nd worker.. " << std::endl;

    threadManager->removeWorker();

    EXPECT(threadManager->workerCount(), 1);
    EXPECT(threadManager->idleWorkerCount(), 1);
    EXPECT(threadManager->pendingTaskCount(), 0);

    std::cout << "\t\t\t\tremove 1st worker.. " << std::endl;

    threadManager->removeWorker();

    EXPECT(threadManager->workerCount(), 0);
    EXPECT(threadManager->idleWorkerCount(), 0);
    EXPECT(threadManager->pendingTaskCount(), 0);

    std::cout << "\t\t\t\tadd blocking task.. " << std::endl;

    // We're going to throw a blocking task into the mix
    Monitor entryMonitor;   // signaled when task is running
    Monitor blockMonitor;   // to be signaled to unblock the task
    bool blocked(true);     // set to false before notifying
    Monitor doneMonitor;    // signaled when count reaches zero
    size_t activeCount = 1;
    shared_ptr<ThreadManagerTests::BlockTask> blockingTask(
      new ThreadManagerTests::BlockTask(entryMonitor, blockMonitor, blocked, doneMonitor, activeCount));
    threadManager->add(blockingTask);

    EXPECT(threadManager->workerCount(), 0);
    EXPECT(threadManager->idleWorkerCount(), 0);
    EXPECT(threadManager->pendingTaskCount(), 1);

    std::cout << "\t\t\t\tadd other task.. " << std::endl;

    shared_ptr<ThreadManagerTests::Task> otherTask(
      new ThreadManagerTests::Task(doneMonitor, activeCount, 0));

    threadManager->add(otherTask);

    EXPECT(threadManager->workerCount(), 0);
    EXPECT(threadManager->idleWorkerCount(), 0);
    EXPECT(threadManager->pendingTaskCount(), 2);

    std::cout << "\t\t\t\tremove blocking task specifically.. " << std::endl;

    threadManager->remove(blockingTask);

    EXPECT(threadManager->workerCount(), 0);
    EXPECT(threadManager->idleWorkerCount(), 0);
    EXPECT(threadManager->pendingTaskCount(), 1);

    std::cout << "\t\t\t\tremove next pending task.." << std::endl;

    shared_ptr<Runnable> nextTask = threadManager->removeNextPending();
    if (nextTask != otherTask) {
      std::cerr << "\t\t\t\t\texpected removeNextPending to return otherTask" << std::endl;
      return false;
    }

    EXPECT(threadManager->workerCount(), 0);
    EXPECT(threadManager->idleWorkerCount(), 0);
    EXPECT(threadManager->pendingTaskCount(), 0);

    std::cout << "\t\t\t\tremove next pending task (none left).." << std::endl;

    nextTask = threadManager->removeNextPending();
    if (nextTask) {
      std::cerr << "\t\t\t\t\texpected removeNextPending to return an empty Runnable" << std::endl;
      return false;
    }

    std::cout << "\t\t\t\tadd 2 expired tasks and 1 not.." << std::endl;

    shared_ptr<ThreadManagerTests::Task> expiredTask(
      new ThreadManagerTests::Task(doneMonitor, activeCount, 0));

    threadManager->add(expiredTask, 0, 1);
    threadManager->add(blockingTask);       // add one that hasn't expired to make sure it gets skipped
    threadManager->add(expiredTask, 0, 1);  // add a second expired to ensure removeExpiredTasks removes both

    sleep_(50);  // make sure enough time elapses for it to expire - the shortest expiration time is 1 millisecond

    EXPECT(threadManager->workerCount(), 0);
    EXPECT(threadManager->idleWorkerCount(), 0);
    EXPECT(threadManager->pendingTaskCount(), 3);
    EXPECT(threadManager->expiredTaskCount(), 0);

    std::cout << "\t\t\t\tremove expired tasks.." << std::endl;

    if (!m_expired.empty()) {
      std::cerr << "\t\t\t\t\texpected m_expired to be empty" << std::endl;
      return false;
    }

    threadManager->removeExpiredTasks();

    if (m_expired.size() != 2) {
      std::cerr << "\t\t\t\t\texpected m_expired to be set" << std::endl;
      return false;
    }

    if (m_expired.front() != expiredTask) {
      std::cerr << "\t\t\t\t\texpected m_expired[0] to be the expired task" << std::endl;
      return false;
    }
    m_expired.pop_front();

    if (m_expired.front() != expiredTask) {
      std::cerr << "\t\t\t\t\texpected m_expired[1] to be the expired task" << std::endl;
      return false;
    }

    m_expired.clear();

    threadManager->remove(blockingTask);

    EXPECT(threadManager->workerCount(), 0);
    EXPECT(threadManager->idleWorkerCount(), 0);
    EXPECT(threadManager->pendingTaskCount(), 0);
    EXPECT(threadManager->expiredTaskCount(), 2);

    std::cout << "\t\t\t\tadd expired task (again).." << std::endl;

    threadManager->add(expiredTask, 0, 1);  // expires in 1ms
    sleep_(50);  // make sure enough time elapses for it to expire - the shortest expiration time is 1ms

    std::cout << "\t\t\t\tadd worker to consume expired task.." << std::endl;

    threadManager->addWorker();
    sleep_(100);  // make sure it has time to spin up and expire the task

    if (m_expired.empty()) {
      std::cerr << "\t\t\t\t\texpected m_expired to be set" << std::endl;
      return false;
    }

    if (m_expired.front() != expiredTask) {
      std::cerr << "\t\t\t\t\texpected m_expired to be the expired task" << std::endl;
      return false;
    }

    m_expired.clear();

    EXPECT(threadManager->workerCount(), 1);
    EXPECT(threadManager->idleWorkerCount(), 1);
    EXPECT(threadManager->pendingTaskCount(), 0);
    EXPECT(threadManager->expiredTaskCount(), 3);

    std::cout << "\t\t\t\ttry to remove too many workers" << std::endl;
    try {
      threadManager->removeWorker(2);
      std::cerr << "\t\t\t\t\texpected InvalidArgumentException" << std::endl;
      return false;
    } catch (const InvalidArgumentException&) {
      /* expected */
    }

    std::cout << "\t\t\t\tremove worker.. " << std::endl;

    threadManager->removeWorker();

    EXPECT(threadManager->workerCount(), 0);
    EXPECT(threadManager->idleWorkerCount(), 0);
    EXPECT(threadManager->pendingTaskCount(), 0);
    EXPECT(threadManager->expiredTaskCount(), 3);

    std::cout << "\t\t\t\tadd blocking task.. " << std::endl;

    threadManager->add(blockingTask);

    EXPECT(threadManager->workerCount(), 0);
    EXPECT(threadManager->idleWorkerCount(), 0);
    EXPECT(threadManager->pendingTaskCount(), 1);

    std::cout << "\t\t\t\tadd worker.. " << std::endl;

    threadManager->addWorker();
    {
      Synchronized s(entryMonitor);
      while (!blockingTask->_entered) {
        entryMonitor.wait();
      }
    }

    EXPECT(threadManager->workerCount(), 1);
    EXPECT(threadManager->idleWorkerCount(), 0);
    EXPECT(threadManager->pendingTaskCount(), 0);

    std::cout << "\t\t\t\tunblock task and remove worker.. " << std::endl;

    {
      Synchronized s(blockMonitor);
      blocked = false;
      blockMonitor.notifyAll();
    }
    threadManager->removeWorker();

    EXPECT(threadManager->workerCount(), 0);
    EXPECT(threadManager->idleWorkerCount(), 0);
    EXPECT(threadManager->pendingTaskCount(), 0);

    std::cout << "\t\t\t\tcleanup.. " << std::endl;

    blockingTask.reset();
    threadManager.reset();
    return true;
  }
};

}
}
}
} // apache::thrift::concurrency

using namespace apache::thrift::concurrency::test;
