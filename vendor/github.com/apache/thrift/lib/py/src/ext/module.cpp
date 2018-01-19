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

#include <Python.h>
#include "types.h"
#include "binary.h"
#include "compact.h"
#include <limits>
#include <stdint.h>

// TODO(dreiss): defval appears to be unused.  Look into removing it.
// TODO(dreiss): Make parse_spec_args recursive, and cache the output
//               permanently in the object.  (Malloc and orphan.)
// TODO(dreiss): Why do we need cStringIO for reading, why not just char*?
//               Can cStringIO let us work with a BufferedTransport?
// TODO(dreiss): Don't ignore the rv from cwrite (maybe).

// Doing a benchmark shows that interning actually makes a difference, amazingly.

/** Pointer to interned string to speed up attribute lookup. */
PyObject* INTERN_STRING(TFrozenDict);
PyObject* INTERN_STRING(cstringio_buf);
PyObject* INTERN_STRING(cstringio_refill);
static PyObject* INTERN_STRING(string_length_limit);
static PyObject* INTERN_STRING(container_length_limit);
static PyObject* INTERN_STRING(trans);

namespace apache {
namespace thrift {
namespace py {

template <typename T>
static PyObject* encode_impl(PyObject* args) {
  if (!args)
    return NULL;

  PyObject* enc_obj = NULL;
  PyObject* type_args = NULL;
  if (!PyArg_ParseTuple(args, "OO", &enc_obj, &type_args)) {
    return NULL;
  }
  if (!enc_obj || !type_args) {
    return NULL;
  }

  T protocol;
  if (!protocol.prepareEncodeBuffer() || !protocol.encodeValue(enc_obj, T_STRUCT, type_args)) {
    return NULL;
  }

  return protocol.getEncodedValue();
}

static inline long as_long_then_delete(PyObject* value, long default_value) {
  ScopedPyObject scope(value);
  long v = PyInt_AsLong(value);
  if (INT_CONV_ERROR_OCCURRED(v)) {
    PyErr_Clear();
    return default_value;
  }
  return v;
}

template <typename T>
static PyObject* decode_impl(PyObject* args) {
  PyObject* output_obj = NULL;
  PyObject* oprot = NULL;
  PyObject* typeargs = NULL;
  if (!PyArg_ParseTuple(args, "OOO", &output_obj, &oprot, &typeargs)) {
    return NULL;
  }

  T protocol;
#ifdef _MSC_VER
  // workaround strange VC++ 2015 bug where #else path does not compile
  int32_t default_limit = INT32_MAX;
#else
  int32_t default_limit = std::numeric_limits<int32_t>::max();
#endif
  protocol.setStringLengthLimit(
      as_long_then_delete(PyObject_GetAttr(oprot, INTERN_STRING(string_length_limit)),
                          default_limit));
  protocol.setContainerLengthLimit(
      as_long_then_delete(PyObject_GetAttr(oprot, INTERN_STRING(container_length_limit)),
                          default_limit));
  ScopedPyObject transport(PyObject_GetAttr(oprot, INTERN_STRING(trans)));
  if (!transport) {
    return NULL;
  }

  StructTypeArgs parsedargs;
  if (!parse_struct_args(&parsedargs, typeargs)) {
    return NULL;
  }

  if (!protocol.prepareDecodeBufferFromTransport(transport.get())) {
    return NULL;
  }

  return protocol.readStruct(output_obj, parsedargs.klass, parsedargs.spec);
}
}
}
}

using namespace apache::thrift::py;

/* -- PYTHON MODULE SETUP STUFF --- */

extern "C" {

static PyObject* encode_binary(PyObject*, PyObject* args) {
  return encode_impl<BinaryProtocol>(args);
}

static PyObject* decode_binary(PyObject*, PyObject* args) {
  return decode_impl<BinaryProtocol>(args);
}

static PyObject* encode_compact(PyObject*, PyObject* args) {
  return encode_impl<CompactProtocol>(args);
}

static PyObject* decode_compact(PyObject*, PyObject* args) {
  return decode_impl<CompactProtocol>(args);
}

static PyMethodDef ThriftFastBinaryMethods[] = {
    {"encode_binary", encode_binary, METH_VARARGS, ""},
    {"decode_binary", decode_binary, METH_VARARGS, ""},
    {"encode_compact", encode_compact, METH_VARARGS, ""},
    {"decode_compact", decode_compact, METH_VARARGS, ""},
    {NULL, NULL, 0, NULL} /* Sentinel */
};

#if PY_MAJOR_VERSION >= 3

static struct PyModuleDef ThriftFastBinaryDef = {PyModuleDef_HEAD_INIT,
                                                 "thrift.protocol.fastbinary",
                                                 NULL,
                                                 0,
                                                 ThriftFastBinaryMethods,
                                                 NULL,
                                                 NULL,
                                                 NULL,
                                                 NULL};

#define INITERROR return NULL;

PyObject* PyInit_fastbinary() {

#else

#define INITERROR return;

void initfastbinary() {

  PycString_IMPORT;
  if (PycStringIO == NULL)
    INITERROR

#endif

#define INIT_INTERN_STRING(value)                                                                  \
  do {                                                                                             \
    INTERN_STRING(value) = PyString_InternFromString(#value);                                      \
    if (!INTERN_STRING(value))                                                                     \
      INITERROR                                                                                    \
  } while (0)

  INIT_INTERN_STRING(TFrozenDict);
  INIT_INTERN_STRING(cstringio_buf);
  INIT_INTERN_STRING(cstringio_refill);
  INIT_INTERN_STRING(string_length_limit);
  INIT_INTERN_STRING(container_length_limit);
  INIT_INTERN_STRING(trans);
#undef INIT_INTERN_STRING

  PyObject* module =
#if PY_MAJOR_VERSION >= 3
      PyModule_Create(&ThriftFastBinaryDef);
#else
      Py_InitModule("thrift.protocol.fastbinary", ThriftFastBinaryMethods);
#endif
  if (module == NULL)
    INITERROR;

#if PY_MAJOR_VERSION >= 3
  return module;
#endif
}
}
