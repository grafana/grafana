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

#ifndef _THRIFT_TRANSPORT_TBUFFERTRANSPORTS_H_
#define _THRIFT_TRANSPORT_TBUFFERTRANSPORTS_H_ 1

#include <cstdlib>
#include <cstring>
#include <limits>
#include <boost/scoped_array.hpp>

#include <thrift/transport/TTransport.h>
#include <thrift/transport/TVirtualTransport.h>

#ifdef __GNUC__
#define TDB_LIKELY(val) (__builtin_expect((val), 1))
#define TDB_UNLIKELY(val) (__builtin_expect((val), 0))
#else
#define TDB_LIKELY(val) (val)
#define TDB_UNLIKELY(val) (val)
#endif

namespace apache {
namespace thrift {
namespace transport {

/**
 * Base class for all transports that use read/write buffers for performance.
 *
 * TBufferBase is designed to implement the fast-path "memcpy" style
 * operations that work in the common case.  It does so with small and
 * (eventually) nonvirtual, inlinable methods.  TBufferBase is an abstract
 * class.  Subclasses are expected to define the "slow path" operations
 * that have to be done when the buffers are full or empty.
 *
 */
class TBufferBase : public TVirtualTransport<TBufferBase> {

public:
  /**
   * Fast-path read.
   *
   * When we have enough data buffered to fulfill the read, we can satisfy it
   * with a single memcpy, then adjust our internal pointers.  If the buffer
   * is empty, we call out to our slow path, implemented by a subclass.
   * This method is meant to eventually be nonvirtual and inlinable.
   */
  uint32_t read(uint8_t* buf, uint32_t len) {
    uint8_t* new_rBase = rBase_ + len;
    if (TDB_LIKELY(new_rBase <= rBound_)) {
      std::memcpy(buf, rBase_, len);
      rBase_ = new_rBase;
      return len;
    }
    return readSlow(buf, len);
  }

  /**
   * Shortcutted version of readAll.
   */
  uint32_t readAll(uint8_t* buf, uint32_t len) {
    uint8_t* new_rBase = rBase_ + len;
    if (TDB_LIKELY(new_rBase <= rBound_)) {
      std::memcpy(buf, rBase_, len);
      rBase_ = new_rBase;
      return len;
    }
    return apache::thrift::transport::readAll(*this, buf, len);
  }

  /**
   * Fast-path write.
   *
   * When we have enough empty space in our buffer to accommodate the write, we
   * can satisfy it with a single memcpy, then adjust our internal pointers.
   * If the buffer is full, we call out to our slow path, implemented by a
   * subclass.  This method is meant to eventually be nonvirtual and
   * inlinable.
   */
  void write(const uint8_t* buf, uint32_t len) {
    uint8_t* new_wBase = wBase_ + len;
    if (TDB_LIKELY(new_wBase <= wBound_)) {
      std::memcpy(wBase_, buf, len);
      wBase_ = new_wBase;
      return;
    }
    writeSlow(buf, len);
  }

  /**
   * Fast-path borrow.  A lot like the fast-path read.
   */
  const uint8_t* borrow(uint8_t* buf, uint32_t* len) {
    if (TDB_LIKELY(static_cast<ptrdiff_t>(*len) <= rBound_ - rBase_)) {
      // With strict aliasing, writing to len shouldn't force us to
      // refetch rBase_ from memory.  TODO(dreiss): Verify this.
      *len = static_cast<uint32_t>(rBound_ - rBase_);
      return rBase_;
    }
    return borrowSlow(buf, len);
  }

  /**
   * Consume doesn't require a slow path.
   */
  void consume(uint32_t len) {
    if (TDB_LIKELY(static_cast<ptrdiff_t>(len) <= rBound_ - rBase_)) {
      rBase_ += len;
    } else {
      throw TTransportException(TTransportException::BAD_ARGS, "consume did not follow a borrow.");
    }
  }

protected:
  /// Slow path read.
  virtual uint32_t readSlow(uint8_t* buf, uint32_t len) = 0;

  /// Slow path write.
  virtual void writeSlow(const uint8_t* buf, uint32_t len) = 0;

  /**
   * Slow path borrow.
   *
   * POSTCONDITION: return == NULL || rBound_ - rBase_ >= *len
   */
  virtual const uint8_t* borrowSlow(uint8_t* buf, uint32_t* len) = 0;

  /**
   * Trivial constructor.
   *
   * Initialize pointers safely.  Constructing is not a very
   * performance-sensitive operation, so it is okay to just leave it to
   * the concrete class to set up pointers correctly.
   */
  TBufferBase() : rBase_(NULL), rBound_(NULL), wBase_(NULL), wBound_(NULL) {}

  /// Convenience mutator for setting the read buffer.
  void setReadBuffer(uint8_t* buf, uint32_t len) {
    rBase_ = buf;
    rBound_ = buf + len;
  }

  /// Convenience mutator for setting the write buffer.
  void setWriteBuffer(uint8_t* buf, uint32_t len) {
    wBase_ = buf;
    wBound_ = buf + len;
  }

  virtual ~TBufferBase() {}

  /// Reads begin here.
  uint8_t* rBase_;
  /// Reads may extend to just before here.
  uint8_t* rBound_;

  /// Writes begin here.
  uint8_t* wBase_;
  /// Writes may extend to just before here.
  uint8_t* wBound_;
};

/**
 * Buffered transport. For reads it will read more data than is requested
 * and will serve future data out of a local buffer. For writes, data is
 * stored to an in memory buffer before being written out.
 *
 */
class TBufferedTransport : public TVirtualTransport<TBufferedTransport, TBufferBase> {
public:
  static const int DEFAULT_BUFFER_SIZE = 512;

  /// Use default buffer sizes.
  TBufferedTransport(boost::shared_ptr<TTransport> transport)
    : transport_(transport),
      rBufSize_(DEFAULT_BUFFER_SIZE),
      wBufSize_(DEFAULT_BUFFER_SIZE),
      rBuf_(new uint8_t[rBufSize_]),
      wBuf_(new uint8_t[wBufSize_]) {
    initPointers();
  }

  /// Use specified buffer sizes.
  TBufferedTransport(boost::shared_ptr<TTransport> transport, uint32_t sz)
    : transport_(transport),
      rBufSize_(sz),
      wBufSize_(sz),
      rBuf_(new uint8_t[rBufSize_]),
      wBuf_(new uint8_t[wBufSize_]) {
    initPointers();
  }

  /// Use specified read and write buffer sizes.
  TBufferedTransport(boost::shared_ptr<TTransport> transport, uint32_t rsz, uint32_t wsz)
    : transport_(transport),
      rBufSize_(rsz),
      wBufSize_(wsz),
      rBuf_(new uint8_t[rBufSize_]),
      wBuf_(new uint8_t[wBufSize_]) {
    initPointers();
  }

  void open() { transport_->open(); }

  bool isOpen() { return transport_->isOpen(); }

  bool peek() {
    if (rBase_ == rBound_) {
      setReadBuffer(rBuf_.get(), transport_->read(rBuf_.get(), rBufSize_));
    }
    return (rBound_ > rBase_);
  }

  void close() {
    flush();
    transport_->close();
  }

  virtual uint32_t readSlow(uint8_t* buf, uint32_t len);

  virtual void writeSlow(const uint8_t* buf, uint32_t len);

  void flush();

  /**
   * Returns the origin of the underlying transport
   */
  virtual const std::string getOrigin() { return transport_->getOrigin(); }

  /**
   * The following behavior is currently implemented by TBufferedTransport,
   * but that may change in a future version:
   * 1/ If len is at most rBufSize_, borrow will never return NULL.
   *    Depending on the underlying transport, it could throw an exception
   *    or hang forever.
   * 2/ Some borrow requests may copy bytes internally.  However,
   *    if len is at most rBufSize_/2, none of the copied bytes
   *    will ever have to be copied again.  For optimial performance,
   *    stay under this limit.
   */
  virtual const uint8_t* borrowSlow(uint8_t* buf, uint32_t* len);

  boost::shared_ptr<TTransport> getUnderlyingTransport() { return transport_; }

  /*
   * TVirtualTransport provides a default implementation of readAll().
   * We want to use the TBufferBase version instead.
   */
  uint32_t readAll(uint8_t* buf, uint32_t len) { return TBufferBase::readAll(buf, len); }

protected:
  void initPointers() {
    setReadBuffer(rBuf_.get(), 0);
    setWriteBuffer(wBuf_.get(), wBufSize_);
    // Write size never changes.
  }

  boost::shared_ptr<TTransport> transport_;

  uint32_t rBufSize_;
  uint32_t wBufSize_;
  boost::scoped_array<uint8_t> rBuf_;
  boost::scoped_array<uint8_t> wBuf_;
};

/**
 * Wraps a transport into a buffered one.
 *
 */
class TBufferedTransportFactory : public TTransportFactory {
public:
  TBufferedTransportFactory() {}

  virtual ~TBufferedTransportFactory() {}

  /**
   * Wraps the transport into a buffered one.
   */
  virtual boost::shared_ptr<TTransport> getTransport(boost::shared_ptr<TTransport> trans) {
    return boost::shared_ptr<TTransport>(new TBufferedTransport(trans));
  }
};

/**
 * Framed transport. All writes go into an in-memory buffer until flush is
 * called, at which point the transport writes the length of the entire
 * binary chunk followed by the data payload. This allows the receiver on the
 * other end to always do fixed-length reads.
 *
 */
class TFramedTransport : public TVirtualTransport<TFramedTransport, TBufferBase> {
public:
  static const int DEFAULT_BUFFER_SIZE = 512;
  static const int DEFAULT_MAX_FRAME_SIZE = 256 * 1024 * 1024;

  /// Use default buffer sizes.
  TFramedTransport()
    : transport_(),
      rBufSize_(0),
      wBufSize_(DEFAULT_BUFFER_SIZE),
      rBuf_(),
      wBuf_(new uint8_t[wBufSize_]),
      bufReclaimThresh_((std::numeric_limits<uint32_t>::max)()) {
    initPointers();
  }

  TFramedTransport(boost::shared_ptr<TTransport> transport)
    : transport_(transport),
      rBufSize_(0),
      wBufSize_(DEFAULT_BUFFER_SIZE),
      rBuf_(),
      wBuf_(new uint8_t[wBufSize_]),
      bufReclaimThresh_((std::numeric_limits<uint32_t>::max)()),
      maxFrameSize_(DEFAULT_MAX_FRAME_SIZE) {
    initPointers();
  }

  TFramedTransport(boost::shared_ptr<TTransport> transport,
                   uint32_t sz,
                   uint32_t bufReclaimThresh = (std::numeric_limits<uint32_t>::max)())
    : transport_(transport),
      rBufSize_(0),
      wBufSize_(sz),
      rBuf_(),
      wBuf_(new uint8_t[wBufSize_]),
      bufReclaimThresh_(bufReclaimThresh),
      maxFrameSize_(DEFAULT_MAX_FRAME_SIZE) {
    initPointers();
  }

  void open() { transport_->open(); }

  bool isOpen() { return transport_->isOpen(); }

  bool peek() { return (rBase_ < rBound_) || transport_->peek(); }

  void close() {
    flush();
    transport_->close();
  }

  virtual uint32_t readSlow(uint8_t* buf, uint32_t len);

  virtual void writeSlow(const uint8_t* buf, uint32_t len);

  virtual void flush();

  uint32_t readEnd();

  uint32_t writeEnd();

  const uint8_t* borrowSlow(uint8_t* buf, uint32_t* len);

  boost::shared_ptr<TTransport> getUnderlyingTransport() { return transport_; }

  /*
   * TVirtualTransport provides a default implementation of readAll().
   * We want to use the TBufferBase version instead.
   */
  using TBufferBase::readAll;

  /**
   * Returns the origin of the underlying transport
   */
  virtual const std::string getOrigin() { return transport_->getOrigin(); }

  /**
   * Set the maximum size of the frame at read
   */
  void setMaxFrameSize(uint32_t maxFrameSize) { maxFrameSize_ = maxFrameSize; }

  /**
   * Get the maximum size of the frame at read
   */
  uint32_t getMaxFrameSize() { return maxFrameSize_; }

protected:
  /**
   * Reads a frame of input from the underlying stream.
   *
   * Returns true if a frame was read successfully, or false on EOF.
   * (Raises a TTransportException if EOF occurs after a partial frame.)
   */
  virtual bool readFrame();

  void initPointers() {
    setReadBuffer(NULL, 0);
    setWriteBuffer(wBuf_.get(), wBufSize_);

    // Pad the buffer so we can insert the size later.
    int32_t pad = 0;
    this->write((uint8_t*)&pad, sizeof(pad));
  }

  boost::shared_ptr<TTransport> transport_;

  uint32_t rBufSize_;
  uint32_t wBufSize_;
  boost::scoped_array<uint8_t> rBuf_;
  boost::scoped_array<uint8_t> wBuf_;
  uint32_t bufReclaimThresh_;
  uint32_t maxFrameSize_;
};

/**
 * Wraps a transport into a framed one.
 *
 */
class TFramedTransportFactory : public TTransportFactory {
public:
  TFramedTransportFactory() {}

  virtual ~TFramedTransportFactory() {}

  /**
   * Wraps the transport into a framed one.
   */
  virtual boost::shared_ptr<TTransport> getTransport(boost::shared_ptr<TTransport> trans) {
    return boost::shared_ptr<TTransport>(new TFramedTransport(trans));
  }
};

/**
 * A memory buffer is a tranpsort that simply reads from and writes to an
 * in memory buffer. Anytime you call write on it, the data is simply placed
 * into a buffer, and anytime you call read, data is read from that buffer.
 *
 * The buffers are allocated using C constructs malloc,realloc, and the size
 * doubles as necessary.  We've considered using scoped
 *
 */
class TMemoryBuffer : public TVirtualTransport<TMemoryBuffer, TBufferBase> {
private:
  // Common initialization done by all constructors.
  void initCommon(uint8_t* buf, uint32_t size, bool owner, uint32_t wPos) {
    if (buf == NULL && size != 0) {
      assert(owner);
      buf = (uint8_t*)std::malloc(size);
      if (buf == NULL) {
        throw std::bad_alloc();
      }
    }

    buffer_ = buf;
    bufferSize_ = size;

    rBase_ = buffer_;
    rBound_ = buffer_ + wPos;
    // TODO(dreiss): Investigate NULL-ing this if !owner.
    wBase_ = buffer_ + wPos;
    wBound_ = buffer_ + bufferSize_;

    owner_ = owner;

    // rBound_ is really an artifact.  In principle, it should always be
    // equal to wBase_.  We update it in a few places (computeRead, etc.).
  }

public:
  static const uint32_t defaultSize = 1024;

  /**
   * This enum specifies how a TMemoryBuffer should treat
   * memory passed to it via constructors or resetBuffer.
   *
   * OBSERVE:
   *   TMemoryBuffer will simply store a pointer to the memory.
   *   It is the callers responsibility to ensure that the pointer
   *   remains valid for the lifetime of the TMemoryBuffer,
   *   and that it is properly cleaned up.
   *   Note that no data can be written to observed buffers.
   *
   * COPY:
   *   TMemoryBuffer will make an internal copy of the buffer.
   *   The caller has no responsibilities.
   *
   * TAKE_OWNERSHIP:
   *   TMemoryBuffer will become the "owner" of the buffer,
   *   and will be responsible for freeing it.
   *   The membory must have been allocated with malloc.
   */
  enum MemoryPolicy { OBSERVE = 1, COPY = 2, TAKE_OWNERSHIP = 3 };

  /**
   * Construct a TMemoryBuffer with a default-sized buffer,
   * owned by the TMemoryBuffer object.
   */
  TMemoryBuffer() { initCommon(NULL, defaultSize, true, 0); }

  /**
   * Construct a TMemoryBuffer with a buffer of a specified size,
   * owned by the TMemoryBuffer object.
   *
   * @param sz  The initial size of the buffer.
   */
  TMemoryBuffer(uint32_t sz) { initCommon(NULL, sz, true, 0); }

  /**
   * Construct a TMemoryBuffer with buf as its initial contents.
   *
   * @param buf    The initial contents of the buffer.
   *               Note that, while buf is a non-const pointer,
   *               TMemoryBuffer will not write to it if policy == OBSERVE,
   *               so it is safe to const_cast<uint8_t*>(whatever).
   * @param sz     The size of @c buf.
   * @param policy See @link MemoryPolicy @endlink .
   */
  TMemoryBuffer(uint8_t* buf, uint32_t sz, MemoryPolicy policy = OBSERVE) {
    if (buf == NULL && sz != 0) {
      throw TTransportException(TTransportException::BAD_ARGS,
                                "TMemoryBuffer given null buffer with non-zero size.");
    }

    switch (policy) {
    case OBSERVE:
    case TAKE_OWNERSHIP:
      initCommon(buf, sz, policy == TAKE_OWNERSHIP, sz);
      break;
    case COPY:
      initCommon(NULL, sz, true, 0);
      this->write(buf, sz);
      break;
    default:
      throw TTransportException(TTransportException::BAD_ARGS,
                                "Invalid MemoryPolicy for TMemoryBuffer");
    }
  }

  ~TMemoryBuffer() {
    if (owner_) {
      std::free(buffer_);
    }
  }

  bool isOpen() { return true; }

  bool peek() { return (rBase_ < wBase_); }

  void open() {}

  void close() {}

  // TODO(dreiss): Make bufPtr const.
  void getBuffer(uint8_t** bufPtr, uint32_t* sz) {
    *bufPtr = rBase_;
    *sz = static_cast<uint32_t>(wBase_ - rBase_);
  }

  std::string getBufferAsString() {
    if (buffer_ == NULL) {
      return "";
    }
    uint8_t* buf;
    uint32_t sz;
    getBuffer(&buf, &sz);
    return std::string((char*)buf, (std::string::size_type)sz);
  }

  void appendBufferToString(std::string& str) {
    if (buffer_ == NULL) {
      return;
    }
    uint8_t* buf;
    uint32_t sz;
    getBuffer(&buf, &sz);
    str.append((char*)buf, sz);
  }

  void resetBuffer() {
    rBase_ = buffer_;
    rBound_ = buffer_;
    wBase_ = buffer_;
    // It isn't safe to write into a buffer we don't own.
    if (!owner_) {
      wBound_ = wBase_;
      bufferSize_ = 0;
    }
  }

  /// See constructor documentation.
  void resetBuffer(uint8_t* buf, uint32_t sz, MemoryPolicy policy = OBSERVE) {
    // Use a variant of the copy-and-swap trick for assignment operators.
    // This is sub-optimal in terms of performance for two reasons:
    //   1/ The constructing and swapping of the (small) values
    //      in the temporary object takes some time, and is not necessary.
    //   2/ If policy == COPY, we allocate the new buffer before
    //      freeing the old one, precluding the possibility of
    //      reusing that memory.
    // I doubt that either of these problems could be optimized away,
    // but the second is probably no a common case, and the first is minor.
    // I don't expect resetBuffer to be a common operation, so I'm willing to
    // bite the performance bullet to make the method this simple.

    // Construct the new buffer.
    TMemoryBuffer new_buffer(buf, sz, policy);
    // Move it into ourself.
    this->swap(new_buffer);
    // Our old self gets destroyed.
  }

  /// See constructor documentation.
  void resetBuffer(uint32_t sz) {
    // Construct the new buffer.
    TMemoryBuffer new_buffer(sz);
    // Move it into ourself.
    this->swap(new_buffer);
    // Our old self gets destroyed.
  }

  std::string readAsString(uint32_t len) {
    std::string str;
    (void)readAppendToString(str, len);
    return str;
  }

  uint32_t readAppendToString(std::string& str, uint32_t len);

  // return number of bytes read
  uint32_t readEnd() {
    // This cast should be safe, because buffer_'s size is a uint32_t
    uint32_t bytes = static_cast<uint32_t>(rBase_ - buffer_);
    if (rBase_ == wBase_) {
      resetBuffer();
    }
    return bytes;
  }

  // Return number of bytes written
  uint32_t writeEnd() {
    // This cast should be safe, because buffer_'s size is a uint32_t
    return static_cast<uint32_t>(wBase_ - buffer_);
  }

  uint32_t available_read() const {
    // Remember, wBase_ is the real rBound_.
    return static_cast<uint32_t>(wBase_ - rBase_);
  }

  uint32_t available_write() const { return static_cast<uint32_t>(wBound_ - wBase_); }

  // Returns a pointer to where the client can write data to append to
  // the TMemoryBuffer, and ensures the buffer is big enough to accommodate a
  // write of the provided length.  The returned pointer is very convenient for
  // passing to read(), recv(), or similar. You must call wroteBytes() as soon
  // as data is written or the buffer will not be aware that data has changed.
  uint8_t* getWritePtr(uint32_t len) {
    ensureCanWrite(len);
    return wBase_;
  }

  // Informs the buffer that the client has written 'len' bytes into storage
  // that had been provided by getWritePtr().
  void wroteBytes(uint32_t len);

  /*
   * TVirtualTransport provides a default implementation of readAll().
   * We want to use the TBufferBase version instead.
   */
  uint32_t readAll(uint8_t* buf, uint32_t len) { return TBufferBase::readAll(buf, len); }

protected:
  void swap(TMemoryBuffer& that) {
    using std::swap;
    swap(buffer_, that.buffer_);
    swap(bufferSize_, that.bufferSize_);

    swap(rBase_, that.rBase_);
    swap(rBound_, that.rBound_);
    swap(wBase_, that.wBase_);
    swap(wBound_, that.wBound_);

    swap(owner_, that.owner_);
  }

  // Make sure there's at least 'len' bytes available for writing.
  void ensureCanWrite(uint32_t len);

  // Compute the position and available data for reading.
  void computeRead(uint32_t len, uint8_t** out_start, uint32_t* out_give);

  uint32_t readSlow(uint8_t* buf, uint32_t len);

  void writeSlow(const uint8_t* buf, uint32_t len);

  const uint8_t* borrowSlow(uint8_t* buf, uint32_t* len);

  // Data buffer
  uint8_t* buffer_;

  // Allocated buffer size
  uint32_t bufferSize_;

  // Is this object the owner of the buffer?
  bool owner_;

  // Don't forget to update constrctors, initCommon, and swap if
  // you add new members.
};
}
}
} // apache::thrift::transport

#endif // #ifndef _THRIFT_TRANSPORT_TBUFFERTRANSPORTS_H_
