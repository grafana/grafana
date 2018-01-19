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

// clang-format off

#ifndef _THRIFT_TRANSPORT_PLATFORM_SOCKET_H_
#  define _THRIFT_TRANSPORT_PLATFORM_SOCKET_H_

#ifdef _WIN32
#  define THRIFT_GET_SOCKET_ERROR ::WSAGetLastError()
#  define THRIFT_ERRNO (*_errno())
#  define THRIFT_EINPROGRESS WSAEINPROGRESS
#  define THRIFT_EAGAIN WSAEWOULDBLOCK
#  define THRIFT_EINTR WSAEINTR
#  define THRIFT_ECONNRESET WSAECONNRESET
#  define THRIFT_ENOTCONN WSAENOTCONN
#  define THRIFT_ETIMEDOUT WSAETIMEDOUT
#  define THRIFT_EWOULDBLOCK WSAEWOULDBLOCK
#  define THRIFT_EPIPE WSAECONNRESET
#  define THRIFT_NO_SOCKET_CACHING SO_EXCLUSIVEADDRUSE
#  define THRIFT_SOCKET SOCKET
#  define THRIFT_INVALID_SOCKET INVALID_SOCKET
#  define THRIFT_SOCKETPAIR thrift_socketpair
#  define THRIFT_FCNTL thrift_fcntl
#  define THRIFT_O_NONBLOCK 1
#  define THRIFT_F_GETFL 0
#  define THRIFT_F_SETFL 1
#  define THRIFT_GETTIMEOFDAY thrift_gettimeofday
#  define THRIFT_CLOSESOCKET closesocket
#  define THRIFT_CLOSE _close
#  define THRIFT_OPEN _open
#  define THRIFT_FTRUNCATE _chsize_s
#  define THRIFT_FSYNC _commit
#  define THRIFT_LSEEK _lseek
#  define THRIFT_WRITE _write
#  define THRIFT_READ _read
#  define THRIFT_FSTAT _fstat
#  define THRIFT_STAT _stat
#  ifdef _WIN32_WCE
#    define THRIFT_GAI_STRERROR(...) thrift_wstr2str(gai_strerrorW(__VA_ARGS__))
#  else
#    define THRIFT_GAI_STRERROR gai_strerrorA
#  endif
#  define THRIFT_SSIZET ptrdiff_t
#  if (_MSC_VER < 1900)
#    define THRIFT_SNPRINTF _snprintf
#  else
#    define THRIFT_SNPRINTF snprintf
#  endif
#  define THRIFT_SLEEP_SEC thrift_sleep
#  define THRIFT_SLEEP_USEC thrift_usleep
#  define THRIFT_TIMESPEC thrift_timespec
#  define THRIFT_CTIME_R thrift_ctime_r
#  define THRIFT_POLL thrift_poll
#  if WINVER <= 0x0502 //XP, Server2003
#    define THRIFT_POLLFD  thrift_pollfd
#    define THRIFT_POLLIN  0x0300
#    define THRIFT_POLLOUT 0x0010
#  else //Vista, Win7...
#    define THRIFT_POLLFD  pollfd
#    define THRIFT_POLLIN  POLLIN
#    define THRIFT_POLLOUT POLLOUT
#  endif //WINVER
#  define THRIFT_SHUT_RDWR SD_BOTH
#else //not _WIN32
#  include <errno.h>
#  define THRIFT_GET_SOCKET_ERROR errno
#  define THRIFT_ERRNO errno
#  define THRIFT_EINTR       EINTR
#  define THRIFT_EINPROGRESS EINPROGRESS
#  define THRIFT_ECONNRESET  ECONNRESET
#  define THRIFT_ENOTCONN    ENOTCONN
#  define THRIFT_ETIMEDOUT   ETIMEDOUT
#  define THRIFT_EWOULDBLOCK EWOULDBLOCK
#  define THRIFT_EAGAIN      EAGAIN
#  define THRIFT_EPIPE       EPIPE
#  define THRIFT_NO_SOCKET_CACHING SO_REUSEADDR
#  define THRIFT_SOCKET int
#  define THRIFT_INVALID_SOCKET (-1)
#  define THRIFT_SOCKETPAIR socketpair
#  define THRIFT_FCNTL fcntl
#  define THRIFT_O_NONBLOCK O_NONBLOCK
#  define THRIFT_F_GETFL F_GETFL
#  define THRIFT_F_SETFL F_SETFL
#  define THRIFT_GETTIMEOFDAY gettimeofday
#  define THRIFT_CLOSESOCKET close
#  define THRIFT_CLOSE close
#  define THRIFT_OPEN open
#  define THRIFT_FTRUNCATE ftruncate
#  define THRIFT_FSYNC fsync
#  define THRIFT_LSEEK lseek
#  define THRIFT_WRITE write
#  define THRIFT_READ read
#  define THRIFT_STAT stat
#  define THRIFT_FSTAT fstat
#  define THRIFT_GAI_STRERROR gai_strerror
#  define THRIFT_SSIZET ssize_t
#  define THRIFT_SNPRINTF snprintf
#  define THRIFT_SLEEP_SEC sleep
#  define THRIFT_SLEEP_USEC usleep
#  define THRIFT_TIMESPEC timespec
#  define THRIFT_CTIME_R ctime_r
#  define THRIFT_POLL poll
#  define THRIFT_POLLFD  pollfd
#  define THRIFT_POLLIN  POLLIN
#  define THRIFT_POLLOUT POLLOUT
#  define THRIFT_SHUT_RDWR SHUT_RDWR
#endif

#endif // _THRIFT_TRANSPORT_PLATFORM_SOCKET_H_
