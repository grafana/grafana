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
#ifndef _THRIFT_TEST_SERVERTHREAD_TCC_
#define _THRIFT_TEST_SERVERTHREAD_TCC_ 1

#include "ServerThread.h"

#include <thrift/concurrency/PlatformThreadFactory.h>
#include <thrift/concurrency/ThreadManager.h>
#include <thrift/server/TThreadPoolServer.h>
#include <thrift/transport/TBufferTransports.h>
#include <thrift/transport/TServerSocket.h>

namespace apache {
namespace thrift {
namespace test {

void ServerThread::start() {
  assert(!running_);
  running_ = true;

  // Start the other thread
  concurrency::PlatformThreadFactory threadFactory;
  threadFactory.setDetached(false);
  thread_ = threadFactory.newThread(helper_);

  thread_->start();

  // Wait on the other thread to tell us that it has successfully
  // bound to the port and started listening (or until an error occurs).
  concurrency::Synchronized s(serverMonitor_);
  while (!serving_ && !error_) {
    serverMonitor_.waitForever();
  }

  if (error_) {
    throw transport::TTransportException(transport::TTransportException::NOT_OPEN,
                                         "failed to bind on server socket");
  }
}

void ServerThread::stop() {
  if (!running_) {
    return;
  }

  // Tell the server to stop
  server_->stop();
  running_ = false;

  // Wait for the server thread to exit
  //
  // Note: this only works if all client connections have closed.  The servers
  // generally wait for everything to be closed before exiting; there currently
  // isn't a way to tell them to just exit now, and shut down existing
  // connections.
  thread_->join();
}

void ServerThread::run() {
  /*
   * Try binding to several ports, in case the one we want is already in use.
   */
  port_ = 12345;
  unsigned int maxRetries = 10;
  for (unsigned int n = 0; n < maxRetries; ++n) {
    // Create the server
    server_ = serverState_->createServer(port_);
    // Install our helper as the server event handler, so that our
    // preServe() method will be called once we've successfully bound to
    // the port and are about to start listening.
    server_->setServerEventHandler(helper_);

    try {
      // Try to serve requests
      server_->serve();
    } catch (const TException&) {
      // TNonblockingServer throws a generic TException if it fails to bind.
      // If we get a TException, we'll optimistically assume the bind failed.
      ++port_;
      continue;
    }

    // Seriously?  serve() is pretty lame.  If it fails to start serving it
    // just returns rather than throwing an exception.
    //
    // We have to use our preServe() hook to tell if serve() successfully
    // started serving and is returning because stop() is called, or if it just
    // failed to start serving in the first place.
    concurrency::Synchronized s(serverMonitor_);
    if (serving_) {
      // Oh good, we started serving and are exiting because
      // we're trying to stop.
      serving_ = false;
      return;
    } else {
      // We never started serving, probably because we failed to bind to the
      // port.  Increment the port number and try again.
      ++port_;
      continue;
    }
  }

  // We failed to bind on any port.
  concurrency::Synchronized s(serverMonitor_);
  error_ = true;
  serverMonitor_.notify();
}

void ServerThread::preServe() {
  // We bound to the port successfully, and are about to start serving requests
  serverState_->bindSuccessful(port_);

  // Set the real server event handler (replacing ourself)
  boost::shared_ptr<server::TServerEventHandler> serverEventHandler
      = serverState_->getServerEventHandler();
  server_->setServerEventHandler(serverEventHandler);

  // Notify the main thread that we have successfully started serving requests
  concurrency::Synchronized s(serverMonitor_);
  serving_ = true;
  serverMonitor_.notify();

  // Invoke preServe() on the real event handler, since we ate
  // the original preServe() event.
  if (serverEventHandler) {
    serverEventHandler->preServe();
  }
}
}
}
} // apache::thrift::test

#endif // _THRIFT_TEST_SERVERTHREAD_TCC_
