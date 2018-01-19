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

#include <cassert>
#include <algorithm>

#include <thrift/transport/TBufferTransports.h>

using std::string;

namespace apache {
namespace thrift {
namespace transport {

uint32_t TBufferedTransport::readSlow(uint8_t* buf, uint32_t len) {
  uint32_t have = static_cast<uint32_t>(rBound_ - rBase_);

  // We should only take the slow path if we can't satisfy the read
  // with the data already in the buffer.
  assert(have < len);

  // If we have some data in the buffer, copy it out and return it.
  // We have to return it without attempting to read more, since we aren't
  // guaranteed that the underlying transport actually has more data, so
  // attempting to read from it could block.
  if (have > 0) {
    memcpy(buf, rBase_, have);
    setReadBuffer(rBuf_.get(), 0);
    return have;
  }

  // No data is available in our buffer.
  // Get more from underlying transport up to buffer size.
  // Note that this makes a lot of sense if len < rBufSize_
  // and almost no sense otherwise.  TODO(dreiss): Fix that
  // case (possibly including some readv hotness).
  setReadBuffer(rBuf_.get(), transport_->read(rBuf_.get(), rBufSize_));

  // Hand over whatever we have.
  uint32_t give = (std::min)(len, static_cast<uint32_t>(rBound_ - rBase_));
  memcpy(buf, rBase_, give);
  rBase_ += give;

  return give;
}

void TBufferedTransport::writeSlow(const uint8_t* buf, uint32_t len) {
  uint32_t have_bytes = static_cast<uint32_t>(wBase_ - wBuf_.get());
  uint32_t space = static_cast<uint32_t>(wBound_ - wBase_);
  // We should only take the slow path if we can't accommodate the write
  // with the free space already in the buffer.
  assert(wBound_ - wBase_ < static_cast<ptrdiff_t>(len));

  // Now here's the tricky question: should we copy data from buf into our
  // internal buffer and write it from there, or should we just write out
  // the current internal buffer in one syscall and write out buf in another.
  // If our currently buffered data plus buf is at least double our buffer
  // size, we will have to do two syscalls no matter what (except in the
  // degenerate case when our buffer is empty), so there is no use copying.
  // Otherwise, there is sort of a sliding scale.  If we have N-1 bytes
  // buffered and need to write 2, it would be crazy to do two syscalls.
  // On the other hand, if we have 2 bytes buffered and are writing 2N-3,
  // we can save a syscall in the short term by loading up our buffer, writing
  // it out, and copying the rest of the bytes into our buffer.  Of course,
  // if we get another 2-byte write, we haven't saved any syscalls at all,
  // and have just copied nearly 2N bytes for nothing.  Finding a perfect
  // policy would require predicting the size of future writes, so we're just
  // going to always eschew syscalls if we have less than 2N bytes to write.

  // The case where we have to do two syscalls.
  // This case also covers the case where the buffer is empty,
  // but it is clearer (I think) to think of it as two separate cases.
  if ((have_bytes + len >= 2 * wBufSize_) || (have_bytes == 0)) {
    // TODO(dreiss): writev
    if (have_bytes > 0) {
      transport_->write(wBuf_.get(), have_bytes);
    }
    transport_->write(buf, len);
    wBase_ = wBuf_.get();
    return;
  }

  // Fill up our internal buffer for a write.
  memcpy(wBase_, buf, space);
  buf += space;
  len -= space;
  transport_->write(wBuf_.get(), wBufSize_);

  // Copy the rest into our buffer.
  assert(len < wBufSize_);
  memcpy(wBuf_.get(), buf, len);
  wBase_ = wBuf_.get() + len;
  return;
}

const uint8_t* TBufferedTransport::borrowSlow(uint8_t* buf, uint32_t* len) {
  (void)buf;
  (void)len;
  // Simply return NULL.  We don't know if there is actually data available on
  // the underlying transport, so calling read() might block.
  return NULL;
}

void TBufferedTransport::flush() {
  // Write out any data waiting in the write buffer.
  uint32_t have_bytes = static_cast<uint32_t>(wBase_ - wBuf_.get());
  if (have_bytes > 0) {
    // Note that we reset wBase_ prior to the underlying write
    // to ensure we're in a sane state (i.e. internal buffer cleaned)
    // if the underlying write throws up an exception
    wBase_ = wBuf_.get();
    transport_->write(wBuf_.get(), have_bytes);
  }

  // Flush the underlying transport.
  transport_->flush();
}

uint32_t TFramedTransport::readSlow(uint8_t* buf, uint32_t len) {
  uint32_t want = len;
  uint32_t have = static_cast<uint32_t>(rBound_ - rBase_);

  // We should only take the slow path if we can't satisfy the read
  // with the data already in the buffer.
  assert(have < want);

  // If we have some data in the buffer, copy it out and return it.
  // We have to return it without attempting to read more, since we aren't
  // guaranteed that the underlying transport actually has more data, so
  // attempting to read from it could block.
  if (have > 0) {
    memcpy(buf, rBase_, have);
    setReadBuffer(rBuf_.get(), 0);
    return have;
  }

  // Read another frame.
  if (!readFrame()) {
    // EOF.  No frame available.
    return 0;
  }

  // TODO(dreiss): Should we warn when reads cross frames?

  // Hand over whatever we have.
  uint32_t give = (std::min)(want, static_cast<uint32_t>(rBound_ - rBase_));
  memcpy(buf, rBase_, give);
  rBase_ += give;
  want -= give;

  return (len - want);
}

bool TFramedTransport::readFrame() {
  // TODO(dreiss): Think about using readv here, even though it would
  // result in (gasp) read-ahead.

  // Read the size of the next frame.
  // We can't use readAll(&sz, sizeof(sz)), since that always throws an
  // exception on EOF.  We want to throw an exception only if EOF occurs after
  // partial size data.
  int32_t sz = -1;
  uint32_t size_bytes_read = 0;
  while (size_bytes_read < sizeof(sz)) {
    uint8_t* szp = reinterpret_cast<uint8_t*>(&sz) + size_bytes_read;
    uint32_t bytes_read
        = transport_->read(szp, static_cast<uint32_t>(sizeof(sz)) - size_bytes_read);
    if (bytes_read == 0) {
      if (size_bytes_read == 0) {
        // EOF before any data was read.
        return false;
      } else {
        // EOF after a partial frame header.  Raise an exception.
        throw TTransportException(TTransportException::END_OF_FILE,
                                  "No more data to read after "
                                  "partial frame header.");
      }
    }
    size_bytes_read += bytes_read;
  }

  sz = ntohl(sz);

  if (sz < 0) {
    throw TTransportException("Frame size has negative value");
  }

  // Check for oversized frame
  if (sz > static_cast<int32_t>(maxFrameSize_))
    throw TTransportException(TTransportException::CORRUPTED_DATA, "Received an oversized frame");

  // Read the frame payload, and reset markers.
  if (sz > static_cast<int32_t>(rBufSize_)) {
    rBuf_.reset(new uint8_t[sz]);
    rBufSize_ = sz;
  }
  transport_->readAll(rBuf_.get(), sz);
  setReadBuffer(rBuf_.get(), sz);
  return true;
}

void TFramedTransport::writeSlow(const uint8_t* buf, uint32_t len) {
  // Double buffer size until sufficient.
  uint32_t have = static_cast<uint32_t>(wBase_ - wBuf_.get());
  uint32_t new_size = wBufSize_;
  if (len + have < have /* overflow */ || len + have > 0x7fffffff) {
    throw TTransportException(TTransportException::BAD_ARGS,
                              "Attempted to write over 2 GB to TFramedTransport.");
  }
  while (new_size < len + have) {
    new_size = new_size > 0 ? new_size * 2 : 1;
  }

  // TODO(dreiss): Consider modifying this class to use malloc/free
  // so we can use realloc here.

  // Allocate new buffer.
  uint8_t* new_buf = new uint8_t[new_size];

  // Copy the old buffer to the new one.
  memcpy(new_buf, wBuf_.get(), have);

  // Now point buf to the new one.
  wBuf_.reset(new_buf);
  wBufSize_ = new_size;
  wBase_ = wBuf_.get() + have;
  wBound_ = wBuf_.get() + wBufSize_;

  // Copy the data into the new buffer.
  memcpy(wBase_, buf, len);
  wBase_ += len;
}

void TFramedTransport::flush() {
  int32_t sz_hbo, sz_nbo;
  assert(wBufSize_ > sizeof(sz_nbo));

  // Slip the frame size into the start of the buffer.
  sz_hbo = static_cast<uint32_t>(wBase_ - (wBuf_.get() + sizeof(sz_nbo)));
  sz_nbo = (int32_t)htonl((uint32_t)(sz_hbo));
  memcpy(wBuf_.get(), (uint8_t*)&sz_nbo, sizeof(sz_nbo));

  if (sz_hbo > 0) {
    // Note that we reset wBase_ (with a pad for the frame size)
    // prior to the underlying write to ensure we're in a sane state
    // (i.e. internal buffer cleaned) if the underlying write throws
    // up an exception
    wBase_ = wBuf_.get() + sizeof(sz_nbo);

    // Write size and frame body.
    transport_->write(wBuf_.get(), static_cast<uint32_t>(sizeof(sz_nbo)) + sz_hbo);
  }

  // Flush the underlying transport.
  transport_->flush();

  // reclaim write buffer
  if (wBufSize_ > bufReclaimThresh_) {
    wBufSize_ = DEFAULT_BUFFER_SIZE;
    wBuf_.reset(new uint8_t[wBufSize_]);
    setWriteBuffer(wBuf_.get(), wBufSize_);

    // reset wBase_ with a pad for the frame size
    int32_t pad = 0;
    wBase_ = wBuf_.get() + sizeof(pad);
  }
}

uint32_t TFramedTransport::writeEnd() {
  return static_cast<uint32_t>(wBase_ - wBuf_.get());
}

const uint8_t* TFramedTransport::borrowSlow(uint8_t* buf, uint32_t* len) {
  (void)buf;
  (void)len;
  // Don't try to be clever with shifting buffers.
  // If the fast path failed let the protocol use its slow path.
  // Besides, who is going to try to borrow across messages?
  return NULL;
}

uint32_t TFramedTransport::readEnd() {
  // include framing bytes
  uint32_t bytes_read = static_cast<uint32_t>(rBound_ - rBuf_.get() + sizeof(uint32_t));

  if (rBufSize_ > bufReclaimThresh_) {
    rBufSize_ = 0;
    rBuf_.reset();
    setReadBuffer(rBuf_.get(), rBufSize_);
  }

  return bytes_read;
}

void TMemoryBuffer::computeRead(uint32_t len, uint8_t** out_start, uint32_t* out_give) {
  // Correct rBound_ so we can use the fast path in the future.
  rBound_ = wBase_;

  // Decide how much to give.
  uint32_t give = (std::min)(len, available_read());

  *out_start = rBase_;
  *out_give = give;

  // Preincrement rBase_ so the caller doesn't have to.
  rBase_ += give;
}

uint32_t TMemoryBuffer::readSlow(uint8_t* buf, uint32_t len) {
  uint8_t* start;
  uint32_t give;
  computeRead(len, &start, &give);

  // Copy into the provided buffer.
  memcpy(buf, start, give);

  return give;
}

uint32_t TMemoryBuffer::readAppendToString(std::string& str, uint32_t len) {
  // Don't get some stupid assertion failure.
  if (buffer_ == NULL) {
    return 0;
  }

  uint8_t* start;
  uint32_t give;
  computeRead(len, &start, &give);

  // Append to the provided string.
  str.append((char*)start, give);

  return give;
}

void TMemoryBuffer::ensureCanWrite(uint32_t len) {
  // Check available space
  uint32_t avail = available_write();
  if (len <= avail) {
    return;
  }

  if (!owner_) {
    throw TTransportException("Insufficient space in external MemoryBuffer");
  }

  // Grow the buffer as necessary.
  uint32_t new_size = bufferSize_;
  while (len > avail) {
    new_size = new_size > 0 ? new_size * 2 : 1;
    avail = available_write() + (new_size - bufferSize_);
  }

  // Allocate into a new pointer so we don't bork ours if it fails.
  uint8_t* new_buffer = static_cast<uint8_t*>(std::realloc(buffer_, new_size));
  if (new_buffer == NULL) {
    throw std::bad_alloc();
  }

  rBase_ = new_buffer + (rBase_ - buffer_);
  rBound_ = new_buffer + (rBound_ - buffer_);
  wBase_ = new_buffer + (wBase_ - buffer_);
  wBound_ = new_buffer + new_size;
  buffer_ = new_buffer;
  bufferSize_ = new_size;
}

void TMemoryBuffer::writeSlow(const uint8_t* buf, uint32_t len) {
  ensureCanWrite(len);

  // Copy into the buffer and increment wBase_.
  memcpy(wBase_, buf, len);
  wBase_ += len;
}

void TMemoryBuffer::wroteBytes(uint32_t len) {
  uint32_t avail = available_write();
  if (len > avail) {
    throw TTransportException("Client wrote more bytes than size of buffer.");
  }
  wBase_ += len;
}

const uint8_t* TMemoryBuffer::borrowSlow(uint8_t* buf, uint32_t* len) {
  (void)buf;
  rBound_ = wBase_;
  if (available_read() >= *len) {
    *len = available_read();
    return rBase_;
  }
  return NULL;
}
}
}
} // apache::thrift::transport
