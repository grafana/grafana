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
 * Provides a SSL BIO implementation wrapping a Thrift transport.
 *
 * This way, SSL I/O can be relayed over Thrift transport without introducing
 * an additional layer of buffering, especially for the non-blocking
 * transports.
 *
 * For the Thrift transport incarnations of the SSL entities, "tt" is used as
 * prefix for clarity.
 */
module thrift.internal.ssl_bio;

import core.stdc.config;
import core.stdc.string : strlen;
import core.memory : GC;
import deimos.openssl.bio;
import deimos.openssl.err;
import thrift.base;
import thrift.internal.ssl;
import thrift.transport.base;

/**
 * Creates an SSL BIO object wrapping the given transport.
 *
 * Exceptions thrown by the transport are pushed onto the OpenSSL error stack,
 * using the location/reason values from thrift.internal.ssl.ERR_*_D_EXCEPTION.
 *
 * The transport is assumed to be ready for reading and writing when the BIO
 * functions are called, it is not opened by the implementation.
 *
 * Params:
 *   transport = The transport to wrap.
 *   closeTransport = Whether the close the transport when the SSL BIO is
 *     closed.
 */
BIO* createTTransportBIO(TTransport transport, bool closeTransport) {
  auto result = BIO_new(cast(BIO_METHOD*)&ttBioMethod);
  if (!result) return null;

  GC.addRoot(cast(void*)transport);
  BIO_set_fd(result, closeTransport, cast(c_long)cast(void*)transport);

  return result;
}

private {
  // Helper to get the Thrift transport assigned with the given BIO.
  TTransport trans(BIO* b) nothrow {
    auto result = cast(TTransport)b.ptr;
    assert(result);
    return result;
  }

  void setError(Exception e) nothrow {
    ERR_put_error(ERR_LIB_D_EXCEPTION, ERR_F_D_EXCEPTION, ERR_R_D_EXCEPTION,
      ERR_FILE_D_EXCEPTION, ERR_LINE_D_EXCEPTION);
    try { GC.addRoot(cast(void*)e); } catch {}
    ERR_set_error_data(cast(char*)e, ERR_FLAGS_D_EXCEPTION);
  }

  extern(C) int ttWrite(BIO* b, const(char)* data, int length) nothrow {
    assert(b);
    if (!data || length <= 0) return 0;
    try {
      trans(b).write((cast(ubyte*)data)[0 .. length]);
      return length;
    } catch (Exception e) {
      setError(e);
      return -1;
    }
  }

  extern(C) int ttRead(BIO* b, char* data, int length) nothrow {
    assert(b);
    if (!data || length <= 0) return 0;
    try {
      return cast(int)trans(b).read((cast(ubyte*)data)[0 .. length]);
    } catch (Exception e) {
      setError(e);
      return -1;
    }
  }

  extern(C) int ttPuts(BIO* b, const(char)* str) nothrow {
    return ttWrite(b, str, cast(int)strlen(str));
  }

  extern(C) c_long ttCtrl(BIO* b, int cmd, c_long num, void* ptr) nothrow {
    assert(b);

    switch (cmd) {
      case BIO_C_SET_FD:
        // Note that close flag and "fd" are actually reversed here because we
        // need 64 bit width for the pointer – should probably drop BIO_set_fd
        // altogether.
        ttDestroy(b);
        b.ptr = cast(void*)num;
        b.shutdown = cast(int)ptr;
        b.init_ = 1;
        return 1;
      case BIO_C_GET_FD:
        if (!b.init_) return -1;
        *(cast(void**)ptr) = b.ptr;
        return cast(c_long)b.ptr;
      case BIO_CTRL_GET_CLOSE:
        return b.shutdown;
      case BIO_CTRL_SET_CLOSE:
        b.shutdown = cast(int)num;
        return 1;
      case BIO_CTRL_FLUSH:
        try {
          trans(b).flush();
          return 1;
        } catch (Exception e) {
          setError(e);
          return -1;
        }
      case BIO_CTRL_DUP:
        // Seems like we have nothing to do on duplication, but couldn't find
        // any documentation if this actually ever happens during normal SSL
        // usage.
        return 1;
      default:
        return 0;
    }
  }

  extern(C) int ttCreate(BIO* b) nothrow {
    assert(b);
    b.init_ = 0;
    b.num = 0; // User-defined number field, unused here.
    b.ptr = null;
    b.flags = 0;
    return 1;
  }

  extern(C) int ttDestroy(BIO* b) nothrow {
    if (!b) return 0;

    int rc = 1;
    if (b.shutdown) {
      if (b.init_) {
        try {
          trans(b).close();
          GC.removeRoot(cast(void*)trans(b));
          b.ptr = null;
        } catch (Exception e) {
          setError(e);
          rc = -1;
        }
      }
      b.init_ = 0;
      b.flags = 0;
    }

    return rc;
  }

  immutable BIO_METHOD ttBioMethod = {
    BIO_TYPE_SOURCE_SINK,
    "TTransport",
    &ttWrite,
    &ttRead,
    &ttPuts,
    null, // gets
    &ttCtrl,
    &ttCreate,
    &ttDestroy,
    null // callback_ctrl
  };
}
