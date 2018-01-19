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

#include <boost/test/auto_unit_test.hpp>
#include <boost/test/unit_test_suite.hpp>
#include <boost/bind.hpp>
#include <boost/chrono/duration.hpp>
#include <boost/date_time/posix_time/posix_time_duration.hpp>
#include <boost/thread/thread.hpp>
#include <boost/filesystem.hpp>
#include <boost/format.hpp>
#include <boost/shared_ptr.hpp>
#include <thrift/transport/TSSLSocket.h>
#include <thrift/transport/TSSLServerSocket.h>
#ifdef __linux__
#include <signal.h>
#endif

using apache::thrift::transport::TSSLServerSocket;
using apache::thrift::transport::TSSLSocket;
using apache::thrift::transport::TTransport;
using apache::thrift::transport::TTransportException;
using apache::thrift::transport::TSSLSocketFactory;

BOOST_AUTO_TEST_SUITE(TSSLSocketInterruptTest)

boost::filesystem::path keyDir;
boost::filesystem::path certFile(const std::string& filename)
{
  return keyDir / filename;
}
boost::mutex gMutex;

struct GlobalFixtureSSL
{
    GlobalFixtureSSL()
    {
      using namespace boost::unit_test::framework;
      for (int i = 0; i < master_test_suite().argc; ++i)
      {
        BOOST_TEST_MESSAGE(boost::format("argv[%1%] = \"%2%\"") % i % master_test_suite().argv[i]);
      }

#ifdef __linux__
      // OpenSSL calls send() without MSG_NOSIGPIPE so writing to a socket that has
      // disconnected can cause a SIGPIPE signal...
      signal(SIGPIPE, SIG_IGN);
#endif

      TSSLSocketFactory::setManualOpenSSLInitialization(true);
      apache::thrift::transport::initializeOpenSSL();

      keyDir = boost::filesystem::current_path().parent_path().parent_path().parent_path() / "test" / "keys";
      if (!boost::filesystem::exists(certFile("server.crt")))
      {
        keyDir = boost::filesystem::path(master_test_suite().argv[master_test_suite().argc - 1]);
        if (!boost::filesystem::exists(certFile("server.crt")))
        {
          throw std::invalid_argument("The last argument to this test must be the directory containing the test certificate(s).");
        }
      }
    }

    virtual ~GlobalFixtureSSL()
    {
      apache::thrift::transport::cleanupOpenSSL();
#ifdef __linux__
      signal(SIGPIPE, SIG_DFL);
#endif
    }
};

#if (BOOST_VERSION >= 105900)
BOOST_GLOBAL_FIXTURE(GlobalFixtureSSL);
#else
BOOST_GLOBAL_FIXTURE(GlobalFixtureSSL)
#endif

void readerWorker(boost::shared_ptr<TTransport> tt, uint32_t expectedResult) {
  uint8_t buf[4];
  try {
    tt->read(buf, 1);
    BOOST_CHECK_EQUAL(expectedResult, tt->read(buf, 4));
  } catch (const TTransportException& tx) {
    BOOST_CHECK_EQUAL(TTransportException::TIMED_OUT, tx.getType());
  }
}

void readerWorkerMustThrow(boost::shared_ptr<TTransport> tt) {
  try {
    uint8_t buf[400];
    tt->read(buf, 1);
    tt->read(buf, 400);
    BOOST_ERROR("should not have gotten here");
  } catch (const TTransportException& tx) {
    BOOST_CHECK_EQUAL(TTransportException::INTERRUPTED, tx.getType());
  }
}

boost::shared_ptr<TSSLSocketFactory> createServerSocketFactory() {
  boost::shared_ptr<TSSLSocketFactory> pServerSocketFactory;

  pServerSocketFactory.reset(new TSSLSocketFactory());
  pServerSocketFactory->ciphers("ALL:!ADH:!LOW:!EXP:!MD5:@STRENGTH");
  pServerSocketFactory->loadCertificate(certFile("server.crt").string().c_str());
  pServerSocketFactory->loadPrivateKey(certFile("server.key").string().c_str());
  pServerSocketFactory->server(true);
  return pServerSocketFactory;
}

boost::shared_ptr<TSSLSocketFactory> createClientSocketFactory() {
  boost::shared_ptr<TSSLSocketFactory> pClientSocketFactory;

  pClientSocketFactory.reset(new TSSLSocketFactory());
  pClientSocketFactory->authenticate(true);
  pClientSocketFactory->loadCertificate(certFile("client.crt").string().c_str());
  pClientSocketFactory->loadPrivateKey(certFile("client.key").string().c_str());
  pClientSocketFactory->loadTrustedCertificates(certFile("CA.pem").string().c_str());
  return pClientSocketFactory;
}

BOOST_AUTO_TEST_CASE(test_ssl_interruptable_child_read_while_handshaking) {
  boost::shared_ptr<TSSLSocketFactory> pServerSocketFactory = createServerSocketFactory();
  TSSLServerSocket sock1("localhost", 0, pServerSocketFactory);
  sock1.listen();
  int port = sock1.getPort();
  boost::shared_ptr<TSSLSocketFactory> pClientSocketFactory = createClientSocketFactory();
  boost::shared_ptr<TSSLSocket> clientSock = pClientSocketFactory->createSocket("localhost", port);
  clientSock->open();
  boost::shared_ptr<TTransport> accepted = sock1.accept();
  boost::thread readThread(boost::bind(readerWorkerMustThrow, accepted));
  boost::this_thread::sleep(boost::posix_time::milliseconds(50));
  // readThread is practically guaranteed to be blocking now
  sock1.interruptChildren();
  BOOST_CHECK_MESSAGE(readThread.try_join_for(boost::chrono::milliseconds(20)),
  "server socket interruptChildren did not interrupt child read");
  clientSock->close();
  accepted->close();
  sock1.close();
}

BOOST_AUTO_TEST_CASE(test_ssl_interruptable_child_read) {
  boost::shared_ptr<TSSLSocketFactory> pServerSocketFactory = createServerSocketFactory();
  TSSLServerSocket sock1("localhost", 0, pServerSocketFactory);
  sock1.listen();
  int port = sock1.getPort();
  boost::shared_ptr<TSSLSocketFactory> pClientSocketFactory = createClientSocketFactory();
  boost::shared_ptr<TSSLSocket> clientSock = pClientSocketFactory->createSocket("localhost", port);
  clientSock->open();
  boost::shared_ptr<TTransport> accepted = sock1.accept();
  boost::thread readThread(boost::bind(readerWorkerMustThrow, accepted));
  clientSock->write((const uint8_t*)"0", 1);
  boost::this_thread::sleep(boost::posix_time::milliseconds(50));
  // readThread is practically guaranteed to be blocking now
  sock1.interruptChildren();
  BOOST_CHECK_MESSAGE(readThread.try_join_for(boost::chrono::milliseconds(20)),
                      "server socket interruptChildren did not interrupt child read");
  accepted->close();
  clientSock->close();
  sock1.close();
}

BOOST_AUTO_TEST_CASE(test_ssl_non_interruptable_child_read) {
  boost::shared_ptr<TSSLSocketFactory> pServerSocketFactory = createServerSocketFactory();
  TSSLServerSocket sock1("localhost", 0, pServerSocketFactory);
  sock1.setInterruptableChildren(false); // returns to pre-THRIFT-2441 behavior
  sock1.listen();
  int port = sock1.getPort();
  boost::shared_ptr<TSSLSocketFactory> pClientSocketFactory = createClientSocketFactory();
  boost::shared_ptr<TSSLSocket> clientSock = pClientSocketFactory->createSocket("localhost", port);
  clientSock->open();
  boost::shared_ptr<TTransport> accepted = sock1.accept();
  boost::static_pointer_cast<TSSLSocket>(accepted)->setRecvTimeout(1000);
  boost::thread readThread(boost::bind(readerWorker, accepted, 0));
  clientSock->write((const uint8_t*)"0", 1);
  boost::this_thread::sleep(boost::posix_time::milliseconds(50));
  // readThread is practically guaranteed to be blocking here
  sock1.interruptChildren();
  BOOST_CHECK_MESSAGE(!readThread.try_join_for(boost::chrono::milliseconds(200)),
                      "server socket interruptChildren interrupted child read");

  // wait for receive timeout to kick in
  readThread.join();
  accepted->close();
  clientSock->close();
  sock1.close();
}

BOOST_AUTO_TEST_CASE(test_ssl_cannot_change_after_listen) {
  boost::shared_ptr<TSSLSocketFactory> pServerSocketFactory = createServerSocketFactory();
  TSSLServerSocket sock1("localhost", 0, pServerSocketFactory);
  sock1.listen();
  BOOST_CHECK_THROW(sock1.setInterruptableChildren(false), std::logic_error);
  sock1.close();
}

void peekerWorker(boost::shared_ptr<TTransport> tt, bool expectedResult) {
  uint8_t buf[400];
  try {
    tt->read(buf, 1);
    tt->peek();
  } catch (const TTransportException& tx) {
    BOOST_CHECK_EQUAL(TTransportException::TIMED_OUT, tx.getType());
  }
}

void peekerWorkerInterrupt(boost::shared_ptr<TTransport> tt) {
  uint8_t buf[400];
  try {
    tt->read(buf, 1);
    tt->peek();
  } catch (const TTransportException& tx) {
    BOOST_CHECK_EQUAL(TTransportException::INTERRUPTED, tx.getType());
  }
}

BOOST_AUTO_TEST_CASE(test_ssl_interruptable_child_peek) {
  boost::shared_ptr<TSSLSocketFactory> pServerSocketFactory = createServerSocketFactory();
  TSSLServerSocket sock1("localhost", 0, pServerSocketFactory);
  sock1.listen();
  int port = sock1.getPort();
  boost::shared_ptr<TSSLSocketFactory> pClientSocketFactory = createClientSocketFactory();
  boost::shared_ptr<TSSLSocket> clientSock = pClientSocketFactory->createSocket("localhost", port);
  clientSock->open();
  boost::shared_ptr<TTransport> accepted = sock1.accept();
  boost::thread peekThread(boost::bind(peekerWorkerInterrupt, accepted));
  clientSock->write((const uint8_t*)"0", 1);
  boost::this_thread::sleep(boost::posix_time::milliseconds(50));
  // peekThread is practically guaranteed to be blocking now
  sock1.interruptChildren();
  BOOST_CHECK_MESSAGE(peekThread.try_join_for(boost::chrono::milliseconds(200)),
                      "server socket interruptChildren did not interrupt child peek");
  accepted->close();
  clientSock->close();
  sock1.close();
}

BOOST_AUTO_TEST_CASE(test_ssl_non_interruptable_child_peek) {
  boost::shared_ptr<TSSLSocketFactory> pServerSocketFactory = createServerSocketFactory();
  TSSLServerSocket sock1("localhost", 0, pServerSocketFactory);
  sock1.setInterruptableChildren(false); // returns to pre-THRIFT-2441 behavior
  sock1.listen();
  int port = sock1.getPort();
  boost::shared_ptr<TSSLSocketFactory> pClientSocketFactory = createClientSocketFactory();
  boost::shared_ptr<TSSLSocket> clientSock = pClientSocketFactory->createSocket("localhost", port);
  clientSock->open();
  boost::shared_ptr<TTransport> accepted = sock1.accept();
  boost::static_pointer_cast<TSSLSocket>(accepted)->setRecvTimeout(1000);
  boost::thread peekThread(boost::bind(peekerWorker, accepted, false));
  clientSock->write((const uint8_t*)"0", 1);
  boost::this_thread::sleep(boost::posix_time::milliseconds(50));
  // peekThread is practically guaranteed to be blocking now
  sock1.interruptChildren();
  BOOST_CHECK_MESSAGE(!peekThread.try_join_for(boost::chrono::milliseconds(200)),
                      "server socket interruptChildren interrupted child peek");

  // wait for the receive timeout to kick in
  peekThread.join();
  accepted->close();
  clientSock->close();
  sock1.close();
}

BOOST_AUTO_TEST_SUITE_END()
