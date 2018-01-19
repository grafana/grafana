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

#include "FacebookBase.h"

using namespace facebook::fb303;
using apache::thrift::concurrency::Guard;

FacebookBase::FacebookBase(std::string name) :
  name_(name) {
  aliveSince_ = (int64_t) time(NULL);
}

inline void FacebookBase::getName(std::string& _return) {
  _return = name_;
}

void FacebookBase::setOption(const std::string& key, const std::string& value) {
  Guard g(optionsLock_);
  options_[key] = value;
}

void FacebookBase::getOption(std::string& _return, const std::string& key) {
  Guard g(optionsLock_);
  _return = options_[key];
}

void FacebookBase::getOptions(std::map<std::string, std::string> & _return) {
  Guard g(optionsLock_);
  _return = options_;
}

int64_t FacebookBase::incrementCounter(const std::string& key, int64_t amount) {
  counters_.acquireRead();

  // if we didn't find the key, we need to write lock the whole map to create it
  ReadWriteCounterMap::iterator it = counters_.find(key);
  if (it == counters_.end()) {
    counters_.release();
    counters_.acquireWrite();

    // we need to check again to make sure someone didn't create this key
    // already while we released the lock
    it = counters_.find(key);
    if(it == counters_.end()){
      counters_[key].value = amount;
      counters_.release();
      return amount;
    }
  }

  it->second.acquireWrite();
  int64_t count = it->second.value + amount;
  it->second.value = count;
  it->second.release();
  counters_.release();
  return count;
}

int64_t FacebookBase::setCounter(const std::string& key, int64_t value) {
  counters_.acquireRead();

  // if we didn't find the key, we need to write lock the whole map to create it
  ReadWriteCounterMap::iterator it = counters_.find(key);
  if (it == counters_.end()) {
    counters_.release();
    counters_.acquireWrite();
    counters_[key].value = value;
    counters_.release();
    return value;
  }

  it->second.acquireWrite();
  it->second.value = value;
  it->second.release();
  counters_.release();
  return value;
}

void FacebookBase::getCounters(std::map<std::string, int64_t>& _return) {
  // we need to lock the whole thing and actually build the map since we don't
  // want our read/write structure to go over the wire
  counters_.acquireRead();
  for(ReadWriteCounterMap::iterator it = counters_.begin();
      it != counters_.end(); ++it)
  {
    _return[it->first] = it->second.value;
  }
  counters_.release();
}

int64_t FacebookBase::getCounter(const std::string& key) {
  int64_t rv = 0;
  counters_.acquireRead();
  ReadWriteCounterMap::iterator it = counters_.find(key);
  if (it != counters_.end()) {
    it->second.acquireRead();
    rv = it->second.value;
    it->second.release();
  }
  counters_.release();
  return rv;
}

inline int64_t FacebookBase::aliveSince() {
  return aliveSince_;
}

