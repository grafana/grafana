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
 * OpenSSL socket implementation, in large parts ported from C++.
 */
module thrift.transport.ssl;

import core.exception : onOutOfMemoryError;
import core.stdc.errno : errno, EINTR;
import core.sync.mutex : Mutex;
import core.memory : GC;
import core.stdc.config;
import core.stdc.stdlib : free, malloc;
import std.ascii : toUpper;
import std.array : empty, front, popFront;
import std.conv : emplace, to;
import std.exception : enforce;
import std.socket : Address, InternetAddress, Internet6Address, Socket;
import std.string : toStringz;
import deimos.openssl.err;
import deimos.openssl.rand;
import deimos.openssl.ssl;
import deimos.openssl.x509v3;
import thrift.base;
import thrift.internal.ssl;
import thrift.transport.base;
import thrift.transport.socket;

/**
 * SSL encrypted socket implementation using OpenSSL.
 *
 * Note:
 * On Posix systems which do not have the BSD-specific SO_NOSIGPIPE flag, you
 * might want to ignore the SIGPIPE signal, as OpenSSL might try to write to
 * a closed socket if the peer disconnects abruptly:
 * ---
 * import core.stdc.signal;
 * import core.sys.posix.signal;
 * signal(SIGPIPE, SIG_IGN);
 * ---
 */
final class TSSLSocket : TSocket {
  /**
   * Creates an instance that wraps an already created, connected (!) socket.
   *
   * Params:
   *   context = The SSL socket context to use. A reference to it is stored so
   *     that it doesn't get cleaned up while the socket is used.
   *   socket = Already created, connected socket object.
   */
  this(TSSLContext context, Socket socket) {
    super(socket);
    context_ = context;
    serverSide_ = context.serverSide;
    accessManager_ = context.accessManager;
  }

  /**
   * Creates a new unconnected socket that will connect to the given host
   * on the given port.
   *
   * Params:
   *   context = The SSL socket context to use. A reference to it is stored so
    *     that it doesn't get cleaned up while the socket is used.
   *   host = Remote host.
   *   port = Remote port.
   */
  this(TSSLContext context, string host, ushort port) {
    super(host, port);
    context_ = context;
    serverSide_ = context.serverSide;
    accessManager_ = context.accessManager;
  }

  override bool isOpen() @property {
    if (ssl_ is null || !super.isOpen()) return false;

    auto shutdown = SSL_get_shutdown(ssl_);
    bool shutdownReceived = (shutdown & SSL_RECEIVED_SHUTDOWN) != 0;
    bool shutdownSent = (shutdown & SSL_SENT_SHUTDOWN) != 0;
    return !(shutdownReceived && shutdownSent);
  }

  override bool peek() {
    if (!isOpen) return false;
    checkHandshake();

    byte bt;
    auto rc = SSL_peek(ssl_, &bt, bt.sizeof);
    enforce(rc >= 0, getSSLException("SSL_peek"));

    if (rc == 0) {
      ERR_clear_error();
    }
    return (rc > 0);
  }

  override void open() {
    enforce(!serverSide_, "Cannot open a server-side SSL socket.");
    if (isOpen) return;
    super.open();
  }

  override void close() {
    if (!isOpen) return;

    if (ssl_ !is null) {
      // Two-step SSL shutdown.
      auto rc = SSL_shutdown(ssl_);
      if (rc == 0) {
        rc = SSL_shutdown(ssl_);
      }
      if (rc < 0) {
        // Do not throw an exception here as leaving the transport "open" will
        // probably produce only more errors, and the chance we can do
        // something about the error e.g. by retrying is very low.
        logError("Error shutting down SSL: %s", getSSLException());
      }

      SSL_free(ssl_);
      ssl_ = null;
      ERR_remove_state(0);
    }
    super.close();
  }

  override size_t read(ubyte[] buf) {
    checkHandshake();

    int bytes;
    foreach (_; 0 .. maxRecvRetries) {
      bytes = SSL_read(ssl_, buf.ptr, cast(int)buf.length);
      if (bytes >= 0) break;

      auto errnoCopy = errno;
      if (SSL_get_error(ssl_, bytes) == SSL_ERROR_SYSCALL) {
        if (ERR_get_error() == 0 && errnoCopy == EINTR) {
          // FIXME: Windows.
          continue;
        }
      }
      throw getSSLException("SSL_read");
    }
    return bytes;
  }

  override void write(in ubyte[] buf) {
    checkHandshake();

    // Loop in case SSL_MODE_ENABLE_PARTIAL_WRITE is set in SSL_CTX.
    size_t written = 0;
    while (written < buf.length) {
      auto bytes = SSL_write(ssl_, buf.ptr + written,
        cast(int)(buf.length - written));
      if (bytes <= 0) {
        throw getSSLException("SSL_write");
      }
      written += bytes;
    }
  }

  override void flush() {
    checkHandshake();

    auto bio = SSL_get_wbio(ssl_);
    enforce(bio !is null, new TSSLException("SSL_get_wbio returned null"));

    auto rc = BIO_flush(bio);
    enforce(rc == 1, getSSLException("BIO_flush"));
  }

  /**
   * Whether to use client or server side SSL handshake protocol.
   */
  bool serverSide() @property const {
    return serverSide_;
  }

  /// Ditto
  void serverSide(bool value) @property {
    serverSide_ = value;
  }

  /**
   * The access manager to use.
   */
  void accessManager(TAccessManager value) @property {
    accessManager_ = value;
  }

private:
  void checkHandshake() {
    enforce(super.isOpen(), new TTransportException(
      TTransportException.Type.NOT_OPEN));

    if (ssl_ !is null) return;
    ssl_ = context_.createSSL();

    SSL_set_fd(ssl_, socketHandle);
    int rc;
    if (serverSide_) {
      rc = SSL_accept(ssl_);
    } else {
      rc = SSL_connect(ssl_);
    }
    enforce(rc > 0, getSSLException());
    authorize(ssl_, accessManager_, getPeerAddress(),
      (serverSide_ ? getPeerAddress().toHostNameString() : host));
  }

  bool serverSide_;
  SSL* ssl_;
  TSSLContext context_;
  TAccessManager accessManager_;
}

/**
 * Represents an OpenSSL context with certification settings, etc. and handles
 * initialization/teardown.
 *
 * OpenSSL is initialized when the first instance of this class is created
 * and shut down when the last one is destroyed (thread-safe).
 */
class TSSLContext {
  this() {
    initMutex_.lock();
    scope(exit) initMutex_.unlock();

    if (count_ == 0) {
      initializeOpenSSL();
      randomize();
    }
    count_++;

    ctx_ = SSL_CTX_new(TLSv1_method());
    enforce(ctx_, getSSLException("SSL_CTX_new"));
    SSL_CTX_set_mode(ctx_, SSL_MODE_AUTO_RETRY);
  }

  ~this() {
    initMutex_.lock();
    scope(exit) initMutex_.unlock();

    if (ctx_ !is null) {
      SSL_CTX_free(ctx_);
      ctx_ = null;
    }

    count_--;
    if (count_ == 0) {
      cleanupOpenSSL();
    }
  }

  /**
   * Ciphers to be used in SSL handshake process.
   *
   * The string must be in the colon-delimited OpenSSL notation described in
   * ciphers(1), for example: "ALL:!ADH:!LOW:!EXP:!MD5:@STRENGTH".
   */
  void ciphers(string enable) @property {
    auto rc = SSL_CTX_set_cipher_list(ctx_, toStringz(enable));

    enforce(ERR_peek_error() == 0, getSSLException("SSL_CTX_set_cipher_list"));
    enforce(rc > 0, new TSSLException("None of specified ciphers are supported"));
  }

  /**
   * Whether peer is required to present a valid certificate.
   */
  void authenticate(bool required) @property {
    int mode;
    if (required) {
      mode = SSL_VERIFY_PEER | SSL_VERIFY_FAIL_IF_NO_PEER_CERT |
        SSL_VERIFY_CLIENT_ONCE;
    } else {
      mode = SSL_VERIFY_NONE;
    }
    SSL_CTX_set_verify(ctx_, mode, null);
  }

  /**
   * Load server certificate.
   *
   * Params:
   *   path = Path to the certificate file.
   *   format = Certificate file format. Defaults to PEM, which is currently
   *     the only one supported.
   */
  void loadCertificate(string path, string format = "PEM") {
    enforce(path !is null && format !is null, new TTransportException(
      "loadCertificateChain: either <path> or <format> is null",
      TTransportException.Type.BAD_ARGS));

    if (format == "PEM") {
      enforce(SSL_CTX_use_certificate_chain_file(ctx_, toStringz(path)),
        getSSLException(
          `Could not load SSL server certificate from file "` ~ path ~ `"`
        )
      );
    } else {
      throw new TSSLException("Unsupported certificate format: " ~ format);
    }
  }

  /*
   * Load private key.
   *
   * Params:
   *   path = Path to the certificate file.
   *   format = Private key file format. Defaults to PEM, which is currently
   *     the only one supported.
   */
  void loadPrivateKey(string path, string format = "PEM") {
    enforce(path !is null && format !is null, new TTransportException(
      "loadPrivateKey: either <path> or <format> is NULL",
      TTransportException.Type.BAD_ARGS));

    if (format == "PEM") {
      enforce(SSL_CTX_use_PrivateKey_file(ctx_, toStringz(path), SSL_FILETYPE_PEM),
        getSSLException(
          `Could not load SSL private key from file "` ~ path ~ `"`
        )
      );
    } else {
      throw new TSSLException("Unsupported certificate format: " ~ format);
    }
  }

  /**
   * Load trusted certificates from specified file (in PEM format).
   *
   * Params.
   *   path = Path to the file containing the trusted certificates.
   */
  void loadTrustedCertificates(string path) {
    enforce(path !is null, new TTransportException(
      "loadTrustedCertificates: <path> is NULL",
      TTransportException.Type.BAD_ARGS));

    enforce(SSL_CTX_load_verify_locations(ctx_, toStringz(path), null),
      getSSLException(
        `Could not load SSL trusted certificate list from file "` ~ path ~ `"`
      )
    );
  }

  /**
   * Called during OpenSSL initialization to seed the OpenSSL entropy pool.
   *
   * Defaults to simply calling RAND_poll(), but it can be overwritten if a
   * different, perhaps more secure implementation is desired.
   */
  void randomize() {
    RAND_poll();
  }

  /**
   * Whether to use client or server side SSL handshake protocol.
   */
  bool serverSide() @property const {
    return serverSide_;
  }

  /// Ditto
  void serverSide(bool value) @property {
    serverSide_ = value;
  }

  /**
   * The access manager to use.
   */
  TAccessManager accessManager() @property {
    if (!serverSide_ && !accessManager_) {
      accessManager_ = new TDefaultClientAccessManager;
    }
    return accessManager_;
  }

  /// Ditto
  void accessManager(TAccessManager value) @property {
    accessManager_ = value;
  }

  SSL* createSSL() out (result) {
    assert(result);
  } body {
    auto result = SSL_new(ctx_);
    enforce(result, getSSLException("SSL_new"));
    return result;
  }

protected:
  /**
   * Override this method for custom password callback. It may be called
   * multiple times at any time during a session as necessary.
   *
   * Params:
   *   size = Maximum length of password, including null byte.
   */
  string getPassword(int size) nothrow out(result) {
    assert(result.length < size);
  } body {
    return "";
  }

  /**
   * Notifies OpenSSL to use getPassword() instead of the default password
   * callback with getPassword().
   */
  void overrideDefaultPasswordCallback() {
    SSL_CTX_set_default_passwd_cb(ctx_, &passwordCallback);
    SSL_CTX_set_default_passwd_cb_userdata(ctx_, cast(void*)this);
  }

  SSL_CTX* ctx_;

private:
  bool serverSide_;
  TAccessManager accessManager_;

  shared static this() {
    initMutex_ = new Mutex();
  }

  static void initializeOpenSSL() {
    if (initialized_) {
      return;
    }
    initialized_ = true;

    SSL_library_init();
    SSL_load_error_strings();

    mutexes_ = new Mutex[CRYPTO_num_locks()];
    foreach (ref m; mutexes_) {
      m = new Mutex;
    }

    import thrift.internal.traits;
    // As per the OpenSSL threads manpage, this isn't needed on Windows.
    version (Posix) {
      CRYPTO_set_id_callback(assumeNothrow(&threadIdCallback));
    }
    CRYPTO_set_locking_callback(assumeNothrow(&lockingCallback));
    CRYPTO_set_dynlock_create_callback(assumeNothrow(&dynlockCreateCallback));
    CRYPTO_set_dynlock_lock_callback(assumeNothrow(&dynlockLockCallback));
    CRYPTO_set_dynlock_destroy_callback(assumeNothrow(&dynlockDestroyCallback));
  }

  static void cleanupOpenSSL() {
    if (!initialized_) return;

    initialized_ = false;
    CRYPTO_set_locking_callback(null);
    CRYPTO_set_dynlock_create_callback(null);
    CRYPTO_set_dynlock_lock_callback(null);
    CRYPTO_set_dynlock_destroy_callback(null);
    CRYPTO_cleanup_all_ex_data();
    ERR_free_strings();
    ERR_remove_state(0);
  }

  static extern(C) {
    version (Posix) {
      import core.sys.posix.pthread : pthread_self;
      c_ulong threadIdCallback() {
        return cast(c_ulong)pthread_self();
      }
    }

    void lockingCallback(int mode, int n, const(char)* file, int line) {
      if (mode & CRYPTO_LOCK) {
        mutexes_[n].lock();
      } else {
        mutexes_[n].unlock();
      }
    }

    CRYPTO_dynlock_value* dynlockCreateCallback(const(char)* file, int line) {
      enum size =  __traits(classInstanceSize, Mutex);
      auto mem = malloc(size)[0 .. size];
      if (!mem) onOutOfMemoryError();
      GC.addRange(mem.ptr, size);
      auto mutex = emplace!Mutex(mem);
      return cast(CRYPTO_dynlock_value*)mutex;
    }

    void dynlockLockCallback(int mode, CRYPTO_dynlock_value* l,
      const(char)* file, int line)
    {
      if (l is null) return;
      if (mode & CRYPTO_LOCK) {
        (cast(Mutex)l).lock();
      } else {
        (cast(Mutex)l).unlock();
      }
    }

    void dynlockDestroyCallback(CRYPTO_dynlock_value* l,
      const(char)* file, int line)
    {
      GC.removeRange(l);
      destroy(cast(Mutex)l);
      free(l);
    }

    int passwordCallback(char* password, int size, int, void* data) nothrow {
      auto context = cast(TSSLContext) data;
      auto userPassword = context.getPassword(size);
      auto len = userPassword.length;
      if (len > size) {
        len = size;
      }
      password[0 .. len] = userPassword[0 .. len]; // TODO: \0 handling correct?
      return cast(int)len;
    }
  }

  static __gshared bool initialized_;
  static __gshared Mutex initMutex_;
  static __gshared Mutex[] mutexes_;
  static __gshared uint count_;
}

/**
 * Decides whether a remote host is legitimate or not.
 *
 * It is usually set at a TSSLContext, which then passes it to all the created
 * TSSLSockets.
 */
class TAccessManager {
  ///
  enum Decision {
    DENY = -1, /// Deny access.
    SKIP =  0, /// Cannot decide, move on to next check (deny if last).
    ALLOW = 1  /// Allow access.
  }

  /**
   * Determines whether a peer should be granted access or not based on its
   * IP address.
   *
   * Called once after SSL handshake is completes successfully and before peer
   * certificate is examined.
   *
   * If a valid decision (ALLOW or DENY) is returned, the peer certificate
   * will not be verified.
   */
  Decision verify(Address address) {
    return Decision.DENY;
  }

  /**
   * Determines whether a peer should be granted access or not based on a
   * name from its certificate.
   *
   * Called every time a DNS subjectAltName/common name is extracted from the
   * peer's certificate.
   *
   * Params:
   *   host = The actual host name string from the socket connection.
   *   certHost = A host name string from the certificate.
   */
  Decision verify(string host, const(char)[] certHost) {
    return Decision.DENY;
  }

  /**
   * Determines whether a peer should be granted access or not based on an IP
   * address from its certificate.
   *
   * Called every time an IP subjectAltName is extracted from the peer's
   * certificate.
   *
   * Params:
   *   address = The actual address from the socket connection.
   *   certHost = A host name string from the certificate.
   */
  Decision verify(Address address, ubyte[] certAddress) {
    return Decision.DENY;
  }
}

/**
 * Default access manager implementation, which just checks the host name
 * resp. IP address of the connection against the certificate.
 */
class TDefaultClientAccessManager : TAccessManager {
  override Decision verify(Address address) {
    return Decision.SKIP;
  }

  override Decision verify(string host, const(char)[] certHost) {
    if (host.empty || certHost.empty) {
      return Decision.SKIP;
    }
    return (matchName(host, certHost) ? Decision.ALLOW : Decision.SKIP);
  }

  override Decision verify(Address address, ubyte[] certAddress) {
    bool match;
    if (certAddress.length == 4) {
      if (auto ia = cast(InternetAddress)address) {
        match = ((cast(ubyte*)ia.addr())[0 .. 4] == certAddress[]);
      }
    } else if (certAddress.length == 16) {
      if (auto ia = cast(Internet6Address)address) {
        match = (ia.addr() == certAddress[]);
      }
    }
    return (match ? Decision.ALLOW : Decision.SKIP);
  }
}

private {
  /**
   * Matches a name with a pattern. The pattern may include wildcard. A single
   * wildcard "*" can match up to one component in the domain name.
   *
   * Params:
   *   host = Host name to match, typically the SSL remote peer.
   *   pattern = Host name pattern, typically from the SSL certificate.
   *
   * Returns: true if host matches pattern, false otherwise.
   */
  bool matchName(const(char)[] host, const(char)[] pattern) {
    while (!host.empty && !pattern.empty) {
      if (toUpper(pattern.front) == toUpper(host.front)) {
        host.popFront;
        pattern.popFront;
      } else if (pattern.front == '*') {
        while (!host.empty && host.front != '.') {
          host.popFront;
        }
        pattern.popFront;
      } else {
        break;
      }
    }
    return (host.empty && pattern.empty);
  }

  unittest {
    enforce(matchName("thrift.apache.org", "*.apache.org"));
    enforce(!matchName("thrift.apache.org", "apache.org"));
    enforce(matchName("thrift.apache.org", "thrift.*.*"));
    enforce(matchName("", ""));
    enforce(!matchName("", "*"));
  }
}

/**
 * SSL-level exception.
 */
class TSSLException : TTransportException {
  ///
  this(string msg, string file = __FILE__, size_t line = __LINE__,
    Throwable next = null)
  {
    super(msg, TTransportException.Type.INTERNAL_ERROR, file, line, next);
  }
}
