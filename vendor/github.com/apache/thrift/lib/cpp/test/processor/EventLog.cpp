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
#include "EventLog.h"

#include <stdarg.h>
#include <stdlib.h>

using namespace std;
using namespace apache::thrift::concurrency;

namespace {

// Define environment variable DEBUG_EVENTLOG to enable debug logging
// ex: $ DEBUG_EVENTLOG=1 processor_test
static const char * DEBUG_EVENTLOG = getenv("DEBUG_EVENTLOG");

void debug(const char* fmt, ...) {
  if (DEBUG_EVENTLOG) {
    va_list ap;
    va_start(ap, fmt);
    vfprintf(stderr, fmt, ap);
    va_end(ap);

    fprintf(stderr, "\n");
  }
}
}

namespace apache {
namespace thrift {
namespace test {

uint32_t EventLog::nextId_ = 0;

#define EVENT_TYPE(value) EventType EventLog::value = #value
EVENT_TYPE(ET_LOG_END);
EVENT_TYPE(ET_CONN_CREATED);
EVENT_TYPE(ET_CONN_DESTROYED);
EVENT_TYPE(ET_CALL_STARTED);
EVENT_TYPE(ET_CALL_FINISHED);
EVENT_TYPE(ET_PROCESS);
EVENT_TYPE(ET_PRE_READ);
EVENT_TYPE(ET_POST_READ);
EVENT_TYPE(ET_PRE_WRITE);
EVENT_TYPE(ET_POST_WRITE);
EVENT_TYPE(ET_ASYNC_COMPLETE);
EVENT_TYPE(ET_HANDLER_ERROR);

EVENT_TYPE(ET_CALL_INCREMENT_GENERATION);
EVENT_TYPE(ET_CALL_GET_GENERATION);
EVENT_TYPE(ET_CALL_ADD_STRING);
EVENT_TYPE(ET_CALL_GET_STRINGS);
EVENT_TYPE(ET_CALL_GET_DATA_WAIT);
EVENT_TYPE(ET_CALL_ONEWAY_WAIT);
EVENT_TYPE(ET_CALL_EXCEPTION_WAIT);
EVENT_TYPE(ET_CALL_UNEXPECTED_EXCEPTION_WAIT);
EVENT_TYPE(ET_CALL_SET_VALUE);
EVENT_TYPE(ET_CALL_GET_VALUE);
EVENT_TYPE(ET_WAIT_RETURN);

EventLog::EventLog() {
  id_ = nextId_++;
  debug("New log: %d", id_);
}

void EventLog::append(EventType type,
                      uint32_t connectionId,
                      uint32_t callId,
                      const string& message) {
  Synchronized s(monitor_);
  debug("%d <-- %u, %u, %s \"%s\"", id_, connectionId, callId, type, message.c_str());

  Event e(type, connectionId, callId, message);
  events_.push_back(e);

  monitor_.notify();
}

Event EventLog::waitForEvent(int64_t timeout) {
  Synchronized s(monitor_);

  try {
    while (events_.empty()) {
      monitor_.wait(timeout);
    }
  } catch (TimedOutException ex) {
    return Event(ET_LOG_END, 0, 0, "");
  }

  Event event = events_.front();
  events_.pop_front();
  return event;
}

Event EventLog::waitForConnEvent(uint32_t connId, int64_t timeout) {
  Synchronized s(monitor_);

  EventList::iterator it = events_.begin();
  while (true) {
    try {
      // TODO: it would be nicer to honor timeout for the duration of this
      // call, rather than restarting it for each call to wait().  It shouldn't
      // be a big problem in practice, though.
      while (it == events_.end()) {
        monitor_.wait(timeout);
      }
    } catch (TimedOutException ex) {
      return Event(ET_LOG_END, 0, 0, "");
    }

    if (it->connectionId == connId) {
      Event event = *it;
      events_.erase(it);
      return event;
    }
  }
}
}
}
} // apache::thrift::test
