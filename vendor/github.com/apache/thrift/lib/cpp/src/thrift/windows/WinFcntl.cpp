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

#include <thrift/windows/WinFcntl.h>

int thrift_fcntl(THRIFT_SOCKET fd, int cmd, int flags) {
  if (cmd != THRIFT_F_GETFL && cmd != THRIFT_F_SETFL) {
    return -1;
  }

  if (flags != THRIFT_O_NONBLOCK && flags != 0) {
    return -1;
  }

  if (cmd == THRIFT_F_GETFL) {
    return 0;
  }

  int res;
  if (flags) {
    res = ioctlsocket(fd, FIONBIO, reinterpret_cast<u_long*>(&(flags = 1)));
  } else {
    res = ioctlsocket(fd, FIONBIO, reinterpret_cast<u_long*>(&(flags = 0)));
  }

  return res;
}

#if WINVER <= 0x0502 // XP, Server2003
int thrift_poll(THRIFT_POLLFD* fdArray, ULONG nfds, INT timeout) {
  fd_set read_fds, write_fds;
  fd_set* read_fds_ptr = NULL;
  fd_set* write_fds_ptr = NULL;

  FD_ZERO(&read_fds);
  FD_ZERO(&write_fds);

  for (ULONG i = 0; i < nfds; i++) {
    // Read (in) socket
    if ((fdArray[i].events & THRIFT_POLLIN) == THRIFT_POLLIN) {
      read_fds_ptr = &read_fds;
      FD_SET(fdArray[i].fd, &read_fds);
    }
    // Write (out) socket
    else if ((fdArray[i].events & THRIFT_POLLOUT) == THRIFT_POLLOUT) {
      write_fds_ptr = &write_fds;
      FD_SET(fdArray[i].fd, &write_fds);
    }
  }

  timeval time_out;
  timeval* time_out_ptr = NULL;
  if (timeout >= 0) {
    time_out.tv_sec = timeout / 1000;
    time_out.tv_usec = (timeout % 1000) * 1000;
    time_out_ptr = &time_out;
  } else { // to avoid compiler warnings
    (void)time_out;
    (void)timeout;
  }

  int sktready = select(1, read_fds_ptr, write_fds_ptr, NULL, time_out_ptr);
  if (sktready > 0) {
    for (ULONG i = 0; i < nfds; i++) {
      fdArray[i].revents = 0;
      if (FD_ISSET(fdArray[i].fd, &read_fds))
        fdArray[i].revents |= THRIFT_POLLIN;
      if (FD_ISSET(fdArray[i].fd, &write_fds))
        fdArray[i].revents |= THRIFT_POLLOUT;
    }
  }
  return sktready;
}
#else  // Vista, Win7...
int thrift_poll(THRIFT_POLLFD* fdArray, ULONG nfds, INT timeout) {
  return WSAPoll(fdArray, nfds, timeout);
}
#endif // WINVER

#ifdef _WIN32_WCE
std::string thrift_wstr2str(std::wstring ws) {
  std::string s(ws.begin(), ws.end());
  return s;
}
#endif
