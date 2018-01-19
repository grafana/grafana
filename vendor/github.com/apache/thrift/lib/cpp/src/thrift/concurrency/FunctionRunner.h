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

#ifndef _THRIFT_CONCURRENCY_FUNCTION_RUNNER_H
#define _THRIFT_CONCURRENCY_FUNCTION_RUNNER_H 1

#include <thrift/cxxfunctional.h>
#include <thrift/concurrency/Thread.h>

namespace apache {
namespace thrift {
namespace concurrency {

/**
 * Convenient implementation of Runnable that will execute arbitrary callbacks.
 * Interfaces are provided to accept both a generic 'void(void)' callback, and
 * a 'void* (void*)' pthread_create-style callback.
 *
 * Example use:
 *  void* my_thread_main(void* arg);
 *  shared_ptr<ThreadFactory> factory = ...;
 *  // To create a thread that executes my_thread_main once:
 *  shared_ptr<Thread> thread = factory->newThread(
 *    FunctionRunner::create(my_thread_main, some_argument));
 *  thread->start();
 *
 *  bool A::foo();
 *  A* a = new A();
 *  // To create a thread that executes a.foo() every 100 milliseconds:
 *  factory->newThread(FunctionRunner::create(
 *    apache::thrift::stdcxx::bind(&A::foo, a), 100))->start();
 *
 */

class FunctionRunner : public Runnable {
public:
  // This is the type of callback 'pthread_create()' expects.
  typedef void* (*PthreadFuncPtr)(void* arg);
  // This a fully-generic void(void) callback for custom bindings.
  typedef apache::thrift::stdcxx::function<void()> VoidFunc;

  typedef apache::thrift::stdcxx::function<bool()> BoolFunc;

  /**
   * Syntactic sugar to make it easier to create new FunctionRunner
   * objects wrapped in shared_ptr.
   */
  static boost::shared_ptr<FunctionRunner> create(const VoidFunc& cob) {
    return boost::shared_ptr<FunctionRunner>(new FunctionRunner(cob));
  }

  static boost::shared_ptr<FunctionRunner> create(PthreadFuncPtr func, void* arg) {
    return boost::shared_ptr<FunctionRunner>(new FunctionRunner(func, arg));
  }

private:
  static void pthread_func_wrapper(PthreadFuncPtr func, void* arg) {
    // discard return value
    func(arg);
  }

public:
  /**
   * Given a 'pthread_create' style callback, this FunctionRunner will
   * execute the given callback.  Note that the 'void*' return value is ignored.
   */
  FunctionRunner(PthreadFuncPtr func, void* arg)
    : func_(apache::thrift::stdcxx::bind(pthread_func_wrapper, func, arg)), intervalMs_(-1) {}

  /**
   * Given a generic callback, this FunctionRunner will execute it.
   */
  FunctionRunner(const VoidFunc& cob) : func_(cob), intervalMs_(-1) {}

  /**
   * Given a bool foo(...) type callback, FunctionRunner will execute
   * the callback repeatedly with 'intervalMs' milliseconds between the calls,
   * until it returns false. Note that the actual interval between calls will
   * be intervalMs plus execution time of the callback.
   */
  FunctionRunner(const BoolFunc& cob, int intervalMs) : repFunc_(cob), intervalMs_(intervalMs) {}

  void run() {
    if (repFunc_) {
      while (repFunc_()) {
        THRIFT_SLEEP_USEC(intervalMs_ * 1000);
      }
    } else {
      func_();
    }
  }

private:
  VoidFunc func_;
  BoolFunc repFunc_;
  int intervalMs_;
};
}
}
} // apache::thrift::concurrency

#endif // #ifndef _THRIFT_CONCURRENCY_FUNCTION_RUNNER_H
