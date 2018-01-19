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
#include <thrift/Thrift.h>

#include <cassert>
#include <boost/thread.hpp>
#include <boost/thread/mutex.hpp>
#include <boost/date_time/posix_time/posix_time.hpp>

namespace apache {
namespace thrift {
namespace concurrency {

/**
 * Implementation of Mutex class using boost interprocess mutex
 *
 * @version $Id:$
 */
class Mutex::impl : public boost::timed_mutex {};

Mutex::Mutex(Initializer init) : impl_(new Mutex::impl()) {
  THRIFT_UNUSED_VARIABLE(init);
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
  return impl_->timed_lock(boost::get_system_time() + boost::posix_time::milliseconds(ms));
}

void Mutex::unlock() const {
  impl_->unlock();
}

void Mutex::DEFAULT_INITIALIZER(void* arg) {
  THRIFT_UNUSED_VARIABLE(arg);
}
}
}
} // apache::thrift::concurrency
