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

#include <thrift/windows/OverlappedSubmissionThread.h>
#include <thrift/transport/TTransportException.h>
#include <boost/noncopyable.hpp>
#include <boost/scope_exit.hpp>
#include <process.h>

namespace apache {
namespace thrift {
namespace transport {

TOverlappedWorkItem::TOverlappedWorkItem()
  : SLIST_ENTRY(),
    action(UNKNOWN),
    h(INVALID_HANDLE_VALUE),
    buffer(NULL),
    buffer_len(0),
    overlap(),
    last_error(0),
    success(TRUE) {
}

void TOverlappedWorkItem::reset(uint8_t* buf, uint32_t len, HANDLE event) {
  memset(&overlap, 0, sizeof(overlap));
  overlap.hEvent = event;
  buffer = buf;
  buffer_len = len;
  last_error = 0;
  success = FALSE;
}

uint32_t TOverlappedWorkItem::overlappedResults(bool signal_failure) {
  DWORD bytes = 0;
  BOOL result = ::GetOverlappedResult(h, &overlap, &bytes, TRUE);
  if (signal_failure && !result) // get overlapped error case
  {
    GlobalOutput.perror("TPipe ::GetOverlappedResult errored GLE=", ::GetLastError());
    throw TTransportException(TTransportException::UNKNOWN, "TPipe: GetOverlappedResult failed");
  }
  return bytes;
}

bool TOverlappedWorkItem::process() {
  BOOST_SCOPE_EXIT((&doneSubmittingEvent)) { SetEvent(doneSubmittingEvent.h); }
  BOOST_SCOPE_EXIT_END

  switch (action) {
  case (CONNECT):
    success = ::ConnectNamedPipe(h, &overlap);
    if (success == FALSE)
      last_error = ::GetLastError();
    return true;
  case (READ):
    success = ::ReadFile(h, buffer, buffer_len, NULL, &overlap);
    if (success == FALSE)
      last_error = ::GetLastError();
    return true;
  case (CANCELIO):
    success = ::CancelIo(h);
    if (success == FALSE)
      last_error = ::GetLastError();
    return true;
  case (STOP):
  default:
    return false;
  }
}

void TOverlappedSubmissionThread::addWorkItem(TOverlappedWorkItem* item) {
  InterlockedPushEntrySList(&workList_, item);
  SetEvent(workAvailableEvent_.h);
  WaitForSingleObject(item->doneSubmittingEvent.h, INFINITE);
}

TOverlappedSubmissionThread* TOverlappedSubmissionThread::acquire_instance() {
  TAutoCrit lock(instanceGuard_);
  if (instance_ == NULL) {
    assert(instanceRefCount_ == 0);
    instance_ = new TOverlappedSubmissionThread;
  }
  ++instanceRefCount_;
  return instance_;
}
void TOverlappedSubmissionThread::release_instance() {
  TAutoCrit lock(instanceGuard_);
  if (--instanceRefCount_ == 0) {
    delete instance_;
    instance_ = NULL;
  }
}

TOverlappedSubmissionThread::TOverlappedSubmissionThread() {
  stopItem_.action = TOverlappedWorkItem::STOP;

  InitializeSListHead(&workList_);
  thread_ = (HANDLE)_beginthreadex(NULL, 0, thread_proc, this, 0, NULL);
  if (thread_ == 0) {
    GlobalOutput.perror("TOverlappedSubmissionThread unable to create thread, errno=", errno);
    throw TTransportException(TTransportException::NOT_OPEN,
                              " TOverlappedSubmissionThread unable to create thread");
  }
}

TOverlappedSubmissionThread::~TOverlappedSubmissionThread() {
  addWorkItem(&stopItem_);
  ::WaitForSingleObject(thread_, INFINITE);
  CloseHandle(thread_);
}

void TOverlappedSubmissionThread::run() {
  for (;;) {
    WaitForSingleObject(workAvailableEvent_.h, INFINITE);
    // todo check result
    SLIST_ENTRY* entry = NULL;
    while ((entry = InterlockedPopEntrySList(&workList_)) != NULL) {
      TOverlappedWorkItem& item = *static_cast<TOverlappedWorkItem*>(entry);
      if (!item.process())
        return;
    }
  }
}

unsigned __stdcall TOverlappedSubmissionThread::thread_proc(void* addr) {
  static_cast<TOverlappedSubmissionThread*>(addr)->run();
  return 0;
}

TCriticalSection TOverlappedSubmissionThread::instanceGuard_;
TOverlappedSubmissionThread* TOverlappedSubmissionThread::instance_;
uint32_t TOverlappedSubmissionThread::instanceRefCount_ = 0;
}
}
} // apach::thrift::transport
