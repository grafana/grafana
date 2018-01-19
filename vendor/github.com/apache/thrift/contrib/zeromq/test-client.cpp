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
  const char* endpoint = "tcp://127.0.0.1:9090";
  int socktype = ZMQ_REQ;
  int incr = 0;
  if (argc > 1) {
    incr = atoi(argv[1]);
    if (incr) {
      socktype = ZMQ_DOWNSTREAM;
      endpoint = "tcp://127.0.0.1:9091";
    }
  }

  zmq::context_t ctx(1);
  shared_ptr<TZmqClient> transport(new TZmqClient(ctx, endpoint, socktype));
  shared_ptr<TBinaryProtocol> protocol(new TBinaryProtocol(transport));
  StorageClient client(protocol);
  transport->open();

  if (incr) {
    client.incr(incr);
    usleep(50000);
  } else {
    int value = client.get();
    std::cout << value << std::endl;
  }

  return 0;
}
