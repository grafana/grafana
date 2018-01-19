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

#ifndef THRIFT_PY_ENDIAN_H
#define THRIFT_PY_ENDIAN_H

#include <Python.h>

#ifndef _WIN32
#include <netinet/in.h>
#else
#include <WinSock2.h>
#pragma comment(lib, "ws2_32.lib")
#define BIG_ENDIAN (4321)
#define LITTLE_ENDIAN (1234)
#define BYTE_ORDER LITTLE_ENDIAN
#define inline __inline
#endif

/* Fix endianness issues on Solaris */
#if defined(__SVR4) && defined(__sun)
#if defined(__i386) && !defined(__i386__)
#define __i386__
#endif

#ifndef BIG_ENDIAN
#define BIG_ENDIAN (4321)
#endif
#ifndef LITTLE_ENDIAN
#define LITTLE_ENDIAN (1234)
#endif

/* I386 is LE, even on Solaris */
#if !defined(BYTE_ORDER) && defined(__i386__)
#define BYTE_ORDER LITTLE_ENDIAN
#endif
#endif

#ifndef __BYTE_ORDER
#if defined(BYTE_ORDER) && defined(LITTLE_ENDIAN) && defined(BIG_ENDIAN)
#define __BYTE_ORDER BYTE_ORDER
#define __LITTLE_ENDIAN LITTLE_ENDIAN
#define __BIG_ENDIAN BIG_ENDIAN
#else
#error "Cannot determine endianness"
#endif
#endif

// Same comment as the enum.  Sorry.
#if __BYTE_ORDER == __BIG_ENDIAN
#define ntohll(n) (n)
#define htonll(n) (n)
#if defined(__GNUC__) && defined(__GLIBC__)
#include <byteswap.h>
#define letohll(n) bswap_64(n)
#define htolell(n) bswap_64(n)
#else /* GNUC & GLIBC */
#define letohll(n) ((((unsigned long long)ntohl(n)) << 32) + ntohl(n >> 32))
#define htolell(n) ((((unsigned long long)htonl(n)) << 32) + htonl(n >> 32))
#endif
#elif __BYTE_ORDER == __LITTLE_ENDIAN
#if defined(__GNUC__) && defined(__GLIBC__)
#include <byteswap.h>
#define ntohll(n) bswap_64(n)
#define htonll(n) bswap_64(n)
#else /* GNUC & GLIBC */
#define ntohll(n) ((((unsigned long long)ntohl(n)) << 32) + ntohl(n >> 32))
#define htonll(n) ((((unsigned long long)htonl(n)) << 32) + htonl(n >> 32))
#endif /* GNUC & GLIBC */
#define letohll(n) (n)
#define htolell(n) (n)
#else /* __BYTE_ORDER */
#error "Can't define htonll or ntohll!"
#endif

#endif // THRIFT_PY_ENDIAN_H
