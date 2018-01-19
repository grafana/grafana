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

#ifndef THRIFT_TRANSPORT_THEADERTRANSPORT_H_
#define THRIFT_TRANSPORT_THEADERTRANSPORT_H_ 1

#include <bitset>
#include <vector>
#include <stdexcept>
#include <string>
#include <map>

#include <boost/scoped_array.hpp>
#include <boost/shared_ptr.hpp>

#include <thrift/protocol/TProtocolTypes.h>
#include <thrift/transport/TBufferTransports.h>
#include <thrift/transport/TTransport.h>
#include <thrift/transport/TVirtualTransport.h>

enum CLIENT_TYPE {
  THRIFT_HEADER_CLIENT_TYPE = 0,
  THRIFT_FRAMED_BINARY = 1,
  THRIFT_UNFRAMED_BINARY = 2,
  THRIFT_FRAMED_COMPACT = 3,
  THRIFT_UNFRAMED_COMPACT = 4,
  THRIFT_UNKNOWN_CLIENT_TYPE = 5,
};

namespace apache {
namespace thrift {
namespace transport {

using apache::thrift::protocol::T_COMPACT_PROTOCOL;

/**
 * Header transport. All writes go into an in-memory buffer until flush is
 * called, at which point the transport writes the length of the entire
 * binary chunk followed by the data payload. This allows the receiver on the
 * other end to always do fixed-length reads.
 *
 * Subclass TFramedTransport because most of the read/write methods are similar
 * and need similar buffers.  Major changes are readFrame & flush.
 *
 * Header Transport *must* be the same transport for both input and
 * output when used on the server side - client responses should be
 * the same protocol as those in the request.
 */
class THeaderTransport : public TVirtualTransport<THeaderTransport, TFramedTransport> {
public:
  static const int DEFAULT_BUFFER_SIZE = 512u;
  static const int THRIFT_MAX_VARINT32_BYTES = 5;

  /// Use default buffer sizes.
  explicit THeaderTransport(const boost::shared_ptr<TTransport>& transport)
    : TVirtualTransport(transport),
      outTransport_(transport),
      protoId(T_COMPACT_PROTOCOL),
      clientType(THRIFT_HEADER_CLIENT_TYPE),
      seqId(0),
      flags(0),
      tBufSize_(0),
      tBuf_(NULL) {
    if (!transport_) throw std::invalid_argument("transport is empty");
    initBuffers();
  }

  THeaderTransport(const boost::shared_ptr<TTransport> inTransport,
                   const boost::shared_ptr<TTransport> outTransport)
    : TVirtualTransport(inTransport),
      outTransport_(outTransport),
      protoId(T_COMPACT_PROTOCOL),
      clientType(THRIFT_HEADER_CLIENT_TYPE),
      seqId(0),
      flags(0),
      tBufSize_(0),
      tBuf_(NULL) {
    if (!transport_) throw std::invalid_argument("inTransport is empty");
    if (!outTransport_) throw std::invalid_argument("outTransport is empty");
    initBuffers();
  }

  virtual uint32_t readSlow(uint8_t* buf, uint32_t len);
  virtual void flush();

  void resizeTransformBuffer(uint32_t additionalSize = 0);

  uint16_t getProtocolId() const;
  void setProtocolId(uint16_t protoId) { this->protoId = protoId; }

  void resetProtocol();

  /**
   * We know we got a packet in header format here, try to parse the header
   *
   * @param headerSize size of the header portion
   * @param sz Size of the whole message, including header
   */
  void readHeaderFormat(uint16_t headerSize, uint32_t sz);

  /**
   * Untransform the data based on the received header flags
   * On conclusion of function, setReadBuffer is called with the
   * untransformed data.
   *
   * @param ptr ptr to data
   * @param size of data
   */
  void untransform(uint8_t* ptr, uint32_t sz);

  /**
   * Transform the data based on our write transform flags
   * At conclusion of function the write buffer is set to the
   * transformed data.
   *
   * @param ptr Ptr to data to transform
   * @param sz Size of data buffer
   */
  void transform(uint8_t* ptr, uint32_t sz);

  uint16_t getNumTransforms() const {
    int trans = writeTrans_.size();
    return trans;
  }

  void setTransform(uint16_t transId) { writeTrans_.push_back(transId); }

  // Info headers

  typedef std::map<std::string, std::string> StringToStringMap;

  // these work with write headers
  void setHeader(const std::string& key, const std::string& value);

  void clearHeaders();

  StringToStringMap& getWriteHeaders() { return writeHeaders_; }

  // these work with read headers
  const StringToStringMap& getHeaders() const { return readHeaders_; }

  // accessors for seqId
  int32_t getSequenceNumber() const { return seqId; }
  void setSequenceNumber(int32_t seqId) { this->seqId = seqId; }

  enum TRANSFORMS {
    ZLIB_TRANSFORM = 0x01,
  };

protected:
  /**
   * Reads a frame of input from the underlying stream.
   *
   * Returns true if a frame was read successfully, or false on EOF.
   * (Raises a TTransportException if EOF occurs after a partial frame.)
   */
  virtual bool readFrame();

  void ensureReadBuffer(uint32_t sz);
  uint32_t getWriteBytes();

  void initBuffers() {
    setReadBuffer(NULL, 0);
    setWriteBuffer(wBuf_.get(), wBufSize_);
  }

  boost::shared_ptr<TTransport> outTransport_;

  // 0 and 16th bits must be 0 to differentiate from framed & unframed
  static const uint32_t HEADER_MAGIC = 0x0FFF0000;
  static const uint32_t HEADER_MASK = 0xFFFF0000;
  static const uint32_t FLAGS_MASK = 0x0000FFFF;

  static const uint32_t MAX_FRAME_SIZE = 0x3FFFFFFF;

  int16_t protoId;
  uint16_t clientType;
  uint32_t seqId;
  uint16_t flags;

  std::vector<uint16_t> readTrans_;
  std::vector<uint16_t> writeTrans_;

  // Map to use for headers
  StringToStringMap readHeaders_;
  StringToStringMap writeHeaders_;

  /**
   * Returns the maximum number of bytes that write k/v headers can take
   */
  size_t getMaxWriteHeadersSize() const;

  struct infoIdType {
    enum idType {
      // start at 1 to avoid confusing header padding for an infoId
      KEYVALUE = 1,
      END // signal the end of infoIds we can handle
    };
  };

  // Buffers to use for transform processing
  uint32_t tBufSize_;
  boost::scoped_array<uint8_t> tBuf_;

  void readString(uint8_t*& ptr, /* out */ std::string& str, uint8_t const* headerBoundary);

  void writeString(uint8_t*& ptr, const std::string& str);

  // Varint utils
  /**
   * Read an i16 from the wire as a varint. The MSB of each byte is set
   * if there is another byte to follow. This can read up to 3 bytes.
   */
  uint32_t readVarint16(uint8_t const* ptr, int16_t* i16, uint8_t const* boundary);

  /**
   * Read an i32 from the wire as a varint. The MSB of each byte is set
   * if there is another byte to follow. This can read up to 5 bytes.
   */
  uint32_t readVarint32(uint8_t const* ptr, int32_t* i32, uint8_t const* boundary);

  /**
   * Write an i32 as a varint. Results in 1-5 bytes on the wire.
   */
  uint32_t writeVarint32(int32_t n, uint8_t* pkt);

  /**
   * Write an i16 as a varint. Results in 1-3 bytes on the wire.
   */
  uint32_t writeVarint16(int16_t n, uint8_t* pkt);
};

/**
 * Wraps a transport into a header one.
 *
 */
class THeaderTransportFactory : public TTransportFactory {
public:
  THeaderTransportFactory() {}

  virtual ~THeaderTransportFactory() {}

  /**
   * Wraps the transport into a header one.
   */
  virtual boost::shared_ptr<TTransport> getTransport(boost::shared_ptr<TTransport> trans) {
    return boost::shared_ptr<TTransport>(new THeaderTransport(trans));
  }
};
}
}
} // apache::thrift::transport

#endif // #ifndef THRIFT_TRANSPORT_THEADERTRANSPORT_H_
