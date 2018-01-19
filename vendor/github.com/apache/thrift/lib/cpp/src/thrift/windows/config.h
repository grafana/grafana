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

#ifndef _THRIFT_WINDOWS_CONFIG_H_
#define _THRIFT_WINDOWS_CONFIG_H_ 1

#if defined(_MSC_VER) && (_MSC_VER > 1200)
#pragma once
#endif // _MSC_VER

#ifndef _WIN32
#error "This is a Windows header only"
#endif

// use std::thread in MSVC11 (2012) or newer
#if _MSC_VER >= 1700
#define USE_STD_THREAD 1
#else
// otherwise use boost threads
#define USE_BOOST_THREAD 1
#endif

// VS2010 or later has stdint.h
#if _MSC_VER >= 1600
#define HAVE_STDINT_H 1
#endif

#ifndef TARGET_WIN_XP
#define TARGET_WIN_XP 1
#endif

#if TARGET_WIN_XP
#ifndef WINVER
#define WINVER 0x0501
#endif
#ifndef _WIN32_WINNT
#define _WIN32_WINNT 0x0501
#endif
#endif

#ifndef _WIN32_WINNT
#define _WIN32_WINNT 0x0601
#endif

#if defined(_M_IX86) || defined(_M_X64)
#define ARITHMETIC_RIGHT_SHIFT 1
#define SIGNED_RIGHT_SHIFT_IS 1
#endif

#pragma warning(disable : 4996) // Deprecated posix name.

#define VERSION "0.10.0"
#define HAVE_GETTIMEOFDAY 1
#define HAVE_SYS_STAT_H 1

// Must be using VS2010 or later, or boost, so that C99 types are defined in the global namespace
#ifdef HAVE_STDINT_H
#include <stdint.h>
#else
#include <boost/cstdint.hpp>

typedef boost::int64_t int64_t;
typedef boost::uint64_t uint64_t;
typedef boost::int32_t int32_t;
typedef boost::uint32_t uint32_t;
typedef boost::int16_t int16_t;
typedef boost::uint16_t uint16_t;
typedef boost::int8_t int8_t;
typedef boost::uint8_t uint8_t;
#endif

#include <thrift/transport/PlatformSocket.h>
#include <thrift/windows/GetTimeOfDay.h>
#include <thrift/windows/Operators.h>
#include <thrift/windows/TWinsockSingleton.h>
#include <thrift/windows/WinFcntl.h>
#include <thrift/windows/SocketPair.h>

// windows
#include <Winsock2.h>
#include <ws2tcpip.h>
#ifdef _WIN32_WCE
#pragma comment(lib, "Ws2.lib")
#else
#pragma comment(lib, "Ws2_32.lib")
#pragma comment(lib, "advapi32.lib") // For security APIs in TPipeServer
#pragma comment(lib, "Shlwapi.lib")  // For StrStrIA in TPipeServer
#endif
#endif // _THRIFT_WINDOWS_CONFIG_H_
