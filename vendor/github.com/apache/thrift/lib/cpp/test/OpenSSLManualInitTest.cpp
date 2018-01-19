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
// To show that this test actually tests something, you can change
// MANUAL_OPENSSL_INIT to 0 to cause automatic OpenSSL init/cleanup,
// which will cause the test to fail
#define MANUAL_OPENSSL_INIT 1
#ifdef _WIN32
#include <WinSock2.h>
#endif

#include <boost/test/unit_test.hpp>
#include <openssl/evp.h>
#include <thrift/transport/TSSLSocket.h>

using namespace std;
using namespace apache::thrift::transport;

void make_isolated_sslsocketfactory() {
  // Here we create an isolated TSSLSocketFactory to ensure the
  // constructor and destructor of TSSLSocketFactory get run.  Thus
  // without manual initialization normally OpenSSL would be
  // uninitialized after this function.
  TSSLSocketFactory factory;
}

void openssl_init() {
#if MANUAL_OPENSSL_INIT
  TSSLSocketFactory::setManualOpenSSLInitialization(true);
  initializeOpenSSL();
#endif
}

void openssl_cleanup() {
#if MANUAL_OPENSSL_INIT
  cleanupOpenSSL();
#endif
}

void test_openssl_availability() {
  // Check whether Thrift leaves OpenSSL functionality available after
  // the last TSSLSocketFactory is destroyed when manual
  // initialization is set
  openssl_init();
  make_isolated_sslsocketfactory();

  // The following function is one that will fail if OpenSSL is
  // uninitialized.  It might also fail on very old versions of
  // OpenSSL...
  const EVP_MD* md = EVP_get_digestbyname("SHA256");
  BOOST_CHECK(md != NULL);
  openssl_cleanup();
}

#ifdef BOOST_TEST_DYN_LINK
bool init_unit_test_suite() {
  boost::unit_test::test_suite* suite = &boost::unit_test::framework::master_test_suite();
  suite->p_name.value = "OpenSSLManualInit";

  suite->add(BOOST_TEST_CASE(test_openssl_availability));

  return true;
}
 
int main( int argc, char* argv[] ) {
  return ::boost::unit_test::unit_test_main(&init_unit_test_suite,argc,argv);
}
#else
boost::unit_test::test_suite* init_unit_test_suite(int argc, char* argv[]) {
  THRIFT_UNUSED_VARIABLE(argc);
  THRIFT_UNUSED_VARIABLE(argv);
  boost::unit_test::test_suite* suite = &boost::unit_test::framework::master_test_suite();
  suite->p_name.value = "OpenSSLManualInit";

  suite->add(BOOST_TEST_CASE(test_openssl_availability));

  return NULL;
}
#endif