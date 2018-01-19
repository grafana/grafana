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

#include <iostream>
#include <vector>
#include <string>

#include "ThreadFactoryTests.h"
#include "TimerManagerTests.h"
#include "ThreadManagerTests.h"

int main(int argc, char** argv) {

  std::string arg;

  std::vector<std::string> args(argc - 1 > 1 ? argc - 1 : 1);

  args[0] = "all";

  for (int ix = 1; ix < argc; ix++) {
    args[ix - 1] = std::string(argv[ix]);
  }

  bool runAll = args[0].compare("all") == 0;

  if (runAll || args[0].compare("thread-factory") == 0) {

    ThreadFactoryTests threadFactoryTests;

    std::cout << "ThreadFactory tests..." << std::endl;

    int reapLoops = 20;
    int reapCount = 1000;
    size_t floodLoops = 3;
    size_t floodCount = 20000;

    std::cout << "\t\tThreadFactory reap N threads test: N = " << reapLoops << "x" << reapCount << std::endl;

    if (!threadFactoryTests.reapNThreads(reapLoops, reapCount)) {
      std::cerr << "\t\ttThreadFactory reap N threads FAILED" << std::endl;
      return 1;
    }

    std::cout << "\t\tThreadFactory flood N threads test: N = " << floodLoops << "x" << floodCount << std::endl;

    if (!threadFactoryTests.floodNTest(floodLoops, floodCount)) {
      std::cerr << "\t\ttThreadFactory flood N threads FAILED" << std::endl;
      return 1;
    }

    std::cout << "\t\tThreadFactory synchronous start test" << std::endl;

    if (!threadFactoryTests.synchStartTest()) {
      std::cerr << "\t\ttThreadFactory synchronous start FAILED" << std::endl;
      return 1;
    }

    std::cout << "\t\tThreadFactory monitor timeout test" << std::endl;

    if (!threadFactoryTests.monitorTimeoutTest()) {
      std::cerr << "\t\ttThreadFactory monitor timeout FAILED" << std::endl;
      return 1;
    }
  }

  if (runAll || args[0].compare("util") == 0) {

    std::cout << "Util tests..." << std::endl;

    std::cout << "\t\tUtil minimum time" << std::endl;

    int64_t time00 = Util::currentTime();
    int64_t time01 = Util::currentTime();

    std::cout << "\t\t\tMinimum time: " << time01 - time00 << "ms" << std::endl;

    time00 = Util::currentTime();
    time01 = time00;
    size_t count = 0;

    while (time01 < time00 + 10) {
      count++;
      time01 = Util::currentTime();
    }

    std::cout << "\t\t\tscall per ms: " << count / (time01 - time00) << std::endl;
  }

  if (runAll || args[0].compare("timer-manager") == 0) {

    std::cout << "TimerManager tests..." << std::endl;

    std::cout << "\t\tTimerManager test00" << std::endl;

    TimerManagerTests timerManagerTests;

    if (!timerManagerTests.test00()) {
      std::cerr << "\t\tTimerManager tests FAILED" << std::endl;
      return 1;
    }
  }

  if (runAll || args[0].compare("thread-manager") == 0) {

    std::cout << "ThreadManager tests..." << std::endl;

    {
      size_t workerCount = 100;
      size_t taskCount = 50000;
      int64_t delay = 10LL;

      ThreadManagerTests threadManagerTests;

      std::cout << "\t\tThreadManager api test:" << std::endl;

      if (!threadManagerTests.apiTest()) {
        std::cerr << "\t\tThreadManager apiTest FAILED" << std::endl;
        return 1;
      }

      std::cout << "\t\tThreadManager load test: worker count: " << workerCount
                << " task count: " << taskCount << " delay: " << delay << std::endl;

      if (!threadManagerTests.loadTest(taskCount, delay, workerCount)) {
        std::cerr << "\t\tThreadManager loadTest FAILED" << std::endl;
        return 1;
      }

      std::cout << "\t\tThreadManager block test: worker count: " << workerCount
                << " delay: " << delay << std::endl;

      if (!threadManagerTests.blockTest(delay, workerCount)) {
        std::cerr << "\t\tThreadManager blockTest FAILED" << std::endl;
        return 1;
      }
    }
  }

  if (runAll || args[0].compare("thread-manager-benchmark") == 0) {

    std::cout << "ThreadManager benchmark tests..." << std::endl;

    {

      size_t minWorkerCount = 2;

      size_t maxWorkerCount = 64;

      size_t tasksPerWorker = 1000;

      int64_t delay = 5LL;

      for (size_t workerCount = minWorkerCount; workerCount < maxWorkerCount; workerCount *= 4) {

        size_t taskCount = workerCount * tasksPerWorker;

        std::cout << "\t\tThreadManager load test: worker count: " << workerCount
                  << " task count: " << taskCount << " delay: " << delay << std::endl;

        ThreadManagerTests threadManagerTests;

        if (!threadManagerTests.loadTest(taskCount, delay, workerCount))
        {
          std::cerr << "\t\tThreadManager loadTest FAILED" << std::endl;
          return 1;
        }
      }
    }
  }

  std::cout << "ALL TESTS PASSED" << std::endl;
  return 0;
}
