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

#ifndef _THRIFT_CXXFUNCTIONAL_H_
#define _THRIFT_CXXFUNCTIONAL_H_ 1

// clang-format off

/**
 * Loads <functional> from the 'right' location, depending
 * on compiler and whether or not it's using C++03 with TR1
 * or C++11.
 */

/*
 * MSVC 10 and 11 have the <functional> stuff at <functional>.
 * In MSVC 10 all of the implementations live in std::tr1.
 * In MSVC 11 all of the implementations live in std, with aliases
 *  in std::tr1 to point to the ones in std.
 */
#if defined(_WIN32) && !defined(__MINGW32__)
  #define _THRIFT_USING_MICROSOFT_STDLIB 1
#endif

#ifdef __clang__
  /* Clang has two options, depending on standard library:
   * - no -stdlib or -stdlib=libstdc++ set; uses GNU libstdc++.
   *    <tr1/functional>
   * - -stdlib=libc++; uses LLVM libc++.
   *    <functional>, no 'std::tr1'.
   *
   * The compiler itself doesn't define anything differently
   * depending on the value of -stdlib, but the library headers
   * will set different preprocessor options. In order to check,
   * though, we have to pull in some library header.
   */
  #include <utility>

  /* With LLVM libc++, utility pulls in __config, which sets
     _LIBCPP_VERSION. */
  #if defined(_LIBCPP_VERSION)
    #define _THRIFT_USING_CLANG_LIBCXX 1

  /* With GNU libstdc++, utility pulls in bits/c++config.h,
     which sets __GLIBCXX__. */
  #elif defined(__GLIBCXX__)
    #define _THRIFT_USING_GNU_LIBSTDCXX 1

  /* No idea. */
  #else
    #error Unable to detect which C++ standard library is in use.
  #endif
#elif __GNUC__
  #define _THRIFT_USING_GNU_LIBSTDCXX 1
#endif

#if _THRIFT_USING_MICROSOFT_STDLIB
  #include <functional>

  namespace apache { namespace thrift { namespace stdcxx {
    using ::std::tr1::function;
    using ::std::tr1::bind;

    namespace placeholders {
      using ::std::tr1::placeholders::_1;
      using ::std::tr1::placeholders::_2;
      using ::std::tr1::placeholders::_3;
      using ::std::tr1::placeholders::_4;
      using ::std::tr1::placeholders::_5;
      using ::std::tr1::placeholders::_6;
    } // apache::thrift::stdcxx::placeholders
  }}} // apache::thrift::stdcxx

#elif _THRIFT_USING_CLANG_LIBCXX
  #include <functional>

  namespace apache { namespace thrift { namespace stdcxx {
    using ::std::function;
    using ::std::bind;

    namespace placeholders {
      using ::std::placeholders::_1;
      using ::std::placeholders::_2;
      using ::std::placeholders::_3;
      using ::std::placeholders::_4;
      using ::std::placeholders::_5;
      using ::std::placeholders::_6;
    } // apache::thrift::stdcxx::placeholders
  }}} // apache::thrift::stdcxx

#elif _THRIFT_USING_GNU_LIBSTDCXX
  #ifdef USE_BOOST_THREAD
    #include <boost/tr1/functional.hpp>
  #else
    #include <tr1/functional>
  #endif

  namespace apache { namespace thrift { namespace stdcxx {
    using ::std::tr1::function;
    using ::std::tr1::bind;

    namespace placeholders {
      using ::std::tr1::placeholders::_1;
      using ::std::tr1::placeholders::_2;
      using ::std::tr1::placeholders::_3;
      using ::std::tr1::placeholders::_4;
      using ::std::tr1::placeholders::_5;
      using ::std::tr1::placeholders::_6;
    } // apache::thrift::stdcxx::placeholders
  }}} // apache::thrift::stdcxx
#endif

  // Alias for thrift c++ compatibility namespace
  namespace tcxx = apache::thrift::stdcxx;

#endif // #ifndef _THRIFT_CXXFUNCTIONAL_H_
