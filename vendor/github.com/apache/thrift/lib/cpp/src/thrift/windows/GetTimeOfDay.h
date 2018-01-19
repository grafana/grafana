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

#ifndef _THRIFT_WINDOWS_GETTIMEOFDAY_H_
#define _THRIFT_WINDOWS_GETTIMEOFDAY_H_

#if defined(_MSC_VER) && (_MSC_VER > 1200)
#pragma once
#endif // _MSC_VER

#ifndef _WIN32
#error This is a MSVC header only.
#endif

#include <thrift/thrift-config.h>
#include <time.h>

struct thrift_timespec {
  int64_t tv_sec;
  int64_t tv_nsec;
};

int thrift_gettimeofday(struct timeval* tv, struct timezone* tz);
int thrift_sleep(unsigned int seconds);
int thrift_usleep(unsigned int micro_seconds);
char* thrift_ctime_r(const time_t* _clock, char* _buf);

#endif // _THRIFT_WINDOWS_GETTIMEOFDAY_H_
