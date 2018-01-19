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

#include <cstdlib>
#include <iostream>

#include <thrift/transport/TBufferTransports.h>
#include <thrift/transport/TFDTransport.h>
#include <thrift/protocol/TBinaryProtocol.h>
#include <thrift/protocol/TDebugProtocol.h>
#include <thrift/protocol/TProtocolTap.h>

using namespace std;
using boost::shared_ptr;
using namespace apache::thrift::transport;
using namespace apache::thrift::protocol;

void usage() {
  fprintf(stderr,
      "usage: thrift_dump {-b|-f|-s} < input > ouput\n"
      "  -b TBufferedTransport messages\n"
      "  -f TFramedTransport messages\n"
      "  -s Raw structures\n");
  exit(EXIT_FAILURE);
}

int main(int argc, char *argv[]) {
  if (argc != 2) {
    usage();
  }

  shared_ptr<TTransport> stdin_trans(new TFDTransport(STDIN_FILENO));
  shared_ptr<TTransport> itrans;

  if (argv[1] == std::string("-b") || argv[1] == std::string("-s")) {
    itrans.reset(new TBufferedTransport(stdin_trans));
  } else if (argv[1] == std::string("-f")) {
    itrans.reset(new TFramedTransport(stdin_trans));
  } else {
    usage();
  }

  shared_ptr<TProtocol> iprot(new TBinaryProtocol(itrans));
  shared_ptr<TProtocol> oprot(
      new TDebugProtocol(
        shared_ptr<TTransport>(new TBufferedTransport(
          shared_ptr<TTransport>(new TFDTransport(STDOUT_FILENO))))));

  TProtocolTap tap(iprot, oprot);

  try {
    if (argv[1] == std::string("-s")) {
      for (;;) {
        tap.skip(T_STRUCT);
      }
    } else {
      std::string name;
      TMessageType messageType;
      int32_t seqid;
      for (;;) {
        tap.readMessageBegin(name, messageType, seqid);
        tap.skip(T_STRUCT);
        tap.readMessageEnd();
      }
    }
  } catch (TProtocolException exn) {
    cout << "Protocol Exception: " << exn.what() << endl;
  } catch (...) {
    oprot->getTransport()->flush();
  }

  cout << endl;

  return 0;
}
