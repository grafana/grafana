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

#ifndef THRIFT_PY_TYPES_H
#define THRIFT_PY_TYPES_H

#include <Python.h>

#ifdef _MSC_VER
#define __STDC_LIMIT_MACROS
#endif
#include <stdint.h>

#if PY_MAJOR_VERSION >= 3

#include <vector>

// TODO: better macros
#define PyInt_AsLong(v) PyLong_AsLong(v)
#define PyInt_FromLong(v) PyLong_FromLong(v)

#define PyString_InternFromString(v) PyUnicode_InternFromString(v)

#endif

#define INTERN_STRING(value) _intern_##value

#define INT_CONV_ERROR_OCCURRED(v) (((v) == -1) && PyErr_Occurred())

extern "C" {
extern PyObject* INTERN_STRING(TFrozenDict);
extern PyObject* INTERN_STRING(cstringio_buf);
extern PyObject* INTERN_STRING(cstringio_refill);
}

namespace apache {
namespace thrift {
namespace py {

extern PyObject* ThriftModule;

// Stolen out of TProtocol.h.
// It would be a huge pain to have both get this from one place.
enum TType {
  T_INVALID = -1,
  T_STOP = 0,
  T_VOID = 1,
  T_BOOL = 2,
  T_BYTE = 3,
  T_I08 = 3,
  T_I16 = 6,
  T_I32 = 8,
  T_U64 = 9,
  T_I64 = 10,
  T_DOUBLE = 4,
  T_STRING = 11,
  T_UTF7 = 11,
  T_STRUCT = 12,
  T_MAP = 13,
  T_SET = 14,
  T_LIST = 15,
  T_UTF8 = 16,
  T_UTF16 = 17
};

// replace with unique_ptr when we're OK with C++11
class ScopedPyObject {
public:
  ScopedPyObject() : obj_(NULL) {}
  explicit ScopedPyObject(PyObject* py_object) : obj_(py_object) {}
  ~ScopedPyObject() {
    if (obj_)
      Py_DECREF(obj_);
  }
  PyObject* get() throw() { return obj_; }
  operator bool() { return obj_; }
  void reset(PyObject* py_object) throw() {
    if (obj_)
      Py_DECREF(obj_);
    obj_ = py_object;
  }
  PyObject* release() throw() {
    PyObject* tmp = obj_;
    obj_ = NULL;
    return tmp;
  }
  void swap(ScopedPyObject& other) throw() {
    ScopedPyObject tmp(other.release());
    other.reset(release());
    reset(tmp.release());
  }

private:
  ScopedPyObject(const ScopedPyObject&) {}
  ScopedPyObject& operator=(const ScopedPyObject&) { return *this; }

  PyObject* obj_;
};

/**
 * A cache of the two key attributes of a CReadableTransport,
 * so we don't have to keep calling PyObject_GetAttr.
 */
struct DecodeBuffer {
  ScopedPyObject stringiobuf;
  ScopedPyObject refill_callable;
};

#if PY_MAJOR_VERSION < 3
extern char refill_signature[3];
typedef PyObject EncodeBuffer;
#else
extern const char* refill_signature;
struct EncodeBuffer {
  std::vector<char> buf;
  size_t pos;
};
#endif

/**
 * A cache of the spec_args for a set or list,
 * so we don't have to keep calling PyTuple_GET_ITEM.
 */
struct SetListTypeArgs {
  TType element_type;
  PyObject* typeargs;
  bool immutable;
};

/**
 * A cache of the spec_args for a map,
 * so we don't have to keep calling PyTuple_GET_ITEM.
 */
struct MapTypeArgs {
  TType ktag;
  TType vtag;
  PyObject* ktypeargs;
  PyObject* vtypeargs;
  bool immutable;
};

/**
 * A cache of the spec_args for a struct,
 * so we don't have to keep calling PyTuple_GET_ITEM.
 */
struct StructTypeArgs {
  PyObject* klass;
  PyObject* spec;
  bool immutable;
};

/**
 * A cache of the item spec from a struct specification,
 * so we don't have to keep calling PyTuple_GET_ITEM.
 */
struct StructItemSpec {
  int tag;
  TType type;
  PyObject* attrname;
  PyObject* typeargs;
  PyObject* defval;
};

bool parse_set_list_args(SetListTypeArgs* dest, PyObject* typeargs);

bool parse_map_args(MapTypeArgs* dest, PyObject* typeargs);

bool parse_struct_args(StructTypeArgs* dest, PyObject* typeargs);

bool parse_struct_item_spec(StructItemSpec* dest, PyObject* spec_tuple);
}
}
}

#endif // THRIFT_PY_TYPES_H
