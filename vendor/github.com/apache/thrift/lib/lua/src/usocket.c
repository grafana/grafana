//
// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements. See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership. The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License. You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.
//

#include <sys/time.h>
#include <sys/types.h>
#include <arpa/inet.h>
#include <netdb.h>
#include <string.h>
#include <unistd.h>
#include <fcntl.h>
#include <errno.h>

#include <stdio.h> // TODO REMOVE

#include "socket.h"

////////////////////////////////////////////////////////////////////////////////
// Private

// Num seconds since Jan 1 1970 (UTC)
#ifdef _WIN32
// SOL
#else
  double __gettime() {
    struct timeval v;
    gettimeofday(&v, (struct timezone*) NULL);
    return v.tv_sec + v.tv_usec/1.0e6;
  }
#endif

#define WAIT_MODE_R  1
#define WAIT_MODE_W  2
#define WAIT_MODE_C  (WAIT_MODE_R|WAIT_MODE_W)
T_ERRCODE socket_wait(p_socket sock, int mode, int timeout) {
  int ret = 0;
  fd_set rfds, wfds;
  struct timeval tv;
  double end, t;
  if (!timeout) {
    return TIMEOUT;
  }

  end = __gettime() + timeout/1000;
  do {
    FD_ZERO(&rfds);
    FD_ZERO(&wfds);

    // Specify what I/O operations we care about
    if (mode & WAIT_MODE_R) {
      FD_SET(*sock, &rfds);
    }
    if (mode & WAIT_MODE_W) {
      FD_SET(*sock, &wfds);
    }

    // Check for timeout
    t = end - __gettime();
    if (t < 0.0) {
      break;
    }

    // Wait
    tv.tv_sec = (int)t;
    tv.tv_usec = (int)((t - tv.tv_sec) * 1.0e6);
    ret = select(*sock+1, &rfds, &wfds, NULL, &tv);
  } while (ret == -1 && errno == EINTR);
  if (ret == -1) {
    return errno;
  }

  // Check for timeout
  if (ret == 0) {
    return TIMEOUT;
  }

  // Verify that we can actually read from the remote host
  if (mode & WAIT_MODE_C && FD_ISSET(*sock, &rfds) &&
      recv(*sock, (char*) &rfds, 0, 0) != 0) {
    return errno;
  }

  return SUCCESS;
}

////////////////////////////////////////////////////////////////////////////////
// General

T_ERRCODE socket_create(p_socket sock, int domain, int type, int protocol) {
  *sock = socket(domain, type, protocol);
  if (*sock > 0) {
    return SUCCESS;
  } else {
    return errno;
  }
}

T_ERRCODE socket_destroy(p_socket sock) {
  // TODO Figure out if I should be free-ing this
  if (*sock > 0) {
    socket_setblocking(sock);
    close(*sock);
    *sock = -1;
  }
  return SUCCESS;
}

T_ERRCODE socket_bind(p_socket sock, p_sa addr, int addr_len) {
  int ret = SUCCESS;
  socket_setblocking(sock);
  if (bind(*sock, addr, addr_len)) {
    ret = errno;
  }
  socket_setnonblocking(sock);
  return ret;
}

T_ERRCODE socket_get_info(p_socket sock, short *port, char *buf, size_t len) {
  struct sockaddr_storage sa;
  memset(&sa, 0, sizeof(sa));
  socklen_t addrlen = sizeof(sa);
  int rc = getsockname(*sock, (struct sockaddr*)&sa, &addrlen);
  if (!rc) {
    if (sa.ss_family == AF_INET6) {
      struct sockaddr_in6* sin = (struct sockaddr_in6*)(&sa);
      if (!inet_ntop(AF_INET6, &sin->sin6_addr, buf, len)) {
        return errno;
      }
      *port = ntohs(sin->sin6_port);
    } else {
      struct sockaddr_in* sin = (struct sockaddr_in*)(&sa);
      if (!inet_ntop(AF_INET, &sin->sin_addr, buf, len)) {
        return errno;
      }
      *port = ntohs(sin->sin_port);
    }
    return SUCCESS;
  }
  return errno;
}

////////////////////////////////////////////////////////////////////////////////
// Server

T_ERRCODE socket_accept(p_socket sock, p_socket client,
                  p_sa addr, socklen_t *addrlen, int timeout) {
  int err;
  if (*sock < 0) {
    return CLOSED;
  }
  do {
    *client = accept(*sock, addr, addrlen);
    if (*client > 0) {
      return SUCCESS;
    }
    err = errno;
  } while (err != EINTR);
  if (err == EAGAIN || err == ECONNABORTED) {
    return socket_wait(sock, WAIT_MODE_R, timeout);
  }
  return err;
}

T_ERRCODE socket_listen(p_socket sock, int backlog) {
  int ret = SUCCESS;
  socket_setblocking(sock);
  if (listen(*sock, backlog)) {
    ret = errno;
  }
  socket_setnonblocking(sock);
  return ret;
}

////////////////////////////////////////////////////////////////////////////////
// Client

T_ERRCODE socket_connect(p_socket sock, p_sa addr, int addr_len, int timeout) {
  int err;
  if (*sock < 0) {
    return CLOSED;
  }

  do {
    if (connect(*sock, addr, addr_len) == 0) {
      return SUCCESS;
    }
  } while ((err = errno) == EINTR);
  if (err != EINPROGRESS && err != EAGAIN) {
    return err;
  }
  return socket_wait(sock, WAIT_MODE_C, timeout);
}

T_ERRCODE socket_send(
  p_socket sock, const char *data, size_t len, int timeout) {
  int err, put = 0;
  if (*sock < 0) {
    return CLOSED;
  }
  do {
    put = send(*sock, data, len, 0);
    if (put > 0) {
      return SUCCESS;
    }
    err = errno;
  } while (err != EINTR);

  if (err == EAGAIN) {
    return socket_wait(sock, WAIT_MODE_W, timeout);
  }
  return err;
}

T_ERRCODE socket_recv(
  p_socket sock, char *data, size_t len, int timeout, int *received) {
  int err, got = 0;
  if (*sock < 0) {
    return CLOSED;
  }

  int flags = fcntl(*sock, F_GETFL, 0);
  do {
    got = recv(*sock, data, len, 0);
    if (got > 0) {
      *received = got;
      return SUCCESS;
    }
    err = errno;

    // Connection has been closed by peer
    if (got == 0) {
      return CLOSED;
    }
  } while (err != EINTR);

  if (err == EAGAIN) {
    return socket_wait(sock, WAIT_MODE_R, timeout);
  }
  return err;
}

////////////////////////////////////////////////////////////////////////////////
// Util

void socket_setnonblocking(p_socket sock) {
  int flags = fcntl(*sock, F_GETFL, 0);
  flags |= O_NONBLOCK;
  fcntl(*sock, F_SETFL, flags);
}

void socket_setblocking(p_socket sock) {
  int flags = fcntl(*sock, F_GETFL, 0);
  flags &= (~(O_NONBLOCK));
  fcntl(*sock, F_SETFL, flags);
}

////////////////////////////////////////////////////////////////////////////////
// TCP

#define ERRORSTR_RETURN(err) \
  if (err == SUCCESS) { \
    return NULL; \
  } else if (err == TIMEOUT) { \
    return TIMEOUT_MSG; \
  } else if (err == CLOSED) { \
    return CLOSED_MSG; \
  } \
  return strerror(err)

const char * tcp_create(p_socket sock) {
  int err = socket_create(sock, AF_INET, SOCK_STREAM, 0);
  ERRORSTR_RETURN(err);
}

const char * tcp_destroy(p_socket sock) {
  int err = socket_destroy(sock);
  ERRORSTR_RETURN(err);
}

const char * tcp_bind(p_socket sock, const char *host, unsigned short port) {
  int err;
  struct hostent *h;
  struct sockaddr_in local;
  memset(&local, 0, sizeof(local));
  local.sin_family = AF_INET;
  local.sin_addr.s_addr = htonl(INADDR_ANY);
  local.sin_port = htons(port);
  if (strcmp(host, "*") && !inet_aton(host, &local.sin_addr)) {
    h = gethostbyname(host);
    if (!h) {
      return hstrerror(h_errno);
    }
    memcpy(&local.sin_addr,
           (struct in_addr *)h->h_addr_list[0],
           sizeof(struct in_addr));
  }
  err = socket_bind(sock, (p_sa) &local, sizeof(local));
  ERRORSTR_RETURN(err);
}

const char * tcp_listen(p_socket sock, int backlog) {
  int err = socket_listen(sock, backlog);
  ERRORSTR_RETURN(err);
}

const char * tcp_accept(p_socket sock, p_socket client, int timeout) {
  int err = socket_accept(sock, client, NULL, NULL, timeout);
  ERRORSTR_RETURN(err);
}

const char * tcp_connect(p_socket sock,
                         const char *host,
                         unsigned short port,
                         int timeout) {
  int err;
  struct hostent *h;
  struct sockaddr_in remote;
  memset(&remote, 0, sizeof(remote));
  remote.sin_family = AF_INET;
  remote.sin_port = htons(port);
  if (strcmp(host, "*") && !inet_aton(host, &remote.sin_addr)) {
    h = gethostbyname(host);
    if (!h) {
      return hstrerror(h_errno);
    }
    memcpy(&remote.sin_addr,
           (struct in_addr *)h->h_addr_list[0],
           sizeof(struct in_addr));
  }
  err = socket_connect(sock, (p_sa) &remote, sizeof(remote), timeout);
  ERRORSTR_RETURN(err);
}

#define WRITE_STEP 8192
const char * tcp_send(
  p_socket sock, const char * data, size_t w_len, int timeout) {
  int err;
  size_t put = 0, step;
  if (!w_len) {
    return NULL;
  }

  do {
    step = (WRITE_STEP < w_len - put ? WRITE_STEP : w_len - put);
    err = socket_send(sock, data + put, step, timeout);
    put += step;
  } while (err == SUCCESS && put < w_len);
  ERRORSTR_RETURN(err);
}

const char * tcp_raw_receive(
  p_socket sock, char * data, size_t r_len, int timeout, int *received) {
  int err = socket_recv(sock, data, r_len, timeout, received);
  ERRORSTR_RETURN(err);
}
