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

#define BOOST_TEST_MODULE SecurityTest
#include <boost/test/unit_test.hpp>
#include <boost/bind.hpp>
#include <boost/filesystem.hpp>
#include <boost/foreach.hpp>
#include <boost/format.hpp>
#include <boost/make_shared.hpp>
#include <boost/shared_ptr.hpp>
#include <boost/thread.hpp>
#include <thrift/transport/TSSLServerSocket.h>
#include <thrift/transport/TSSLSocket.h>
#include <thrift/transport/TTransport.h>
#include <vector>
#ifdef __linux__
#include <signal.h>
#endif

using apache::thrift::transport::TSSLServerSocket;
using apache::thrift::transport::TServerTransport;
using apache::thrift::transport::TSSLSocket;
using apache::thrift::transport::TSSLSocketFactory;
using apache::thrift::transport::TTransport;
using apache::thrift::transport::TTransportException;
using apache::thrift::transport::TTransportFactory;

boost::filesystem::path keyDir;
boost::filesystem::path certFile(const std::string& filename)
{
    return keyDir / filename;
}
boost::mutex gMutex;

struct GlobalFixture
{
    GlobalFixture()
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

    virtual ~GlobalFixture()
    {
		apache::thrift::transport::cleanupOpenSSL();
#ifdef __linux__
		signal(SIGPIPE, SIG_DFL);
#endif
    }
};

#if (BOOST_VERSION >= 105900)
BOOST_GLOBAL_FIXTURE(GlobalFixture);
#else
BOOST_GLOBAL_FIXTURE(GlobalFixture)
#endif

struct SecurityFixture
{
    void server(apache::thrift::transport::SSLProtocol protocol)
    {
        try
        {
            boost::mutex::scoped_lock lock(mMutex);

            boost::shared_ptr<TSSLSocketFactory> pServerSocketFactory;
            boost::shared_ptr<TSSLServerSocket> pServerSocket;

            pServerSocketFactory.reset(new TSSLSocketFactory(static_cast<apache::thrift::transport::SSLProtocol>(protocol)));
            pServerSocketFactory->ciphers("ALL:!ADH:!LOW:!EXP:!MD5:@STRENGTH");
            pServerSocketFactory->loadCertificate(certFile("server.crt").string().c_str());
            pServerSocketFactory->loadPrivateKey(certFile("server.key").string().c_str());
            pServerSocketFactory->server(true);
            pServerSocket.reset(new TSSLServerSocket("localhost", 0, pServerSocketFactory));
            boost::shared_ptr<TTransport> connectedClient;

            try
            {
                pServerSocket->listen();
                mPort = pServerSocket->getPort();
                mCVar.notify_one();
                lock.unlock();

                connectedClient = pServerSocket->accept();
                uint8_t buf[2];
                buf[0] = 'O';
                buf[1] = 'K';
                connectedClient->write(&buf[0], 2);
                connectedClient->flush();
            }

            catch (apache::thrift::transport::TTransportException& ex)
            {
                boost::mutex::scoped_lock lock(gMutex);
                BOOST_TEST_MESSAGE(boost::format("SRV %1% Exception: %2%") % boost::this_thread::get_id() % ex.what());
            }

            if (connectedClient)
            {
                connectedClient->close();
                connectedClient.reset();
            }

            pServerSocket->close();
            pServerSocket.reset();
        }
        catch (std::exception& ex)
        {
            BOOST_FAIL(boost::format("%1%: %2%") % typeid(ex).name() % ex.what());
        }
    }

    void client(apache::thrift::transport::SSLProtocol protocol)
    {
        try
        {
            boost::shared_ptr<TSSLSocketFactory> pClientSocketFactory;
            boost::shared_ptr<TSSLSocket> pClientSocket;

            try
            {
                pClientSocketFactory.reset(new TSSLSocketFactory(static_cast<apache::thrift::transport::SSLProtocol>(protocol)));
                pClientSocketFactory->authenticate(true);
                pClientSocketFactory->loadCertificate(certFile("client.crt").string().c_str());
                pClientSocketFactory->loadPrivateKey(certFile("client.key").string().c_str());
                pClientSocketFactory->loadTrustedCertificates(certFile("CA.pem").string().c_str());
                pClientSocket = pClientSocketFactory->createSocket("localhost", mPort);
                pClientSocket->open();

                uint8_t buf[3];
                buf[0] = 0;
                buf[1] = 0;
                BOOST_CHECK_EQUAL(2, pClientSocket->read(&buf[0], 2));
                BOOST_CHECK_EQUAL(0, memcmp(&buf[0], "OK", 2));
                mConnected = true;
            }
            catch (apache::thrift::transport::TTransportException& ex)
            {
                boost::mutex::scoped_lock lock(gMutex);
                BOOST_TEST_MESSAGE(boost::format("CLI %1% Exception: %2%") % boost::this_thread::get_id() % ex.what());
            }

            if (pClientSocket)
            {
                pClientSocket->close();
                pClientSocket.reset();
            }
        }
        catch (std::exception& ex)
        {
            BOOST_FAIL(boost::format("%1%: %2%") % typeid(ex).name() % ex.what());
        }
    }

    static const char *protocol2str(size_t protocol)
    {
        static const char *strings[apache::thrift::transport::LATEST + 1] =
        {
                "SSLTLS",
                "SSLv2",
                "SSLv3",
                "TLSv1_0",
                "TLSv1_1",
                "TLSv1_2"
        };
        return strings[protocol];
    }

    boost::mutex mMutex;
    boost::condition_variable mCVar;
    int mPort;
    bool mConnected;
};

BOOST_FIXTURE_TEST_SUITE(BOOST_TEST_MODULE, SecurityFixture)

BOOST_AUTO_TEST_CASE(ssl_security_matrix)
{
    try
    {
        // matrix of connection success between client and server with different SSLProtocol selections
        bool matrix[apache::thrift::transport::LATEST + 1][apache::thrift::transport::LATEST + 1] =
        {
    //   server    = SSLTLS   SSLv2    SSLv3    TLSv1_0  TLSv1_1  TLSv1_2
    // client
    /* SSLTLS  */  { true,    false,   false,   true,    true,    true    },
    /* SSLv2   */  { false,   false,   false,   false,   false,   false   },
    /* SSLv3   */  { false,   false,   true,    false,   false,   false   },
    /* TLSv1_0 */  { true,    false,   false,   true,    false,   false   },
    /* TLSv1_1 */  { true,    false,   false,   false,   true,    false   },
    /* TLSv1_2 */  { true,    false,   false,   false,   false,   true    }
        };

        for (size_t si = 0; si <= apache::thrift::transport::LATEST; ++si)
        {
            for (size_t ci = 0; ci <= apache::thrift::transport::LATEST; ++ci)
            {
                if (si == 1 || ci == 1)
                {
                    // Skip all SSLv2 cases - protocol not supported
                    continue;
                }

#ifdef OPENSSL_NO_SSL3
                if (si == 2 || ci == 2)
                {
                    // Skip all SSLv3 cases - protocol not supported
                    continue;
                }
#endif

                boost::mutex::scoped_lock lock(mMutex);

                BOOST_TEST_MESSAGE(boost::format("TEST: Server = %1%, Client = %2%")
                    % protocol2str(si) % protocol2str(ci));

                mConnected = false;
                boost::thread_group threads;
                threads.create_thread(boost::bind(&SecurityFixture::server, this, static_cast<apache::thrift::transport::SSLProtocol>(si)));
                mCVar.wait(lock);           // wait for listen() to succeed
                lock.unlock();
                threads.create_thread(boost::bind(&SecurityFixture::client, this, static_cast<apache::thrift::transport::SSLProtocol>(ci)));
                threads.join_all();

                BOOST_CHECK_MESSAGE(mConnected == matrix[ci][si],
                        boost::format("      Server = %1%, Client = %2% expected mConnected == %3% but was %4%")
                            % protocol2str(si) % protocol2str(ci) % matrix[ci][si] % mConnected);
            }
        }
    }
    catch (std::exception& ex)
    {
        BOOST_FAIL(boost::format("%1%: %2%") % typeid(ex).name() % ex.what());
    }
}

BOOST_AUTO_TEST_SUITE_END()
