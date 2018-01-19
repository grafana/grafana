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
  TZmqServer reqrep_server(processor, ctx, "tcp://0.0.0.0:9090", ZMQ_REP);
  TZmqServer oneway_server(processor, ctx, "tcp://0.0.0.0:9091", ZMQ_UPSTREAM);
  TZmqMultiServer multiserver;
  multiserver.servers().push_back(&reqrep_server);
  multiserver.servers().push_back(&oneway_server);
  multiserver.serveForever();

  return 0;
}
