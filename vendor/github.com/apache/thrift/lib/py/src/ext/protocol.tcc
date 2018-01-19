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

#ifndef THRIFT_PY_PROTOCOL_TCC
#define THRIFT_PY_PROTOCOL_TCC

#include <iterator>

#define CHECK_RANGE(v, min, max) (((v) <= (max)) && ((v) >= (min)))
#define INIT_OUTBUF_SIZE 128

#if PY_MAJOR_VERSION < 3
#include <cStringIO.h>
#else
#include <algorithm>
#endif

namespace apache {
namespace thrift {
namespace py {

#if PY_MAJOR_VERSION < 3

namespace detail {

inline bool input_check(PyObject* input) {
  return PycStringIO_InputCheck(input);
}

inline EncodeBuffer* new_encode_buffer(size_t size) {
  if (!PycStringIO) {
    PycString_IMPORT;
  }
  if (!PycStringIO) {
    return NULL;
  }
  return PycStringIO->NewOutput(size);
}

inline int read_buffer(PyObject* buf, char** output, int len) {
  if (!PycStringIO) {
    PycString_IMPORT;
  }
  if (!PycStringIO) {
    PyErr_SetString(PyExc_ImportError, "failed to import native cStringIO");
    return -1;
  }
  return PycStringIO->cread(buf, output, len);
}
}

template <typename Impl>
inline ProtocolBase<Impl>::~ProtocolBase() {
  if (output_) {
    Py_CLEAR(output_);
  }
}

template <typename Impl>
inline bool ProtocolBase<Impl>::isUtf8(PyObject* typeargs) {
  return PyString_Check(typeargs) && !strncmp(PyString_AS_STRING(typeargs), "UTF8", 4);
}

template <typename Impl>
PyObject* ProtocolBase<Impl>::getEncodedValue() {
  if (!PycStringIO) {
    PycString_IMPORT;
  }
  if (!PycStringIO) {
    return NULL;
  }
  return PycStringIO->cgetvalue(output_);
}

template <typename Impl>
inline bool ProtocolBase<Impl>::writeBuffer(char* data, size_t size) {
  if (!PycStringIO) {
    PycString_IMPORT;
  }
  if (!PycStringIO) {
    PyErr_SetString(PyExc_ImportError, "failed to import native cStringIO");
    return false;
  }
  int len = PycStringIO->cwrite(output_, data, size);
  if (len < 0) {
    PyErr_SetString(PyExc_IOError, "failed to write to cStringIO object");
    return false;
  }
  if (len != size) {
    PyErr_Format(PyExc_EOFError, "write length mismatch: expected %lu got %d", size, len);
    return false;
  }
  return true;
}

#else

namespace detail {

inline bool input_check(PyObject* input) {
  // TODO: Check for BytesIO type
  return true;
}

inline EncodeBuffer* new_encode_buffer(size_t size) {
  EncodeBuffer* buffer = new EncodeBuffer;
  buffer->buf.reserve(size);
  buffer->pos = 0;
  return buffer;
}

struct bytesio {
  PyObject_HEAD
#if PY_MINOR_VERSION < 5
      char* buf;
#else
      PyObject* buf;
#endif
  Py_ssize_t pos;
  Py_ssize_t string_size;
};

inline int read_buffer(PyObject* buf, char** output, int len) {
  bytesio* buf2 = reinterpret_cast<bytesio*>(buf);
#if PY_MINOR_VERSION < 5
  *output = buf2->buf + buf2->pos;
#else
  *output = PyBytes_AS_STRING(buf2->buf) + buf2->pos;
#endif
  Py_ssize_t pos0 = buf2->pos;
  buf2->pos = std::min(buf2->pos + static_cast<Py_ssize_t>(len), buf2->string_size);
  return static_cast<int>(buf2->pos - pos0);
}
}

template <typename Impl>
inline ProtocolBase<Impl>::~ProtocolBase() {
  if (output_) {
    delete output_;
  }
}

template <typename Impl>
inline bool ProtocolBase<Impl>::isUtf8(PyObject* typeargs) {
  // while condition for py2 is "arg == 'UTF8'", it should be "arg != 'BINARY'" for py3.
  // HACK: check the length and don't bother reading the value
  return !PyUnicode_Check(typeargs) || PyUnicode_GET_LENGTH(typeargs) != 6;
}

template <typename Impl>
PyObject* ProtocolBase<Impl>::getEncodedValue() {
  return PyBytes_FromStringAndSize(output_->buf.data(), output_->buf.size());
}

template <typename Impl>
inline bool ProtocolBase<Impl>::writeBuffer(char* data, size_t size) {
  size_t need = size + output_->pos;
  if (output_->buf.capacity() < need) {
    try {
      output_->buf.reserve(need);
    } catch (std::bad_alloc& ex) {
      PyErr_SetString(PyExc_MemoryError, "Failed to allocate write buffer");
      return false;
    }
  }
  std::copy(data, data + size, std::back_inserter(output_->buf));
  return true;
}

#endif

namespace detail {

#define DECLARE_OP_SCOPE(name, op)                                                                 \
  template <typename Impl>                                                                         \
  struct name##Scope {                                                                             \
    Impl* impl;                                                                                    \
    bool valid;                                                                                    \
    name##Scope(Impl* thiz) : impl(thiz), valid(impl->op##Begin()) {}                              \
    ~name##Scope() {                                                                               \
      if (valid)                                                                                   \
        impl->op##End();                                                                           \
    }                                                                                              \
    operator bool() { return valid; }                                                              \
  };                                                                                               \
  template <typename Impl, template <typename> class T>                                            \
  name##Scope<Impl> op##Scope(T<Impl>* thiz) {                                                     \
    return name##Scope<Impl>(static_cast<Impl*>(thiz));                                            \
  }
DECLARE_OP_SCOPE(WriteStruct, writeStruct)
DECLARE_OP_SCOPE(ReadStruct, readStruct)
#undef DECLARE_OP_SCOPE

inline bool check_ssize_t_32(Py_ssize_t len) {
  // error from getting the int
  if (INT_CONV_ERROR_OCCURRED(len)) {
    return false;
  }
  if (!CHECK_RANGE(len, 0, std::numeric_limits<int32_t>::max())) {
    PyErr_SetString(PyExc_OverflowError, "size out of range: exceeded INT32_MAX");
    return false;
  }
  return true;
}
}

template <typename T>
bool parse_pyint(PyObject* o, T* ret, int32_t min, int32_t max) {
  long val = PyInt_AsLong(o);

  if (INT_CONV_ERROR_OCCURRED(val)) {
    return false;
  }
  if (!CHECK_RANGE(val, min, max)) {
    PyErr_SetString(PyExc_OverflowError, "int out of range");
    return false;
  }

  *ret = static_cast<T>(val);
  return true;
}

template <typename Impl>
inline bool ProtocolBase<Impl>::checkType(TType got, TType expected) {
  if (expected != got) {
    PyErr_SetString(PyExc_TypeError, "got wrong ttype while reading field");
    return false;
  }
  return true;
}

template <typename Impl>
bool ProtocolBase<Impl>::checkLengthLimit(int32_t len, long limit) {
  if (len < 0) {
    PyErr_Format(PyExc_OverflowError, "negative length: %ld", limit);
    return false;
  }
  if (len > limit) {
    PyErr_Format(PyExc_OverflowError, "size exceeded specified limit: %ld", limit);
    return false;
  }
  return true;
}

template <typename Impl>
bool ProtocolBase<Impl>::readBytes(char** output, int len) {
  if (len < 0) {
    PyErr_Format(PyExc_ValueError, "attempted to read negative length: %d", len);
    return false;
  }
  // TODO(dreiss): Don't fear the malloc.  Think about taking a copy of
  //               the partial read instead of forcing the transport
  //               to prepend it to its buffer.

  int rlen = detail::read_buffer(input_.stringiobuf.get(), output, len);

  if (rlen == len) {
    return true;
  } else if (rlen == -1) {
    return false;
  } else {
    // using building functions as this is a rare codepath
    ScopedPyObject newiobuf(PyObject_CallFunction(input_.refill_callable.get(), refill_signature,
                                                  *output, rlen, len, NULL));
    if (!newiobuf) {
      return false;
    }

    // must do this *AFTER* the call so that we don't deref the io buffer
    input_.stringiobuf.reset(newiobuf.release());

    rlen = detail::read_buffer(input_.stringiobuf.get(), output, len);

    if (rlen == len) {
      return true;
    } else if (rlen == -1) {
      return false;
    } else {
      // TODO(dreiss): This could be a valid code path for big binary blobs.
      PyErr_SetString(PyExc_TypeError, "refill claimed to have refilled the buffer, but didn't!!");
      return false;
    }
  }
}

template <typename Impl>
bool ProtocolBase<Impl>::prepareDecodeBufferFromTransport(PyObject* trans) {
  if (input_.stringiobuf) {
    PyErr_SetString(PyExc_ValueError, "decode buffer is already initialized");
    return false;
  }

  ScopedPyObject stringiobuf(PyObject_GetAttr(trans, INTERN_STRING(cstringio_buf)));
  if (!stringiobuf) {
    return false;
  }
  if (!detail::input_check(stringiobuf.get())) {
    PyErr_SetString(PyExc_TypeError, "expecting stringio input_");
    return false;
  }

  ScopedPyObject refill_callable(PyObject_GetAttr(trans, INTERN_STRING(cstringio_refill)));
  if (!refill_callable) {
    return false;
  }
  if (!PyCallable_Check(refill_callable.get())) {
    PyErr_SetString(PyExc_TypeError, "expecting callable");
    return false;
  }

  input_.stringiobuf.swap(stringiobuf);
  input_.refill_callable.swap(refill_callable);
  return true;
}

template <typename Impl>
bool ProtocolBase<Impl>::prepareEncodeBuffer() {
  output_ = detail::new_encode_buffer(INIT_OUTBUF_SIZE);
  return output_ != NULL;
}

template <typename Impl>
bool ProtocolBase<Impl>::encodeValue(PyObject* value, TType type, PyObject* typeargs) {
  /*
   * Refcounting Strategy:
   *
   * We assume that elements of the thrift_spec tuple are not going to be
   * mutated, so we don't ref count those at all. Other than that, we try to
   * keep a reference to all the user-created objects while we work with them.
   * encodeValue assumes that a reference is already held. The *caller* is
   * responsible for handling references
   */

  switch (type) {

  case T_BOOL: {
    int v = PyObject_IsTrue(value);
    if (v == -1) {
      return false;
    }
    impl()->writeBool(v);
    return true;
  }
  case T_I08: {
    int8_t val;

    if (!parse_pyint(value, &val, std::numeric_limits<int8_t>::min(),
                     std::numeric_limits<int8_t>::max())) {
      return false;
    }

    impl()->writeI8(val);
    return true;
  }
  case T_I16: {
    int16_t val;

    if (!parse_pyint(value, &val, std::numeric_limits<int16_t>::min(),
                     std::numeric_limits<int16_t>::max())) {
      return false;
    }

    impl()->writeI16(val);
    return true;
  }
  case T_I32: {
    int32_t val;

    if (!parse_pyint(value, &val, std::numeric_limits<int32_t>::min(),
                     std::numeric_limits<int32_t>::max())) {
      return false;
    }

    impl()->writeI32(val);
    return true;
  }
  case T_I64: {
    int64_t nval = PyLong_AsLongLong(value);

    if (INT_CONV_ERROR_OCCURRED(nval)) {
      return false;
    }

    if (!CHECK_RANGE(nval, std::numeric_limits<int64_t>::min(),
                     std::numeric_limits<int64_t>::max())) {
      PyErr_SetString(PyExc_OverflowError, "int out of range");
      return false;
    }

    impl()->writeI64(nval);
    return true;
  }

  case T_DOUBLE: {
    double nval = PyFloat_AsDouble(value);
    if (nval == -1.0 && PyErr_Occurred()) {
      return false;
    }

    impl()->writeDouble(nval);
    return true;
  }

  case T_STRING: {
    ScopedPyObject nval;

    if (PyUnicode_Check(value)) {
      nval.reset(PyUnicode_AsUTF8String(value));
      if (!nval) {
        return false;
      }
    } else {
      Py_INCREF(value);
      nval.reset(value);
    }

    Py_ssize_t len = PyBytes_Size(nval.get());
    if (!detail::check_ssize_t_32(len)) {
      return false;
    }

    impl()->writeString(nval.get(), static_cast<int32_t>(len));
    return true;
  }

  case T_LIST:
  case T_SET: {
    SetListTypeArgs parsedargs;
    if (!parse_set_list_args(&parsedargs, typeargs)) {
      return false;
    }

    Py_ssize_t len = PyObject_Length(value);
    if (!detail::check_ssize_t_32(len)) {
      return false;
    }

    if (!impl()->writeListBegin(value, parsedargs, static_cast<int32_t>(len)) || PyErr_Occurred()) {
      return false;
    }
    ScopedPyObject iterator(PyObject_GetIter(value));
    if (!iterator) {
      return false;
    }

    while (PyObject* rawItem = PyIter_Next(iterator.get())) {
      ScopedPyObject item(rawItem);
      if (!encodeValue(item.get(), parsedargs.element_type, parsedargs.typeargs)) {
        return false;
      }
    }

    return true;
  }

  case T_MAP: {
    Py_ssize_t len = PyDict_Size(value);
    if (!detail::check_ssize_t_32(len)) {
      return false;
    }

    MapTypeArgs parsedargs;
    if (!parse_map_args(&parsedargs, typeargs)) {
      return false;
    }

    if (!impl()->writeMapBegin(value, parsedargs, static_cast<int32_t>(len)) || PyErr_Occurred()) {
      return false;
    }
    Py_ssize_t pos = 0;
    PyObject* k = NULL;
    PyObject* v = NULL;
    // TODO(bmaurer): should support any mapping, not just dicts
    while (PyDict_Next(value, &pos, &k, &v)) {
      if (!encodeValue(k, parsedargs.ktag, parsedargs.ktypeargs)
          || !encodeValue(v, parsedargs.vtag, parsedargs.vtypeargs)) {
        return false;
      }
    }
    return true;
  }

  case T_STRUCT: {
    StructTypeArgs parsedargs;
    if (!parse_struct_args(&parsedargs, typeargs)) {
      return false;
    }

    Py_ssize_t nspec = PyTuple_Size(parsedargs.spec);
    if (nspec == -1) {
      PyErr_SetString(PyExc_TypeError, "spec is not a tuple");
      return false;
    }

    detail::WriteStructScope<Impl> scope = detail::writeStructScope(this);
    if (!scope) {
      return false;
    }
    for (Py_ssize_t i = 0; i < nspec; i++) {
      PyObject* spec_tuple = PyTuple_GET_ITEM(parsedargs.spec, i);
      if (spec_tuple == Py_None) {
        continue;
      }

      StructItemSpec parsedspec;
      if (!parse_struct_item_spec(&parsedspec, spec_tuple)) {
        return false;
      }

      ScopedPyObject instval(PyObject_GetAttr(value, parsedspec.attrname));

      if (!instval) {
        return false;
      }

      if (instval.get() == Py_None) {
        continue;
      }

      bool res = impl()->writeField(instval.get(), parsedspec);
      if (!res) {
        return false;
      }
    }
    impl()->writeFieldStop();
    return true;
  }

  case T_STOP:
  case T_VOID:
  case T_UTF16:
  case T_UTF8:
  case T_U64:
  default:
    PyErr_Format(PyExc_TypeError, "Unexpected TType for encodeValue: %d", type);
    return false;
  }

  return true;
}

template <typename Impl>
bool ProtocolBase<Impl>::skip(TType type) {
  switch (type) {
  case T_BOOL:
    return impl()->skipBool();
  case T_I08:
    return impl()->skipByte();
  case T_I16:
    return impl()->skipI16();
  case T_I32:
    return impl()->skipI32();
  case T_I64:
    return impl()->skipI64();
  case T_DOUBLE:
    return impl()->skipDouble();

  case T_STRING: {
    return impl()->skipString();
  }

  case T_LIST:
  case T_SET: {
    TType etype = T_STOP;
    int32_t len = impl()->readListBegin(etype);
    if (len < 0) {
      return false;
    }
    for (int32_t i = 0; i < len; i++) {
      if (!skip(etype)) {
        return false;
      }
    }
    return true;
  }

  case T_MAP: {
    TType ktype = T_STOP;
    TType vtype = T_STOP;
    int32_t len = impl()->readMapBegin(ktype, vtype);
    if (len < 0) {
      return false;
    }
    for (int32_t i = 0; i < len; i++) {
      if (!skip(ktype) || !skip(vtype)) {
        return false;
      }
    }
    return true;
  }

  case T_STRUCT: {
    detail::ReadStructScope<Impl> scope = detail::readStructScope(this);
    if (!scope) {
      return false;
    }
    while (true) {
      TType type = T_STOP;
      int16_t tag;
      if (!impl()->readFieldBegin(type, tag)) {
        return false;
      }
      if (type == T_STOP) {
        return true;
      }
      if (!skip(type)) {
        return false;
      }
    }
    return true;
  }

  case T_STOP:
  case T_VOID:
  case T_UTF16:
  case T_UTF8:
  case T_U64:
  default:
    PyErr_Format(PyExc_TypeError, "Unexpected TType for skip: %d", type);
    return false;
  }

  return true;
}

// Returns a new reference.
template <typename Impl>
PyObject* ProtocolBase<Impl>::decodeValue(TType type, PyObject* typeargs) {
  switch (type) {

  case T_BOOL: {
    bool v = 0;
    if (!impl()->readBool(v)) {
      return NULL;
    }
    if (v) {
      Py_RETURN_TRUE;
    } else {
      Py_RETURN_FALSE;
    }
  }
  case T_I08: {
    int8_t v = 0;
    if (!impl()->readI8(v)) {
      return NULL;
    }
    return PyInt_FromLong(v);
  }
  case T_I16: {
    int16_t v = 0;
    if (!impl()->readI16(v)) {
      return NULL;
    }
    return PyInt_FromLong(v);
  }
  case T_I32: {
    int32_t v = 0;
    if (!impl()->readI32(v)) {
      return NULL;
    }
    return PyInt_FromLong(v);
  }

  case T_I64: {
    int64_t v = 0;
    if (!impl()->readI64(v)) {
      return NULL;
    }
    // TODO(dreiss): Find out if we can take this fastpath always when
    //               sizeof(long) == sizeof(long long).
    if (CHECK_RANGE(v, LONG_MIN, LONG_MAX)) {
      return PyInt_FromLong((long)v);
    }
    return PyLong_FromLongLong(v);
  }

  case T_DOUBLE: {
    double v = 0.0;
    if (!impl()->readDouble(v)) {
      return NULL;
    }
    return PyFloat_FromDouble(v);
  }

  case T_STRING: {
    char* buf = NULL;
    int len = impl()->readString(&buf);
    if (len < 0) {
      return NULL;
    }
    if (isUtf8(typeargs)) {
      return PyUnicode_DecodeUTF8(buf, len, 0);
    } else {
      return PyBytes_FromStringAndSize(buf, len);
    }
  }

  case T_LIST:
  case T_SET: {
    SetListTypeArgs parsedargs;
    if (!parse_set_list_args(&parsedargs, typeargs)) {
      return NULL;
    }

    TType etype = T_STOP;
    int32_t len = impl()->readListBegin(etype);
    if (len < 0) {
      return NULL;
    }
    if (len > 0 && !checkType(etype, parsedargs.element_type)) {
      return NULL;
    }

    bool use_tuple = type == T_LIST && parsedargs.immutable;
    ScopedPyObject ret(use_tuple ? PyTuple_New(len) : PyList_New(len));
    if (!ret) {
      return NULL;
    }

    for (int i = 0; i < len; i++) {
      PyObject* item = decodeValue(etype, parsedargs.typeargs);
      if (!item) {
        return NULL;
      }
      if (use_tuple) {
        PyTuple_SET_ITEM(ret.get(), i, item);
      } else {
        PyList_SET_ITEM(ret.get(), i, item);
      }
    }

    // TODO(dreiss): Consider biting the bullet and making two separate cases
    //               for list and set, avoiding this post facto conversion.
    if (type == T_SET) {
      PyObject* setret;
      setret = parsedargs.immutable ? PyFrozenSet_New(ret.get()) : PySet_New(ret.get());
      return setret;
    }
    return ret.release();
  }

  case T_MAP: {
    MapTypeArgs parsedargs;
    if (!parse_map_args(&parsedargs, typeargs)) {
      return NULL;
    }

    TType ktype = T_STOP;
    TType vtype = T_STOP;
    uint32_t len = impl()->readMapBegin(ktype, vtype);
    if (len > 0 && (!checkType(ktype, parsedargs.ktag) || !checkType(vtype, parsedargs.vtag))) {
      return NULL;
    }

    ScopedPyObject ret(PyDict_New());
    if (!ret) {
      return NULL;
    }

    for (uint32_t i = 0; i < len; i++) {
      ScopedPyObject k(decodeValue(ktype, parsedargs.ktypeargs));
      if (!k) {
        return NULL;
      }
      ScopedPyObject v(decodeValue(vtype, parsedargs.vtypeargs));
      if (!v) {
        return NULL;
      }
      if (PyDict_SetItem(ret.get(), k.get(), v.get()) == -1) {
        return NULL;
      }
    }

    if (parsedargs.immutable) {
      if (!ThriftModule) {
        ThriftModule = PyImport_ImportModule("thrift.Thrift");
      }
      if (!ThriftModule) {
        return NULL;
      }

      ScopedPyObject cls(PyObject_GetAttr(ThriftModule, INTERN_STRING(TFrozenDict)));
      if (!cls) {
        return NULL;
      }

      ScopedPyObject arg(PyTuple_New(1));
      PyTuple_SET_ITEM(arg.get(), 0, ret.release());
      ret.reset(PyObject_CallObject(cls.get(), arg.get()));
    }

    return ret.release();
  }

  case T_STRUCT: {
    StructTypeArgs parsedargs;
    if (!parse_struct_args(&parsedargs, typeargs)) {
      return NULL;
    }
    return readStruct(Py_None, parsedargs.klass, parsedargs.spec);
  }

  case T_STOP:
  case T_VOID:
  case T_UTF16:
  case T_UTF8:
  case T_U64:
  default:
    PyErr_Format(PyExc_TypeError, "Unexpected TType for decodeValue: %d", type);
    return NULL;
  }
}

template <typename Impl>
PyObject* ProtocolBase<Impl>::readStruct(PyObject* output, PyObject* klass, PyObject* spec_seq) {
  int spec_seq_len = PyTuple_Size(spec_seq);
  bool immutable = output == Py_None;
  ScopedPyObject kwargs;
  if (spec_seq_len == -1) {
    return NULL;
  }

  if (immutable) {
    kwargs.reset(PyDict_New());
    if (!kwargs) {
      PyErr_SetString(PyExc_TypeError, "failed to prepare kwargument storage");
      return NULL;
    }
  }

  detail::ReadStructScope<Impl> scope = detail::readStructScope(this);
  if (!scope) {
    return NULL;
  }
  while (true) {
    TType type = T_STOP;
    int16_t tag;
    if (!impl()->readFieldBegin(type, tag)) {
      return NULL;
    }
    if (type == T_STOP) {
      break;
    }
    if (tag < 0 || tag >= spec_seq_len) {
      if (!skip(type)) {
        PyErr_SetString(PyExc_TypeError, "Error while skipping unknown field");
        return NULL;
      }
      continue;
    }

    PyObject* item_spec = PyTuple_GET_ITEM(spec_seq, tag);
    if (item_spec == Py_None) {
      if (!skip(type)) {
        PyErr_SetString(PyExc_TypeError, "Error while skipping unknown field");
        return NULL;
      }
      continue;
    }
    StructItemSpec parsedspec;
    if (!parse_struct_item_spec(&parsedspec, item_spec)) {
      return NULL;
    }
    if (parsedspec.type != type) {
      if (!skip(type)) {
        PyErr_Format(PyExc_TypeError, "struct field had wrong type: expected %d but got %d",
                     parsedspec.type, type);
        return NULL;
      }
      continue;
    }

    ScopedPyObject fieldval(decodeValue(parsedspec.type, parsedspec.typeargs));
    if (!fieldval) {
      return NULL;
    }

    if ((immutable && PyDict_SetItem(kwargs.get(), parsedspec.attrname, fieldval.get()) == -1)
        || (!immutable && PyObject_SetAttr(output, parsedspec.attrname, fieldval.get()) == -1)) {
      return NULL;
    }
  }
  if (immutable) {
    ScopedPyObject args(PyTuple_New(0));
    if (!args) {
      PyErr_SetString(PyExc_TypeError, "failed to prepare argument storage");
      return NULL;
    }
    return PyObject_Call(klass, args.get(), kwargs.get());
  }
  Py_INCREF(output);
  return output;
}
}
}
}
#endif // THRIFT_PY_PROTOCOL_H
