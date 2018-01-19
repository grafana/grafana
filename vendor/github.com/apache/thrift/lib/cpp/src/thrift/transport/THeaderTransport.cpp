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

#include <thrift/transport/THeaderTransport.h>
#include <thrift/TApplicationException.h>
#include <thrift/protocol/TProtocolTypes.h>
#include <thrift/protocol/TBinaryProtocol.h>
#include <thrift/protocol/TCompactProtocol.h>

#include <utility>
#include <cassert>
#include <string>
#include <zlib.h>
#include <string.h>

using std::map;
using boost::shared_ptr;
using std::string;
using std::vector;

namespace apache {
namespace thrift {
namespace transport {

using namespace apache::thrift::protocol;
using apache::thrift::protocol::TBinaryProtocol;

uint32_t THeaderTransport::readSlow(uint8_t* buf, uint32_t len) {
  if (clientType == THRIFT_UNFRAMED_BINARY || clientType == THRIFT_UNFRAMED_COMPACT) {
    return transport_->read(buf, len);
  }

  return TFramedTransport::readSlow(buf, len);
}

uint16_t THeaderTransport::getProtocolId() const {
  if (clientType == THRIFT_HEADER_CLIENT_TYPE) {
    return protoId;
  } else if (clientType == THRIFT_UNFRAMED_COMPACT || clientType == THRIFT_FRAMED_COMPACT) {
    return T_COMPACT_PROTOCOL;
  } else {
    return T_BINARY_PROTOCOL; // Assume other transports use TBinary
  }
}

void THeaderTransport::ensureReadBuffer(uint32_t sz) {
  if (sz > rBufSize_) {
    rBuf_.reset(new uint8_t[sz]);
    rBufSize_ = sz;
  }
}

bool THeaderTransport::readFrame() {
  // szN is network byte order of sz
  uint32_t szN;
  uint32_t sz;

  // Read the size of the next frame.
  // We can't use readAll(&sz, sizeof(sz)), since that always throws an
  // exception on EOF.  We want to throw an exception only if EOF occurs after
  // partial size data.
  uint32_t sizeBytesRead = 0;
  while (sizeBytesRead < sizeof(szN)) {
    uint8_t* szp = reinterpret_cast<uint8_t*>(&szN) + sizeBytesRead;
    uint32_t bytesRead = transport_->read(szp, sizeof(szN) - sizeBytesRead);
    if (bytesRead == 0) {
      if (sizeBytesRead == 0) {
        // EOF before any data was read.
        return false;
      } else {
        // EOF after a partial frame header.  Raise an exception.
        throw TTransportException(TTransportException::END_OF_FILE,
                                  "No more data to read after "
                                  "partial frame header.");
      }
    }
    sizeBytesRead += bytesRead;
  }

  sz = ntohl(szN);

  ensureReadBuffer(4);

  if ((sz & TBinaryProtocol::VERSION_MASK) == (uint32_t)TBinaryProtocol::VERSION_1) {
    // unframed
    clientType = THRIFT_UNFRAMED_BINARY;
    memcpy(rBuf_.get(), &szN, sizeof(szN));
    setReadBuffer(rBuf_.get(), 4);
  } else if (static_cast<int8_t>(sz >> 24) == TCompactProtocol::PROTOCOL_ID
             && (static_cast<int8_t>(sz >> 16) & TCompactProtocol::VERSION_MASK)
                    == TCompactProtocol::VERSION_N) {
    clientType = THRIFT_UNFRAMED_COMPACT;
    memcpy(rBuf_.get(), &szN, sizeof(szN));
    setReadBuffer(rBuf_.get(), 4);
  } else {
    // Could be header format or framed. Check next uint32
    uint32_t magic_n;
    uint32_t magic;

    if (sz > MAX_FRAME_SIZE) {
      throw TTransportException(TTransportException::CORRUPTED_DATA,
                                "Header transport frame is too large");
    }

    ensureReadBuffer(sz);

    // We can use readAll here, because it would be an invalid frame otherwise
    transport_->readAll(reinterpret_cast<uint8_t*>(&magic_n), sizeof(magic_n));
    memcpy(rBuf_.get(), &magic_n, sizeof(magic_n));
    magic = ntohl(magic_n);

    if ((magic & TBinaryProtocol::VERSION_MASK) == (uint32_t)TBinaryProtocol::VERSION_1) {
      // framed
      clientType = THRIFT_FRAMED_BINARY;
      transport_->readAll(rBuf_.get() + 4, sz - 4);
      setReadBuffer(rBuf_.get(), sz);
    } else if (static_cast<int8_t>(magic >> 24) == TCompactProtocol::PROTOCOL_ID
               && (static_cast<int8_t>(magic >> 16) & TCompactProtocol::VERSION_MASK)
                      == TCompactProtocol::VERSION_N) {
      clientType = THRIFT_FRAMED_COMPACT;
      transport_->readAll(rBuf_.get() + 4, sz - 4);
      setReadBuffer(rBuf_.get(), sz);
    } else if (HEADER_MAGIC == (magic & HEADER_MASK)) {
      if (sz < 10) {
        throw TTransportException(TTransportException::CORRUPTED_DATA,
                                  "Header transport frame is too small");
      }

      transport_->readAll(rBuf_.get() + 4, sz - 4);

      // header format
      clientType = THRIFT_HEADER_CLIENT_TYPE;
      // flags
      flags = magic & FLAGS_MASK;
      // seqId
      uint32_t seqId_n;
      memcpy(&seqId_n, rBuf_.get() + 4, sizeof(seqId_n));
      seqId = ntohl(seqId_n);
      // header size
      uint16_t headerSize_n;
      memcpy(&headerSize_n, rBuf_.get() + 8, sizeof(headerSize_n));
      uint16_t headerSize = ntohs(headerSize_n);
      setReadBuffer(rBuf_.get(), sz);
      readHeaderFormat(headerSize, sz);
    } else {
      clientType = THRIFT_UNKNOWN_CLIENT_TYPE;
      throw TTransportException(TTransportException::BAD_ARGS,
                                "Could not detect client transport type");
    }
  }

  return true;
}

/**
 * Reads a string from ptr, taking care not to reach headerBoundary
 * Advances ptr on success
 *
 * @param   str                  output string
 * @throws  CORRUPTED_DATA  if size of string exceeds boundary
 */
void THeaderTransport::readString(uint8_t*& ptr,
                                  /* out */ string& str,
                                  uint8_t const* headerBoundary) {
  int32_t strLen;

  uint32_t bytes = readVarint32(ptr, &strLen, headerBoundary);
  if (strLen > headerBoundary - ptr) {
    throw TTransportException(TTransportException::CORRUPTED_DATA,
                              "Info header length exceeds header size");
  }
  ptr += bytes;
  str.assign(reinterpret_cast<const char*>(ptr), strLen);
  ptr += strLen;
}

void THeaderTransport::readHeaderFormat(uint16_t headerSize, uint32_t sz) {
  readTrans_.clear();   // Clear out any previous transforms.
  readHeaders_.clear(); // Clear out any previous headers.

  // skip over already processed magic(4), seqId(4), headerSize(2)
  uint8_t* ptr = reinterpret_cast<uint8_t*>(rBuf_.get() + 10);

  // Catch integer overflow, check for reasonable header size
  assert(headerSize < 16384);
  headerSize *= 4;
  const uint8_t* const headerBoundary = ptr + headerSize;
  if (headerSize > sz) {
    throw TTransportException(TTransportException::CORRUPTED_DATA,
                              "Header size is larger than frame");
  }
  uint8_t* data = ptr + headerSize;
  ptr += readVarint16(ptr, &protoId, headerBoundary);
  int16_t numTransforms;
  ptr += readVarint16(ptr, &numTransforms, headerBoundary);

  // For now all transforms consist of only the ID, not data.
  for (int i = 0; i < numTransforms; i++) {
    int32_t transId;
    ptr += readVarint32(ptr, &transId, headerBoundary);

    readTrans_.push_back(transId);
  }

  // Info headers
  while (ptr < headerBoundary) {
    int32_t infoId;
    ptr += readVarint32(ptr, &infoId, headerBoundary);

    if (infoId == 0) {
      // header padding
      break;
    }
    if (infoId >= infoIdType::END) {
      // cannot handle infoId
      break;
    }
    switch (infoId) {
    case infoIdType::KEYVALUE:
      // Process key-value headers
      uint32_t numKVHeaders;
      ptr += readVarint32(ptr, (int32_t*)&numKVHeaders, headerBoundary);
      // continue until we reach (padded) end of packet
      while (numKVHeaders-- && ptr < headerBoundary) {
        // format: key; value
        // both: length (varint32); value (string)
        string key, value;
        readString(ptr, key, headerBoundary);
        // value
        readString(ptr, value, headerBoundary);
        // save to headers
        readHeaders_[key] = value;
      }
      break;
    }
  }

  // Untransform the data section.  rBuf will contain result.
  untransform(data, sz - (data - rBuf_.get())); // ignore header in size calc
}

void THeaderTransport::untransform(uint8_t* ptr, uint32_t sz) {
  // Update the transform buffer size if needed
  resizeTransformBuffer();

  for (vector<uint16_t>::const_iterator it = readTrans_.begin(); it != readTrans_.end(); ++it) {
    const uint16_t transId = *it;

    if (transId == ZLIB_TRANSFORM) {
      z_stream stream;
      int err;

      stream.next_in = ptr;
      stream.avail_in = sz;

      // Setting these to 0 means use the default free/alloc functions
      stream.zalloc = (alloc_func)0;
      stream.zfree = (free_func)0;
      stream.opaque = (voidpf)0;
      err = inflateInit(&stream);
      if (err != Z_OK) {
        throw TApplicationException(TApplicationException::MISSING_RESULT,
                                    "Error while zlib deflateInit");
      }
      stream.next_out = tBuf_.get();
      stream.avail_out = tBufSize_;
      err = inflate(&stream, Z_FINISH);
      if (err != Z_STREAM_END || stream.avail_out == 0) {
        throw TApplicationException(TApplicationException::MISSING_RESULT,
                                    "Error while zlib deflate");
      }
      sz = stream.total_out;

      err = inflateEnd(&stream);
      if (err != Z_OK) {
        throw TApplicationException(TApplicationException::MISSING_RESULT,
                                    "Error while zlib deflateEnd");
      }

      memcpy(ptr, tBuf_.get(), sz);
    } else {
      throw TApplicationException(TApplicationException::MISSING_RESULT, "Unknown transform");
    }
  }

  setReadBuffer(ptr, sz);
}

/**
 * We may have updated the wBuf size, update the tBuf size to match.
 * Should be called in transform.
 *
 * The buffer should be slightly larger than write buffer size due to
 * compression transforms (that may slightly grow on small frame sizes)
 */
void THeaderTransport::resizeTransformBuffer(uint32_t additionalSize) {
  if (tBufSize_ < wBufSize_ + DEFAULT_BUFFER_SIZE) {
    uint32_t new_size = wBufSize_ + DEFAULT_BUFFER_SIZE + additionalSize;
    uint8_t* new_buf = new uint8_t[new_size];
    tBuf_.reset(new_buf);
    tBufSize_ = new_size;
  }
}

void THeaderTransport::transform(uint8_t* ptr, uint32_t sz) {
  // Update the transform buffer size if needed
  resizeTransformBuffer();

  for (vector<uint16_t>::const_iterator it = writeTrans_.begin(); it != writeTrans_.end(); ++it) {
    const uint16_t transId = *it;

    if (transId == ZLIB_TRANSFORM) {
      z_stream stream;
      int err;

      stream.next_in = ptr;
      stream.avail_in = sz;

      stream.zalloc = (alloc_func)0;
      stream.zfree = (free_func)0;
      stream.opaque = (voidpf)0;
      err = deflateInit(&stream, Z_DEFAULT_COMPRESSION);
      if (err != Z_OK) {
        throw TTransportException(TTransportException::CORRUPTED_DATA,
                                  "Error while zlib deflateInit");
      }
      uint32_t tbuf_size = 0;
      while (err == Z_OK) {
        resizeTransformBuffer(tbuf_size);

        stream.next_out = tBuf_.get();
        stream.avail_out = tBufSize_;
        err = deflate(&stream, Z_FINISH);
        tbuf_size += DEFAULT_BUFFER_SIZE;
      }
      sz = stream.total_out;

      err = deflateEnd(&stream);
      if (err != Z_OK) {
        throw TTransportException(TTransportException::CORRUPTED_DATA,
                                  "Error while zlib deflateEnd");
      }

      memcpy(ptr, tBuf_.get(), sz);
    } else {
      throw TTransportException(TTransportException::CORRUPTED_DATA, "Unknown transform");
    }
  }

  wBase_ = wBuf_.get() + sz;
}

void THeaderTransport::resetProtocol() {
  // Set to anything except HTTP type so we don't flush again
  clientType = THRIFT_HEADER_CLIENT_TYPE;

  // Read the header and decide which protocol to go with
  readFrame();
}

uint32_t THeaderTransport::getWriteBytes() {
  return wBase_ - wBuf_.get();
}

/**
 * Writes a string to a byte buffer, as size (varint32) + string (non-null
 * terminated)
 * Automatically advances ptr to after the written portion
 */
void THeaderTransport::writeString(uint8_t*& ptr, const string& str) {
  uint32_t strLen = str.length();
  ptr += writeVarint32(strLen, ptr);
  memcpy(ptr, str.c_str(), strLen); // no need to write \0
  ptr += strLen;
}

void THeaderTransport::setHeader(const string& key, const string& value) {
  writeHeaders_[key] = value;
}

size_t THeaderTransport::getMaxWriteHeadersSize() const {
  size_t maxWriteHeadersSize = 0;
  THeaderTransport::StringToStringMap::const_iterator it;
  for (it = writeHeaders_.begin(); it != writeHeaders_.end(); ++it) {
    // add sizes of key and value to maxWriteHeadersSize
    // 2 varints32 + the strings themselves
    maxWriteHeadersSize += 5 + 5 + (it->first).length() + (it->second).length();
  }
  return maxWriteHeadersSize;
}

void THeaderTransport::clearHeaders() {
  writeHeaders_.clear();
}

void THeaderTransport::flush() {
  // Write out any data waiting in the write buffer.
  uint32_t haveBytes = getWriteBytes();

  if (clientType == THRIFT_HEADER_CLIENT_TYPE) {
    transform(wBuf_.get(), haveBytes);
    haveBytes = getWriteBytes(); // transform may have changed the size
  }

  // Note that we reset wBase_ prior to the underlying write
  // to ensure we're in a sane state (i.e. internal buffer cleaned)
  // if the underlying write throws up an exception
  wBase_ = wBuf_.get();

  if (haveBytes > MAX_FRAME_SIZE) {
    throw TTransportException(TTransportException::CORRUPTED_DATA,
                              "Attempting to send frame that is too large");
  }

  if (clientType == THRIFT_HEADER_CLIENT_TYPE) {
    // header size will need to be updated at the end because of varints.
    // Make it big enough here for max varint size, plus 4 for padding.
    int headerSize = (2 + getNumTransforms()) * THRIFT_MAX_VARINT32_BYTES + 4;
    // add approximate size of info headers
    headerSize += getMaxWriteHeadersSize();

    // Pkt size
    uint32_t maxSzHbo = headerSize + haveBytes // thrift header + payload
                        + 10;                  // common header section
    uint8_t* pkt = tBuf_.get();
    uint8_t* headerStart;
    uint8_t* headerSizePtr;
    uint8_t* pktStart = pkt;

    if (maxSzHbo > tBufSize_) {
      throw TTransportException(TTransportException::CORRUPTED_DATA,
                                "Attempting to header frame that is too large");
    }

    uint32_t szHbo;
    uint32_t szNbo;
    uint16_t headerSizeN;

    // Fixup szHbo later
    pkt += sizeof(szNbo);
    uint16_t headerN = htons(HEADER_MAGIC >> 16);
    memcpy(pkt, &headerN, sizeof(headerN));
    pkt += sizeof(headerN);
    uint16_t flagsN = htons(flags);
    memcpy(pkt, &flagsN, sizeof(flagsN));
    pkt += sizeof(flagsN);
    uint32_t seqIdN = htonl(seqId);
    memcpy(pkt, &seqIdN, sizeof(seqIdN));
    pkt += sizeof(seqIdN);
    headerSizePtr = pkt;
    // Fixup headerSizeN later
    pkt += sizeof(headerSizeN);
    headerStart = pkt;

    pkt += writeVarint32(protoId, pkt);
    pkt += writeVarint32(getNumTransforms(), pkt);

    // For now, each transform is only the ID, no following data.
    for (vector<uint16_t>::const_iterator it = writeTrans_.begin(); it != writeTrans_.end(); ++it) {
      pkt += writeVarint32(*it, pkt);
    }

    // write info headers

    // for now only write kv-headers
    uint16_t headerCount = writeHeaders_.size();
    if (headerCount > 0) {
      pkt += writeVarint32(infoIdType::KEYVALUE, pkt);
      // Write key-value headers count
      pkt += writeVarint32(headerCount, pkt);
      // Write info headers
      map<string, string>::const_iterator it;
      for (it = writeHeaders_.begin(); it != writeHeaders_.end(); ++it) {
        writeString(pkt, it->first);  // key
        writeString(pkt, it->second); // value
      }
      writeHeaders_.clear();
    }

    // Fixups after varint size calculations
    headerSize = (pkt - headerStart);
    uint8_t padding = 4 - (headerSize % 4);
    headerSize += padding;

    // Pad out pkt with 0x00
    for (int i = 0; i < padding; i++) {
      *(pkt++) = 0x00;
    }

    // Pkt size
    szHbo = headerSize + haveBytes          // thrift header + payload
            + (headerStart - pktStart - 4); // common header section
    headerSizeN = htons(headerSize / 4);
    memcpy(headerSizePtr, &headerSizeN, sizeof(headerSizeN));

    // Set framing size.
    szNbo = htonl(szHbo);
    memcpy(pktStart, &szNbo, sizeof(szNbo));

    outTransport_->write(pktStart, szHbo - haveBytes + 4);
    outTransport_->write(wBuf_.get(), haveBytes);
  } else if (clientType == THRIFT_FRAMED_BINARY || clientType == THRIFT_FRAMED_COMPACT) {
    uint32_t szHbo = (uint32_t)haveBytes;
    uint32_t szNbo = htonl(szHbo);

    outTransport_->write(reinterpret_cast<uint8_t*>(&szNbo), 4);
    outTransport_->write(wBuf_.get(), haveBytes);
  } else if (clientType == THRIFT_UNFRAMED_BINARY || clientType == THRIFT_UNFRAMED_COMPACT) {
    outTransport_->write(wBuf_.get(), haveBytes);
  } else {
    throw TTransportException(TTransportException::BAD_ARGS, "Unknown client type");
  }

  // Flush the underlying transport.
  outTransport_->flush();
}

/**
 * Read an i16 from the wire as a varint. The MSB of each byte is set
 * if there is another byte to follow. This can read up to 3 bytes.
 */
uint32_t THeaderTransport::readVarint16(uint8_t const* ptr, int16_t* i16, uint8_t const* boundary) {
  int32_t val;
  uint32_t rsize = readVarint32(ptr, &val, boundary);
  *i16 = (int16_t)val;
  return rsize;
}

/**
 * Read an i32 from the wire as a varint. The MSB of each byte is set
 * if there is another byte to follow. This can read up to 5 bytes.
 */
uint32_t THeaderTransport::readVarint32(uint8_t const* ptr, int32_t* i32, uint8_t const* boundary) {

  uint32_t rsize = 0;
  uint32_t val = 0;
  int shift = 0;

  while (true) {
    if (ptr == boundary) {
      throw TApplicationException(TApplicationException::INVALID_MESSAGE_TYPE,
                                  "Trying to read past header boundary");
    }
    uint8_t byte = *(ptr++);
    rsize++;
    val |= (uint64_t)(byte & 0x7f) << shift;
    shift += 7;
    if (!(byte & 0x80)) {
      *i32 = val;
      return rsize;
    }
  }
}

/**
 * Write an i32 as a varint. Results in 1-5 bytes on the wire.
 */
uint32_t THeaderTransport::writeVarint32(int32_t n, uint8_t* pkt) {
  uint8_t buf[5];
  uint32_t wsize = 0;

  while (true) {
    if ((n & ~0x7F) == 0) {
      buf[wsize++] = (int8_t)n;
      break;
    } else {
      buf[wsize++] = (int8_t)((n & 0x7F) | 0x80);
      n >>= 7;
    }
  }

  // Caller will advance pkt.
  for (uint32_t i = 0; i < wsize; i++) {
    pkt[i] = buf[i];
  }

  return wsize;
}

uint32_t THeaderTransport::writeVarint16(int16_t n, uint8_t* pkt) {
  return writeVarint32(n, pkt);
}
}
}
} // apache::thrift::transport
