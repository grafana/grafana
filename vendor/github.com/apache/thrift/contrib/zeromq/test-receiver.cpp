#include "zmq.hpp"
#include "TZmqServer.h"
#include "Storage.h"

using boost::shared_ptr;
using apache::thrift::TProcessor;
using apache::thrift::server::TZmqServer;
using apache::thrift::server::TZmqMultiServer;

class StorageHandler : virtual public StorageIf {
 public:
  StorageHandler()
    : value_(0)
  {}

  void incr(const int32_t amount) {
    value_ += amount;
    printf("value_: %i\n", value_) ;
  }

  int32_t get() {
    return value_;
  }

 private:
  int32_t value_;

};


int main(int argc, char *argv[]) {
  shared_ptr<StorageHandler> handler(new StorageHandler());
  shared_ptr<TProcessor> processor(new StorageProcessor(handler));

  zmq::context_t ctx(1);
  TZmqServer oneway_server(processor, ctx, "epgm://eth0;239.192.1.1:5555", ZMQ_SUB);
  oneway_server.serve();

  return 0;
}
