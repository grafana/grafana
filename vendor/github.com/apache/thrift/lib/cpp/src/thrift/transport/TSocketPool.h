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

#ifndef _THRIFT_TRANSPORT_TSOCKETPOOL_H_
#define _THRIFT_TRANSPORT_TSOCKETPOOL_H_ 1

#include <vector>
#include <thrift/transport/TSocket.h>

namespace apache {
namespace thrift {
namespace transport {

/**
 * Class to hold server information for TSocketPool
 *
 */
class TSocketPoolServer {

public:
  /**
   * Default constructor for server info
   */
  TSocketPoolServer();

  /**
   * Constructor for TSocketPool server
   */
  TSocketPoolServer(const std::string& host, int port);

  // Host name
  std::string host_;

  // Port to connect on
  int port_;

  // Socket for the server
  THRIFT_SOCKET socket_;

  // Last time connecting to this server failed
  time_t lastFailTime_;

  // Number of consecutive times connecting to this server failed
  int consecutiveFailures_;
};

/**
 * TCP Socket implementation of the TTransport interface.
 *
 */
class TSocketPool : public TSocket {

public:
  /**
   * Socket pool constructor
   */
  TSocketPool();

  /**
   * Socket pool constructor
   *
   * @param hosts list of host names
   * @param ports list of port names
   */
  TSocketPool(const std::vector<std::string>& hosts, const std::vector<int>& ports);

  /**
   * Socket pool constructor
   *
   * @param servers list of pairs of host name and port
   */
  TSocketPool(const std::vector<std::pair<std::string, int> >& servers);

  /**
   * Socket pool constructor
   *
   * @param servers list of TSocketPoolServers
   */
  TSocketPool(const std::vector<boost::shared_ptr<TSocketPoolServer> >& servers);

  /**
   * Socket pool constructor
   *
   * @param host single host
   * @param port single port
   */
  TSocketPool(const std::string& host, int port);

  /**
   * Destroyes the socket object, closing it if necessary.
   */
  virtual ~TSocketPool();

  /**
   * Add a server to the pool
   */
  void addServer(const std::string& host, int port);

  /**
   * Add a server to the pool
   */
  void addServer(boost::shared_ptr<TSocketPoolServer>& server);

  /**
   * Set list of servers in this pool
   */
  void setServers(const std::vector<boost::shared_ptr<TSocketPoolServer> >& servers);

  /**
   * Get list of servers in this pool
   */
  void getServers(std::vector<boost::shared_ptr<TSocketPoolServer> >& servers);

  /**
   * Sets how many times to keep retrying a host in the connect function.
   */
  void setNumRetries(int numRetries);

  /**
   * Sets how long to wait until retrying a host if it was marked down
   */
  void setRetryInterval(int retryInterval);

  /**
   * Sets how many times to keep retrying a host before marking it as down.
   */
  void setMaxConsecutiveFailures(int maxConsecutiveFailures);

  /**
   * Turns randomization in connect order on or off.
   */
  void setRandomize(bool randomize);

  /**
   * Whether to always try the last server.
   */
  void setAlwaysTryLast(bool alwaysTryLast);

  /**
   * Creates and opens the UNIX socket.
   */
  void open();

  /*
   * Closes the UNIX socket
   */
  void close();

protected:
  void setCurrentServer(const boost::shared_ptr<TSocketPoolServer>& server);

  /** List of servers to connect to */
  std::vector<boost::shared_ptr<TSocketPoolServer> > servers_;

  /** Current server */
  boost::shared_ptr<TSocketPoolServer> currentServer_;

  /** How many times to retry each host in connect */
  int numRetries_;

  /** Retry interval in seconds, how long to not try a host if it has been
   * marked as down.
   */
  time_t retryInterval_;

  /** Max consecutive failures before marking a host down. */
  int maxConsecutiveFailures_;

  /** Try hosts in order? or Randomized? */
  bool randomize_;

  /** Always try last host, even if marked down? */
  bool alwaysTryLast_;
};
}
}
} // apache::thrift::transport

#endif // #ifndef _THRIFT_TRANSPORT_TSOCKETPOOL_H_
