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

#ifndef _THRIFT_TRANSPORT_TSSLSOCKET_H_
#define _THRIFT_TRANSPORT_TSSLSOCKET_H_ 1

// Put this first to avoid WIN32 build failure
#include <thrift/transport/TSocket.h>
#include <string>
#include <boost/shared_ptr.hpp>
#include <openssl/ssl.h>
#include <thrift/concurrency/Mutex.h>

namespace apache {
namespace thrift {
namespace transport {

class AccessManager;
class SSLContext;

enum SSLProtocol {
  SSLTLS  = 0,  // Supports SSLv2 and SSLv3 handshake but only negotiates at TLSv1_0 or later.
//SSLv2   = 1,  // HORRIBLY INSECURE!
  SSLv3   = 2,  // Supports SSLv3 only - also horribly insecure!
  TLSv1_0 = 3,  // Supports TLSv1_0 or later.
  TLSv1_1 = 4,  // Supports TLSv1_1 or later.
  TLSv1_2 = 5,  // Supports TLSv1_2 or later.
  LATEST  = TLSv1_2
};

#define TSSL_EINTR 0
#define TSSL_DATA 1

/**
 * Initialize OpenSSL library.  This function, or some other
 * equivalent function to initialize OpenSSL, must be called before
 * TSSLSocket is used.  If you set TSSLSocketFactory to use manual
 * OpenSSL initialization, you should call this function or otherwise
 * ensure OpenSSL is initialized yourself.
 */
void initializeOpenSSL();
/**
 * Cleanup OpenSSL library.  This function should be called to clean
 * up OpenSSL after use of OpenSSL functionality is finished.  If you
 * set TSSLSocketFactory to use manual OpenSSL initialization, you
 * should call this function yourself or ensure that whatever
 * initialized OpenSSL cleans it up too.
 */
void cleanupOpenSSL();

/**
 * OpenSSL implementation for SSL socket interface.
 */
class TSSLSocket : public TSocket {
public:
  ~TSSLSocket();
  /**
   * TTransport interface.
   */
  bool isOpen();
  bool peek();
  void open();
  void close();
  uint32_t read(uint8_t* buf, uint32_t len);
  void write(const uint8_t* buf, uint32_t len);
  void flush();
  /**
  * Set whether to use client or server side SSL handshake protocol.
  *
  * @param flag  Use server side handshake protocol if true.
  */
  void server(bool flag) { server_ = flag; }
  /**
   * Determine whether the SSL socket is server or client mode.
   */
  bool server() const { return server_; }
  /**
   * Set AccessManager.
   *
   * @param manager  Instance of AccessManager
   */
  virtual void access(boost::shared_ptr<AccessManager> manager) { access_ = manager; }

protected:
  /**
   * Constructor.
   */
  TSSLSocket(boost::shared_ptr<SSLContext> ctx);
  /**
   * Constructor with an interrupt signal.
   */
  TSSLSocket(boost::shared_ptr<SSLContext> ctx, boost::shared_ptr<THRIFT_SOCKET> interruptListener);
  /**
   * Constructor, create an instance of TSSLSocket given an existing socket.
   *
   * @param socket An existing socket
   */
  TSSLSocket(boost::shared_ptr<SSLContext> ctx, THRIFT_SOCKET socket);
  /**
   * Constructor, create an instance of TSSLSocket given an existing socket that can be interrupted.
   *
   * @param socket An existing socket
   */
  TSSLSocket(boost::shared_ptr<SSLContext> ctx, THRIFT_SOCKET socket, boost::shared_ptr<THRIFT_SOCKET> interruptListener);
   /**
   * Constructor.
   *
   * @param host  Remote host name
   * @param port  Remote port number
   */
  TSSLSocket(boost::shared_ptr<SSLContext> ctx, std::string host, int port);
    /**
	* Constructor with an interrupt signal.
	*
	* @param host  Remote host name
	* @param port  Remote port number
	*/
    TSSLSocket(boost::shared_ptr<SSLContext> ctx, std::string host, int port, boost::shared_ptr<THRIFT_SOCKET> interruptListener);
  /**
   * Authorize peer access after SSL handshake completes.
   */
  virtual void authorize();
  /**
   * Initiate SSL handshake if not already initiated.
   */
  void checkHandshake();
  /**
   * Waits for an socket or shutdown event.
   *
   * @throw TTransportException::INTERRUPTED if interrupted is signaled.
   *
   * @return TSSL_EINTR if EINTR happened on the underlying socket
   *         TSSL_DATA  if data is available on the socket.
   */
  unsigned int waitForEvent(bool wantRead);

  bool server_;
  SSL* ssl_;
  boost::shared_ptr<SSLContext> ctx_;
  boost::shared_ptr<AccessManager> access_;
  friend class TSSLSocketFactory;
};

/**
 * SSL socket factory. SSL sockets should be created via SSL factory.
 */
class TSSLSocketFactory {
public:
  /**
   * Constructor/Destructor
   *
   * @param protocol The SSL/TLS protocol to use.
   */
  TSSLSocketFactory(SSLProtocol protocol = SSLTLS);
  virtual ~TSSLSocketFactory();
  /**
   * Create an instance of TSSLSocket with a fresh new socket.
   */
  virtual boost::shared_ptr<TSSLSocket> createSocket();
  /**
   * Create an instance of TSSLSocket with a fresh new socket, which is interruptable.
   */
  virtual boost::shared_ptr<TSSLSocket> createSocket(boost::shared_ptr<THRIFT_SOCKET> interruptListener);
  /**
   * Create an instance of TSSLSocket with the given socket.
   *
   * @param socket An existing socket.
   */
  virtual boost::shared_ptr<TSSLSocket> createSocket(THRIFT_SOCKET socket);
  /**
   * Create an instance of TSSLSocket with the given socket which is interruptable.
   *
   * @param socket An existing socket.
   */
  virtual boost::shared_ptr<TSSLSocket> createSocket(THRIFT_SOCKET socket, boost::shared_ptr<THRIFT_SOCKET> interruptListener);
  /**
  * Create an instance of TSSLSocket.
  *
  * @param host  Remote host to be connected to
  * @param port  Remote port to be connected to
  */
  virtual boost::shared_ptr<TSSLSocket> createSocket(const std::string& host, int port);
  /**
  * Create an instance of TSSLSocket.
  *
  * @param host  Remote host to be connected to
  * @param port  Remote port to be connected to
  */
  virtual boost::shared_ptr<TSSLSocket> createSocket(const std::string& host, int port, boost::shared_ptr<THRIFT_SOCKET> interruptListener);
  /**
   * Set ciphers to be used in SSL handshake process.
   *
   * @param ciphers  A list of ciphers
   */
  virtual void ciphers(const std::string& enable);
  /**
   * Enable/Disable authentication.
   *
   * @param required Require peer to present valid certificate if true
   */
  virtual void authenticate(bool required);
  /**
   * Load server certificate.
   *
   * @param path   Path to the certificate file
   * @param format Certificate file format
   */
  virtual void loadCertificate(const char* path, const char* format = "PEM");
  /**
   * Load private key.
   *
   * @param path   Path to the private key file
   * @param format Private key file format
   */
  virtual void loadPrivateKey(const char* path, const char* format = "PEM");
  /**
   * Load trusted certificates from specified file.
   *
   * @param path Path to trusted certificate file
   */
  virtual void loadTrustedCertificates(const char* path);
  /**
   * Default randomize method.
   */
  virtual void randomize();
  /**
   * Override default OpenSSL password callback with getPassword().
   */
  void overrideDefaultPasswordCallback();
  /**
   * Set/Unset server mode.
   *
   * @param flag  Server mode if true
   */
  virtual void server(bool flag) { server_ = flag; }
  /**
   * Determine whether the socket is in server or client mode.
   *
   * @return true, if server mode, or, false, if client mode
   */
  virtual bool server() const { return server_; }
  /**
   * Set AccessManager.
   *
   * @param manager  The AccessManager instance
   */
  virtual void access(boost::shared_ptr<AccessManager> manager) { access_ = manager; }
  static void setManualOpenSSLInitialization(bool manualOpenSSLInitialization) {
    manualOpenSSLInitialization_ = manualOpenSSLInitialization;
  }

protected:
  boost::shared_ptr<SSLContext> ctx_;

  /**
   * Override this method for custom password callback. It may be called
   * multiple times at any time during a session as necessary.
   *
   * @param password Pass collected password to OpenSSL
   * @param size     Maximum length of password including NULL character
   */
  virtual void getPassword(std::string& /* password */, int /* size */) {}

private:
  bool server_;
  boost::shared_ptr<AccessManager> access_;
  static concurrency::Mutex mutex_;
  static uint64_t count_;
  static bool manualOpenSSLInitialization_;
  void setup(boost::shared_ptr<TSSLSocket> ssl);
  static int passwordCallback(char* password, int size, int, void* data);
};

/**
 * SSL exception.
 */
class TSSLException : public TTransportException {
public:
  TSSLException(const std::string& message)
    : TTransportException(TTransportException::INTERNAL_ERROR, message) {}

  virtual const char* what() const throw() {
    if (message_.empty()) {
      return "TSSLException";
    } else {
      return message_.c_str();
    }
  }
};

/**
 * Wrap OpenSSL SSL_CTX into a class.
 */
class SSLContext {
public:
  SSLContext(const SSLProtocol& protocol = SSLTLS);
  virtual ~SSLContext();
  SSL* createSSL();
  SSL_CTX* get() { return ctx_; }

private:
  SSL_CTX* ctx_;
};

/**
 * Callback interface for access control. It's meant to verify the remote host.
 * It's constructed when application starts and set to TSSLSocketFactory
 * instance. It's passed onto all TSSLSocket instances created by this factory
 * object.
 */
class AccessManager {
public:
  enum Decision {
    DENY = -1, // deny access
    SKIP = 0,  // cannot make decision, move on to next (if any)
    ALLOW = 1  // allow access
  };
  /**
   * Destructor
   */
  virtual ~AccessManager() {}
  /**
   * Determine whether the peer should be granted access or not. It's called
   * once after the SSL handshake completes successfully, before peer certificate
   * is examined.
   *
   * If a valid decision (ALLOW or DENY) is returned, the peer certificate is
   * not to be verified.
   *
   * @param  sa Peer IP address
   * @return True if the peer is trusted, false otherwise
   */
  virtual Decision verify(const sockaddr_storage& /* sa */) throw() { return DENY; }
  /**
   * Determine whether the peer should be granted access or not. It's called
   * every time a DNS subjectAltName/common name is extracted from peer's
   * certificate.
   *
   * @param  host Client mode: host name returned by TSocket::getHost()
   *              Server mode: host name returned by TSocket::getPeerHost()
   * @param  name SubjectAltName or common name extracted from peer certificate
   * @param  size Length of name
   * @return True if the peer is trusted, false otherwise
   *
   * Note: The "name" parameter may be UTF8 encoded.
   */
  virtual Decision verify(const std::string& /* host */,
                          const char* /* name */,
                          int /* size */) throw() {
    return DENY;
  }
  /**
   * Determine whether the peer should be granted access or not. It's called
   * every time an IP subjectAltName is extracted from peer's certificate.
   *
   * @param  sa   Peer IP address retrieved from the underlying socket
   * @param  data IP address extracted from certificate
   * @param  size Length of the IP address
   * @return True if the peer is trusted, false otherwise
   */
  virtual Decision verify(const sockaddr_storage& /* sa */,
                          const char* /* data */,
                          int /* size */) throw() {
    return DENY;
  }
};

typedef AccessManager::Decision Decision;

class DefaultClientAccessManager : public AccessManager {
public:
  // AccessManager interface
  Decision verify(const sockaddr_storage& sa) throw();
  Decision verify(const std::string& host, const char* name, int size) throw();
  Decision verify(const sockaddr_storage& sa, const char* data, int size) throw();
};
}
}
}

#endif
