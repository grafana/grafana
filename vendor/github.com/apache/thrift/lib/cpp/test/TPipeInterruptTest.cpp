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

#ifdef _WIN32

#include <boost/test/test_tools.hpp>
#include <boost/test/unit_test_suite.hpp>

#include <boost/bind.hpp>
#include <boost/chrono/duration.hpp>
#include <boost/date_time/posix_time/posix_time_duration.hpp>
#include <boost/thread/thread.hpp>
#include <thrift/transport/TPipe.h>
#include <thrift/transport/TPipeServer.h>

using apache::thrift::transport::TPipeServer;
using apache::thrift::transport::TPipe;
using apache::thrift::transport::TTransport;
using apache::thrift::transport::TTransportException;

BOOST_AUTO_TEST_SUITE(TPipeInterruptTest)

// TODO: duplicate the test cases in TSocketInterruptTest for pipes,
// once pipes implement interruptChildren

BOOST_AUTO_TEST_CASE(test_interrupt_before_accept) {
  TPipeServer pipe1("TPipeInterruptTest");
  pipe1.listen();
  pipe1.interrupt();
  BOOST_CHECK_THROW(pipe1.accept(), TTransportException);
}

static void acceptWorker(TPipeServer *pipe) {
  try
  {
    for (;;)
    {
      boost::shared_ptr<TTransport> temp = pipe->accept();
    }
  }
  catch (...) {/*just want to make sure nothing crashes*/ }
}

static void interruptWorker(TPipeServer *pipe) {
  boost::this_thread::sleep(boost::posix_time::milliseconds(10));
  pipe->interrupt();
}

BOOST_AUTO_TEST_CASE(stress_pipe_accept_interruption) {
  int interruptIters = 10;

  for (int i = 0; i < interruptIters; ++i)
  {
    TPipeServer pipeServer("TPipeInterruptTest");
    pipeServer.listen();
    boost::thread acceptThread(boost::bind(acceptWorker, &pipeServer));
    boost::thread interruptThread(boost::bind(interruptWorker, &pipeServer));
    try
    {
      for (;;)
      {
        TPipe client("TPipeInterruptTest");
        client.setConnTimeout(1);
        client.open();
      }
    } catch (...) { /*just testing for crashes*/ }
    interruptThread.join();
    acceptThread.join();
  }
}

BOOST_AUTO_TEST_SUITE_END()
#endif
