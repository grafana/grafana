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
#include <stdbool.h>
#include <stdint.h>
#include <constants.h>
#include <struct.h>
#include <macros.h>
#include <bytes.h>

VALUE rb_thrift_binary_proto_native_qmark(VALUE self) {
  return Qtrue;
}



static int VERSION_1;
static int VERSION_MASK;
static int TYPE_MASK;
static int BAD_VERSION;
static ID rbuf_ivar_id;

static void write_byte_direct(VALUE trans, int8_t b) {
  WRITE(trans, (char*)&b, 1);
}

static void write_i16_direct(VALUE trans, int16_t value) {
  char data[2];
  
  data[1] = value;
  data[0] = (value >> 8);

  WRITE(trans, data, 2);
}

static void write_i32_direct(VALUE trans, int32_t value) {
  char data[4];

  data[3] = value;
  data[2] = (value >> 8);
  data[1] = (value >> 16);
  data[0] = (value >> 24);

  WRITE(trans, data, 4);
}


static void write_i64_direct(VALUE trans, int64_t value) {
  char data[8];

  data[7] = value;
  data[6] = (value >> 8);
  data[5] = (value >> 16);
  data[4] = (value >> 24);
  data[3] = (value >> 32);
  data[2] = (value >> 40);
  data[1] = (value >> 48);
  data[0] = (value >> 56);

  WRITE(trans, data, 8);
}

static void write_string_direct(VALUE trans, VALUE str) {
  if (TYPE(str) != T_STRING) {
    rb_raise(rb_eStandardError, "Value should be a string");
  }
  str = convert_to_utf8_byte_buffer(str);
  write_i32_direct(trans, RSTRING_LEN(str));
  rb_funcall(trans, write_method_id, 1, str);
}

//--------------------------------
// interface writing methods
//--------------------------------

VALUE rb_thrift_binary_proto_write_message_end(VALUE self) {
  return Qnil;
}

VALUE rb_thrift_binary_proto_write_struct_begin(VALUE self, VALUE name) {
  return Qnil;
}

VALUE rb_thrift_binary_proto_write_struct_end(VALUE self) {
  return Qnil;
}

VALUE rb_thrift_binary_proto_write_field_end(VALUE self) {
  return Qnil;
}

VALUE rb_thrift_binary_proto_write_map_end(VALUE self) {
  return Qnil;
}

VALUE rb_thrift_binary_proto_write_list_end(VALUE self) {
  return Qnil;
}

VALUE rb_thrift_binary_proto_write_set_end(VALUE self) {
  return Qnil;
}

VALUE rb_thrift_binary_proto_write_message_begin(VALUE self, VALUE name, VALUE type, VALUE seqid) {
  VALUE trans = GET_TRANSPORT(self);
  VALUE strict_write = GET_STRICT_WRITE(self);

  if (strict_write == Qtrue) {
    write_i32_direct(trans, VERSION_1 | FIX2INT(type));
    write_string_direct(trans, name);
    write_i32_direct(trans, FIX2INT(seqid));
  } else {
    write_string_direct(trans, name);
    write_byte_direct(trans, FIX2INT(type));
    write_i32_direct(trans, FIX2INT(seqid));
  }
  
  return Qnil;
}

VALUE rb_thrift_binary_proto_write_field_begin(VALUE self, VALUE name, VALUE type, VALUE id) {
  VALUE trans = GET_TRANSPORT(self);
  write_byte_direct(trans, FIX2INT(type));
  write_i16_direct(trans, FIX2INT(id));
  
  return Qnil;
}

VALUE rb_thrift_binary_proto_write_field_stop(VALUE self) {
  write_byte_direct(GET_TRANSPORT(self), TTYPE_STOP);
  return Qnil;
}

VALUE rb_thrift_binary_proto_write_map_begin(VALUE self, VALUE ktype, VALUE vtype, VALUE size) {
  VALUE trans = GET_TRANSPORT(self);
  write_byte_direct(trans, FIX2INT(ktype));
  write_byte_direct(trans, FIX2INT(vtype));
  write_i32_direct(trans, FIX2INT(size));
  
  return Qnil;
}

VALUE rb_thrift_binary_proto_write_list_begin(VALUE self, VALUE etype, VALUE size) {
  VALUE trans = GET_TRANSPORT(self);
  write_byte_direct(trans, FIX2INT(etype));
  write_i32_direct(trans, FIX2INT(size));
  
  return Qnil;
}

VALUE rb_thrift_binary_proto_write_set_begin(VALUE self, VALUE etype, VALUE size) {
  rb_thrift_binary_proto_write_list_begin(self, etype, size);
  return Qnil;
}

VALUE rb_thrift_binary_proto_write_bool(VALUE self, VALUE b) {
  write_byte_direct(GET_TRANSPORT(self), RTEST(b) ? 1 : 0);
  return Qnil;
}

VALUE rb_thrift_binary_proto_write_byte(VALUE self, VALUE byte) {
  CHECK_NIL(byte);
  write_byte_direct(GET_TRANSPORT(self), NUM2INT(byte));
  return Qnil;
}

VALUE rb_thrift_binary_proto_write_i16(VALUE self, VALUE i16) {
  CHECK_NIL(i16);
  write_i16_direct(GET_TRANSPORT(self), FIX2INT(i16));
  return Qnil;
}

VALUE rb_thrift_binary_proto_write_i32(VALUE self, VALUE i32) {
  CHECK_NIL(i32);
  write_i32_direct(GET_TRANSPORT(self), NUM2INT(i32));
  return Qnil;
}

VALUE rb_thrift_binary_proto_write_i64(VALUE self, VALUE i64) {
  CHECK_NIL(i64);
  write_i64_direct(GET_TRANSPORT(self), NUM2LL(i64));
  return Qnil;
}

VALUE rb_thrift_binary_proto_write_double(VALUE self, VALUE dub) {
  CHECK_NIL(dub);
  // Unfortunately, bitwise_cast doesn't work in C.  Bad C!
  union {
    double f;
    int64_t t;
  } transfer;
  transfer.f = RFLOAT_VALUE(rb_Float(dub));
  write_i64_direct(GET_TRANSPORT(self), transfer.t);

  return Qnil;
}

VALUE rb_thrift_binary_proto_write_string(VALUE self, VALUE str) {
  CHECK_NIL(str);
  VALUE trans = GET_TRANSPORT(self);
  write_string_direct(trans, str);
  return Qnil;
}

VALUE rb_thrift_binary_proto_write_binary(VALUE self, VALUE buf) {
  CHECK_NIL(buf);
  VALUE trans = GET_TRANSPORT(self);
  buf = force_binary_encoding(buf);
  write_i32_direct(trans, RSTRING_LEN(buf));
  rb_funcall(trans, write_method_id, 1, buf);
  return Qnil;
}

//---------------------------------------
// interface reading methods
//---------------------------------------

VALUE rb_thrift_binary_proto_read_string(VALUE self);
VALUE rb_thrift_binary_proto_read_binary(VALUE self);
VALUE rb_thrift_binary_proto_read_byte(VALUE self);
VALUE rb_thrift_binary_proto_read_i32(VALUE self);
VALUE rb_thrift_binary_proto_read_i16(VALUE self);

static char read_byte_direct(VALUE self) {
  VALUE byte = rb_funcall(GET_TRANSPORT(self), read_byte_method_id, 0);
  return (char)(FIX2INT(byte));
}

static int16_t read_i16_direct(VALUE self) {
  VALUE rbuf = rb_ivar_get(self, rbuf_ivar_id);
  rb_funcall(GET_TRANSPORT(self), read_into_buffer_method_id, 2, rbuf, INT2FIX(2));
  return (int16_t)(((uint8_t)(RSTRING_PTR(rbuf)[1])) | ((uint16_t)((RSTRING_PTR(rbuf)[0]) << 8)));
}

static int32_t read_i32_direct(VALUE self) {
  VALUE rbuf = rb_ivar_get(self, rbuf_ivar_id);
  rb_funcall(GET_TRANSPORT(self), read_into_buffer_method_id, 2, rbuf, INT2FIX(4));
  return ((uint8_t)(RSTRING_PTR(rbuf)[3])) |
    (((uint8_t)(RSTRING_PTR(rbuf)[2])) << 8) |
    (((uint8_t)(RSTRING_PTR(rbuf)[1])) << 16) |
    (((uint8_t)(RSTRING_PTR(rbuf)[0])) << 24);
}

static int64_t read_i64_direct(VALUE self) {
  VALUE rbuf = rb_ivar_get(self, rbuf_ivar_id);
  rb_funcall(GET_TRANSPORT(self), read_into_buffer_method_id, 2, rbuf, INT2FIX(8));
  uint64_t hi = ((uint8_t)(RSTRING_PTR(rbuf)[3])) |
    (((uint8_t)(RSTRING_PTR(rbuf)[2])) << 8) |
    (((uint8_t)(RSTRING_PTR(rbuf)[1])) << 16) |
    (((uint8_t)(RSTRING_PTR(rbuf)[0])) << 24);
  uint32_t lo = ((uint8_t)(RSTRING_PTR(rbuf)[7])) |
    (((uint8_t)(RSTRING_PTR(rbuf)[6])) << 8) |
    (((uint8_t)(RSTRING_PTR(rbuf)[5])) << 16) |
    (((uint8_t)(RSTRING_PTR(rbuf)[4])) << 24);
  return (hi << 32) | lo;
}

static VALUE get_protocol_exception(VALUE code, VALUE message) {
  VALUE args[2];
  args[0] = code;
  args[1] = message;
  return rb_class_new_instance(2, (VALUE*)&args, protocol_exception_class);
}

VALUE rb_thrift_binary_proto_read_message_end(VALUE self) {
  return Qnil;
}

VALUE rb_thrift_binary_proto_read_struct_begin(VALUE self) {
  return Qnil;
}

VALUE rb_thrift_binary_proto_read_struct_end(VALUE self) {
  return Qnil;
}

VALUE rb_thrift_binary_proto_read_field_end(VALUE self) {
  return Qnil;
}

VALUE rb_thrift_binary_proto_read_map_end(VALUE self) {
  return Qnil;
}

VALUE rb_thrift_binary_proto_read_list_end(VALUE self) {
  return Qnil;
}

VALUE rb_thrift_binary_proto_read_set_end(VALUE self) {
  return Qnil;
}

VALUE rb_thrift_binary_proto_read_message_begin(VALUE self) {
  VALUE strict_read = GET_STRICT_READ(self);
  VALUE name, seqid;
  int type;
  
  int version = read_i32_direct(self);
  
  if (version < 0) {
    if ((version & VERSION_MASK) != VERSION_1) {
      rb_exc_raise(get_protocol_exception(INT2FIX(BAD_VERSION), rb_str_new2("Missing version identifier")));
    }
    type = version & TYPE_MASK;
    name = rb_thrift_binary_proto_read_string(self);
    seqid = rb_thrift_binary_proto_read_i32(self);
  } else {
    if (strict_read == Qtrue) {
      rb_exc_raise(get_protocol_exception(INT2FIX(BAD_VERSION), rb_str_new2("No version identifier, old protocol client?")));
    }
    name = READ(self, version);
    type = read_byte_direct(self);
    seqid = rb_thrift_binary_proto_read_i32(self);
  }
  
  return rb_ary_new3(3, name, INT2FIX(type), seqid);
}

VALUE rb_thrift_binary_proto_read_field_begin(VALUE self) {
  int type = read_byte_direct(self);
  if (type == TTYPE_STOP) {
    return rb_ary_new3(3, Qnil, INT2FIX(type), INT2FIX(0));
  } else {
    VALUE id = rb_thrift_binary_proto_read_i16(self);
    return rb_ary_new3(3, Qnil, INT2FIX(type), id);
  }
}

VALUE rb_thrift_binary_proto_read_map_begin(VALUE self) {
  VALUE ktype = rb_thrift_binary_proto_read_byte(self);
  VALUE vtype = rb_thrift_binary_proto_read_byte(self);
  VALUE size = rb_thrift_binary_proto_read_i32(self);
  return rb_ary_new3(3, ktype, vtype, size);
}

VALUE rb_thrift_binary_proto_read_list_begin(VALUE self) {
  VALUE etype = rb_thrift_binary_proto_read_byte(self);
  VALUE size = rb_thrift_binary_proto_read_i32(self);
  return rb_ary_new3(2, etype, size);
}

VALUE rb_thrift_binary_proto_read_set_begin(VALUE self) {
  return rb_thrift_binary_proto_read_list_begin(self);
}

VALUE rb_thrift_binary_proto_read_bool(VALUE self) {
  char byte = read_byte_direct(self);
  return byte != 0 ? Qtrue : Qfalse;
}

VALUE rb_thrift_binary_proto_read_byte(VALUE self) {
  return INT2FIX(read_byte_direct(self));
}

VALUE rb_thrift_binary_proto_read_i16(VALUE self) {
  return INT2FIX(read_i16_direct(self));
}

VALUE rb_thrift_binary_proto_read_i32(VALUE self) {
  return INT2NUM(read_i32_direct(self));
}

VALUE rb_thrift_binary_proto_read_i64(VALUE self) {
  return LL2NUM(read_i64_direct(self));
}

VALUE rb_thrift_binary_proto_read_double(VALUE self) {
  union {
    double f;
    int64_t t;
  } transfer;
  transfer.t = read_i64_direct(self);
  return rb_float_new(transfer.f);
}

VALUE rb_thrift_binary_proto_read_string(VALUE self) {
  VALUE buffer = rb_thrift_binary_proto_read_binary(self);
  return convert_to_string(buffer);
}

VALUE rb_thrift_binary_proto_read_binary(VALUE self) {
  int size = read_i32_direct(self);
  return READ(self, size);
}

void Init_binary_protocol_accelerated() {
  VALUE thrift_binary_protocol_class = rb_const_get(thrift_module, rb_intern("BinaryProtocol"));

  VERSION_1 = rb_num2ll(rb_const_get(thrift_binary_protocol_class, rb_intern("VERSION_1")));
  VERSION_MASK = rb_num2ll(rb_const_get(thrift_binary_protocol_class, rb_intern("VERSION_MASK")));
  TYPE_MASK = rb_num2ll(rb_const_get(thrift_binary_protocol_class, rb_intern("TYPE_MASK")));

  VALUE bpa_class = rb_define_class_under(thrift_module, "BinaryProtocolAccelerated", thrift_binary_protocol_class);

  rb_define_method(bpa_class, "native?", rb_thrift_binary_proto_native_qmark, 0);

  rb_define_method(bpa_class, "write_message_begin", rb_thrift_binary_proto_write_message_begin, 3);
  rb_define_method(bpa_class, "write_field_begin",   rb_thrift_binary_proto_write_field_begin, 3);
  rb_define_method(bpa_class, "write_field_stop",    rb_thrift_binary_proto_write_field_stop, 0);
  rb_define_method(bpa_class, "write_map_begin",     rb_thrift_binary_proto_write_map_begin, 3);
  rb_define_method(bpa_class, "write_list_begin",    rb_thrift_binary_proto_write_list_begin, 2);
  rb_define_method(bpa_class, "write_set_begin",     rb_thrift_binary_proto_write_set_begin, 2);
  rb_define_method(bpa_class, "write_byte",          rb_thrift_binary_proto_write_byte, 1);
  rb_define_method(bpa_class, "write_bool",          rb_thrift_binary_proto_write_bool, 1);
  rb_define_method(bpa_class, "write_i16",           rb_thrift_binary_proto_write_i16, 1);
  rb_define_method(bpa_class, "write_i32",           rb_thrift_binary_proto_write_i32, 1);
  rb_define_method(bpa_class, "write_i64",           rb_thrift_binary_proto_write_i64, 1);
  rb_define_method(bpa_class, "write_double",        rb_thrift_binary_proto_write_double, 1);
  rb_define_method(bpa_class, "write_string",        rb_thrift_binary_proto_write_string, 1);
  rb_define_method(bpa_class, "write_binary",        rb_thrift_binary_proto_write_binary, 1);
  // unused methods
  rb_define_method(bpa_class, "write_message_end", rb_thrift_binary_proto_write_message_end, 0);
  rb_define_method(bpa_class, "write_struct_begin", rb_thrift_binary_proto_write_struct_begin, 1);
  rb_define_method(bpa_class, "write_struct_end", rb_thrift_binary_proto_write_struct_end, 0);
  rb_define_method(bpa_class, "write_field_end", rb_thrift_binary_proto_write_field_end, 0);
  rb_define_method(bpa_class, "write_map_end", rb_thrift_binary_proto_write_map_end, 0);
  rb_define_method(bpa_class, "write_list_end", rb_thrift_binary_proto_write_list_end, 0);
  rb_define_method(bpa_class, "write_set_end", rb_thrift_binary_proto_write_set_end, 0);

  rb_define_method(bpa_class, "read_message_begin",  rb_thrift_binary_proto_read_message_begin, 0);
  rb_define_method(bpa_class, "read_field_begin",    rb_thrift_binary_proto_read_field_begin, 0);
  rb_define_method(bpa_class, "read_map_begin",      rb_thrift_binary_proto_read_map_begin, 0);
  rb_define_method(bpa_class, "read_list_begin",     rb_thrift_binary_proto_read_list_begin, 0);
  rb_define_method(bpa_class, "read_set_begin",      rb_thrift_binary_proto_read_set_begin, 0);
  rb_define_method(bpa_class, "read_byte",           rb_thrift_binary_proto_read_byte, 0);
  rb_define_method(bpa_class, "read_bool",           rb_thrift_binary_proto_read_bool, 0);
  rb_define_method(bpa_class, "read_i16",            rb_thrift_binary_proto_read_i16, 0);
  rb_define_method(bpa_class, "read_i32",            rb_thrift_binary_proto_read_i32, 0);
  rb_define_method(bpa_class, "read_i64",            rb_thrift_binary_proto_read_i64, 0);
  rb_define_method(bpa_class, "read_double",         rb_thrift_binary_proto_read_double, 0);
  rb_define_method(bpa_class, "read_string",         rb_thrift_binary_proto_read_string, 0);
  rb_define_method(bpa_class, "read_binary",         rb_thrift_binary_proto_read_binary, 0);
  // unused methods
  rb_define_method(bpa_class, "read_message_end", rb_thrift_binary_proto_read_message_end, 0);
  rb_define_method(bpa_class, "read_struct_begin", rb_thrift_binary_proto_read_struct_begin, 0);
  rb_define_method(bpa_class, "read_struct_end", rb_thrift_binary_proto_read_struct_end, 0);
  rb_define_method(bpa_class, "read_field_end", rb_thrift_binary_proto_read_field_end, 0);
  rb_define_method(bpa_class, "read_map_end", rb_thrift_binary_proto_read_map_end, 0);
  rb_define_method(bpa_class, "read_list_end", rb_thrift_binary_proto_read_list_end, 0);
  rb_define_method(bpa_class, "read_set_end", rb_thrift_binary_proto_read_set_end, 0);

  rbuf_ivar_id = rb_intern("@rbuf");
}
