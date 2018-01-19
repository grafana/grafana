Thrift C++ Software Library

# License

Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements. See the NOTICE file
distributed with this work for additional information
regarding copyright ownership. The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License. You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied. See the License for the
specific language governing permissions and limitations
under the License.


# Using Thrift with C++

The Thrift C++ libraries are built using the GNU tools. Follow the instructions
in the top-level README.md

In case you do not want to open another README.md file, do this thrift src:

    ./bootstrap.sh
    ./configure (--with-boost=/usr/local)
    make
    sudo make install

Thrift is divided into two libraries.

* libthrift - The core Thrift library contains all the core Thrift code. It requires
  boost shared pointers, pthreads, and librt.

* libthriftnb - This library contains the Thrift nonblocking server, which uses libevent.
  To link this library you will also need to link libevent.

## Linking Against Thrift

After you build and install Thrift the libraries are installed to
/usr/local/lib by default. Make sure this is in your LDPATH.

On Linux, the best way to do this is to ensure that /usr/local/lib is in
your /etc/ld.so.conf and then run /sbin/ldconfig.

Depending upon whether you are linking dynamically or statically and how
your build environment it set up, you may need to include additional
libraries when linking against thrift, such as librt and/or libpthread. If
you are using libthriftnb you will also need libevent.

## Dependencies

boost shared pointers
http://www.boost.org/libs/smart_ptr/smart_ptr.htm

libevent (for libthriftnb only)
http://monkey.org/~provos/libevent/

# Using Thrift with C++ on Windows

You need to define an environment variables for 3rd party components separately:

BOOST_ROOT : For boost, e.g. D:\boost_1_55_0
OPENSSL_ROOT_DIR : For OpenSSL, e.g. D:\OpenSSL-Win32

only required by libthriftnb:

LIBEVENT_ROOT_DIR : For Libevent e.g. D:\libevent-2.0.21-stable

See /3rdparty.user for more details.

Thrift is divided into two libraries.

* libthrift - The core Thrift library contains all the core Thrift code. It requires
  boost shared pointers, pthreads, and librt.

* libthriftnb - This library contains the Thrift nonblocking server, which uses libevent.
  To link this library you will also need to link libevent.

## Linking Against Thrift

You need to link your project that uses thrift against all the thrift
dependencies; in the case of libthrift, boost and for
libthriftnb, libevent.

In the project properties you must also set HAVE_CONFIG_H as force include
the config header: "windows/confg.h"

## Dependencies

boost shared pointers
http://www.boost.org/libs/smart_ptr/smart_ptr.htm

boost thread
http://www.boost.org/doc/libs/release/doc/html/thread.html

libevent (for libthriftnb only)
http://monkey.org/~provos/libevent/

## Notes on boost thread (static vs shared):

By default lib/cpp/windows/force_inc.h defines:

    #define BOOST_ALL_NO_LIB 1
    #define BOOST_THREAD_NO_LIB 1

This has for effect to have the host application linking against Thrift
to have to link with boost thread as a static library.

If you wanted instead to link with boost thread as a shared library,
you'll need to uncomment those two lines, and recompile.

## Windows version compatibility

The Thrift library targets Windows XP for broadest compatbility. A notable
difference is in the Windows-specific implementation of the socket poll
function. To target Vista, Win7 or other versions, comment out the line

    #define TARGET_WIN_XP.

## Named Pipes

Named Pipe transport has been added in the TPipe and TPipeServer classes. This
is currently Windows-only. Named pipe transport for *NIX has not been
implemented. Domain sockets are a better choice for local IPC under non-Windows
OS's. *NIX named pipes only support 1:1 client-server connection.

# Thrift/SSL

## Scope

This SSL only supports blocking mode socket I/O. It can only be used with
TSimpleServer, TThreadedServer, and TThreadPoolServer.

## Implementation

There're two main classes TSSLSocketFactory and TSSLSocket. Instances of
TSSLSocket are always created from TSSLSocketFactory.

PosixSSLThreadFactory creates PosixSSLThread. The only difference from the
PthreadThread type is that it cleanups OpenSSL error queue upon exiting
the thread. Ideally, OpenSSL APIs should only be called from PosixSSLThread.

## How to use SSL APIs

This is for demo. In real code, typically only one TSSLSocketFactory
instance is needed.

    shared_ptr<TSSLSocketFactory> getSSLSocketFactory() {
      shared_ptr<TSSLSocketFactory> factory(new TSSLSocketFactory());
      // client: load trusted certificates
      factory->loadTrustedCertificates("my-trusted-ca-certificates.pem");
      // client: optionally set your own access manager, otherwise,
      //         the default client access manager will be loaded.

      factory->loadCertificate("my-certificate-signed-by-ca.pem");
      factory->loadPrivateKey("my-private-key.pem");
      // server: optionally setup access manager
      // shared_ptr<AccessManager> accessManager(new MyAccessManager);
      // factory->access(accessManager);
      ...
    }


client code sample

    shared_ptr<TSSLSocketFactory> factory = getSSLSocketFactory();
    shared_ptr<TSocket> socket = factory.createSocket(host, port);
    shared_ptr<TBufferedTransport> transport(new TBufferedTransport(socket));
    ...


server code sample

    shared_ptr<TSSLSocketFactory> factory = getSSLSocketFactory();
    shared_ptr<TSSLServerSocket> socket(new TSSLServerSocket(port, factory));
    shared_ptr<TTransportFactory> transportFactory(new TBufferedTransportFactory));
    ...

## AccessManager

AccessManager defines a callback interface. It has three callback methods:

(a) Decision verify(const sockaddr_storage& sa);

(b) Decision verify(const string& host, const char* name, int size);

(c) Decision verify(const sockaddr_storage& sa, const char* data, int size);

After SSL handshake completes, additional checks are conducted. Application
is given the chance to decide whether or not to continue the conversation
with the remote. Application is queried through the above three "verify"
method. They are called at different points of the verification process.

Decisions can be one of ALLOW, DENY, and SKIP. ALLOW and DENY means the
conversation should be continued or disconnected, respectively. ALLOW and
DENY decision stops the verification process. SKIP means there's no decision
based on the given input, continue the verification process.

First, (a) is called with the remote IP. It is called once at the beginning.
"sa" is the IP address of the remote peer.

Then, the certificate of remote peer is loaded. SubjectAltName extensions
are extracted and sent to application for verification. When a DNS
subjectAltName field is extracted, (b) is called. When an IP subjectAltName
field is extracted, (c) is called.

The "host" in (b) is the value from TSocket::getHost() if this is a client
side socket, or TSocket::getPeerHost() if this is a server side socket. The
reason is client side socket initiates the connection. TSocket::getHost()
is the remote host name. On server side, the remote host name is unknown
unless it's retrieved through TSocket::getPeerHost(). Either way, "host"
should be the remote host name. Keep in mind, if TSocket::getPeerHost()
failed, it would return the remote host name in numeric format.

If all subjectAltName extensions were "skipped", the common name field would
be checked. It is sent to application through (c), where "sa" is the remote
IP address. "data" is the IP address extracted from subjectAltName IP
extension, and "size" is the length of the extension data.

If any of the above "verify" methods returned a decision ALLOW or DENY, the
verification process would be stopped.

If any of the above "verify" methods returned SKIP, that decision would be
ignored and the verification process would move on till the last item is
examined. At that point, if there's still no decision, the connection is
terminated.

Thread safety, an access manager should not store state information if it's
to be used by many SSL sockets.

## SIGPIPE signal

Applications running OpenSSL over network connections may crash if SIGPIPE
is not ignored. This happens when they receive a connection reset by remote
peer exception, which somehow triggers a SIGPIPE signal. If not handled,
this signal would kill the application.

## How to run test client/server in SSL mode

The server and client expects the followings from the directory /test/

- keys/server.crt
- keys/server.key
- keys/CA.pem

The file names are hard coded in the source code. You need to create these
certificates before you can run the test code in SSL mode. Make sure at least
one of the followings is included in "keys/server.crt",

- subjectAltName, DNS localhost
- subjectAltName, IP  127.0.0.1
- common name,    localhost

Run within /test/ folder,

         ./cpp/TestServer --ssl &
         ./cpp/TestClient --ssl

If "-h <host>" is used to run client, the above "localhost" in the above
keys/server.crt has to be replaced with that host name.

## TSSLSocketFactory::randomize()

The default implementation of OpenSSLSocketFactory::randomize() simply calls
OpenSSL's RAND_poll() when OpenSSL library is first initialized.

The PRNG seed is key to the application security. This method should be
overridden if it's not strong enough for you.
