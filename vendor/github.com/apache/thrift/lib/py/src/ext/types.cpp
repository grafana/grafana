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

#include "ext/types.h"
#include "ext/protocol.h"

namespace apache {
namespace thrift {
namespace py {

PyObject* ThriftModule = NULL;

#if PY_MAJOR_VERSION < 3
char refill_signature[] = {'s', '#', 'i'};
#else
const char* refill_signature = "y#i";
#endif

bool parse_struct_item_spec(StructItemSpec* dest, PyObject* spec_tuple) {
  // i'd like to use ParseArgs here, but it seems to be a bottleneck.
  if (PyTuple_Size(spec_tuple) != 5) {
    PyErr_Format(PyExc_TypeError, "expecting 5 arguments for spec tuple but got %d",
                 static_cast<int>(PyTuple_Size(spec_tuple)));
    return false;
  }

  dest->tag = static_cast<TType>(PyInt_AsLong(PyTuple_GET_ITEM(spec_tuple, 0)));
  if (INT_CONV_ERROR_OCCURRED(dest->tag)) {
    return false;
  }

  dest->type = static_cast<TType>(PyInt_AsLong(PyTuple_GET_ITEM(spec_tuple, 1)));
  if (INT_CONV_ERROR_OCCURRED(dest->type)) {
    return false;
  }

  dest->attrname = PyTuple_GET_ITEM(spec_tuple, 2);
  dest->typeargs = PyTuple_GET_ITEM(spec_tuple, 3);
  dest->defval = PyTuple_GET_ITEM(spec_tuple, 4);
  return true;
}

bool parse_set_list_args(SetListTypeArgs* dest, PyObject* typeargs) {
  if (PyTuple_Size(typeargs) != 3) {
    PyErr_SetString(PyExc_TypeError, "expecting tuple of size 3 for list/set type args");
    return false;
  }

  dest->element_type = static_cast<TType>(PyInt_AsLong(PyTuple_GET_ITEM(typeargs, 0)));
  if (INT_CONV_ERROR_OCCURRED(dest->element_type)) {
    return false;
  }

  dest->typeargs = PyTuple_GET_ITEM(typeargs, 1);

  dest->immutable = Py_True == PyTuple_GET_ITEM(typeargs, 2);

  return true;
}

bool parse_map_args(MapTypeArgs* dest, PyObject* typeargs) {
  if (PyTuple_Size(typeargs) != 5) {
    PyErr_SetString(PyExc_TypeError, "expecting 5 arguments for typeargs to map");
    return false;
  }

  dest->ktag = static_cast<TType>(PyInt_AsLong(PyTuple_GET_ITEM(typeargs, 0)));
  if (INT_CONV_ERROR_OCCURRED(dest->ktag)) {
    return false;
  }

  dest->vtag = static_cast<TType>(PyInt_AsLong(PyTuple_GET_ITEM(typeargs, 2)));
  if (INT_CONV_ERROR_OCCURRED(dest->vtag)) {
    return false;
  }

  dest->ktypeargs = PyTuple_GET_ITEM(typeargs, 1);
  dest->vtypeargs = PyTuple_GET_ITEM(typeargs, 3);
  dest->immutable = Py_True == PyTuple_GET_ITEM(typeargs, 4);

  return true;
}

bool parse_struct_args(StructTypeArgs* dest, PyObject* typeargs) {
  if (PyTuple_Size(typeargs) != 2) {
    PyErr_SetString(PyExc_TypeError, "expecting tuple of size 2 for struct args");
    return false;
  }

  dest->klass = PyTuple_GET_ITEM(typeargs, 0);
  dest->spec = PyTuple_GET_ITEM(typeargs, 1);

  return true;
}
}
}
}
