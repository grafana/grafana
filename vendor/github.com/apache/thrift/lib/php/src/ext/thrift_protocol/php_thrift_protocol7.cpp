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
#ifdef HAVE_CONFIG_H
#include "config.h"
#endif

#include "php.h"
#include "zend_interfaces.h"
#include "zend_exceptions.h"
#include "php_thrift_protocol.h"

#if PHP_VERSION_ID >= 70000

#include <sys/types.h>
#include <arpa/inet.h>

#include <cstdint>
#include <stdexcept>
#include <algorithm>

#ifndef bswap_64
#define	bswap_64(x)     (((uint64_t)(x) << 56) | \
                        (((uint64_t)(x) << 40) & 0xff000000000000ULL) | \
                        (((uint64_t)(x) << 24) & 0xff0000000000ULL) | \
                        (((uint64_t)(x) << 8)  & 0xff00000000ULL) | \
                        (((uint64_t)(x) >> 8)  & 0xff000000ULL) | \
                        (((uint64_t)(x) >> 24) & 0xff0000ULL) | \
                        (((uint64_t)(x) >> 40) & 0xff00ULL) | \
                        ((uint64_t)(x)  >> 56))
#endif

#if __BYTE_ORDER == __LITTLE_ENDIAN
#define htonll(x) bswap_64(x)
#define ntohll(x) bswap_64(x)
#elif __BYTE_ORDER == __BIG_ENDIAN
#define htonll(x) x
#define ntohll(x) x
#else
#error Unknown __BYTE_ORDER
#endif

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

const int32_t VERSION_MASK = 0xffff0000;
const int32_t VERSION_1 = 0x80010000;
const int8_t T_CALL = 1;
const int8_t T_REPLY = 2;
const int8_t T_EXCEPTION = 3;
// tprotocolexception
const int INVALID_DATA = 1;
const int BAD_VERSION = 4;

static zend_function_entry thrift_protocol_functions[] = {
  PHP_FE(thrift_protocol_write_binary, nullptr)
  PHP_FE(thrift_protocol_read_binary, nullptr)
  {nullptr, nullptr, nullptr}
};

zend_module_entry thrift_protocol_module_entry = {
  STANDARD_MODULE_HEADER,
  "thrift_protocol",
  thrift_protocol_functions,
  nullptr,
  nullptr,
  nullptr,
  nullptr,
  nullptr,
  "1.0",
  STANDARD_MODULE_PROPERTIES
};

#ifdef COMPILE_DL_THRIFT_PROTOCOL
ZEND_GET_MODULE(thrift_protocol)
#endif

class PHPExceptionWrapper : public std::exception {
public:
  PHPExceptionWrapper(zval* _ex) throw() {
    ZVAL_COPY(&ex, _ex);
    snprintf(_what, 40, "PHP exception zval=%p", _ex);
  }

  PHPExceptionWrapper(zend_object* _exobj) throw() {
    ZVAL_OBJ(&ex, _exobj);
    snprintf(_what, 40, "PHP exception zval=%p", _exobj);
  }
  ~PHPExceptionWrapper() throw() {
    zval_dtor(&ex);
  }

  const char* what() const throw() {
    return _what;
  }
  operator zval*() const throw() {
    return const_cast<zval*>(&ex);
  } // Zend API doesn't do 'const'...
protected:
  zval ex;
  char _what[40];
} ;

class PHPTransport {
protected:
  PHPTransport(zval* _p, size_t _buffer_size) {
    assert(Z_TYPE_P(_p) == IS_OBJECT);

    ZVAL_UNDEF(&t);

    buffer = reinterpret_cast<char*>(emalloc(_buffer_size));
    buffer_ptr = buffer;
    buffer_used = 0;
    buffer_size = _buffer_size;

    // Get the transport for the passed protocol
    zval gettransport;
    ZVAL_STRING(&gettransport, "getTransport");
    call_user_function(nullptr, _p, &gettransport, &t, 0, nullptr);

    zval_dtor(&gettransport);

    assert(Z_TYPE(t) == IS_OBJECT);
  }

  ~PHPTransport() {
    efree(buffer);
    zval_dtor(&t);
  }

  char* buffer;
  char* buffer_ptr;
  size_t buffer_used;
  size_t buffer_size;

  zval t;
};


class PHPOutputTransport : public PHPTransport {
public:
  PHPOutputTransport(zval* _p, size_t _buffer_size = 8192) : PHPTransport(_p, _buffer_size) { }
  ~PHPOutputTransport() { }

  void write(const char* data, size_t len) {
    if ((len + buffer_used) > buffer_size) {
      internalFlush();
    }
    if (len > buffer_size) {
      directWrite(data, len);
    } else {
      memcpy(buffer_ptr, data, len);
      buffer_used += len;
      buffer_ptr += len;
    }
  }

  void writeI64(int64_t i) {
    i = htonll(i);
    write((const char*)&i, 8);
  }

  void writeU32(uint32_t i) {
    i = htonl(i);
    write((const char*)&i, 4);
  }

  void writeI32(int32_t i) {
    i = htonl(i);
    write((const char*)&i, 4);
  }

  void writeI16(int16_t i) {
    i = htons(i);
    write((const char*)&i, 2);
  }

  void writeI8(int8_t i) {
    write((const char*)&i, 1);
  }

  void writeString(const char* str, size_t len) {
    writeU32(len);
    write(str, len);
  }

  void flush() {
    internalFlush();
    directFlush();
  }

protected:
  void internalFlush() {
     if (buffer_used) {
      directWrite(buffer, buffer_used);
      buffer_ptr = buffer;
      buffer_used = 0;
    }
  }
  void directFlush() {
    zval ret, flushfn;
    ZVAL_NULL(&ret);
    ZVAL_STRING(&flushfn, "flush");

    call_user_function(EG(function_table), &(this->t), &flushfn, &ret, 0, nullptr);
    zval_dtor(&flushfn);
    zval_dtor(&ret);
  }
  void directWrite(const char* data, size_t len) {
    zval args[1], ret, writefn;

    ZVAL_STRING(&writefn, "write");
    ZVAL_STRINGL(&args[0], data, len);

    ZVAL_NULL(&ret);
    call_user_function(EG(function_table), &(this->t), &writefn, &ret, 1, args);

    zval_dtor(&writefn);
    zval_dtor(&ret);
    zval_dtor(&args[0]);

    if (EG(exception)) {
      zend_object *ex = EG(exception);
      EG(exception) = nullptr;
      throw PHPExceptionWrapper(ex);
    }
  }
};

class PHPInputTransport : public PHPTransport {
public:
  PHPInputTransport(zval* _p, size_t _buffer_size = 8192) : PHPTransport(_p, _buffer_size) {
  }

  ~PHPInputTransport() {
    put_back();
  }

  void put_back() {
    if (buffer_used) {
      zval args[1], ret, putbackfn;
      ZVAL_STRINGL(&args[0], buffer_ptr, buffer_used);
      ZVAL_STRING(&putbackfn, "putBack");
      ZVAL_NULL(&ret);

      call_user_function(EG(function_table), &(this->t), &putbackfn, &ret, 1, args);

      zval_dtor(&putbackfn);
      zval_dtor(&ret);
      zval_dtor(&args[0]);
    }
    buffer_used = 0;
    buffer_ptr = buffer;
  }

  void skip(size_t len) {
    while (len) {
      size_t chunk_size = std::min(len, buffer_used);
      if (chunk_size) {
        buffer_ptr = reinterpret_cast<char*>(buffer_ptr) + chunk_size;
        buffer_used -= chunk_size;
        len -= chunk_size;
      }
      if (! len) break;
      refill();
    }
  }

  void readBytes(void* buf, size_t len) {
    while (len) {
      size_t chunk_size = std::min(len, buffer_used);
      if (chunk_size) {
        memcpy(buf, buffer_ptr, chunk_size);
        buffer_ptr = reinterpret_cast<char*>(buffer_ptr) + chunk_size;
        buffer_used -= chunk_size;
        buf = reinterpret_cast<char*>(buf) + chunk_size;
        len -= chunk_size;
      }
      if (! len) break;
      refill();
    }
  }

  int8_t readI8() {
    int8_t c;
    readBytes(&c, 1);
    return c;
  }

  int16_t readI16() {
    int16_t c;
    readBytes(&c, 2);
    return (int16_t)ntohs(c);
  }

  uint32_t readU32() {
    uint32_t c;
    readBytes(&c, 4);
    return (uint32_t)ntohl(c);
  }

  int32_t readI32() {
    int32_t c;
    readBytes(&c, 4);
    return (int32_t)ntohl(c);
  }

protected:
  void refill() {
    assert(buffer_used == 0);
    zval retval;
    zval args[1];
    zval funcname;

    ZVAL_NULL(&retval);
    ZVAL_LONG(&args[0], buffer_size);

    ZVAL_STRING(&funcname, "read");

    call_user_function(EG(function_table), &(this->t), &funcname, &retval, 1, args);
    zval_dtor(&args[0]);
    zval_dtor(&funcname);

    if (EG(exception)) {
      zval_dtor(&retval);

      zend_object *ex = EG(exception);
      EG(exception) = nullptr;
      throw PHPExceptionWrapper(ex);
    }

    buffer_used = Z_STRLEN(retval);
    memcpy(buffer, Z_STRVAL(retval), buffer_used);

    zval_dtor(&retval);

    buffer_ptr = buffer;
  }

};

static
void binary_deserialize_spec(zval* zthis, PHPInputTransport& transport, HashTable* spec);
static
void binary_serialize_spec(zval* zthis, PHPOutputTransport& transport, HashTable* spec);
static
void binary_serialize(int8_t thrift_typeID, PHPOutputTransport& transport, zval* value, HashTable* fieldspec);

// Create a PHP object given a typename and call the ctor, optionally passing up to 2 arguments
static
void createObject(const char* obj_typename, zval* return_value, int nargs = 0, zval* arg1 = nullptr, zval* arg2 = nullptr) {
  /* is there a better way to do that on the stack ? */
  zend_string *obj_name = zend_string_init(obj_typename, strlen(obj_typename), 0);
  zend_class_entry* ce = zend_fetch_class(obj_name, ZEND_FETCH_CLASS_DEFAULT);
  zend_string_release(obj_name);

  if (! ce) {
    php_error_docref(nullptr, E_ERROR, "Class %s does not exist", obj_typename);
    RETURN_NULL();
  }

  object_and_properties_init(return_value, ce, nullptr);
  zend_function* constructor = zend_std_get_constructor(Z_OBJ_P(return_value));
  zval ctor_rv;
  zend_call_method(return_value, ce, &constructor, NULL, 0, &ctor_rv, nargs, arg1, arg2);
  zval_dtor(&ctor_rv);
}

static
void throw_tprotocolexception(const char* what, long errorcode) {
  zval zwhat, zerrorcode;

  ZVAL_STRING(&zwhat, what);
  ZVAL_LONG(&zerrorcode, errorcode);

  zval ex;
  createObject("\\Thrift\\Exception\\TProtocolException", &ex, 2, &zwhat, &zerrorcode);

  zval_dtor(&zwhat);
  zval_dtor(&zerrorcode);

  throw PHPExceptionWrapper(&ex);
}

// Sets EG(exception), call this and then RETURN_NULL();
static
void throw_zend_exception_from_std_exception(const std::exception& ex) {
  zend_throw_exception(zend_exception_get_default(), const_cast<char*>(ex.what()), 0);
}

static
void skip_element(long thrift_typeID, PHPInputTransport& transport) {
  switch (thrift_typeID) {
    case T_STOP:
    case T_VOID:
      return;
    case T_STRUCT:
      while (true) {
        int8_t ttype = transport.readI8(); // get field type
        if (ttype == T_STOP) break;
        transport.skip(2); // skip field number, I16
        skip_element(ttype, transport); // skip field payload
      }
      return;
    case T_BOOL:
    case T_BYTE:
      transport.skip(1);
      return;
    case T_I16:
      transport.skip(2);
      return;
    case T_I32:
      transport.skip(4);
      return;
    case T_U64:
    case T_I64:
    case T_DOUBLE:
      transport.skip(8);
      return;
    //case T_UTF7: // aliases T_STRING
    case T_UTF8:
    case T_UTF16:
    case T_STRING: {
      uint32_t len = transport.readU32();
      transport.skip(len);
      } return;
    case T_MAP: {
      int8_t keytype = transport.readI8();
      int8_t valtype = transport.readI8();
      uint32_t size = transport.readU32();
      for (uint32_t i = 0; i < size; ++i) {
        skip_element(keytype, transport);
        skip_element(valtype, transport);
      }
    } return;
    case T_LIST:
    case T_SET: {
      int8_t valtype = transport.readI8();
      uint32_t size = transport.readU32();
      for (uint32_t i = 0; i < size; ++i) {
        skip_element(valtype, transport);
      }
    } return;
  };

  char errbuf[128];
  sprintf(errbuf, "Unknown thrift typeID %ld", thrift_typeID);
  throw_tprotocolexception(errbuf, INVALID_DATA);
}

static inline
bool zval_is_bool(zval* v) {
  return Z_TYPE_P(v) == IS_TRUE || Z_TYPE_P(v) == IS_FALSE;
}

static
void binary_deserialize(int8_t thrift_typeID, PHPInputTransport& transport, zval* return_value, HashTable* fieldspec) {
  ZVAL_NULL(return_value);

  switch (thrift_typeID) {
    case T_STOP:
    case T_VOID:
      RETURN_NULL();
      return;
    case T_STRUCT: {
      zval* val_ptr = zend_hash_str_find(fieldspec, "class", sizeof("class")-1);
      if (val_ptr == nullptr) {
        throw_tprotocolexception("no class type in spec", INVALID_DATA);
        skip_element(T_STRUCT, transport);
        RETURN_NULL();
      }

      char* structType = Z_STRVAL_P(val_ptr);
      // Create an object in PHP userland based on our spec
      createObject(structType, return_value);
      if (Z_TYPE_P(return_value) == IS_NULL) {
        // unable to create class entry
        skip_element(T_STRUCT, transport);
        RETURN_NULL();
      }

      zval* spec = zend_read_static_property(Z_OBJCE_P(return_value), "_TSPEC", sizeof("_TSPEC")-1, false);
      if (Z_TYPE_P(spec) != IS_ARRAY) {
        char errbuf[128];
        snprintf(errbuf, 128, "spec for %s is wrong type: %d\n", structType, Z_TYPE_P(spec));
        throw_tprotocolexception(errbuf, INVALID_DATA);
        RETURN_NULL();
      }
      binary_deserialize_spec(return_value, transport, Z_ARRVAL_P(spec));
      return;
    } break;
    case T_BOOL: {
      uint8_t c;
      transport.readBytes(&c, 1);
      RETURN_BOOL(c != 0);
    }
  //case T_I08: // same numeric value as T_BYTE
    case T_BYTE: {
      uint8_t c;
      transport.readBytes(&c, 1);
      RETURN_LONG((int8_t)c);
    }
    case T_I16: {
      uint16_t c;
      transport.readBytes(&c, 2);
      RETURN_LONG((int16_t)ntohs(c));
    }
    case T_I32: {
      uint32_t c;
      transport.readBytes(&c, 4);
      RETURN_LONG((int32_t)ntohl(c));
    }
    case T_U64:
    case T_I64: {
      uint64_t c;
      transport.readBytes(&c, 8);
      RETURN_LONG((int64_t)ntohll(c));
    }
    case T_DOUBLE: {
      union {
        uint64_t c;
        double d;
      } a;
      transport.readBytes(&(a.c), 8);
      a.c = ntohll(a.c);
      RETURN_DOUBLE(a.d);
    }
    //case T_UTF7: // aliases T_STRING
    case T_UTF8:
    case T_UTF16:
    case T_STRING: {
      uint32_t size = transport.readU32();
      if (size) {
        char strbuf[size+1];
        transport.readBytes(strbuf, size);
        strbuf[size] = '\0';
        ZVAL_STRINGL(return_value, strbuf, size);
      } else {
        ZVAL_EMPTY_STRING(return_value);
      }
      return;
    }
    case T_MAP: { // array of key -> value
      uint8_t types[2];
      transport.readBytes(types, 2);
      uint32_t size = transport.readU32();
      array_init(return_value);

      zval *val_ptr;
      val_ptr = zend_hash_str_find(fieldspec, "key", sizeof("key")-1);
      HashTable* keyspec = Z_ARRVAL_P(val_ptr);
      val_ptr = zend_hash_str_find(fieldspec, "val", sizeof("val")-1);
      HashTable* valspec = Z_ARRVAL_P(val_ptr);

      for (uint32_t s = 0; s < size; ++s) {
        zval key, value;

        binary_deserialize(types[0], transport, &key, keyspec);
        binary_deserialize(types[1], transport, &value, valspec);
        if (Z_TYPE(key) == IS_LONG) {
          zend_hash_index_update(Z_ARR_P(return_value), Z_LVAL(key), &value);
        } else {
          if (Z_TYPE(key) != IS_STRING) convert_to_string(&key);
          zend_hash_update(Z_ARR_P(return_value), Z_STR(key), &value);
        }
      }
      return; // return_value already populated
    }
    case T_LIST: { // array with autogenerated numeric keys
      int8_t type = transport.readI8();
      uint32_t size = transport.readU32();
      zval *val_ptr = zend_hash_str_find(fieldspec, "elem", sizeof("elem")-1);
      HashTable* elemspec = Z_ARRVAL_P(val_ptr);

      array_init(return_value);
      for (uint32_t s = 0; s < size; ++s) {
        zval value;
        binary_deserialize(type, transport, &value, elemspec);
        zend_hash_next_index_insert(Z_ARR_P(return_value), &value);
      }
      return;
    }
    case T_SET: { // array of key -> TRUE
      uint8_t type;
      uint32_t size;
      transport.readBytes(&type, 1);
      transport.readBytes(&size, 4);
      size = ntohl(size);
      zval *val_ptr = zend_hash_str_find(fieldspec, "elem", sizeof("elem")-1);
      HashTable* elemspec = Z_ARRVAL_P(val_ptr);

      array_init(return_value);

      for (uint32_t s = 0; s < size; ++s) {
        zval key, value;
        ZVAL_TRUE(&value);

        binary_deserialize(type, transport, &key, elemspec);

        if (Z_TYPE(key) == IS_LONG) {
          zend_hash_index_update(Z_ARR_P(return_value), Z_LVAL(key), &value);
        } else {
          if (Z_TYPE(key) != IS_STRING) convert_to_string(&key);
          zend_hash_update(Z_ARR_P(return_value), Z_STR(key), &value);
        }
      }
      return;
    }
  };

  char errbuf[128];
  sprintf(errbuf, "Unknown thrift typeID %d", thrift_typeID);
  throw_tprotocolexception(errbuf, INVALID_DATA);
}

static
void binary_serialize_hashtable_key(int8_t keytype, PHPOutputTransport& transport, HashTable* ht, HashPosition& ht_pos) {
  bool keytype_is_numeric = (!((keytype == T_STRING) || (keytype == T_UTF8) || (keytype == T_UTF16)));

  zend_string* key;
  uint key_len;
  long index = 0;

  zval z;

  int res = zend_hash_get_current_key_ex(ht, &key, (zend_ulong*)&index, &ht_pos);
  if (keytype_is_numeric) {
    if (res == HASH_KEY_IS_STRING) {
      index = strtol(ZSTR_VAL(key), nullptr, 10);
    }
    ZVAL_LONG(&z, index);
  } else {
    char buf[64];
    if (res == HASH_KEY_IS_STRING) {
      ZVAL_STR(&z, key);
    } else {
      snprintf(buf, 64, "%ld", index);
      ZVAL_STRING(&z, buf);
    }
  }
  binary_serialize(keytype, transport, &z, nullptr);
  zval_dtor(&z);
}

static
void binary_serialize(int8_t thrift_typeID, PHPOutputTransport& transport, zval* value, HashTable* fieldspec) {
  // At this point the typeID (and field num, if applicable) should've already been written to the output so all we need to do is write the payload.
  switch (thrift_typeID) {
    case T_STOP:
    case T_VOID:
      return;
    case T_STRUCT: {
      if (Z_TYPE_P(value) != IS_OBJECT) {
        throw_tprotocolexception("Attempt to send non-object type as a T_STRUCT", INVALID_DATA);
      }
      zval* spec = zend_read_static_property(Z_OBJCE_P(value), "_TSPEC", sizeof("_TSPEC")-1, false);
      if (Z_TYPE_P(spec) != IS_ARRAY) {
        throw_tprotocolexception("Attempt to send non-Thrift object as a T_STRUCT", INVALID_DATA);
      }
      binary_serialize_spec(value, transport, Z_ARRVAL_P(spec));
    } return;
    case T_BOOL:
      if (!zval_is_bool(value)) convert_to_boolean(value);
      transport.writeI8(Z_TYPE_INFO_P(value) == IS_TRUE ? 1 : 0);
      return;
    case T_BYTE:
      if (Z_TYPE_P(value) != IS_LONG) convert_to_long(value);
      transport.writeI8(Z_LVAL_P(value));
      return;
    case T_I16:
      if (Z_TYPE_P(value) != IS_LONG) convert_to_long(value);
      transport.writeI16(Z_LVAL_P(value));
      return;
    case T_I32:
      if (Z_TYPE_P(value) != IS_LONG) convert_to_long(value);
      transport.writeI32(Z_LVAL_P(value));
      return;
    case T_I64:
    case T_U64: {
      int64_t l_data;
#if defined(_LP64) || defined(_WIN64)
      if (Z_TYPE_P(value) != IS_LONG) convert_to_long(value);
      l_data = Z_LVAL_P(value);
#else
      if (Z_TYPE_P(value) != IS_DOUBLE) convert_to_double(value);
      l_data = (int64_t)Z_DVAL_P(value);
#endif
      transport.writeI64(l_data);
    } return;
    case T_DOUBLE: {
      union {
        int64_t c;
        double d;
      } a;
      if (Z_TYPE_P(value) != IS_DOUBLE) convert_to_double(value);
      a.d = Z_DVAL_P(value);
      transport.writeI64(a.c);
    } return;
    case T_UTF8:
    case T_UTF16:
    case T_STRING:
      if (Z_TYPE_P(value) != IS_STRING) convert_to_string(value);
      transport.writeString(Z_STRVAL_P(value), Z_STRLEN_P(value));
      return;
    case T_MAP: {
      if (Z_TYPE_P(value) != IS_ARRAY) convert_to_array(value);
      if (Z_TYPE_P(value) != IS_ARRAY) {
        throw_tprotocolexception("Attempt to send an incompatible type as an array (T_MAP)", INVALID_DATA);
      }
      HashTable* ht = Z_ARRVAL_P(value);
      zval* val_ptr;

      val_ptr = zend_hash_str_find(fieldspec, "ktype", sizeof("ktype")-1);
      if (Z_TYPE_P(val_ptr) != IS_LONG) convert_to_long(val_ptr);
      uint8_t keytype = Z_LVAL_P(val_ptr);
      transport.writeI8(keytype);
      val_ptr = zend_hash_str_find(fieldspec, "vtype", sizeof("vtype")-1);
      if (Z_TYPE_P(val_ptr) != IS_LONG) convert_to_long(val_ptr);
      uint8_t valtype = Z_LVAL_P(val_ptr);
      transport.writeI8(valtype);

      val_ptr = zend_hash_str_find(fieldspec, "val", sizeof("val")-1);
      HashTable* valspec = Z_ARRVAL_P(val_ptr);

      transport.writeI32(zend_hash_num_elements(ht));
      HashPosition key_ptr;
      for (zend_hash_internal_pointer_reset_ex(ht, &key_ptr);
           (val_ptr = zend_hash_get_current_data_ex(ht, &key_ptr)) != nullptr;
           zend_hash_move_forward_ex(ht, &key_ptr)) {
        binary_serialize_hashtable_key(keytype, transport, ht, key_ptr);
        binary_serialize(valtype, transport, val_ptr, valspec);
      }
    } return;
    case T_LIST: {
      if (Z_TYPE_P(value) != IS_ARRAY) convert_to_array(value);
      if (Z_TYPE_P(value) != IS_ARRAY) {
        throw_tprotocolexception("Attempt to send an incompatible type as an array (T_LIST)", INVALID_DATA);
      }
      HashTable* ht = Z_ARRVAL_P(value);
      zval* val_ptr;

      val_ptr = zend_hash_str_find(fieldspec, "etype", sizeof("etype")-1);
      if (Z_TYPE_P(val_ptr) != IS_LONG) convert_to_long(val_ptr);
      uint8_t valtype = Z_LVAL_P(val_ptr);
      transport.writeI8(valtype);

      val_ptr = zend_hash_str_find(fieldspec, "elem", sizeof("elem")-1);
      HashTable* valspec = Z_ARRVAL_P(val_ptr);

      transport.writeI32(zend_hash_num_elements(ht));
      HashPosition key_ptr;
      for (zend_hash_internal_pointer_reset_ex(ht, &key_ptr);
           (val_ptr = zend_hash_get_current_data_ex(ht, &key_ptr)) != nullptr;
           zend_hash_move_forward_ex(ht, &key_ptr)) {
        binary_serialize(valtype, transport, val_ptr, valspec);
      }
    } return;
    case T_SET: {
      if (Z_TYPE_P(value) != IS_ARRAY) convert_to_array(value);
      if (Z_TYPE_P(value) != IS_ARRAY) {
        throw_tprotocolexception("Attempt to send an incompatible type as an array (T_SET)", INVALID_DATA);
      }
      HashTable* ht = Z_ARRVAL_P(value);
      zval* val_ptr;

      val_ptr = zend_hash_str_find(fieldspec, "etype", sizeof("etype")-1);
      if (Z_TYPE_P(val_ptr) != IS_LONG) convert_to_long(val_ptr);
      uint8_t keytype = Z_LVAL_P(val_ptr);
      transport.writeI8(keytype);

      transport.writeI32(zend_hash_num_elements(ht));
      HashPosition key_ptr;
      for (zend_hash_internal_pointer_reset_ex(ht, &key_ptr);
           (val_ptr = zend_hash_get_current_data_ex(ht, &key_ptr)) != nullptr;
           zend_hash_move_forward_ex(ht, &key_ptr)) {
        binary_serialize_hashtable_key(keytype, transport, ht, key_ptr);
      }
    } return;
  };

  char errbuf[128];
  snprintf(errbuf, 128, "Unknown thrift typeID %d", thrift_typeID);
  throw_tprotocolexception(errbuf, INVALID_DATA);
}

static
void protocol_writeMessageBegin(zval* transport, zend_string* method_name, int32_t msgtype, int32_t seqID) {
  zval args[3];
  zval ret;
  zval writeMessagefn;

  ZVAL_STR(&args[0], method_name);
  ZVAL_LONG(&args[1], msgtype);
  ZVAL_LONG(&args[2], seqID);
  ZVAL_NULL(&ret);
  ZVAL_STRING(&writeMessagefn, "writeMessageBegin");

  call_user_function(EG(function_table), transport, &writeMessagefn, &ret, 3, args);

  zval_dtor(&writeMessagefn);
  zval_dtor(&args[2]); zval_dtor(&args[1]); zval_dtor(&args[0]);
  zval_dtor(&ret);
}

static inline
bool ttype_is_int(int8_t t) {
  return ((t == T_BYTE) || ((t >= T_I16)  && (t <= T_I64)));
}

static inline
bool ttypes_are_compatible(int8_t t1, int8_t t2) {
  // Integer types of different widths are considered compatible;
  // otherwise the typeID must match.
  return ((t1 == t2) || (ttype_is_int(t1) && ttype_is_int(t2)));
}

static
void binary_deserialize_spec(zval* zthis, PHPInputTransport& transport, HashTable* spec) {
  // SET and LIST have 'elem' => array('type', [optional] 'class')
  // MAP has 'val' => array('type', [optiona] 'class')
  zend_class_entry* ce = Z_OBJCE_P(zthis);
  while (true) {
    int8_t ttype = transport.readI8();
    if (ttype == T_STOP) {
      return;
    }

    int16_t fieldno = transport.readI16();
    zval* val_ptr = zend_hash_index_find(spec, fieldno);
    if (val_ptr != nullptr) {
      HashTable* fieldspec = Z_ARRVAL_P(val_ptr);
      // pull the field name
      val_ptr = zend_hash_str_find(fieldspec, "var", sizeof("var")-1);
      char* varname = Z_STRVAL_P(val_ptr);

      // and the type
      val_ptr = zend_hash_str_find(fieldspec, "type", sizeof("type")-1);
      if (Z_TYPE_P(val_ptr) != IS_LONG) convert_to_long(val_ptr);
      int8_t expected_ttype = Z_LVAL_P(val_ptr);

      if (ttypes_are_compatible(ttype, expected_ttype)) {
        zval rv;
        ZVAL_UNDEF(&rv);

        binary_deserialize(ttype, transport, &rv, fieldspec);
        zend_update_property(ce, zthis, varname, strlen(varname), &rv);

        zval_ptr_dtor(&rv);
      } else {
        skip_element(ttype, transport);
      }
    } else {
      skip_element(ttype, transport);
    }
  }
}

static
void binary_serialize_spec(zval* zthis, PHPOutputTransport& transport, HashTable* spec) {
  HashPosition key_ptr;
  zval* val_ptr;

  for (zend_hash_internal_pointer_reset_ex(spec, &key_ptr);
       (val_ptr = zend_hash_get_current_data_ex(spec, &key_ptr)) != nullptr;
       zend_hash_move_forward_ex(spec, &key_ptr)) {

    zend_ulong fieldno;
    if (zend_hash_get_current_key_ex(spec, nullptr, &fieldno, &key_ptr) != HASH_KEY_IS_LONG) {
      throw_tprotocolexception("Bad keytype in TSPEC (expected 'long')", INVALID_DATA);
      return;
    }
    HashTable* fieldspec = Z_ARRVAL_P(val_ptr);

    // field name
    val_ptr = zend_hash_str_find(fieldspec, "var", sizeof("var")-1);
    char* varname = Z_STRVAL_P(val_ptr);

    // thrift type
    val_ptr = zend_hash_str_find(fieldspec, "type", sizeof("type")-1);
    if (Z_TYPE_P(val_ptr) != IS_LONG) convert_to_long(val_ptr);
    int8_t ttype = Z_LVAL_P(val_ptr);

    zval rv;
    zval* prop = zend_read_property(Z_OBJCE_P(zthis), zthis, varname, strlen(varname), false, &rv);
    if (Z_TYPE_P(prop) != IS_NULL) {
      transport.writeI8(ttype);
      transport.writeI16(fieldno);
      binary_serialize(ttype, transport, prop, fieldspec);
    }
  }
  transport.writeI8(T_STOP); // struct end
}

// 6 params: $transport $method_name $ttype $request_struct $seqID $strict_write
PHP_FUNCTION(thrift_protocol_write_binary) {
  zval *protocol;
  zval *request_struct;
  zend_string *method_name;
  long msgtype, seqID;
  zend_bool strict_write;

	if (zend_parse_parameters_ex(ZEND_PARSE_PARAMS_QUIET, ZEND_NUM_ARGS(), "oSlolb",
        &protocol, &method_name, &msgtype,
        &request_struct, &seqID, &strict_write) == FAILURE) {
		return;
	}

  try {
    zval* spec = zend_read_static_property(Z_OBJCE_P(request_struct), "_TSPEC", sizeof("_TSPEC")-1, false);

    if (Z_TYPE_P(spec) != IS_ARRAY) {
       throw_tprotocolexception("Attempt to send non-Thrift object", INVALID_DATA);
    }

    PHPOutputTransport transport(protocol);
    protocol_writeMessageBegin(protocol, method_name, (int32_t) msgtype, (int32_t) seqID);
    binary_serialize_spec(request_struct, transport, Z_ARRVAL_P(spec));
    transport.flush();

  } catch (const PHPExceptionWrapper& ex) {
    zend_throw_exception_object(ex);
    RETURN_NULL();
  } catch (const std::exception& ex) {
    throw_zend_exception_from_std_exception(ex);
    RETURN_NULL();
  }
}


// 4 params: $transport $response_Typename $strict_read $buffer_size
PHP_FUNCTION(thrift_protocol_read_binary) {
  zval *protocol;
  zend_string *obj_typename;
  zend_bool strict_read;
  size_t buffer_size = 8192;

  if (zend_parse_parameters(ZEND_NUM_ARGS(), "oSb|l", &protocol, &obj_typename, &strict_read, &buffer_size) == FAILURE) {
    return;
  }

  try {
    PHPInputTransport transport(protocol, buffer_size);
    int8_t messageType = 0;
    int32_t sz = transport.readI32();

    if (sz < 0) {
      // Check for correct version number
      int32_t version = sz & VERSION_MASK;
      if (version != VERSION_1) {
        throw_tprotocolexception("Bad version identifier", BAD_VERSION);
      }
      messageType = (sz & 0x000000ff);
      int32_t namelen = transport.readI32();
      // skip the name string and the sequence ID, we don't care about those
      transport.skip(namelen + 4);
    } else {
      if (strict_read) {
        throw_tprotocolexception("No version identifier... old protocol client in strict mode?", BAD_VERSION);
      } else {
        // Handle pre-versioned input
        transport.skip(sz); // skip string body
        messageType = transport.readI8();
        transport.skip(4); // skip sequence number
      }
    }

    if (messageType == T_EXCEPTION) {
      zval ex;
      createObject("\\Thrift\\Exception\\TApplicationException", &ex);
      zval* spec = zend_read_static_property(Z_OBJCE(ex), "_TSPEC", sizeof("_TPSEC")-1, false);
      binary_deserialize_spec(&ex, transport, Z_ARRVAL_P(spec));
      throw PHPExceptionWrapper(&ex);
    }

    createObject(ZSTR_VAL(obj_typename), return_value);
    zval* spec = zend_read_static_property(Z_OBJCE_P(return_value), "_TSPEC", sizeof("_TSPEC")-1, false);
    binary_deserialize_spec(return_value, transport, Z_ARRVAL_P(spec));
  } catch (const PHPExceptionWrapper& ex) {
    zend_throw_exception_object(ex);
    RETURN_NULL();
  } catch (const std::exception& ex) {
    throw_zend_exception_from_std_exception(ex);
    RETURN_NULL();
  }
}

#endif /* PHP_VERSION_ID >= 70000 */
