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
#ifndef _THRIFT_PROCESSOR_TEST_HANDLERS_H_
#define _THRIFT_PROCESSOR_TEST_HANDLERS_H_ 1

#include "EventLog.h"
#include "gen-cpp/ParentService.h"
#include "gen-cpp/ChildService.h"

namespace apache {
namespace thrift {
namespace test {

class ParentHandler : virtual public ParentServiceIf {
public:
  ParentHandler(const boost::shared_ptr<EventLog>& log)
    : triggerMonitor(&mutex_), generation_(0), wait_(false), log_(log) {}

  int32_t incrementGeneration() {
    concurrency::Guard g(mutex_);
    log_->append(EventLog::ET_CALL_INCREMENT_GENERATION, 0, 0);
    return ++generation_;
  }

  int32_t getGeneration() {
    concurrency::Guard g(mutex_);
    log_->append(EventLog::ET_CALL_GET_GENERATION, 0, 0);
    return generation_;
  }

  void addString(const std::string& s) {
    concurrency::Guard g(mutex_);
    log_->append(EventLog::ET_CALL_ADD_STRING, 0, 0);
    strings_.push_back(s);
  }

  void getStrings(std::vector<std::string>& _return) {
    concurrency::Guard g(mutex_);
    log_->append(EventLog::ET_CALL_GET_STRINGS, 0, 0);
    _return = strings_;
  }

  void getDataWait(std::string& _return, const int32_t length) {
    concurrency::Guard g(mutex_);
    log_->append(EventLog::ET_CALL_GET_DATA_WAIT, 0, 0);

    blockUntilTriggered();

    _return.append(length, 'a');
  }

  void onewayWait() {
    concurrency::Guard g(mutex_);
    log_->append(EventLog::ET_CALL_ONEWAY_WAIT, 0, 0);

    blockUntilTriggered();
  }

  void exceptionWait(const std::string& message) {
    concurrency::Guard g(mutex_);
    log_->append(EventLog::ET_CALL_EXCEPTION_WAIT, 0, 0);

    blockUntilTriggered();

    MyError e;
    e.message = message;
    throw e;
  }

  void unexpectedExceptionWait(const std::string& message) {
    concurrency::Guard g(mutex_);
    log_->append(EventLog::ET_CALL_UNEXPECTED_EXCEPTION_WAIT, 0, 0);

    blockUntilTriggered();

    MyError e;
    e.message = message;
    throw e;
  }

  /**
   * After prepareTriggeredCall() is invoked, calls to any of the *Wait()
   * functions won't return until triggerPendingCalls() is invoked
   *
   * This has to be a separate function invoked by the main test thread
   * in order to to avoid race conditions.
   */
  void prepareTriggeredCall() {
    concurrency::Guard g(mutex_);
    wait_ = true;
  }

  /**
   * Wake up all calls waiting in blockUntilTriggered()
   */
  void triggerPendingCalls() {
    concurrency::Guard g(mutex_);
    wait_ = false;
    triggerMonitor.notifyAll();
  }

protected:
  /**
   * blockUntilTriggered() won't return until triggerPendingCalls() is invoked
   * in another thread.
   *
   * This should only be called when already holding mutex_.
   */
  void blockUntilTriggered() {
    while (wait_) {
      triggerMonitor.waitForever();
    }

    // Log an event when we return
    log_->append(EventLog::ET_WAIT_RETURN, 0, 0);
  }

  concurrency::Mutex mutex_;
  concurrency::Monitor triggerMonitor;
  int32_t generation_;
  bool wait_;
  std::vector<std::string> strings_;
  boost::shared_ptr<EventLog> log_;
};

#ifdef _WIN32
  #pragma warning( push )
  #pragma warning (disable : 4250 ) //inheriting methods via dominance
#endif

class ChildHandler : public ParentHandler, virtual public ChildServiceIf {
public:
  ChildHandler(const boost::shared_ptr<EventLog>& log) : ParentHandler(log), value_(0) {}

  int32_t setValue(const int32_t value) {
    concurrency::Guard g(mutex_);
    log_->append(EventLog::ET_CALL_SET_VALUE, 0, 0);

    int32_t oldValue = value_;
    value_ = value;
    return oldValue;
  }

  int32_t getValue() {
    concurrency::Guard g(mutex_);
    log_->append(EventLog::ET_CALL_GET_VALUE, 0, 0);

    return value_;
  }

protected:
  int32_t value_;
};

#ifdef _WIN32
  #pragma warning( pop )
#endif

struct ConnContext {
public:
  ConnContext(boost::shared_ptr<protocol::TProtocol> in,
              boost::shared_ptr<protocol::TProtocol> out,
              uint32_t id)
    : input(in), output(out), id(id) {}

  boost::shared_ptr<protocol::TProtocol> input;
  boost::shared_ptr<protocol::TProtocol> output;
  uint32_t id;
};

struct CallContext {
public:
  CallContext(ConnContext* context, uint32_t id, const std::string& name)
    : connContext(context), name(name), id(id) {}

  ConnContext* connContext;
  std::string name;
  uint32_t id;
};

class ServerEventHandler : public server::TServerEventHandler {
public:
  ServerEventHandler(const boost::shared_ptr<EventLog>& log) : nextId_(1), log_(log) {}

  virtual void preServe() {}

  virtual void* createContext(boost::shared_ptr<protocol::TProtocol> input,
                              boost::shared_ptr<protocol::TProtocol> output) {
    ConnContext* context = new ConnContext(input, output, nextId_);
    ++nextId_;
    log_->append(EventLog::ET_CONN_CREATED, context->id, 0);
    return context;
  }

  virtual void deleteContext(void* serverContext,
                             boost::shared_ptr<protocol::TProtocol> input,
                             boost::shared_ptr<protocol::TProtocol> output) {
    ConnContext* context = reinterpret_cast<ConnContext*>(serverContext);

    if (input != context->input) {
      abort();
    }
    if (output != context->output) {
      abort();
    }

    log_->append(EventLog::ET_CONN_DESTROYED, context->id, 0);

    delete context;
  }

  virtual void processContext(void* serverContext,
                              boost::shared_ptr<transport::TTransport> transport) {
// TODO: We currently don't test the behavior of the processContext()
// calls.  The various server implementations call processContext() at
// slightly different times, and it is too annoying to try and account for
// their various differences.
//
// TThreadedServer, TThreadPoolServer, and TSimpleServer usually wait until
// they see the first byte of a request before calling processContext().
// However, they don't wait for the first byte of the very first request,
// and instead immediately call processContext() before any data is
// received.
//
// TNonblockingServer always waits until receiving the full request before
// calling processContext().
#if 0
    ConnContext* context = reinterpret_cast<ConnContext*>(serverContext);
    log_->append(EventLog::ET_PROCESS, context->id, 0);
#else
    THRIFT_UNUSED_VARIABLE(serverContext);
    THRIFT_UNUSED_VARIABLE(transport);
#endif
  }

protected:
  uint32_t nextId_;
  boost::shared_ptr<EventLog> log_;
};

class ProcessorEventHandler : public TProcessorEventHandler {
public:
  ProcessorEventHandler(const boost::shared_ptr<EventLog>& log) : nextId_(1), log_(log) {}

  void* getContext(const char* fnName, void* serverContext) {
    ConnContext* connContext = reinterpret_cast<ConnContext*>(serverContext);

    CallContext* context = new CallContext(connContext, nextId_, fnName);
    ++nextId_;

    log_->append(EventLog::ET_CALL_STARTED, connContext->id, context->id, fnName);
    return context;
  }

  void freeContext(void* ctx, const char* fnName) {
    CallContext* context = reinterpret_cast<CallContext*>(ctx);
    checkName(context, fnName);
    log_->append(EventLog::ET_CALL_FINISHED, context->connContext->id, context->id, fnName);
    delete context;
  }

  void preRead(void* ctx, const char* fnName) {
    CallContext* context = reinterpret_cast<CallContext*>(ctx);
    checkName(context, fnName);
    log_->append(EventLog::ET_PRE_READ, context->connContext->id, context->id, fnName);
  }

  void postRead(void* ctx, const char* fnName, uint32_t bytes) {
    THRIFT_UNUSED_VARIABLE(bytes);
    CallContext* context = reinterpret_cast<CallContext*>(ctx);
    checkName(context, fnName);
    log_->append(EventLog::ET_POST_READ, context->connContext->id, context->id, fnName);
  }

  void preWrite(void* ctx, const char* fnName) {
    CallContext* context = reinterpret_cast<CallContext*>(ctx);
    checkName(context, fnName);
    log_->append(EventLog::ET_PRE_WRITE, context->connContext->id, context->id, fnName);
  }

  void postWrite(void* ctx, const char* fnName, uint32_t bytes) {
    THRIFT_UNUSED_VARIABLE(bytes);
    CallContext* context = reinterpret_cast<CallContext*>(ctx);
    checkName(context, fnName);
    log_->append(EventLog::ET_POST_WRITE, context->connContext->id, context->id, fnName);
  }

  void asyncComplete(void* ctx, const char* fnName) {
    CallContext* context = reinterpret_cast<CallContext*>(ctx);
    checkName(context, fnName);
    log_->append(EventLog::ET_ASYNC_COMPLETE, context->connContext->id, context->id, fnName);
  }

  void handlerError(void* ctx, const char* fnName) {
    CallContext* context = reinterpret_cast<CallContext*>(ctx);
    checkName(context, fnName);
    log_->append(EventLog::ET_HANDLER_ERROR, context->connContext->id, context->id, fnName);
  }

protected:
  void checkName(const CallContext* context, const char* fnName) {
    // Note: we can't use BOOST_CHECK_EQUAL here, since the handler runs in a
    // different thread from the test functions.  Just abort if the names are
    // different
    if (context->name != fnName) {
      fprintf(stderr,
              "call context name mismatch: \"%s\" != \"%s\"\n",
              context->name.c_str(),
              fnName);
      fflush(stderr);
      abort();
    }
  }

  uint32_t nextId_;
  boost::shared_ptr<EventLog> log_;
};
}
}
} // apache::thrift::test

#endif // _THRIFT_PROCESSOR_TEST_HANDLERS_H_
