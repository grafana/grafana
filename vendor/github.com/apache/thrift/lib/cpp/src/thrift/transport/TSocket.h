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

#ifndef _THRIFT_TRANSPORT_TSOCKET_H_
#define _THRIFT_TRANSPORT_TSOCKET_H_ 1

#include <string>

#include <thrift/transport/TTransport.h>
#include <thrift/transport/TVirtualTransport.h>
#include <thrift/transport/TServerSocket.h>
#include <thrift/transport/PlatformSocket.h>

#ifdef HAVE_ARPA_INET_H
#include <arpa/inet.h>
#endif
#ifdef HAVE_SYS_TIME_H
#include <sys/time.h>
#endif
#ifdef HAVE_NETDB_H
#include <netdb.h>
#endif

namespace apache {
namespace thrift {
namespace transport {

/**
 * TCP Socket implementation of the TTransport interface.
 *
 */
class TSocket : public TVirtualTransport<TSocket> {
public:
  /**
   * Constructs a new socket. Note that this does NOT actually connect the
   * socket.
   *
   */
  TSocket();

  /**
   * Constructs a new socket. Note that this does NOT actually connect the
   * socket.
   *
   * @param host An IP address or hostname to connect to
   * @param port The port to connect on
   */
  TSocket(const std::string& host, int port);

  /**
   * Constructs a new Unix domain socket.
   * Note that this does NOT actually connect the socket.
   *
   * @param path The Unix domain socket e.g. "/tmp/ThriftTest.binary.thrift"
   */
  TSocket(const std::string& path);

  /**
   * Destroyes the socket object, closing it if necessary.
   */
  virtual ~TSocket();

  /**
   * Whether the socket is alive.
   *
   * @return Is the socket alive?
   */
  virtual bool isOpen();

  /**
   * Calls select on the socket to see if there is more data available.
   */
  virtual bool peek();

  /**
   * Creates and opens the UNIX socket.
   *
   * @throws TTransportException If the socket could not connect
   */
  virtual void open();

  /**
   * Shuts down communications on the socket.
   */
  virtual void close();

  /**
   * Reads from the underlying socket.
   * \returns the number of bytes read or 0 indicates EOF
   * \throws TTransportException of types:
   *           INTERRUPTED means the socket was interrupted
   *                       out of a blocking call
   *           NOT_OPEN means the socket has been closed
   *           TIMED_OUT means the receive timeout expired
   *           UNKNOWN means something unexpected happened
   */
  virtual uint32_t read(uint8_t* buf, uint32_t len);

  /**
   * Writes to the underlying socket.  Loops until done or fail.
   */
  virtual void write(const uint8_t* buf, uint32_t len);

  /**
   * Writes to the underlying socket.  Does single send() and returns result.
   */
  uint32_t write_partial(const uint8_t* buf, uint32_t len);

  /**
   * Get the host that the socket is connected to
   *
   * @return string host identifier
   */
  std::string getHost();

  /**
   * Get the port that the socket is connected to
   *
   * @return int port number
   */
  int getPort();

  /**
   * Set the host that socket will connect to
   *
   * @param host host identifier
   */
  void setHost(std::string host);

  /**
   * Set the port that socket will connect to
   *
   * @param port port number
   */
  void setPort(int port);

  /**
   * Controls whether the linger option is set on the socket.
   *
   * @param on      Whether SO_LINGER is on
   * @param linger  If linger is active, the number of seconds to linger for
   */
  void setLinger(bool on, int linger);

  /**
   * Whether to enable/disable Nagle's algorithm.
   *
   * @param noDelay Whether or not to disable the algorithm.
   * @return
   */
  void setNoDelay(bool noDelay);

  /**
   * Set the connect timeout
   */
  void setConnTimeout(int ms);

  /**
   * Set the receive timeout
   */
  void setRecvTimeout(int ms);

  /**
   * Set the send timeout
   */
  void setSendTimeout(int ms);

  /**
   * Set the max number of recv retries in case of an THRIFT_EAGAIN
   * error
   */
  void setMaxRecvRetries(int maxRecvRetries);

  /**
   * Set SO_KEEPALIVE
   */
  void setKeepAlive(bool keepAlive);

  /**
   * Get socket information formatted as a string <Host: x Port: x>
   */
  std::string getSocketInfo();

  /**
   * Returns the DNS name of the host to which the socket is connected
   */
  std::string getPeerHost();

  /**
   * Returns the address of the host to which the socket is connected
   */
  std::string getPeerAddress();

  /**
   * Returns the port of the host to which the socket is connected
   **/
  int getPeerPort();

  /**
   * Returns the underlying socket file descriptor.
   */
  THRIFT_SOCKET getSocketFD() { return socket_; }

  /**
   * (Re-)initialize a TSocket for the supplied descriptor.  This is only
   * intended for use by TNonblockingServer -- other use may result in
   * unfortunate surprises.
   *
   * @param fd the descriptor for an already-connected socket
   */
  void setSocketFD(THRIFT_SOCKET fd);

  /*
   * Returns a cached copy of the peer address.
   */
  sockaddr* getCachedAddress(socklen_t* len) const;

  /**
   * Sets whether to use a low minimum TCP retransmission timeout.
   */
  static void setUseLowMinRto(bool useLowMinRto);

  /**
   * Gets whether to use a low minimum TCP retransmission timeout.
   */
  static bool getUseLowMinRto();

  /**
   * Get the origin the socket is connected to
   *
   * @return string peer host identifier and port
   */
  virtual const std::string getOrigin();

  /**
   * Constructor to create socket from file descriptor.
   */
  TSocket(THRIFT_SOCKET socket);

  /**
   * Constructor to create socket from file descriptor that
   * can be interrupted safely.
   */
  TSocket(THRIFT_SOCKET socket, boost::shared_ptr<THRIFT_SOCKET> interruptListener);

  /**
   * Set a cache of the peer address (used when trivially available: e.g.
   * accept() or connect()). Only caches IPV4 and IPV6; unset for others.
   */
  void setCachedAddress(const sockaddr* addr, socklen_t len);

protected:
  /** connect, called by open */
  void openConnection(struct addrinfo* res);

  /** Host to connect to */
  std::string host_;

  /** Port number to connect on */
  int port_;

  /** UNIX domain socket path */
  std::string path_;

  /** Underlying socket handle */
  THRIFT_SOCKET socket_;

  /** Peer hostname */
  std::string peerHost_;

  /** Peer address */
  std::string peerAddress_;

  /** Peer port */
  int peerPort_;

  /**
   * A shared socket pointer that will interrupt a blocking read if data
   * becomes available on it
   */
  boost::shared_ptr<THRIFT_SOCKET> interruptListener_;

  /** Connect timeout in ms */
  int connTimeout_;

  /** Send timeout in ms */
  int sendTimeout_;

  /** Recv timeout in ms */
  int recvTimeout_;

  /** Keep alive on */
  bool keepAlive_;

  /** Linger on */
  bool lingerOn_;

  /** Linger val */
  int lingerVal_;

  /** Nodelay */
  bool noDelay_;

  /** Recv EGAIN retries */
  int maxRecvRetries_;

  /** Cached peer address */
  union {
    sockaddr_in ipv4;
    sockaddr_in6 ipv6;
  } cachedPeerAddr_;

  /** Whether to use low minimum TCP retransmission timeout */
  static bool useLowMinRto_;

private:
  void unix_open();
  void local_open();
};
}
}
} // apache::thrift::transport

#endif // #ifndef _THRIFT_TRANSPORT_TSOCKET_H_
