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

#include <thrift/transport/TTransportException.h>
#include <thrift/transport/TPipe.h>
#ifdef _WIN32
#include <thrift/windows/OverlappedSubmissionThread.h>
#include <thrift/windows/Sync.h>
#endif

namespace apache {
namespace thrift {
namespace transport {

using namespace std;

/**
* TPipe implementation.
*/

#ifdef _WIN32

uint32_t pipe_read(HANDLE pipe, uint8_t* buf, uint32_t len);
void pipe_write(HANDLE pipe, const uint8_t* buf, uint32_t len);

uint32_t pseudo_sync_read(HANDLE pipe, HANDLE event, uint8_t* buf, uint32_t len);
void pseudo_sync_write(HANDLE pipe, HANDLE event, const uint8_t* buf, uint32_t len);

class TPipeImpl : boost::noncopyable {
public:
  TPipeImpl() {}
  virtual ~TPipeImpl() {}
  virtual uint32_t read(uint8_t* buf, uint32_t len) = 0;
  virtual void write(const uint8_t* buf, uint32_t len) = 0;
  virtual HANDLE getPipeHandle() = 0; // doubles as the read handle for anon pipe
  virtual void setPipeHandle(HANDLE pipehandle) = 0;
  virtual HANDLE getWrtPipeHandle() { return INVALID_HANDLE_VALUE; }
  virtual void setWrtPipeHandle(HANDLE) {}
  virtual bool isBufferedDataAvailable() { return false; }
  virtual HANDLE getNativeWaitHandle() { return INVALID_HANDLE_VALUE; }
};

class TNamedPipeImpl : public TPipeImpl {
public:
  explicit TNamedPipeImpl(TAutoHandle &pipehandle) : Pipe_(pipehandle.release()) {}
  virtual ~TNamedPipeImpl() {}
  virtual uint32_t read(uint8_t* buf, uint32_t len) {
    return pseudo_sync_read(Pipe_.h, read_event_.h, buf, len);
  }
  virtual void write(const uint8_t* buf, uint32_t len) {
    pseudo_sync_write(Pipe_.h, write_event_.h, buf, len);
  }

  virtual HANDLE getPipeHandle() { return Pipe_.h; }
  virtual void setPipeHandle(HANDLE pipehandle) { Pipe_.reset(pipehandle); }

private:
  TManualResetEvent read_event_;
  TManualResetEvent write_event_;
  TAutoHandle Pipe_;
};

class TAnonPipeImpl : public TPipeImpl {
public:
  TAnonPipeImpl(HANDLE PipeRd, HANDLE PipeWrt) : PipeRd_(PipeRd), PipeWrt_(PipeWrt) {}
  virtual ~TAnonPipeImpl() {}
  virtual uint32_t read(uint8_t* buf, uint32_t len) { return pipe_read(PipeRd_.h, buf, len); }
  virtual void write(const uint8_t* buf, uint32_t len) { pipe_write(PipeWrt_.h, buf, len); }

  virtual HANDLE getPipeHandle() { return PipeRd_.h; }
  virtual void setPipeHandle(HANDLE PipeRd) { PipeRd_.reset(PipeRd); }
  virtual HANDLE getWrtPipeHandle() { return PipeWrt_.h; }
  virtual void setWrtPipeHandle(HANDLE PipeWrt) { PipeWrt_.reset(PipeWrt); }

private:
  TAutoHandle PipeRd_;
  TAutoHandle PipeWrt_;
};

// If you want a select-like loop to work, use this subclass.  Be warned...
// the read implementation has several context switches, so this is slower
// than using the regular named pipe implementation
class TWaitableNamedPipeImpl : public TPipeImpl {
public:
  explicit TWaitableNamedPipeImpl(TAutoHandle &pipehandle)
    : begin_unread_idx_(0), end_unread_idx_(0) {
    readOverlap_.action = TOverlappedWorkItem::READ;
    readOverlap_.h = pipehandle.h;
    cancelOverlap_.action = TOverlappedWorkItem::CANCELIO;
    cancelOverlap_.h = pipehandle.h;
    buffer_.resize(1024 /*arbitrary buffer size*/, '\0');
    beginAsyncRead(&buffer_[0], static_cast<uint32_t>(buffer_.size()));
    Pipe_.reset(pipehandle.release());
  }
  virtual ~TWaitableNamedPipeImpl() {
    // see if there is an outstanding read request
    if (begin_unread_idx_ == end_unread_idx_) {
      // if so, cancel it, and wait for the dead completion
      thread_->addWorkItem(&cancelOverlap_);
      readOverlap_.overlappedResults(false /*ignore errors*/);
    }
  }
  virtual uint32_t read(uint8_t* buf, uint32_t len);
  virtual void write(const uint8_t* buf, uint32_t len) {
    pseudo_sync_write(Pipe_.h, write_event_.h, buf, len);
  }

  virtual HANDLE getPipeHandle() { return Pipe_.h; }
  virtual void setPipeHandle(HANDLE pipehandle) { Pipe_.reset(pipehandle); }
  virtual bool isBufferedDataAvailable() { return begin_unread_idx_ < end_unread_idx_; }
  virtual HANDLE getNativeWaitHandle() { return ready_event_.h; }

private:
  void beginAsyncRead(uint8_t* buf, uint32_t len);
  uint32_t endAsyncRead();

  TAutoOverlapThread thread_;
  TAutoHandle Pipe_;
  TOverlappedWorkItem readOverlap_;
  TOverlappedWorkItem cancelOverlap_;
  TManualResetEvent ready_event_;
  TManualResetEvent write_event_;
  std::vector<uint8_t> buffer_;
  uint32_t begin_unread_idx_;
  uint32_t end_unread_idx_;
};

void TWaitableNamedPipeImpl::beginAsyncRead(uint8_t* buf, uint32_t len) {
  begin_unread_idx_ = end_unread_idx_ = 0;
  readOverlap_.reset(buf, len, ready_event_.h);
  thread_->addWorkItem(&readOverlap_);
  if (readOverlap_.success == FALSE && readOverlap_.last_error != ERROR_IO_PENDING) {
    GlobalOutput.perror("TPipe ::ReadFile errored GLE=", readOverlap_.last_error);
    throw TTransportException(TTransportException::UNKNOWN, "TPipe: ReadFile failed");
  }
}

uint32_t TWaitableNamedPipeImpl::endAsyncRead() {
  return readOverlap_.overlappedResults();
}

uint32_t TWaitableNamedPipeImpl::read(uint8_t* buf, uint32_t len) {
  if (begin_unread_idx_ == end_unread_idx_) {
    end_unread_idx_ = endAsyncRead();
  }

  uint32_t bytes_to_copy = (std::min)(len, end_unread_idx_ - begin_unread_idx_);
  memcpy(buf, &buffer_[begin_unread_idx_], bytes_to_copy);
  begin_unread_idx_ += bytes_to_copy;
  if (begin_unread_idx_ != end_unread_idx_) {
    assert(len == bytes_to_copy);
    // we were able to fulfill the read with just the bytes in our
    // buffer, and we still have buffer left
    return bytes_to_copy;
  }
  uint32_t bytes_copied = bytes_to_copy;

  // all of the requested data has been read.  Kick off an async read for the next round.
  beginAsyncRead(&buffer_[0], static_cast<uint32_t>(buffer_.size()));

  return bytes_copied;
}

void pseudo_sync_write(HANDLE pipe, HANDLE event, const uint8_t* buf, uint32_t len) {
  OVERLAPPED tempOverlap;
  memset(&tempOverlap, 0, sizeof(tempOverlap));
  tempOverlap.hEvent = event;

  uint32_t written = 0;
  while (written < len) {
    BOOL result = ::WriteFile(pipe, buf + written, len - written, NULL, &tempOverlap);

    if (result == FALSE && ::GetLastError() != ERROR_IO_PENDING) {
      GlobalOutput.perror("TPipe ::WriteFile errored GLE=", ::GetLastError());
      throw TTransportException(TTransportException::UNKNOWN, "TPipe: write failed");
    }

    DWORD bytes = 0;
    result = ::GetOverlappedResult(pipe, &tempOverlap, &bytes, TRUE);
    if (!result) {
      GlobalOutput.perror("TPipe ::GetOverlappedResult errored GLE=", ::GetLastError());
      throw TTransportException(TTransportException::UNKNOWN, "TPipe: GetOverlappedResult failed");
    }
    written += bytes;
  }
}

uint32_t pseudo_sync_read(HANDLE pipe, HANDLE event, uint8_t* buf, uint32_t len) {
  OVERLAPPED tempOverlap;
  memset(&tempOverlap, 0, sizeof(tempOverlap));
  tempOverlap.hEvent = event;

  BOOL result = ::ReadFile(pipe, buf, len, NULL, &tempOverlap);

  if (result == FALSE && ::GetLastError() != ERROR_IO_PENDING) {
    GlobalOutput.perror("TPipe ::ReadFile errored GLE=", ::GetLastError());
    throw TTransportException(TTransportException::UNKNOWN, "TPipe: read failed");
  }

  DWORD bytes = 0;
  result = ::GetOverlappedResult(pipe, &tempOverlap, &bytes, TRUE);
  if (!result) {
    GlobalOutput.perror("TPipe ::GetOverlappedResult errored GLE=", ::GetLastError());
    throw TTransportException(TTransportException::UNKNOWN, "TPipe: GetOverlappedResult failed");
  }
  return bytes;
}

//---- Constructors ----
TPipe::TPipe(TAutoHandle &Pipe)
  : impl_(new TWaitableNamedPipeImpl(Pipe)), TimeoutSeconds_(3), isAnonymous_(false) {
}

TPipe::TPipe(HANDLE Pipe)
  : TimeoutSeconds_(3), isAnonymous_(false)
{
  TAutoHandle pipeHandle(Pipe);
  impl_.reset(new TWaitableNamedPipeImpl(pipeHandle));
}

TPipe::TPipe(const char* pipename) : TimeoutSeconds_(3), isAnonymous_(false) {
  setPipename(pipename);
}

TPipe::TPipe(const std::string& pipename) : TimeoutSeconds_(3), isAnonymous_(false) {
  setPipename(pipename);
}

TPipe::TPipe(HANDLE PipeRd, HANDLE PipeWrt)
  : impl_(new TAnonPipeImpl(PipeRd, PipeWrt)), TimeoutSeconds_(3), isAnonymous_(true) {
}

TPipe::TPipe() : TimeoutSeconds_(3), isAnonymous_(false) {
}

TPipe::~TPipe() {
}

//---------------------------------------------------------
// Transport callbacks
//---------------------------------------------------------
bool TPipe::isOpen() {
  return impl_.get() != NULL;
}

bool TPipe::peek() {
  return isOpen();
}

void TPipe::open() {
  if (isOpen())
    return;

  TAutoHandle hPipe;
  do {
    DWORD flags = FILE_FLAG_OVERLAPPED; // async mode, so we can do reads at the same time as writes
    hPipe.reset(CreateFileA(pipename_.c_str(),
                            GENERIC_READ | GENERIC_WRITE,
                            0,             // no sharing
                            NULL,          // default security attributes
                            OPEN_EXISTING, // opens existing pipe
                            flags,
                            NULL)); // no template file

    if (hPipe.h != INVALID_HANDLE_VALUE)
      break; // success!

    if (::GetLastError() != ERROR_PIPE_BUSY) {
      GlobalOutput.perror("TPipe::open ::CreateFile errored GLE=", ::GetLastError());
      throw TTransportException(TTransportException::NOT_OPEN, "Unable to open pipe");
    }
  } while (::WaitNamedPipeA(pipename_.c_str(), TimeoutSeconds_ * 1000));

  if (hPipe.h == INVALID_HANDLE_VALUE) {
    GlobalOutput.perror("TPipe::open ::CreateFile errored GLE=", ::GetLastError());
    throw TTransportException(TTransportException::NOT_OPEN, "Unable to open pipe");
  }

  impl_.reset(new TNamedPipeImpl(hPipe));
}

void TPipe::close() {
  impl_.reset();
}

uint32_t TPipe::read(uint8_t* buf, uint32_t len) {
  if (!isOpen())
    throw TTransportException(TTransportException::NOT_OPEN, "Called read on non-open pipe");
  return impl_->read(buf, len);
}

uint32_t pipe_read(HANDLE pipe, uint8_t* buf, uint32_t len) {
  DWORD cbRead;
  int fSuccess = ReadFile(pipe,    // pipe handle
                          buf,     // buffer to receive reply
                          len,     // size of buffer
                          &cbRead, // number of bytes read
                          NULL);   // not overlapped

  if (!fSuccess && GetLastError() != ERROR_MORE_DATA)
    return 0; // No more data, possibly because client disconnected.

  return cbRead;
}

void TPipe::write(const uint8_t* buf, uint32_t len) {
  if (!isOpen())
    throw TTransportException(TTransportException::NOT_OPEN, "Called write on non-open pipe");
  impl_->write(buf, len);
}

void pipe_write(HANDLE pipe, const uint8_t* buf, uint32_t len) {
  DWORD cbWritten;
  int fSuccess = WriteFile(pipe,       // pipe handle
                           buf,        // message
                           len,        // message length
                           &cbWritten, // bytes written
                           NULL);      // not overlapped

  if (!fSuccess)
    throw TTransportException(TTransportException::NOT_OPEN, "Write to pipe failed");
}

//---------------------------------------------------------
// Accessors
//---------------------------------------------------------

string TPipe::getPipename() {
  return pipename_;
}

void TPipe::setPipename(const std::string& pipename) {
  if (pipename.find("\\\\") == -1)
    pipename_ = "\\\\.\\pipe\\" + pipename;
  else
    pipename_ = pipename;
}

HANDLE TPipe::getPipeHandle() {
  if (impl_)
    return impl_->getPipeHandle();
  return INVALID_HANDLE_VALUE;
}

void TPipe::setPipeHandle(HANDLE pipehandle) {
  if (isAnonymous_)
    impl_->setPipeHandle(pipehandle);
  else
  {
    TAutoHandle pipe(pipehandle);
    impl_.reset(new TNamedPipeImpl(pipe));
  }
}

HANDLE TPipe::getWrtPipeHandle() {
  if (impl_)
    return impl_->getWrtPipeHandle();
  return INVALID_HANDLE_VALUE;
}

void TPipe::setWrtPipeHandle(HANDLE pipehandle) {
  if (impl_)
    impl_->setWrtPipeHandle(pipehandle);
}

HANDLE TPipe::getNativeWaitHandle() {
  if (impl_)
    return impl_->getNativeWaitHandle();
  return INVALID_HANDLE_VALUE;
}

long TPipe::getConnTimeout() {
  return TimeoutSeconds_;
}

void TPipe::setConnTimeout(long seconds) {
  TimeoutSeconds_ = seconds;
}

#endif //_WIN32
}
}
} // apache::thrift::transport
