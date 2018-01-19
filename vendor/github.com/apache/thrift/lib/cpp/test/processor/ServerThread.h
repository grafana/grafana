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
#ifndef _THRIFT_TEST_SERVERTHREAD_H_
#define _THRIFT_TEST_SERVERTHREAD_H_ 1

#include <thrift/TProcessor.h>
#include <thrift/protocol/TProtocol.h>
#include <thrift/server/TServer.h>
#include <thrift/transport/TTransport.h>

#include "EventLog.h"

namespace apache {
namespace thrift {
namespace test {

/**
 * A helper class to tell ServerThread how to create the server
 */
class ServerState {
public:
  virtual ~ServerState() {}

  /**
   * Create a server to listen on the specified port.
   *
   * If the server returned fails to bind to the specified port when serve() is
   * called on it, createServer() may be called again on a different port.
   */
  virtual boost::shared_ptr<server::TServer> createServer(uint16_t port) = 0;

  /**
   * Get the TServerEventHandler to set on the server.
   *
   * This is only called after the server successfully binds and is about to
   * start serving traffic.  It is invoked from the server thread, rather than
   * the main thread.
   */
  virtual boost::shared_ptr<server::TServerEventHandler> getServerEventHandler() {
    return boost::shared_ptr<server::TServerEventHandler>();
  }

  /**
   * This method is called in the server thread after server binding succeeds.
   *
   * Subclasses may override this method if they wish to record the final
   * port that was used for the server.
   */
  virtual void bindSuccessful(uint16_t /*port*/) {}
};

/**
 * ServerThread starts a thrift server running in a separate thread.
 */
class ServerThread {
public:
  ServerThread(const boost::shared_ptr<ServerState>& state, bool autoStart)
    : helper_(new Helper(this)),
      port_(0),
      running_(false),
      serving_(false),
      error_(false),
      serverState_(state) {
    if (autoStart) {
      start();
    }
  }

  void start();
  void stop();

  uint16_t getPort() const { return port_; }

  ~ServerThread() {
    if (running_) {
      try {
        stop();
      } catch (...) {
        GlobalOutput.printf("error shutting down server");
      }
    }
  }

protected:
  // Annoying.  thrift forces us to use shared_ptr, so we have to use
  // a helper class that we can allocate on the heap and give to thrift.
  // It would be simpler if we could just make Runnable and TServerEventHandler
  // private base classes of ServerThread.
  class Helper : public concurrency::Runnable, public server::TServerEventHandler {
  public:
    Helper(ServerThread* serverThread) : serverThread_(serverThread) {}

    void run() { serverThread_->run(); }

    void preServe() { serverThread_->preServe(); }

  private:
    ServerThread* serverThread_;
  };

  void run();
  void preServe();

  boost::shared_ptr<Helper> helper_;

  uint16_t port_;
  bool running_;
  bool serving_;
  bool error_;
  concurrency::Monitor serverMonitor_;

  boost::shared_ptr<ServerState> serverState_;
  boost::shared_ptr<server::TServer> server_;
  boost::shared_ptr<concurrency::Thread> thread_;
};
}
}
} // apache::thrift::test

#endif // _THRIFT_TEST_SERVERTHREAD_H_
