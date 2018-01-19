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

#ifndef _THRIFT_TRANSPORT_WINDOWS_TWINSOCKSINGLETON_H_
#define _THRIFT_TRANSPORT_WINDOWS_TWINSOCKSINGLETON_H_ 1

#if defined(_MSC_VER) && (_MSC_VER > 1200)
#pragma once
#endif // _MSC_VER

#ifndef _WIN32
#error This is a MSVC header only.
#endif

#include <thrift/thrift-config.h>

// boost
#include <boost/noncopyable.hpp>
#include <boost/scoped_ptr.hpp>

#if USE_BOOST_THREAD
#include <boost/thread/once.hpp>
#elif USE_STD_THREAD
#include <mutex>
#else
#error For windows you must choose USE_BOOST_THREAD or USE_STD_THREAD
#endif

namespace apache {
namespace thrift {
namespace transport {

/**
 * Winsock2 must be intialised once only in order to create sockets. This class
 * performs a one time initialisation when create is called.
 */
class TWinsockSingleton : private boost::noncopyable {

public:
  typedef boost::scoped_ptr<TWinsockSingleton> instance_ptr;

private:
  TWinsockSingleton(void);

public:
  ~TWinsockSingleton(void);

public:
  static void create(void);

private:
  static void init(void);

private:
  static instance_ptr instance_ptr_;
#if USE_BOOST_THREAD
  static boost::once_flag flags_;
#elif USE_STD_THREAD
  static std::once_flag flags_;
#else
#error Need a non-Boost non-C++11 way to track single initialization here.
#endif
};
}
}
} // apache::thrift::transport

#endif // _THRIFT_TRANSPORT_WINDOWS_TWINSOCKSINGLETON_H_
