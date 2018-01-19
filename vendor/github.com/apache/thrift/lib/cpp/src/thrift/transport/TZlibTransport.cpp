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
#include <cstring>
#include <algorithm>
#include <thrift/transport/TZlibTransport.h>

using std::string;

namespace apache {
namespace thrift {
namespace transport {

// Don't call this outside of the constructor.
void TZlibTransport::initZlib() {
  int rv;
  bool r_init = false;
  try {
    rstream_ = new z_stream;
    wstream_ = new z_stream;

    rstream_->zalloc = Z_NULL;
    wstream_->zalloc = Z_NULL;
    rstream_->zfree = Z_NULL;
    wstream_->zfree = Z_NULL;
    rstream_->opaque = Z_NULL;
    wstream_->opaque = Z_NULL;

    rstream_->next_in = crbuf_;
    wstream_->next_in = uwbuf_;
    rstream_->next_out = urbuf_;
    wstream_->next_out = cwbuf_;
    rstream_->avail_in = 0;
    wstream_->avail_in = 0;
    rstream_->avail_out = urbuf_size_;
    wstream_->avail_out = cwbuf_size_;

    rv = inflateInit(rstream_);
    checkZlibRv(rv, rstream_->msg);

    // Have to set this flag so we know whether to de-initialize.
    r_init = true;

    rv = deflateInit(wstream_, comp_level_);
    checkZlibRv(rv, wstream_->msg);
  }

  catch (...) {
    if (r_init) {
      rv = inflateEnd(rstream_);
      checkZlibRvNothrow(rv, rstream_->msg);
    }
    // There is no way we can get here if wstream_ was initialized.

    throw;
  }
}

inline void TZlibTransport::checkZlibRv(int status, const char* message) {
  if (status != Z_OK) {
    throw TZlibTransportException(status, message);
  }
}

inline void TZlibTransport::checkZlibRvNothrow(int status, const char* message) {
  if (status != Z_OK) {
    string output = "TZlibTransport: zlib failure in destructor: "
                    + TZlibTransportException::errorMessage(status, message);
    GlobalOutput(output.c_str());
  }
}

TZlibTransport::~TZlibTransport() {
  int rv;
  rv = inflateEnd(rstream_);
  checkZlibRvNothrow(rv, rstream_->msg);

  rv = deflateEnd(wstream_);
  // Z_DATA_ERROR may be returned if the caller has written data, but not
  // called flush() to actually finish writing the data out to the underlying
  // transport.  The defined TTransport behavior in this case is that this data
  // may be discarded, so we ignore the error and silently discard the data.
  // For other erros, log a message.
  if (rv != Z_DATA_ERROR) {
    checkZlibRvNothrow(rv, wstream_->msg);
  }

  delete[] urbuf_;
  delete[] crbuf_;
  delete[] uwbuf_;
  delete[] cwbuf_;
  delete rstream_;
  delete wstream_;
}

bool TZlibTransport::isOpen() {
  return (readAvail() > 0) || (rstream_->avail_in > 0) || transport_->isOpen();
}

bool TZlibTransport::peek() {
  return (readAvail() > 0) || (rstream_->avail_in > 0) || transport_->peek();
}

// READING STRATEGY
//
// We have two buffers for reading: one containing the compressed data (crbuf_)
// and one containing the uncompressed data (urbuf_).  When read is called,
// we repeat the following steps until we have satisfied the request:
// - Copy data from urbuf_ into the caller's buffer.
// - If we had enough, return.
// - If urbuf_ is empty, read some data into it from the underlying transport.
// - Inflate data from crbuf_ into urbuf_.
//
// In standalone objects, we set input_ended_ to true when inflate returns
// Z_STREAM_END.  This allows to make sure that a checksum was verified.

inline int TZlibTransport::readAvail() {
  return urbuf_size_ - rstream_->avail_out - urpos_;
}

uint32_t TZlibTransport::read(uint8_t* buf, uint32_t len) {
  uint32_t need = len;

  // TODO(dreiss): Skip urbuf on big reads.

  while (true) {
    // Copy out whatever we have available, then give them the min of
    // what we have and what they want, then advance indices.
    int give = (std::min)((uint32_t)readAvail(), need);
    memcpy(buf, urbuf_ + urpos_, give);
    need -= give;
    buf += give;
    urpos_ += give;

    // If they were satisfied, we are done.
    if (need == 0) {
      return len;
    }

    // If we will need to read from the underlying transport to get more data,
    // but we already have some data available, return it now.  Reading from
    // the underlying transport may block, and read() is only allowed to block
    // when no data is available.
    if (need < len && rstream_->avail_in == 0) {
      return len - need;
    }

    // If we get to this point, we need to get some more data.

    // If zlib has reported the end of a stream, we can't really do any more.
    if (input_ended_) {
      return len - need;
    }

    // The uncompressed read buffer is empty, so reset the stream fields.
    rstream_->next_out = urbuf_;
    rstream_->avail_out = urbuf_size_;
    urpos_ = 0;

    // Call inflate() to uncompress some more data
    if (!readFromZlib()) {
      // no data available from underlying transport
      return len - need;
    }

    // Okay.  The read buffer should have whatever we can give it now.
    // Loop back to the start and try to give some more.
  }
}

bool TZlibTransport::readFromZlib() {
  assert(!input_ended_);

  // If we don't have any more compressed data available,
  // read some from the underlying transport.
  if (rstream_->avail_in == 0) {
    uint32_t got = transport_->read(crbuf_, crbuf_size_);
    if (got == 0) {
      return false;
    }
    rstream_->next_in = crbuf_;
    rstream_->avail_in = got;
  }

  // We have some compressed data now.  Uncompress it.
  int zlib_rv = inflate(rstream_, Z_SYNC_FLUSH);

  if (zlib_rv == Z_STREAM_END) {
    input_ended_ = true;
  } else {
    checkZlibRv(zlib_rv, rstream_->msg);
  }

  return true;
}

// WRITING STRATEGY
//
// We buffer up small writes before sending them to zlib, so our logic is:
// - Is the write big?
//   - Send the buffer to zlib.
//   - Send this data to zlib.
// - Is the write small?
//   - Is there insufficient space in the buffer for it?
//     - Send the buffer to zlib.
//   - Copy the data to the buffer.
//
// We have two buffers for writing also: the uncompressed buffer (mentioned
// above) and the compressed buffer.  When sending data to zlib we loop over
// the following until the source (uncompressed buffer or big write) is empty:
// - Is there no more space in the compressed buffer?
//   - Write the compressed buffer to the underlying transport.
// - Deflate from the source into the compressed buffer.

void TZlibTransport::write(const uint8_t* buf, uint32_t len) {
  if (output_finished_) {
    throw TTransportException(TTransportException::BAD_ARGS, "write() called after finish()");
  }

  // zlib's "deflate" function has enough logic in it that I think
  // we're better off (performance-wise) buffering up small writes.
  if (len > MIN_DIRECT_DEFLATE_SIZE) {
    flushToZlib(uwbuf_, uwpos_, Z_NO_FLUSH);
    uwpos_ = 0;
    flushToZlib(buf, len, Z_NO_FLUSH);
  } else if (len > 0) {
    if (uwbuf_size_ - uwpos_ < len) {
      flushToZlib(uwbuf_, uwpos_, Z_NO_FLUSH);
      uwpos_ = 0;
    }
    memcpy(uwbuf_ + uwpos_, buf, len);
    uwpos_ += len;
  }
}

void TZlibTransport::flush() {
  if (output_finished_) {
    throw TTransportException(TTransportException::BAD_ARGS, "flush() called after finish()");
  }

  flushToTransport(Z_FULL_FLUSH);
}

void TZlibTransport::finish() {
  if (output_finished_) {
    throw TTransportException(TTransportException::BAD_ARGS, "finish() called more than once");
  }

  flushToTransport(Z_FINISH);
}

void TZlibTransport::flushToTransport(int flush) {
  // write pending data in uwbuf_ to zlib
  flushToZlib(uwbuf_, uwpos_, flush);
  uwpos_ = 0;

  // write all available data from zlib to the transport
  transport_->write(cwbuf_, cwbuf_size_ - wstream_->avail_out);
  wstream_->next_out = cwbuf_;
  wstream_->avail_out = cwbuf_size_;

  // flush the transport
  transport_->flush();
}

void TZlibTransport::flushToZlib(const uint8_t* buf, int len, int flush) {
  wstream_->next_in = const_cast<uint8_t*>(buf);
  wstream_->avail_in = len;

  while (true) {
    if (flush == Z_NO_FLUSH && wstream_->avail_in == 0) {
      break;
    }

    // If our ouput buffer is full, flush to the underlying transport.
    if (wstream_->avail_out == 0) {
      transport_->write(cwbuf_, cwbuf_size_);
      wstream_->next_out = cwbuf_;
      wstream_->avail_out = cwbuf_size_;
    }

    int zlib_rv = deflate(wstream_, flush);

    if (flush == Z_FINISH && zlib_rv == Z_STREAM_END) {
      assert(wstream_->avail_in == 0);
      output_finished_ = true;
      break;
    }

    checkZlibRv(zlib_rv, wstream_->msg);

    if ((flush == Z_SYNC_FLUSH || flush == Z_FULL_FLUSH) && wstream_->avail_in == 0
        && wstream_->avail_out != 0) {
      break;
    }
  }
}

const uint8_t* TZlibTransport::borrow(uint8_t* buf, uint32_t* len) {
  (void)buf;
  // Don't try to be clever with shifting buffers.
  // If we have enough data, give a pointer to it,
  // otherwise let the protcol use its slow path.
  if (readAvail() >= (int)*len) {
    *len = (uint32_t)readAvail();
    return urbuf_ + urpos_;
  }
  return NULL;
}

void TZlibTransport::consume(uint32_t len) {
  if (readAvail() >= (int)len) {
    urpos_ += len;
  } else {
    throw TTransportException(TTransportException::BAD_ARGS, "consume did not follow a borrow.");
  }
}

void TZlibTransport::verifyChecksum() {
  // If zlib has already reported the end of the stream,
  // it has verified the checksum.
  if (input_ended_) {
    return;
  }

  // This should only be called when reading is complete.
  // If the caller still has unread data, throw an exception.
  if (readAvail() > 0) {
    throw TTransportException(TTransportException::CORRUPTED_DATA,
                              "verifyChecksum() called before end of zlib stream");
  }

  // Reset the rstream fields, in case avail_out is 0.
  // (Since readAvail() is 0, we know there is no unread data in urbuf_)
  rstream_->next_out = urbuf_;
  rstream_->avail_out = urbuf_size_;
  urpos_ = 0;

  // Call inflate()
  // This will throw an exception if the checksum is bad.
  bool performed_inflate = readFromZlib();
  if (!performed_inflate) {
    // We needed to read from the underlying transport, and the read() call
    // returned 0.
    //
    // Not all TTransport implementations behave the same way here, so we'll
    // end up with different behavior depending on the underlying transport.
    //
    // For some transports (e.g., TFDTransport), read() blocks if no more data
    // is available.  They only return 0 if EOF has been reached, or if the
    // remote endpoint has closed the connection.  For those transports,
    // verifyChecksum() will block until the checksum becomes available.
    //
    // Other transport types (e.g., TMemoryBuffer) always return 0 immediately
    // if no more data is available.  For those transport types, verifyChecksum
    // will raise the following exception if the checksum is not available from
    // the underlying transport yet.
    throw TTransportException(TTransportException::CORRUPTED_DATA,
                              "checksum not available yet in "
                              "verifyChecksum()");
  }

  // If input_ended_ is true now, the checksum has been verified
  if (input_ended_) {
    return;
  }

  // The caller invoked us before the actual end of the data stream
  assert(rstream_->avail_out < urbuf_size_);
  throw TTransportException(TTransportException::CORRUPTED_DATA,
                            "verifyChecksum() called before end of "
                            "zlib stream");
}
}
}
} // apache::thrift::transport
