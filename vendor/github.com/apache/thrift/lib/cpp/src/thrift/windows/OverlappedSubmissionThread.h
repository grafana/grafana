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

#ifndef _THRIFT_WINDOWS_OverlappedSubmissionThread_H_
#define _THRIFT_WINDOWS_OverlappedSubmissionThread_H_ 1

#ifndef _WIN32
#error "OverlappedSubmissionThread.h is only usable on Windows"
#endif

#include <thrift/windows/Sync.h>
#include <boost/noncopyable.hpp>
#include <Windows.h>

/*
  *** Why does this class exist?
  In short, because we want to enable something similar to a "select" loop, on Windows, with
  named pipes.  The core of the "select" loop is a call to WaitForMultipleObjects.  So that means
  we need a signalable object that indicates when data is available.

  A pipe handle doesn't do that.  A pipe handle is signaled when a read or write completes, and if
  no one has called read or write, then the pipe handle is useless in WaitForMultipleObjects.  So
  instead, we use overlapped I/O.  With overlapped I/O, you call read, and associate an event with
  the read.  When the read finishes, the event is signaled.  This means that when you create a pipe,
  you start a read.  When the customer calls read on your transport object, you wait for the last
  read to finish, and then kick off another.

  There is one big caveat to this though.  The thread that initiated the read must stay alive.  If
  the thread that initiated the read exits, then the read completes in an error state.  To ensure
  that the initiating thread stays alive, we create a singleton thread whose sole responsibility is
  to manage this overlapped I/O requests.  This introduces some overhead, but it is overhead that
  is necessary for correct behavior.

  This thread currently supports connect, read, and cancel io.  So far, I haven't needed to put any
  writes on this thread, but if needed, it could be done.  The client write buffer would need to be
  copied to ensure that it doesn't get invalidated.

  *** How does one use this class?
  Create a TOverlappedWorkItem, and fill in the action and "h", then call reset().  Your work item
  is now ready to be submitted to the overlapped submission thread.  Create a TAutoOverlapThread,
  and call thread->addWorkItem with your work item.  After addWorkItem completes, you may inspect
  last_error and success.  At some point in the future, call workItem.overlappedResults to wait
  until the operation has completed.
*/

namespace apache {
namespace thrift {
namespace transport {

DECLSPEC_ALIGN(MEMORY_ALLOCATION_ALIGNMENT) struct TOverlappedWorkItem : public SLIST_ENTRY {
  TOverlappedWorkItem();

  enum action_t {
    UNKNOWN = 3000,
    CONNECT,
    READ,
    CANCELIO,
    STOP,
  };

  TAutoResetEvent doneSubmittingEvent;
  action_t action;
  HANDLE h;
  uint8_t* buffer;
  uint32_t buffer_len;
  OVERLAPPED overlap;

  DWORD last_error;
  BOOL success;

  void reset(uint8_t* buf, uint32_t len, HANDLE event);
  uint32_t overlappedResults(bool signal_failure = true);
  bool process();
};

class TOverlappedSubmissionThread : boost::noncopyable {
public:
  void addWorkItem(TOverlappedWorkItem* item);

  // singleton stuff
public:
  static TOverlappedSubmissionThread* acquire_instance();
  static void release_instance();

private:
  static TCriticalSection instanceGuard_;
  static TOverlappedSubmissionThread* instance_;
  static uint32_t instanceRefCount_;

  // thread details
private:
  TOverlappedSubmissionThread();
  ~TOverlappedSubmissionThread();
  void run();
  static unsigned __stdcall thread_proc(void* addr);

private:
  DECLSPEC_ALIGN(MEMORY_ALLOCATION_ALIGNMENT) SLIST_HEADER workList_;
  TOverlappedWorkItem stopItem_;
  TAutoResetEvent workAvailableEvent_;
  HANDLE thread_;
};

class TAutoOverlapThread : boost::noncopyable {
private:
  TOverlappedSubmissionThread* p;

public:
  TAutoOverlapThread() : p(TOverlappedSubmissionThread::acquire_instance()) {}
  ~TAutoOverlapThread() { TOverlappedSubmissionThread::release_instance(); }
  TOverlappedSubmissionThread* operator->() { return p; }
};
}
}
} // apache::thrift::transport

#endif
