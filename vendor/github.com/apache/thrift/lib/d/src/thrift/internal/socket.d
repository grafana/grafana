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

/**
 * Abstractions over OS-dependent socket functionality.
 */
module thrift.internal.socket;

import std.conv : to;

// FreeBSD and OS X return -1 and set ECONNRESET if socket was closed by
// the other side, we need to check for that before throwing an exception.
version (FreeBSD) {
  enum connresetOnPeerShutdown = true;
} else version (OSX) {
  enum connresetOnPeerShutdown = true;
} else {
  enum connresetOnPeerShutdown = false;
}

version (Win32) {
  import std.c.windows.winsock : WSAGetLastError, WSAEINTR, WSAEWOULDBLOCK;
  import std.windows.syserror : sysErrorString;

  // These are unfortunately not defined in std.c.windows.winsock, see
  // http://msdn.microsoft.com/en-us/library/ms740668.aspx.
  enum WSAECONNRESET = 10054;
  enum WSAENOTCONN = 10057;
  enum WSAETIMEDOUT = 10060;
} else {
  import core.stdc.errno : errno, EAGAIN, ECONNRESET, EINPROGRESS, EINTR,
    ENOTCONN, EPIPE;
  import core.stdc.string : strerror;
}

/*
 * CONNECT_INPROGRESS_ERRNO: set by connect() for non-blocking sockets if the
 *   connection could not be immediately established.
 * INTERRUPTED_ERRNO: set when blocking system calls are interrupted by
 *   signals or similar.
 * TIMEOUT_ERRNO: set when a socket timeout has been exceeded.
 * WOULD_BLOCK_ERRNO: set when send/recv would block on non-blocking sockets.
 *
 * isSocetCloseErrno(errno): returns true if errno indicates that the socket
 *   is logically in closed state now.
 */
version (Win32) {
  alias WSAGetLastError getSocketErrno;
  enum CONNECT_INPROGRESS_ERRNO = WSAEWOULDBLOCK;
  enum INTERRUPTED_ERRNO = WSAEINTR;
  enum TIMEOUT_ERRNO = WSAETIMEDOUT;
  enum WOULD_BLOCK_ERRNO = WSAEWOULDBLOCK;

  bool isSocketCloseErrno(typeof(getSocketErrno()) errno) {
    return (errno == WSAECONNRESET || errno == WSAENOTCONN);
  }
} else {
  alias errno getSocketErrno;
  enum CONNECT_INPROGRESS_ERRNO = EINPROGRESS;
  enum INTERRUPTED_ERRNO = EINTR;
  enum WOULD_BLOCK_ERRNO = EAGAIN;

  // TODO: The C++ TSocket implementation mentions that EAGAIN can also be
  // set (undocumentedly) in out of resource conditions; it would be a good
  // idea to contact the original authors of the C++ code for details and adapt
  // the code accordingly.
  enum TIMEOUT_ERRNO = EAGAIN;

  bool isSocketCloseErrno(typeof(getSocketErrno()) errno) {
    return (errno == EPIPE || errno == ECONNRESET || errno == ENOTCONN);
  }
}

string socketErrnoString(uint errno) {
  version (Win32) {
    return sysErrorString(errno);
  } else {
    return to!string(strerror(errno));
  }
}
