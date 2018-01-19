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

#ifndef _THRIFT_CONCURRENCY_STDTHREADFACTORY_H_
#define _THRIFT_CONCURRENCY_STDTHREADFACTORY_H_ 1

#include <thrift/concurrency/Thread.h>

#include <boost/shared_ptr.hpp>

namespace apache {
namespace thrift {
namespace concurrency {

/**
 * A thread factory to create std::threads.
 *
 * @version $Id:$
 */
class StdThreadFactory : public ThreadFactory {

public:
  /**
   * Std thread factory.  All threads created by a factory are reference-counted
   * via boost::shared_ptr and boost::weak_ptr.  The factory guarantees that threads and
   * the Runnable tasks they host will be properly cleaned up once the last strong reference
   * to both is given up.
   *
   * By default threads are not joinable.
   */

  StdThreadFactory(bool detached = true);

  // From ThreadFactory;
  boost::shared_ptr<Thread> newThread(boost::shared_ptr<Runnable> runnable) const;

  // From ThreadFactory;
  Thread::id_t getCurrentThreadId() const;
};

}
}
} // apache::thrift::concurrency

#endif // #ifndef _THRIFT_CONCURRENCY_STDTHREADFACTORY_H_
