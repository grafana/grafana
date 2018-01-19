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

#include <thrift/concurrency/ThreadManager.h>
#include <thrift/concurrency/PlatformThreadFactory.h>
#include <thrift/concurrency/Monitor.h>
#include <thrift/concurrency/Util.h>
#include <thrift/concurrency/Mutex.h>
#include <thrift/protocol/TBinaryProtocol.h>
#include <thrift/server/TSimpleServer.h>
#include <thrift/server/TThreadPoolServer.h>
#include <thrift/server/TThreadedServer.h>
#include <thrift/server/TNonblockingServer.h>
#include <thrift/transport/TServerSocket.h>
#include <thrift/transport/TSocket.h>
#include <thrift/transport/TTransportUtils.h>
#include <thrift/transport/TFileTransport.h>
#include <thrift/TLogging.h>

#include "Service.h"

#include <boost/shared_ptr.hpp>

#include <iostream>
#include <set>
#include <stdexcept>
#include <sstream>
#include <map>
#if _WIN32
#include <thrift/windows/TWinsockSingleton.h>
#endif

using namespace std;

using namespace apache::thrift;
using namespace apache::thrift::protocol;
using namespace apache::thrift::transport;
using namespace apache::thrift::server;
using namespace apache::thrift::concurrency;

using namespace test::stress;

struct eqstr {
  bool operator()(const char* s1, const char* s2) const { return strcmp(s1, s2) == 0; }
};

struct ltstr {
  bool operator()(const char* s1, const char* s2) const { return strcmp(s1, s2) < 0; }
};

// typedef hash_map<const char*, int, hash<const char*>, eqstr> count_map;
typedef map<const char*, int, ltstr> count_map;

class Server : public ServiceIf {
public:
  Server() {}

  void count(const char* method) {
    Guard m(lock_);
    int ct = counts_[method];
    counts_[method] = ++ct;
  }

  void echoVoid() {
    count("echoVoid");
    // Sleep to simulate work
    THRIFT_SLEEP_USEC(1);
    return;
  }

  count_map getCount() {
    Guard m(lock_);
    return counts_;
  }

  int8_t echoByte(const int8_t arg) { return arg; }
  int32_t echoI32(const int32_t arg) { return arg; }
  int64_t echoI64(const int64_t arg) { return arg; }
  void echoString(string& out, const string& arg) {
    if (arg != "hello") {
      T_ERROR_ABORT("WRONG STRING (%s)!!!!", arg.c_str());
    }
    out = arg;
  }
  void echoList(vector<int8_t>& out, const vector<int8_t>& arg) { out = arg; }
  void echoSet(set<int8_t>& out, const set<int8_t>& arg) { out = arg; }
  void echoMap(map<int8_t, int8_t>& out, const map<int8_t, int8_t>& arg) { out = arg; }

private:
  count_map counts_;
  Mutex lock_;
};

class ClientThread : public Runnable {
public:
  ClientThread(boost::shared_ptr<TTransport> transport,
               boost::shared_ptr<ServiceClient> client,
               Monitor& monitor,
               size_t& workerCount,
               size_t loopCount,
               TType loopType)
    : _transport(transport),
      _client(client),
      _monitor(monitor),
      _workerCount(workerCount),
      _loopCount(loopCount),
      _loopType(loopType) {}

  void run() {

    // Wait for all worker threads to start

    {
      Synchronized s(_monitor);
      while (_workerCount == 0) {
        _monitor.wait();
      }
    }

    _startTime = Util::currentTime();

    _transport->open();

    switch (_loopType) {
    case T_VOID:
      loopEchoVoid();
      break;
    case T_BYTE:
      loopEchoByte();
      break;
    case T_I32:
      loopEchoI32();
      break;
    case T_I64:
      loopEchoI64();
      break;
    case T_STRING:
      loopEchoString();
      break;
    default:
      cerr << "Unexpected loop type" << _loopType << endl;
      break;
    }

    _endTime = Util::currentTime();

    _transport->close();

    _done = true;

    {
      Synchronized s(_monitor);

      _workerCount--;

      if (_workerCount == 0) {

        _monitor.notify();
      }
    }
  }

  void loopEchoVoid() {
    for (size_t ix = 0; ix < _loopCount; ix++) {
      _client->echoVoid();
    }
  }

  void loopEchoByte() {
    for (size_t ix = 0; ix < _loopCount; ix++) {
      int8_t arg = 1;
      int8_t result;
      result = _client->echoByte(arg);
      (void)result;
      assert(result == arg);
    }
  }

  void loopEchoI32() {
    for (size_t ix = 0; ix < _loopCount; ix++) {
      int32_t arg = 1;
      int32_t result;
      result = _client->echoI32(arg);
      (void)result;
      assert(result == arg);
    }
  }

  void loopEchoI64() {
    for (size_t ix = 0; ix < _loopCount; ix++) {
      int64_t arg = 1;
      int64_t result;
      result = _client->echoI64(arg);
      (void)result;
      assert(result == arg);
    }
  }

  void loopEchoString() {
    for (size_t ix = 0; ix < _loopCount; ix++) {
      string arg = "hello";
      string result;
      _client->echoString(result, arg);
      assert(result == arg);
    }
  }

  boost::shared_ptr<TTransport> _transport;
  boost::shared_ptr<ServiceClient> _client;
  Monitor& _monitor;
  size_t& _workerCount;
  size_t _loopCount;
  TType _loopType;
  int64_t _startTime;
  int64_t _endTime;
  bool _done;
  Monitor _sleep;
};

int main(int argc, char** argv) {
#if _WIN32
  transport::TWinsockSingleton::create();
#endif

  int port = 9091;
  string serverType = "simple";
  string protocolType = "binary";
  uint32_t workerCount = 4;
  uint32_t clientCount = 20;
  uint32_t loopCount = 1000;
  TType loopType = T_VOID;
  string callName = "echoVoid";
  bool runServer = true;
  bool logRequests = false;
  string requestLogPath = "./requestlog.tlog";
  bool replayRequests = false;

  ostringstream usage;

  usage << argv[0] << " [--port=<port number>] [--server] [--server-type=<server-type>] "
                      "[--protocol-type=<protocol-type>] [--workers=<worker-count>] "
                      "[--clients=<client-count>] [--loop=<loop-count>]" << endl
        << "\tclients        Number of client threads to create - 0 implies no clients, i.e. "
           "server only.  Default is " << clientCount << endl
        << "\thelp           Prints this help text." << endl
        << "\tcall           Service method to call.  Default is " << callName << endl
        << "\tloop           The number of remote thrift calls each client makes.  Default is "
        << loopCount << endl << "\tport           The port the server and clients should bind to "
                                "for thrift network connections.  Default is " << port << endl
        << "\tserver         Run the Thrift server in this process.  Default is " << runServer
        << endl << "\tserver-type    Type of server, \"simple\" or \"thread-pool\".  Default is "
        << serverType << endl
        << "\tprotocol-type  Type of protocol, \"binary\", \"ascii\", or \"xml\".  Default is "
        << protocolType << endl
        << "\tlog-request    Log all request to ./requestlog.tlog. Default is " << logRequests
        << endl << "\treplay-request Replay requests from log file (./requestlog.tlog) Default is "
        << replayRequests << endl << "\tworkers        Number of thread pools workers.  Only valid "
                                     "for thread-pool server type.  Default is " << workerCount
        << endl;

  map<string, string> args;

  for (int ix = 1; ix < argc; ix++) {

    string arg(argv[ix]);

    if (arg.compare(0, 2, "--") == 0) {

      size_t end = arg.find_first_of("=", 2);

      string key = string(arg, 2, end - 2);

      if (end != string::npos) {
        args[key] = string(arg, end + 1);
      } else {
        args[key] = "true";
      }
    } else {
      throw invalid_argument("Unexcepted command line token: " + arg);
    }
  }

  try {

    if (!args["clients"].empty()) {
      clientCount = atoi(args["clients"].c_str());
    }

    if (!args["help"].empty()) {
      cerr << usage.str();
      return 0;
    }

    if (!args["loop"].empty()) {
      loopCount = atoi(args["loop"].c_str());
    }

    if (!args["call"].empty()) {
      callName = args["call"];
    }

    if (!args["port"].empty()) {
      port = atoi(args["port"].c_str());
    }

    if (!args["server"].empty()) {
      runServer = args["server"] == "true";
    }

    if (!args["log-request"].empty()) {
      logRequests = args["log-request"] == "true";
    }

    if (!args["replay-request"].empty()) {
      replayRequests = args["replay-request"] == "true";
    }

    if (!args["server-type"].empty()) {
      serverType = args["server-type"];
    }

    if (!args["workers"].empty()) {
      workerCount = atoi(args["workers"].c_str());
    }

  } catch (std::exception& e) {
    cerr << e.what() << endl;
    cerr << usage.str();
  }

  boost::shared_ptr<PlatformThreadFactory> threadFactory
      = boost::shared_ptr<PlatformThreadFactory>(new PlatformThreadFactory());

  // Dispatcher
  boost::shared_ptr<Server> serviceHandler(new Server());

  if (replayRequests) {
    boost::shared_ptr<Server> serviceHandler(new Server());
    boost::shared_ptr<ServiceProcessor> serviceProcessor(new ServiceProcessor(serviceHandler));

    // Transports
    boost::shared_ptr<TFileTransport> fileTransport(new TFileTransport(requestLogPath));
    fileTransport->setChunkSize(2 * 1024 * 1024);
    fileTransport->setMaxEventSize(1024 * 16);
    fileTransport->seekToEnd();

    // Protocol Factory
    boost::shared_ptr<TProtocolFactory> protocolFactory(new TBinaryProtocolFactory());

    TFileProcessor fileProcessor(serviceProcessor, protocolFactory, fileTransport);

    fileProcessor.process(0, true);
    exit(0);
  }

  if (runServer) {

    boost::shared_ptr<ServiceProcessor> serviceProcessor(new ServiceProcessor(serviceHandler));

    // Protocol Factory
    boost::shared_ptr<TProtocolFactory> protocolFactory(new TBinaryProtocolFactory());

    // Transport Factory
    boost::shared_ptr<TTransportFactory> transportFactory;

    if (logRequests) {
      // initialize the log file
      boost::shared_ptr<TFileTransport> fileTransport(new TFileTransport(requestLogPath));
      fileTransport->setChunkSize(2 * 1024 * 1024);
      fileTransport->setMaxEventSize(1024 * 16);

      transportFactory
          = boost::shared_ptr<TTransportFactory>(new TPipedTransportFactory(fileTransport));
    }

    boost::shared_ptr<Thread> serverThread;
    boost::shared_ptr<Thread> serverThread2;

    if (serverType == "simple") {

      serverThread = threadFactory->newThread(boost::shared_ptr<TServer>(
          new TNonblockingServer(serviceProcessor, protocolFactory, port)));
      serverThread2 = threadFactory->newThread(boost::shared_ptr<TServer>(
          new TNonblockingServer(serviceProcessor, protocolFactory, port + 1)));

    } else if (serverType == "thread-pool") {

      boost::shared_ptr<ThreadManager> threadManager
          = ThreadManager::newSimpleThreadManager(workerCount);

      threadManager->threadFactory(threadFactory);
      threadManager->start();
      serverThread = threadFactory->newThread(boost::shared_ptr<TServer>(
          new TNonblockingServer(serviceProcessor, protocolFactory, port, threadManager)));
      serverThread2 = threadFactory->newThread(boost::shared_ptr<TServer>(
          new TNonblockingServer(serviceProcessor, protocolFactory, port + 1, threadManager)));
    }

    cerr << "Starting the server on port " << port << " and " << (port + 1) << endl;
    serverThread->start();
    serverThread2->start();

    // If we aren't running clients, just wait forever for external clients

    if (clientCount == 0) {
      serverThread->join();
      serverThread2->join();
    }
  }
  THRIFT_SLEEP_SEC(1);

  if (clientCount > 0) {

    Monitor monitor;

    size_t threadCount = 0;

    set<boost::shared_ptr<Thread> > clientThreads;

    if (callName == "echoVoid") {
      loopType = T_VOID;
    } else if (callName == "echoByte") {
      loopType = T_BYTE;
    } else if (callName == "echoI32") {
      loopType = T_I32;
    } else if (callName == "echoI64") {
      loopType = T_I64;
    } else if (callName == "echoString") {
      loopType = T_STRING;
    } else {
      throw invalid_argument("Unknown service call " + callName);
    }

    for (uint32_t ix = 0; ix < clientCount; ix++) {

      boost::shared_ptr<TSocket> socket(new TSocket("127.0.0.1", port + (ix % 2)));
      boost::shared_ptr<TFramedTransport> framedSocket(new TFramedTransport(socket));
      boost::shared_ptr<TProtocol> protocol(new TBinaryProtocol(framedSocket));
      boost::shared_ptr<ServiceClient> serviceClient(new ServiceClient(protocol));

      clientThreads.insert(threadFactory->newThread(boost::shared_ptr<ClientThread>(
          new ClientThread(socket, serviceClient, monitor, threadCount, loopCount, loopType))));
    }

    for (std::set<boost::shared_ptr<Thread> >::const_iterator thread = clientThreads.begin();
         thread != clientThreads.end();
         thread++) {
      (*thread)->start();
    }

    int64_t time00;
    int64_t time01;

    {
      Synchronized s(monitor);
      threadCount = clientCount;

      cerr << "Launch " << clientCount << " client threads" << endl;

      time00 = Util::currentTime();

      monitor.notifyAll();

      while (threadCount > 0) {
        monitor.wait();
      }

      time01 = Util::currentTime();
    }

    int64_t firstTime = 9223372036854775807LL;
    int64_t lastTime = 0;

    double averageTime = 0;
    int64_t minTime = 9223372036854775807LL;
    int64_t maxTime = 0;

    for (set<boost::shared_ptr<Thread> >::iterator ix = clientThreads.begin();
         ix != clientThreads.end();
         ix++) {

      boost::shared_ptr<ClientThread> client
          = boost::dynamic_pointer_cast<ClientThread>((*ix)->runnable());

      int64_t delta = client->_endTime - client->_startTime;

      assert(delta > 0);

      if (client->_startTime < firstTime) {
        firstTime = client->_startTime;
      }

      if (client->_endTime > lastTime) {
        lastTime = client->_endTime;
      }

      if (delta < minTime) {
        minTime = delta;
      }

      if (delta > maxTime) {
        maxTime = delta;
      }

      averageTime += delta;
    }

    averageTime /= clientCount;

    cout << "workers :" << workerCount << ", client : " << clientCount << ", loops : " << loopCount
         << ", rate : " << (clientCount * loopCount * 1000) / ((double)(time01 - time00)) << endl;

    count_map count = serviceHandler->getCount();
    count_map::iterator iter;
    for (iter = count.begin(); iter != count.end(); ++iter) {
      printf("%s => %d\n", iter->first, iter->second);
    }
    cerr << "done." << endl;
  }

  return 0;
}
