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

#include <thrift/concurrency/Mutex.h>
#include <thrift/concurrency/Util.h>

#include <cassert>
#include <chrono>
#include <mutex>

namespace apache {
namespace thrift {
namespace concurrency {

/**
 * Implementation of Mutex class using C++11 std::timed_mutex
 *
 * @version $Id:$
 */
class Mutex::impl : public std::timed_mutex {};

Mutex::Mutex(Initializer init) : impl_(new Mutex::impl()) {
}

void* Mutex::getUnderlyingImpl() const {
  return impl_.get();
}

void Mutex::lock() const {
  impl_->lock();
}

bool Mutex::trylock() const {
  return impl_->try_lock();
}

bool Mutex::timedlock(int64_t ms) const {
  return impl_->try_lock_for(std::chrono::milliseconds(ms));
}

void Mutex::unlock() const {
  impl_->unlock();
}

void Mutex::DEFAULT_INITIALIZER(void* arg) {
}
}
}
} // apache::thrift::concurrency
