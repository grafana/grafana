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

#include <thrift/windows/TWinsockSingleton.h>

// boost
#include <boost/assert.hpp>
#include <stdexcept>

namespace apache {
namespace thrift {
namespace transport {

TWinsockSingleton::instance_ptr TWinsockSingleton::instance_ptr_(NULL);
#if USE_BOOST_THREAD
boost::once_flag TWinsockSingleton::flags_ = BOOST_ONCE_INIT;
#elif USE_STD_THREAD
std::once_flag TWinsockSingleton::flags_;
#else
#error For windows you must choose USE_BOOST_THREAD or USE_STD_THREAD
#endif

//------------------------------------------------------------------------------
TWinsockSingleton::TWinsockSingleton(void) {
  WORD version(MAKEWORD(2, 2));
  WSAData data = {0};

  int error(WSAStartup(version, &data));
  if (error != 0) {
    BOOST_ASSERT(false);
    throw std::runtime_error("Failed to initialise Winsock.");
  }
}

//------------------------------------------------------------------------------
TWinsockSingleton::~TWinsockSingleton(void) {
  WSACleanup();
}

//------------------------------------------------------------------------------
void TWinsockSingleton::create(void) {
#if USE_BOOST_THREAD
  boost::call_once(init, flags_);
#elif USE_STD_THREAD
  std::call_once(flags_, init);
#endif
}

//------------------------------------------------------------------------------
void TWinsockSingleton::init(void) {
  instance_ptr_.reset(new TWinsockSingleton);
}
}
}
} // apache::thrift::transport
