/* socketpair.c
 * Copyright 2007 by Nathan C. Myers <ncm@cantrip.org>; some rights reserved.
 * This code is Free Software.  It may be copied freely, in original or
 * modified form, subject only to the restrictions that (1) the author is
 * relieved from all responsibilities for any use for any purpose, and (2)
 * this copyright notice must be retained, unchanged, in its entirety.  If
 * for any reason the author might be held responsible for any consequences
 * of copying or use, license is withheld.
 */

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

#include <thrift/windows/SocketPair.h>
#include <thrift/Thrift.h>

// stl
#include <string.h>

// Win32
#include <WS2tcpip.h>

int thrift_socketpair(int d, int type, int protocol, THRIFT_SOCKET sv[2]) {
  THRIFT_UNUSED_VARIABLE(protocol);
  THRIFT_UNUSED_VARIABLE(type);
  THRIFT_UNUSED_VARIABLE(d);

  union {
    struct sockaddr_in inaddr;
    struct sockaddr addr;
  } a;
  THRIFT_SOCKET listener;
  int e;
  socklen_t addrlen = sizeof(a.inaddr);
  DWORD flags = 0;
  int reuse = 1;

  if (sv == 0) {
    WSASetLastError(WSAEINVAL);
    return SOCKET_ERROR;
  }

  listener = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
  if (listener == INVALID_SOCKET)
    return SOCKET_ERROR;

  memset(&a, 0, sizeof(a));
  a.inaddr.sin_family = AF_INET;
  a.inaddr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
  a.inaddr.sin_port = 0;

  sv[0] = sv[1] = INVALID_SOCKET;
  do {
    // ignore errors coming out of this setsockopt.  This is because
    // SO_EXCLUSIVEADDRUSE requires admin privileges on WinXP, but we don't
    // want to force socket pairs to be an admin.
    setsockopt(listener, SOL_SOCKET, SO_EXCLUSIVEADDRUSE, (char*)&reuse, (socklen_t)sizeof(reuse));
    if (bind(listener, &a.addr, sizeof(a.inaddr)) == SOCKET_ERROR)
      break;
    if (getsockname(listener, &a.addr, &addrlen) == SOCKET_ERROR)
      break;
    if (listen(listener, 1) == SOCKET_ERROR)
      break;
    sv[0] = WSASocket(AF_INET, SOCK_STREAM, 0, NULL, 0, flags);
    if (sv[0] == INVALID_SOCKET)
      break;
    if (connect(sv[0], &a.addr, sizeof(a.inaddr)) == SOCKET_ERROR)
      break;
    sv[1] = accept(listener, NULL, NULL);
    if (sv[1] == INVALID_SOCKET)
      break;

    closesocket(listener);
    return 0;

  } while (0);

  e = WSAGetLastError();
  closesocket(listener);
  closesocket(sv[0]);
  closesocket(sv[1]);
  WSASetLastError(e);
  return SOCKET_ERROR;
}
