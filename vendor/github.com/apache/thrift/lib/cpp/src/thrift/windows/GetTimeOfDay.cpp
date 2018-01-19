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

#include <thrift/windows/GetTimeOfDay.h>
#include <thrift/thrift-config.h>

// win32
#if defined(__MINGW32__)
  #include <sys/time.h>
#endif

#if defined(_MSC_VER) || defined(_MSC_EXTENSIONS)
#define DELTA_EPOCH_IN_MICROSECS 11644473600000000Ui64
#else
#define DELTA_EPOCH_IN_MICROSECS 11644473600000000ULL
#endif

#if !defined(__MINGW32__)
struct timezone {
  int tz_minuteswest; /* minutes W of Greenwich */
  int tz_dsttime;     /* type of dst correction */
};
#endif

#if defined(__MINGW32__)
int thrift_gettimeofday(struct timeval* tv, struct timezone* tz) {
  return gettimeofday(tv,tz);
}
#else
int thrift_gettimeofday(struct timeval* tv, struct timezone* tz) {
  FILETIME ft;
  unsigned __int64 tmpres(0);
  static int tzflag;

  if (NULL != tv) {
    GetSystemTimeAsFileTime(&ft);

    tmpres |= ft.dwHighDateTime;
    tmpres <<= 32;
    tmpres |= ft.dwLowDateTime;

    /*converting file time to unix epoch*/
    tmpres -= DELTA_EPOCH_IN_MICROSECS;
    tmpres /= 10; /*convert into microseconds*/
    tv->tv_sec = (long)(tmpres / 1000000UL);
    tv->tv_usec = (long)(tmpres % 1000000UL);
  }

  if (NULL != tz) {
    if (!tzflag) {
      _tzset();
      tzflag++;
    }

    long time_zone(0);
    errno_t err(_get_timezone(&time_zone));
    if (err == NO_ERROR) {
      tz->tz_minuteswest = time_zone / 60;
    } else {
      return -1;
    }

    int day_light(0);
    err = (_get_daylight(&day_light));
    if (err == NO_ERROR) {
      tz->tz_dsttime = day_light;
      return 0;
    } else {
      return -1;
    }
  }

  return 0;
}
#endif

int thrift_sleep(unsigned int seconds) {
  ::Sleep(seconds * 1000);
  return 0;
}
int thrift_usleep(unsigned int microseconds) {
  unsigned int milliseconds = (microseconds + 999) / 1000;
  ::Sleep(milliseconds);
  return 0;
}

char* thrift_ctime_r(const time_t* _clock, char* _buf) {
  strcpy(_buf, ctime(_clock));
  return _buf;
}
