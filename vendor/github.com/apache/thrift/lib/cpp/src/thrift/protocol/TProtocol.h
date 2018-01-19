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

#ifndef _THRIFT_PROTOCOL_TPROTOCOL_H_
#define _THRIFT_PROTOCOL_TPROTOCOL_H_ 1

#ifdef _WIN32
// Need to come before any Windows.h includes
#include <Winsock2.h>
#endif

#include <thrift/transport/TTransport.h>
#include <thrift/protocol/TProtocolException.h>

#include <boost/shared_ptr.hpp>
#include <boost/static_assert.hpp>

#ifdef HAVE_NETINET_IN_H
#include <netinet/in.h>
#endif
#include <sys/types.h>
#include <string>
#include <map>
#include <vector>
#include <climits>

// Use this to get around strict aliasing rules.
// For example, uint64_t i = bitwise_cast<uint64_t>(returns_double());
// The most obvious implementation is to just cast a pointer,
// but that doesn't work.
// For a pretty in-depth explanation of the problem, see
// http://cellperformance.beyond3d.com/articles/2006/06/understanding-strict-aliasing.html
template <typename To, typename From>
static inline To bitwise_cast(From from) {
  BOOST_STATIC_ASSERT(sizeof(From) == sizeof(To));

  // BAD!!!  These are all broken with -O2.
  //return *reinterpret_cast<To*>(&from);  // BAD!!!
  //return *static_cast<To*>(static_cast<void*>(&from));  // BAD!!!
  //return *(To*)(void*)&from;  // BAD!!!

  // Super clean and paritally blessed by section 3.9 of the standard.
  //unsigned char c[sizeof(from)];
  //memcpy(c, &from, sizeof(from));
  //To to;
  //memcpy(&to, c, sizeof(c));
  //return to;

  // Slightly more questionable.
  // Same code emitted by GCC.
  //To to;
  //memcpy(&to, &from, sizeof(from));
  //return to;

  // Technically undefined, but almost universally supported,
  // and the most efficient implementation.
  union {
    From f;
    To t;
  } u;
  u.f = from;
  return u.t;
}


#ifdef HAVE_SYS_PARAM_H
#include <sys/param.h>
#endif

#ifndef __THRIFT_BYTE_ORDER
# if defined(BYTE_ORDER) && defined(LITTLE_ENDIAN) && defined(BIG_ENDIAN)
#  define __THRIFT_BYTE_ORDER BYTE_ORDER
#  define __THRIFT_LITTLE_ENDIAN LITTLE_ENDIAN
#  define __THRIFT_BIG_ENDIAN BIG_ENDIAN
# else
#  include <boost/config.hpp>
#  include <boost/detail/endian.hpp>
#  define __THRIFT_BYTE_ORDER BOOST_BYTE_ORDER
#  ifdef BOOST_LITTLE_ENDIAN
#   define __THRIFT_LITTLE_ENDIAN __THRIFT_BYTE_ORDER
#   define __THRIFT_BIG_ENDIAN 0
#  else
#   define __THRIFT_LITTLE_ENDIAN 0
#   define __THRIFT_BIG_ENDIAN __THRIFT_BYTE_ORDER
#  endif
# endif
#endif

#if __THRIFT_BYTE_ORDER == __THRIFT_BIG_ENDIAN
# if !defined(THRIFT_ntohll)
#  define THRIFT_ntohll(n) (n)
#  define THRIFT_htonll(n) (n)
# endif
# if defined(__GNUC__) && defined(__GLIBC__)
#  include <byteswap.h>
#  define THRIFT_htolell(n) bswap_64(n)
#  define THRIFT_letohll(n) bswap_64(n)
#  define THRIFT_htolel(n) bswap_32(n)
#  define THRIFT_letohl(n) bswap_32(n)
#  define THRIFT_htoles(n) bswap_16(n)
#  define THRIFT_letohs(n) bswap_16(n)
# else /* GNUC & GLIBC */
#  define bswap_64(n) \
      ( (((n) & 0xff00000000000000ull) >> 56) \
      | (((n) & 0x00ff000000000000ull) >> 40) \
      | (((n) & 0x0000ff0000000000ull) >> 24) \
      | (((n) & 0x000000ff00000000ull) >> 8)  \
      | (((n) & 0x00000000ff000000ull) << 8)  \
      | (((n) & 0x0000000000ff0000ull) << 24) \
      | (((n) & 0x000000000000ff00ull) << 40) \
      | (((n) & 0x00000000000000ffull) << 56) )
#  define bswap_32(n) \
      ( (((n) & 0xff000000ul) >> 24) \
      | (((n) & 0x00ff0000ul) >> 8)  \
      | (((n) & 0x0000ff00ul) << 8)  \
      | (((n) & 0x000000fful) << 24) )
#  define bswap_16(n) \
      ( (((n) & ((unsigned short)0xff00ul)) >> 8)  \
      | (((n) & ((unsigned short)0x00fful)) << 8)  )
#  define THRIFT_htolell(n) bswap_64(n)
#  define THRIFT_letohll(n) bswap_64(n)
#  define THRIFT_htolel(n) bswap_32(n)
#  define THRIFT_letohl(n) bswap_32(n)
#  define THRIFT_htoles(n) bswap_16(n)
#  define THRIFT_letohs(n) bswap_16(n)
# endif /* GNUC & GLIBC */
#elif __THRIFT_BYTE_ORDER == __THRIFT_LITTLE_ENDIAN
#  define THRIFT_htolell(n) (n)
#  define THRIFT_letohll(n) (n)
#  define THRIFT_htolel(n) (n)
#  define THRIFT_letohl(n) (n)
#  define THRIFT_htoles(n) (n)
#  define THRIFT_letohs(n) (n)
# if defined(__GNUC__) && defined(__GLIBC__)
#  include <byteswap.h>
#  define THRIFT_ntohll(n) bswap_64(n)
#  define THRIFT_htonll(n) bswap_64(n)
# elif defined(_MSC_VER) /* Microsoft Visual C++ */
#  define THRIFT_ntohll(n) ( _byteswap_uint64((uint64_t)n) )
#  define THRIFT_htonll(n) ( _byteswap_uint64((uint64_t)n) )
# elif !defined(THRIFT_ntohll) /* Not GNUC/GLIBC or MSVC */
#  define THRIFT_ntohll(n) ( (((uint64_t)ntohl((uint32_t)n)) << 32) + ntohl((uint32_t)(n >> 32)) )
#  define THRIFT_htonll(n) ( (((uint64_t)htonl((uint32_t)n)) << 32) + htonl((uint32_t)(n >> 32)) )
# endif /* GNUC/GLIBC or MSVC or something else */
#else /* __THRIFT_BYTE_ORDER */
# error "Can't define THRIFT_htonll or THRIFT_ntohll!"
#endif

namespace apache {
namespace thrift {
namespace protocol {

using apache::thrift::transport::TTransport;

/**
 * Enumerated definition of the types that the Thrift protocol supports.
 * Take special note of the T_END type which is used specifically to mark
 * the end of a sequence of fields.
 */
enum TType {
  T_STOP       = 0,
  T_VOID       = 1,
  T_BOOL       = 2,
  T_BYTE       = 3,
  T_I08        = 3,
  T_I16        = 6,
  T_I32        = 8,
  T_U64        = 9,
  T_I64        = 10,
  T_DOUBLE     = 4,
  T_STRING     = 11,
  T_UTF7       = 11,
  T_STRUCT     = 12,
  T_MAP        = 13,
  T_SET        = 14,
  T_LIST       = 15,
  T_UTF8       = 16,
  T_UTF16      = 17
};

/**
 * Enumerated definition of the message types that the Thrift protocol
 * supports.
 */
enum TMessageType {
  T_CALL       = 1,
  T_REPLY      = 2,
  T_EXCEPTION  = 3,
  T_ONEWAY     = 4
};

static const uint32_t DEFAULT_RECURSION_LIMIT = 64;

/**
 * Abstract class for a thrift protocol driver. These are all the methods that
 * a protocol must implement. Essentially, there must be some way of reading
 * and writing all the base types, plus a mechanism for writing out structs
 * with indexed fields.
 *
 * TProtocol objects should not be shared across multiple encoding contexts,
 * as they may need to maintain internal state in some protocols (i.e. XML).
 * Note that is is acceptable for the TProtocol module to do its own internal
 * buffered reads/writes to the underlying TTransport where appropriate (i.e.
 * when parsing an input XML stream, reading should be batched rather than
 * looking ahead character by character for a close tag).
 *
 */
class TProtocol {
public:
  virtual ~TProtocol();

  /**
   * Writing functions.
   */

  virtual uint32_t writeMessageBegin_virt(const std::string& name,
                                          const TMessageType messageType,
                                          const int32_t seqid) = 0;

  virtual uint32_t writeMessageEnd_virt() = 0;

  virtual uint32_t writeStructBegin_virt(const char* name) = 0;

  virtual uint32_t writeStructEnd_virt() = 0;

  virtual uint32_t writeFieldBegin_virt(const char* name,
                                        const TType fieldType,
                                        const int16_t fieldId) = 0;

  virtual uint32_t writeFieldEnd_virt() = 0;

  virtual uint32_t writeFieldStop_virt() = 0;

  virtual uint32_t writeMapBegin_virt(const TType keyType, const TType valType, const uint32_t size)
      = 0;

  virtual uint32_t writeMapEnd_virt() = 0;

  virtual uint32_t writeListBegin_virt(const TType elemType, const uint32_t size) = 0;

  virtual uint32_t writeListEnd_virt() = 0;

  virtual uint32_t writeSetBegin_virt(const TType elemType, const uint32_t size) = 0;

  virtual uint32_t writeSetEnd_virt() = 0;

  virtual uint32_t writeBool_virt(const bool value) = 0;

  virtual uint32_t writeByte_virt(const int8_t byte) = 0;

  virtual uint32_t writeI16_virt(const int16_t i16) = 0;

  virtual uint32_t writeI32_virt(const int32_t i32) = 0;

  virtual uint32_t writeI64_virt(const int64_t i64) = 0;

  virtual uint32_t writeDouble_virt(const double dub) = 0;

  virtual uint32_t writeString_virt(const std::string& str) = 0;

  virtual uint32_t writeBinary_virt(const std::string& str) = 0;

  uint32_t writeMessageBegin(const std::string& name,
                             const TMessageType messageType,
                             const int32_t seqid) {
    T_VIRTUAL_CALL();
    return writeMessageBegin_virt(name, messageType, seqid);
  }

  uint32_t writeMessageEnd() {
    T_VIRTUAL_CALL();
    return writeMessageEnd_virt();
  }

  uint32_t writeStructBegin(const char* name) {
    T_VIRTUAL_CALL();
    return writeStructBegin_virt(name);
  }

  uint32_t writeStructEnd() {
    T_VIRTUAL_CALL();
    return writeStructEnd_virt();
  }

  uint32_t writeFieldBegin(const char* name, const TType fieldType, const int16_t fieldId) {
    T_VIRTUAL_CALL();
    return writeFieldBegin_virt(name, fieldType, fieldId);
  }

  uint32_t writeFieldEnd() {
    T_VIRTUAL_CALL();
    return writeFieldEnd_virt();
  }

  uint32_t writeFieldStop() {
    T_VIRTUAL_CALL();
    return writeFieldStop_virt();
  }

  uint32_t writeMapBegin(const TType keyType, const TType valType, const uint32_t size) {
    T_VIRTUAL_CALL();
    return writeMapBegin_virt(keyType, valType, size);
  }

  uint32_t writeMapEnd() {
    T_VIRTUAL_CALL();
    return writeMapEnd_virt();
  }

  uint32_t writeListBegin(const TType elemType, const uint32_t size) {
    T_VIRTUAL_CALL();
    return writeListBegin_virt(elemType, size);
  }

  uint32_t writeListEnd() {
    T_VIRTUAL_CALL();
    return writeListEnd_virt();
  }

  uint32_t writeSetBegin(const TType elemType, const uint32_t size) {
    T_VIRTUAL_CALL();
    return writeSetBegin_virt(elemType, size);
  }

  uint32_t writeSetEnd() {
    T_VIRTUAL_CALL();
    return writeSetEnd_virt();
  }

  uint32_t writeBool(const bool value) {
    T_VIRTUAL_CALL();
    return writeBool_virt(value);
  }

  uint32_t writeByte(const int8_t byte) {
    T_VIRTUAL_CALL();
    return writeByte_virt(byte);
  }

  uint32_t writeI16(const int16_t i16) {
    T_VIRTUAL_CALL();
    return writeI16_virt(i16);
  }

  uint32_t writeI32(const int32_t i32) {
    T_VIRTUAL_CALL();
    return writeI32_virt(i32);
  }

  uint32_t writeI64(const int64_t i64) {
    T_VIRTUAL_CALL();
    return writeI64_virt(i64);
  }

  uint32_t writeDouble(const double dub) {
    T_VIRTUAL_CALL();
    return writeDouble_virt(dub);
  }

  uint32_t writeString(const std::string& str) {
    T_VIRTUAL_CALL();
    return writeString_virt(str);
  }

  uint32_t writeBinary(const std::string& str) {
    T_VIRTUAL_CALL();
    return writeBinary_virt(str);
  }

  /**
   * Reading functions
   */

  virtual uint32_t readMessageBegin_virt(std::string& name,
                                         TMessageType& messageType,
                                         int32_t& seqid) = 0;

  virtual uint32_t readMessageEnd_virt() = 0;

  virtual uint32_t readStructBegin_virt(std::string& name) = 0;

  virtual uint32_t readStructEnd_virt() = 0;

  virtual uint32_t readFieldBegin_virt(std::string& name, TType& fieldType, int16_t& fieldId) = 0;

  virtual uint32_t readFieldEnd_virt() = 0;

  virtual uint32_t readMapBegin_virt(TType& keyType, TType& valType, uint32_t& size) = 0;

  virtual uint32_t readMapEnd_virt() = 0;

  virtual uint32_t readListBegin_virt(TType& elemType, uint32_t& size) = 0;

  virtual uint32_t readListEnd_virt() = 0;

  virtual uint32_t readSetBegin_virt(TType& elemType, uint32_t& size) = 0;

  virtual uint32_t readSetEnd_virt() = 0;

  virtual uint32_t readBool_virt(bool& value) = 0;

  virtual uint32_t readBool_virt(std::vector<bool>::reference value) = 0;

  virtual uint32_t readByte_virt(int8_t& byte) = 0;

  virtual uint32_t readI16_virt(int16_t& i16) = 0;

  virtual uint32_t readI32_virt(int32_t& i32) = 0;

  virtual uint32_t readI64_virt(int64_t& i64) = 0;

  virtual uint32_t readDouble_virt(double& dub) = 0;

  virtual uint32_t readString_virt(std::string& str) = 0;

  virtual uint32_t readBinary_virt(std::string& str) = 0;

  uint32_t readMessageBegin(std::string& name, TMessageType& messageType, int32_t& seqid) {
    T_VIRTUAL_CALL();
    return readMessageBegin_virt(name, messageType, seqid);
  }

  uint32_t readMessageEnd() {
    T_VIRTUAL_CALL();
    return readMessageEnd_virt();
  }

  uint32_t readStructBegin(std::string& name) {
    T_VIRTUAL_CALL();
    return readStructBegin_virt(name);
  }

  uint32_t readStructEnd() {
    T_VIRTUAL_CALL();
    return readStructEnd_virt();
  }

  uint32_t readFieldBegin(std::string& name, TType& fieldType, int16_t& fieldId) {
    T_VIRTUAL_CALL();
    return readFieldBegin_virt(name, fieldType, fieldId);
  }

  uint32_t readFieldEnd() {
    T_VIRTUAL_CALL();
    return readFieldEnd_virt();
  }

  uint32_t readMapBegin(TType& keyType, TType& valType, uint32_t& size) {
    T_VIRTUAL_CALL();
    return readMapBegin_virt(keyType, valType, size);
  }

  uint32_t readMapEnd() {
    T_VIRTUAL_CALL();
    return readMapEnd_virt();
  }

  uint32_t readListBegin(TType& elemType, uint32_t& size) {
    T_VIRTUAL_CALL();
    return readListBegin_virt(elemType, size);
  }

  uint32_t readListEnd() {
    T_VIRTUAL_CALL();
    return readListEnd_virt();
  }

  uint32_t readSetBegin(TType& elemType, uint32_t& size) {
    T_VIRTUAL_CALL();
    return readSetBegin_virt(elemType, size);
  }

  uint32_t readSetEnd() {
    T_VIRTUAL_CALL();
    return readSetEnd_virt();
  }

  uint32_t readBool(bool& value) {
    T_VIRTUAL_CALL();
    return readBool_virt(value);
  }

  uint32_t readByte(int8_t& byte) {
    T_VIRTUAL_CALL();
    return readByte_virt(byte);
  }

  uint32_t readI16(int16_t& i16) {
    T_VIRTUAL_CALL();
    return readI16_virt(i16);
  }

  uint32_t readI32(int32_t& i32) {
    T_VIRTUAL_CALL();
    return readI32_virt(i32);
  }

  uint32_t readI64(int64_t& i64) {
    T_VIRTUAL_CALL();
    return readI64_virt(i64);
  }

  uint32_t readDouble(double& dub) {
    T_VIRTUAL_CALL();
    return readDouble_virt(dub);
  }

  uint32_t readString(std::string& str) {
    T_VIRTUAL_CALL();
    return readString_virt(str);
  }

  uint32_t readBinary(std::string& str) {
    T_VIRTUAL_CALL();
    return readBinary_virt(str);
  }

  /*
   * std::vector is specialized for bool, and its elements are individual bits
   * rather than bools.   We need to define a different version of readBool()
   * to work with std::vector<bool>.
   */
  uint32_t readBool(std::vector<bool>::reference value) {
    T_VIRTUAL_CALL();
    return readBool_virt(value);
  }

  /**
   * Method to arbitrarily skip over data.
   */
  uint32_t skip(TType type) {
    T_VIRTUAL_CALL();
    return skip_virt(type);
  }
  virtual uint32_t skip_virt(TType type);

  inline boost::shared_ptr<TTransport> getTransport() { return ptrans_; }

  // TODO: remove these two calls, they are for backwards
  // compatibility
  inline boost::shared_ptr<TTransport> getInputTransport() { return ptrans_; }
  inline boost::shared_ptr<TTransport> getOutputTransport() { return ptrans_; }

  // input and output recursion depth are kept separate so that one protocol
  // can be used concurrently for both input and output.
  void incrementInputRecursionDepth() {
    if (recursion_limit_ < ++input_recursion_depth_) {
      throw TProtocolException(TProtocolException::DEPTH_LIMIT);
    }
  }
  void decrementInputRecursionDepth() { --input_recursion_depth_; }

  void incrementOutputRecursionDepth() {
    if (recursion_limit_ < ++output_recursion_depth_) {
      throw TProtocolException(TProtocolException::DEPTH_LIMIT);
    }
  }
  void decrementOutputRecursionDepth() { --output_recursion_depth_; }

  uint32_t getRecursionLimit() const {return recursion_limit_;}
  void setRecurisionLimit(uint32_t depth) {recursion_limit_ = depth;}

protected:
  TProtocol(boost::shared_ptr<TTransport> ptrans)
    : ptrans_(ptrans), input_recursion_depth_(0), output_recursion_depth_(0), recursion_limit_(DEFAULT_RECURSION_LIMIT)
  {}

  boost::shared_ptr<TTransport> ptrans_;

private:
  TProtocol() {}
  uint32_t input_recursion_depth_;
  uint32_t output_recursion_depth_;
  uint32_t recursion_limit_;
};

/**
 * Constructs input and output protocol objects given transports.
 */
class TProtocolFactory {
public:
  TProtocolFactory() {}

  virtual ~TProtocolFactory();

  virtual boost::shared_ptr<TProtocol> getProtocol(boost::shared_ptr<TTransport> trans) = 0;
  virtual boost::shared_ptr<TProtocol> getProtocol(boost::shared_ptr<TTransport> inTrans,
						   boost::shared_ptr<TTransport> outTrans) {
    (void)outTrans;
    return getProtocol(inTrans);
  }
};

/**
 * Dummy protocol class.
 *
 * This class does nothing, and should never be instantiated.
 * It is used only by the generator code.
 */
class TDummyProtocol : public TProtocol {};

// This is the default / legacy choice
struct TNetworkBigEndian
{
  static uint16_t toWire16(uint16_t x)   {return htons(x);}
  static uint32_t toWire32(uint32_t x)   {return htonl(x);}
  static uint64_t toWire64(uint64_t x)   {return THRIFT_htonll(x);}
  static uint16_t fromWire16(uint16_t x) {return ntohs(x);}
  static uint32_t fromWire32(uint32_t x) {return ntohl(x);}
  static uint64_t fromWire64(uint64_t x) {return THRIFT_ntohll(x);}
};

// On most systems, this will be a bit faster than TNetworkBigEndian
struct TNetworkLittleEndian
{
  static uint16_t toWire16(uint16_t x)   {return THRIFT_htoles(x);}
  static uint32_t toWire32(uint32_t x)   {return THRIFT_htolel(x);}
  static uint64_t toWire64(uint64_t x)   {return THRIFT_htolell(x);}
  static uint16_t fromWire16(uint16_t x) {return THRIFT_letohs(x);}
  static uint32_t fromWire32(uint32_t x) {return THRIFT_letohl(x);}
  static uint64_t fromWire64(uint64_t x) {return THRIFT_letohll(x);}
};

struct TOutputRecursionTracker {
  TProtocol &prot_;
  TOutputRecursionTracker(TProtocol &prot) : prot_(prot) {
    prot_.incrementOutputRecursionDepth();
  }
  ~TOutputRecursionTracker() {
    prot_.decrementOutputRecursionDepth();
  }
};

struct TInputRecursionTracker {
  TProtocol &prot_;
  TInputRecursionTracker(TProtocol &prot) : prot_(prot) {
    prot_.incrementInputRecursionDepth();
  }
  ~TInputRecursionTracker() {
    prot_.decrementInputRecursionDepth();
  }
};

/**
 * Helper template for implementing TProtocol::skip().
 *
 * Templatized to avoid having to make virtual function calls.
 */
template <class Protocol_>
uint32_t skip(Protocol_& prot, TType type) {
  TInputRecursionTracker tracker(prot);

  switch (type) {
  case T_BOOL: {
    bool boolv;
    return prot.readBool(boolv);
  }
  case T_BYTE: {
    int8_t bytev;
    return prot.readByte(bytev);
  }
  case T_I16: {
    int16_t i16;
    return prot.readI16(i16);
  }
  case T_I32: {
    int32_t i32;
    return prot.readI32(i32);
  }
  case T_I64: {
    int64_t i64;
    return prot.readI64(i64);
  }
  case T_DOUBLE: {
    double dub;
    return prot.readDouble(dub);
  }
  case T_STRING: {
    std::string str;
    return prot.readBinary(str);
  }
  case T_STRUCT: {
    uint32_t result = 0;
    std::string name;
    int16_t fid;
    TType ftype;
    result += prot.readStructBegin(name);
    while (true) {
      result += prot.readFieldBegin(name, ftype, fid);
      if (ftype == T_STOP) {
        break;
      }
      result += skip(prot, ftype);
      result += prot.readFieldEnd();
    }
    result += prot.readStructEnd();
    return result;
  }
  case T_MAP: {
    uint32_t result = 0;
    TType keyType;
    TType valType;
    uint32_t i, size;
    result += prot.readMapBegin(keyType, valType, size);
    for (i = 0; i < size; i++) {
      result += skip(prot, keyType);
      result += skip(prot, valType);
    }
    result += prot.readMapEnd();
    return result;
  }
  case T_SET: {
    uint32_t result = 0;
    TType elemType;
    uint32_t i, size;
    result += prot.readSetBegin(elemType, size);
    for (i = 0; i < size; i++) {
      result += skip(prot, elemType);
    }
    result += prot.readSetEnd();
    return result;
  }
  case T_LIST: {
    uint32_t result = 0;
    TType elemType;
    uint32_t i, size;
    result += prot.readListBegin(elemType, size);
    for (i = 0; i < size; i++) {
      result += skip(prot, elemType);
    }
    result += prot.readListEnd();
    return result;
  }
  case T_STOP:
  case T_VOID:
  case T_U64:
  case T_UTF8:
  case T_UTF16:
    break;
  }
  return 0;
}

}}} // apache::thrift::protocol

#endif // #define _THRIFT_PROTOCOL_TPROTOCOL_H_ 1
