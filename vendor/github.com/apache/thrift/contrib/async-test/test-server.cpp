#include <tr1/functional>
#include <thrift/protocol/TBinaryProtocol.h>
#include <thrift/async/TAsyncProtocolProcessor.h>
#include <thrift/async/TEvhttpServer.h>
#include <thrift/async/TEvhttpClientChannel.h>
#include "Aggr.h"

using std::tr1::bind;
using std::tr1::placeholders::_1;

using apache::thrift::TException;
using apache::thrift::protocol::TBinaryProtocolFactory;
using apache::thrift::protocol::TProtocolFactory;
using apache::thrift::async::TEvhttpServer;
using apache::thrift::async::TAsyncProcessor;
using apache::thrift::async::TAsyncBufferProcessor;
using apache::thrift::async::TAsyncProtocolProcessor;
using apache::thrift::async::TAsyncChannel;
using apache::thrift::async::TEvhttpClientChannel;

class AggrAsyncHandler : public AggrCobSvIf {
 protected:
  struct RequestContext {
    std::tr1::function<void(std::vector<int32_t> const& _return)> cob;
    std::vector<int32_t> ret;
    int pending_calls;
  };

 public:
  AggrAsyncHandler()
    : eb_(NULL)
    , pfact_(new TBinaryProtocolFactory())
  {
    leaf_ports_.push_back(8081);
    leaf_ports_.push_back(8082);
  }

  void addValue(std::tr1::function<void()> cob, const int32_t value) {
    // Silently drop writes to the aggrgator.
    return cob();
  }

  void getValues(std::tr1::function<void(
        std::vector<int32_t> const& _return)> cob,
      std::tr1::function<void(::apache::thrift::TDelayedException* _throw)> exn_cob) {
    RequestContext* ctx = new RequestContext();
    ctx->cob = cob;
    ctx->pending_calls = leaf_ports_.size();
    for (std::vector<int>::iterator it = leaf_ports_.begin();
        it != leaf_ports_.end(); ++it) {
      boost::shared_ptr<TAsyncChannel> channel(
          new TEvhttpClientChannel(
            "localhost", "/", "127.0.0.1", *it, eb_));
      AggrCobClient* client = new AggrCobClient(channel, pfact_.get());
      client->getValues(std::tr1::bind(&AggrAsyncHandler::clientReturn, this, ctx, _1));
    }
  }

  void setEventBase(struct event_base* eb) {
    eb_ = eb;
  }

  void clientReturn(RequestContext* ctx, AggrCobClient* client) {
    ctx->pending_calls -= 1;

    try {
      std::vector<int32_t> subret;
      client->recv_getValues(subret);
      ctx->ret.insert(ctx->ret.end(), subret.begin(), subret.end());
    } catch (TException& exn) {
      // TODO: Log error
    }

    delete client;

    if (ctx->pending_calls == 0) {
      ctx->cob(ctx->ret);
      delete ctx;
    }
  }

 protected:
  struct event_base* eb_;
  std::vector<int> leaf_ports_;
  boost::shared_ptr<TProtocolFactory> pfact_;
};


int main() {
  boost::shared_ptr<AggrAsyncHandler> handler(new AggrAsyncHandler());
  boost::shared_ptr<TAsyncProcessor> proc(new AggrAsyncProcessor(handler));
  boost::shared_ptr<TProtocolFactory> pfact(new TBinaryProtocolFactory());
  boost::shared_ptr<TAsyncBufferProcessor> bufproc(new TAsyncProtocolProcessor(proc, pfact));
  boost::shared_ptr<TEvhttpServer> server(new TEvhttpServer(bufproc, 8080));
  handler->setEventBase(server->getEventBase());
  server->serve();
}
