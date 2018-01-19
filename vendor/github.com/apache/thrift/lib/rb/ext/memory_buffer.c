/**
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

#include <ruby.h>
#include <constants.h>
#include <bytes.h>
#include <macros.h>

ID buf_ivar_id;
ID index_ivar_id;

ID slice_method_id;

int GARBAGE_BUFFER_SIZE;

#define GET_BUF(self) rb_ivar_get(self, buf_ivar_id)

VALUE rb_thrift_memory_buffer_write(VALUE self, VALUE str);
VALUE rb_thrift_memory_buffer_read(VALUE self, VALUE length_value);
VALUE rb_thrift_memory_buffer_read_byte(VALUE self);
VALUE rb_thrift_memory_buffer_read_into_buffer(VALUE self, VALUE buffer_value, VALUE size_value);

VALUE rb_thrift_memory_buffer_write(VALUE self, VALUE str) {
  VALUE buf = GET_BUF(self);
  str = force_binary_encoding(str);
  rb_str_buf_cat(buf, StringValuePtr(str), RSTRING_LEN(str));
  return Qnil;
}

VALUE rb_thrift_memory_buffer_read(VALUE self, VALUE length_value) {
  int length = FIX2INT(length_value);
  
  VALUE index_value = rb_ivar_get(self, index_ivar_id);
  int index = FIX2INT(index_value);
  
  VALUE buf = GET_BUF(self);
  VALUE data = rb_funcall(buf, slice_method_id, 2, index_value, length_value);
  
  index += length;
  if (index > RSTRING_LEN(buf)) {
    index = RSTRING_LEN(buf);
  }
  if (index >= GARBAGE_BUFFER_SIZE) {
    rb_ivar_set(self, buf_ivar_id, rb_funcall(buf, slice_method_id, 2, INT2FIX(index), INT2FIX(RSTRING_LEN(buf) - 1)));
    index = 0;
  }
  rb_ivar_set(self, index_ivar_id, INT2FIX(index));

  if (RSTRING_LEN(data) < length) {
    rb_raise(rb_eEOFError, "Not enough bytes remain in memory buffer");
  }

  return data;
}

VALUE rb_thrift_memory_buffer_read_byte(VALUE self) {
  VALUE index_value = rb_ivar_get(self, index_ivar_id);
  int index = FIX2INT(index_value);

  VALUE buf = GET_BUF(self);
  if (index >= RSTRING_LEN(buf)) {
    rb_raise(rb_eEOFError, "Not enough bytes remain in memory buffer");
  }
  char byte = RSTRING_PTR(buf)[index++];

  if (index >= GARBAGE_BUFFER_SIZE) {
    rb_ivar_set(self, buf_ivar_id, rb_funcall(buf, slice_method_id, 2, INT2FIX(index), INT2FIX(RSTRING_LEN(buf) - 1)));
    index = 0;
  }
  rb_ivar_set(self, index_ivar_id, INT2FIX(index));

  int result = (int) byte;
  return INT2FIX(result);
}

VALUE rb_thrift_memory_buffer_read_into_buffer(VALUE self, VALUE buffer_value, VALUE size_value) {
  int i = 0;
  int size = FIX2INT(size_value);
  int index;
  VALUE buf = GET_BUF(self);

  index = FIX2INT(rb_ivar_get(self, index_ivar_id));
  while (i < size) {
    if (index >= RSTRING_LEN(buf)) {
      rb_raise(rb_eEOFError, "Not enough bytes remain in memory buffer");
    }
    char byte = RSTRING_PTR(buf)[index++];

    if (i >= RSTRING_LEN(buffer_value)) {
      rb_raise(rb_eIndexError, "index %d out of string", i);
    }
    ((char*)RSTRING_PTR(buffer_value))[i] = byte;
    i++;
  }

  if (index >= GARBAGE_BUFFER_SIZE) {
    rb_ivar_set(self, buf_ivar_id, rb_funcall(buf, slice_method_id, 2, INT2FIX(index), INT2FIX(RSTRING_LEN(buf) - 1)));
    index = 0;
  }
  rb_ivar_set(self, index_ivar_id, INT2FIX(index));

  return INT2FIX(i);
}

void Init_memory_buffer() {
  VALUE thrift_memory_buffer_class = rb_const_get(thrift_module, rb_intern("MemoryBufferTransport"));
  rb_define_method(thrift_memory_buffer_class, "write", rb_thrift_memory_buffer_write, 1);
  rb_define_method(thrift_memory_buffer_class, "read", rb_thrift_memory_buffer_read, 1);
  rb_define_method(thrift_memory_buffer_class, "read_byte", rb_thrift_memory_buffer_read_byte, 0);
  rb_define_method(thrift_memory_buffer_class, "read_into_buffer", rb_thrift_memory_buffer_read_into_buffer, 2);
  
  buf_ivar_id = rb_intern("@buf");
  index_ivar_id = rb_intern("@index");
  
  slice_method_id = rb_intern("slice");
  
  GARBAGE_BUFFER_SIZE = FIX2INT(rb_const_get(thrift_memory_buffer_class, rb_intern("GARBAGE_BUFFER_SIZE")));
}
