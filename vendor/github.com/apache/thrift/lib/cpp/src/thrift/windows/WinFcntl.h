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

#ifndef _THRIFT_WINDOWS_FCNTL_H_
#define _THRIFT_WINDOWS_FCNTL_H_ 1

#if defined(_MSC_VER) && (_MSC_VER > 1200)
#pragma once
#endif // _MSC_VER

#ifndef _WIN32
#error This is a MSVC header only.
#endif

#ifdef _WIN32_WCE
#include <string>
#endif

// Win32
#include <Winsock2.h>
#include <thrift/transport/PlatformSocket.h>

#if WINVER <= 0x0502 // XP, Server2003
struct thrift_pollfd {
  THRIFT_SOCKET fd;
  SHORT events;
  SHORT revents;
};
#endif

extern "C" {
int thrift_fcntl(THRIFT_SOCKET fd, int cmd, int flags);
int thrift_poll(THRIFT_POLLFD* fdArray, ULONG nfds, INT timeout);
}

#ifdef _WIN32_WCE
std::string thrift_wstr2str(std::wstring ws);
#endif

#endif // _THRIFT_WINDOWS_FCNTL_H_
