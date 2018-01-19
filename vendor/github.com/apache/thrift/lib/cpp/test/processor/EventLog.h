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
#ifndef _THRIFT_TEST_EVENTLOG_H_
#define _THRIFT_TEST_EVENTLOG_H_ 1

#include <thrift/concurrency/Monitor.h>

namespace apache {
namespace thrift {
namespace test {

// Initially I made EventType an enum, but using char* results
// in much more readable error messages when there is a mismatch.
// It also lets users of EventLog easily define their own new types.
// Comparing the literal pointer values should be safe, barring any strange
// linking setup that results in duplicate symbols.
typedef const char* EventType;

struct Event {
  Event(EventType type, uint32_t connectionId, uint32_t callId, const std::string& message)
    : type(type), connectionId(connectionId), callId(callId), message(message) {}

  EventType type;
  uint32_t connectionId;
  uint32_t callId;
  std::string message;
};

class EventLog {
public:
  static EventType ET_LOG_END;
  static EventType ET_CONN_CREATED;
  static EventType ET_CONN_DESTROYED;
  static EventType ET_CALL_STARTED;
  static EventType ET_CALL_FINISHED;
  static EventType ET_PROCESS;
  static EventType ET_PRE_READ;
  static EventType ET_POST_READ;
  static EventType ET_PRE_WRITE;
  static EventType ET_POST_WRITE;
  static EventType ET_ASYNC_COMPLETE;
  static EventType ET_HANDLER_ERROR;

  static EventType ET_CALL_INCREMENT_GENERATION;
  static EventType ET_CALL_GET_GENERATION;
  static EventType ET_CALL_ADD_STRING;
  static EventType ET_CALL_GET_STRINGS;
  static EventType ET_CALL_GET_DATA_WAIT;
  static EventType ET_CALL_ONEWAY_WAIT;
  static EventType ET_CALL_UNEXPECTED_EXCEPTION_WAIT;
  static EventType ET_CALL_EXCEPTION_WAIT;
  static EventType ET_WAIT_RETURN;
  static EventType ET_CALL_SET_VALUE;
  static EventType ET_CALL_GET_VALUE;

  EventLog();

  void append(EventType type,
              uint32_t connectionId,
              uint32_t callId,
              const std::string& message = "");

  Event waitForEvent(int64_t timeout = 500);
  Event waitForConnEvent(uint32_t connId, int64_t timeout = 500);

protected:
  typedef std::list<Event> EventList;

  concurrency::Monitor monitor_;
  EventList events_;
  uint32_t id_;

  static uint32_t nextId_;
};
}
}
} // apache::thrift::test

#endif // _THRIFT_TEST_EVENTLOG_H_
