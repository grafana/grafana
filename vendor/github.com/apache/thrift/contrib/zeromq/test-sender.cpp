#include <iostream>
#include <cstdlib>
#include <thrift/protocol/TBinaryProtocol.h>

#include "zmq.hpp"
#include "TZmqClient.h"
#include "Storage.h"

using boost::shared_ptr;
using apache::thrift::transport::TZmqClient;
using apache::thrift::protocol::TBinaryProtocol;

int main(int argc, char** argv) {
  const char* endpoint = "epgm://eth0;239.192.1.1:5555";
  int socktype = ZMQ_PUB;
  int incr = 1;
  if (argc > 1) {
    incr = atoi(argv[1]);
  }

  zmq::context_t ctx(1);
  shared_ptr<TZmqClient> transport(new TZmqClient(ctx, endpoint, socktype));
  shared_ptr<TBinaryProtocol> protocol(new TBinaryProtocol(transport));
  StorageClient client(protocol);

  transport->open();

  client.incr(incr);
  usleep(50000);

  return 0;
}
