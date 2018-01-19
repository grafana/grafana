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

#define LAST_ID(obj) FIX2INT(rb_ary_pop(rb_ivar_get(obj, last_field_id)))
#define SET_LAST_ID(obj, val) rb_ary_push(rb_ivar_get(obj, last_field_id), val)

VALUE rb_thrift_compact_proto_native_qmark(VALUE self) {
  return Qtrue;
}

static ID last_field_id;
static ID boolean_field_id;
static ID bool_value_id;
static ID rbuf_ivar_id;

static int VERSION;
static int VERSION_MASK;
static int TYPE_MASK;
static int TYPE_BITS;
static int TYPE_SHIFT_AMOUNT;
static int PROTOCOL_ID;

static VALUE thrift_compact_protocol_class;

static int CTYPE_BOOLEAN_TRUE   = 0x01;
static int CTYPE_BOOLEAN_FALSE  = 0x02;
static int CTYPE_BYTE           = 0x03;
static int CTYPE_I16            = 0x04;
static int CTYPE_I32            = 0x05;
static int CTYPE_I64            = 0x06;
static int CTYPE_DOUBLE         = 0x07;
static int CTYPE_BINARY         = 0x08;
static int CTYPE_LIST           = 0x09;
static int CTYPE_SET            = 0x0A;
static int CTYPE_MAP            = 0x0B;
static int CTYPE_STRUCT         = 0x0C;

VALUE rb_thrift_compact_proto_write_i16(VALUE self, VALUE i16);

// TODO: implement this
static int get_compact_type(VALUE type_value) {
  int type = FIX2INT(type_value);
  if (type == TTYPE_BOOL) {
    return CTYPE_BOOLEAN_TRUE;
  } else if (type == TTYPE_BYTE) {
    return CTYPE_BYTE;
  } else if (type == TTYPE_I16) {
    return CTYPE_I16;
  } else if (type == TTYPE_I32) {
    return CTYPE_I32;
  } else if (type == TTYPE_I64) {
    return CTYPE_I64;
  } else if (type == TTYPE_DOUBLE) {
    return CTYPE_DOUBLE;
  } else if (type == TTYPE_STRING) {
    return CTYPE_BINARY;
  } else if (type == TTYPE_LIST) {
    return CTYPE_LIST;
  } else if (type == TTYPE_SET) {
    return CTYPE_SET;
  } else if (type == TTYPE_MAP) {
    return CTYPE_MAP;
  } else if (type == TTYPE_STRUCT) {
    return CTYPE_STRUCT;
  } else {
    char str[50];
    sprintf(str, "don't know what type: %d", type);
    rb_raise(rb_eStandardError, "%s", str);
    return 0;
  }
}

static void write_byte_direct(VALUE transport, int8_t b) {
  WRITE(transport, (char*)&b, 1);
}

static void write_field_begin_internal(VALUE self, VALUE type, VALUE id_value, VALUE type_override) {
  int id = FIX2INT(id_value);
  int last_id = LAST_ID(self);
  VALUE transport = GET_TRANSPORT(self);
  
  // if there's a type override, use that.
  int8_t type_to_write = RTEST(type_override) ? FIX2INT(type_override) : get_compact_type(type);
  // check if we can use delta encoding for the field id
  int diff = id - last_id;
  if (diff > 0 && diff <= 15) {
    // write them together
    write_byte_direct(transport, diff << 4 | (type_to_write & 0x0f));
  } else {
    // write them separate
    write_byte_direct(transport, type_to_write & 0x0f);
    rb_thrift_compact_proto_write_i16(self, id_value);
  }

  SET_LAST_ID(self, id_value);
}

static int32_t int_to_zig_zag(int32_t n) {
  return (n << 1) ^ (n >> 31);
}

static uint64_t ll_to_zig_zag(int64_t n) {
  return (n << 1) ^ (n >> 63);
}

static void write_varint32(VALUE transport, uint32_t n) {
  while (true) {
    if ((n & ~0x7F) == 0) {
      write_byte_direct(transport, n & 0x7f);
      break;
    } else {
      write_byte_direct(transport, (n & 0x7F) | 0x80);
      n = n >> 7;
    }
  }
}

static void write_varint64(VALUE transport, uint64_t n) {
  while (true) {
    if ((n & ~0x7F) == 0) {
      write_byte_direct(transport, n & 0x7f);
      break;
    } else {
      write_byte_direct(transport, (n & 0x7F) | 0x80);
      n = n >> 7;
    }
  }
}

static void write_collection_begin(VALUE transport, VALUE elem_type, VALUE size_value) {
  int size = FIX2INT(size_value);
  if (size <= 14) {
    write_byte_direct(transport, size << 4 | get_compact_type(elem_type));
  } else {
    write_byte_direct(transport, 0xf0 | get_compact_type(elem_type));
    write_varint32(transport, size);
  }
}


//--------------------------------
// interface writing methods
//--------------------------------

VALUE rb_thrift_compact_proto_write_i32(VALUE self, VALUE i32);
VALUE rb_thrift_compact_proto_write_string(VALUE self, VALUE str);
VALUE rb_thrift_compact_proto_write_binary(VALUE self, VALUE buf);

VALUE rb_thrift_compact_proto_write_message_end(VALUE self) {
  return Qnil;
}

VALUE rb_thrift_compact_proto_write_struct_begin(VALUE self, VALUE name) {
  rb_ary_push(rb_ivar_get(self, last_field_id), INT2FIX(0));
  return Qnil;
}

VALUE rb_thrift_compact_proto_write_struct_end(VALUE self) {
  rb_ary_pop(rb_ivar_get(self, last_field_id));
  return Qnil;
}

VALUE rb_thrift_compact_proto_write_field_end(VALUE self) {
  return Qnil;
}

VALUE rb_thrift_compact_proto_write_map_end(VALUE self) {
  return Qnil;
}

VALUE rb_thrift_compact_proto_write_list_end(VALUE self) {
  return Qnil;
}

VALUE rb_thrift_compact_proto_write_set_end(VALUE self) {
  return Qnil;
}

VALUE rb_thrift_compact_proto_write_message_begin(VALUE self, VALUE name, VALUE type, VALUE seqid) {
  VALUE transport = GET_TRANSPORT(self);
  write_byte_direct(transport, PROTOCOL_ID);
  write_byte_direct(transport, (VERSION & VERSION_MASK) | ((FIX2INT(type) << TYPE_SHIFT_AMOUNT) & TYPE_MASK));
  write_varint32(transport, FIX2INT(seqid));
  rb_thrift_compact_proto_write_string(self, name);
  
  return Qnil;
}

VALUE rb_thrift_compact_proto_write_field_begin(VALUE self, VALUE name, VALUE type, VALUE id) {
  if (FIX2INT(type) == TTYPE_BOOL) {
    // we want to possibly include the value, so we'll wait.
    rb_ivar_set(self, boolean_field_id, rb_ary_new3(2, type, id));
  } else {
    write_field_begin_internal(self, type, id, Qnil);
  }

  return Qnil;
}

VALUE rb_thrift_compact_proto_write_field_stop(VALUE self) {
  write_byte_direct(GET_TRANSPORT(self), TTYPE_STOP);
  return Qnil;
}

VALUE rb_thrift_compact_proto_write_map_begin(VALUE self, VALUE ktype, VALUE vtype, VALUE size_value) {
  int size = FIX2INT(size_value);
  VALUE transport = GET_TRANSPORT(self);
  if (size == 0) {
    write_byte_direct(transport, 0);
  } else {
    write_varint32(transport, size);
    write_byte_direct(transport, get_compact_type(ktype) << 4 | get_compact_type(vtype));
  }
  return Qnil;
}

VALUE rb_thrift_compact_proto_write_list_begin(VALUE self, VALUE etype, VALUE size) {
  write_collection_begin(GET_TRANSPORT(self), etype, size);
  return Qnil;
}

VALUE rb_thrift_compact_proto_write_set_begin(VALUE self, VALUE etype, VALUE size) {
  write_collection_begin(GET_TRANSPORT(self), etype, size);
  return Qnil;
}

VALUE rb_thrift_compact_proto_write_bool(VALUE self, VALUE b) {
  int8_t type = b == Qtrue ? CTYPE_BOOLEAN_TRUE : CTYPE_BOOLEAN_FALSE;
  VALUE boolean_field = rb_ivar_get(self, boolean_field_id);
  if (NIL_P(boolean_field)) {
    // we're not part of a field, so just write the value.
    write_byte_direct(GET_TRANSPORT(self), type);
  } else {
    // we haven't written the field header yet
    write_field_begin_internal(self, rb_ary_entry(boolean_field, 0), rb_ary_entry(boolean_field, 1), INT2FIX(type));
    rb_ivar_set(self, boolean_field_id, Qnil);
  }
  return Qnil;
}

VALUE rb_thrift_compact_proto_write_byte(VALUE self, VALUE byte) {
  CHECK_NIL(byte);
  write_byte_direct(GET_TRANSPORT(self), FIX2INT(byte));
  return Qnil;
}

VALUE rb_thrift_compact_proto_write_i16(VALUE self, VALUE i16) {
  rb_thrift_compact_proto_write_i32(self, i16);
  return Qnil;
}

VALUE rb_thrift_compact_proto_write_i32(VALUE self, VALUE i32) {
  CHECK_NIL(i32);
  write_varint32(GET_TRANSPORT(self), int_to_zig_zag(NUM2INT(i32)));
  return Qnil;
}

VALUE rb_thrift_compact_proto_write_i64(VALUE self, VALUE i64) {
  CHECK_NIL(i64);
  write_varint64(GET_TRANSPORT(self), ll_to_zig_zag(NUM2LL(i64)));
  return Qnil;
}

VALUE rb_thrift_compact_proto_write_double(VALUE self, VALUE dub) {
  CHECK_NIL(dub);
  // Unfortunately, bitwise_cast doesn't work in C.  Bad C!
  union {
    double f;
    int64_t l;
  } transfer;
  transfer.f = RFLOAT_VALUE(rb_Float(dub));
  char buf[8];
  buf[0] = transfer.l & 0xff;
  buf[1] = (transfer.l >> 8) & 0xff;
  buf[2] = (transfer.l >> 16) & 0xff;
  buf[3] = (transfer.l >> 24) & 0xff;
  buf[4] = (transfer.l >> 32) & 0xff;
  buf[5] = (transfer.l >> 40) & 0xff;
  buf[6] = (transfer.l >> 48) & 0xff;
  buf[7] = (transfer.l >> 56) & 0xff;
  WRITE(GET_TRANSPORT(self), buf, 8);
  return Qnil;
}

VALUE rb_thrift_compact_proto_write_string(VALUE self, VALUE str) {
  str = convert_to_utf8_byte_buffer(str);
  rb_thrift_compact_proto_write_binary(self, str);
  return Qnil;
}

VALUE rb_thrift_compact_proto_write_binary(VALUE self, VALUE buf) {
  buf = force_binary_encoding(buf);
  VALUE transport = GET_TRANSPORT(self);
  write_varint32(transport, RSTRING_LEN(buf));
  WRITE(transport, StringValuePtr(buf), RSTRING_LEN(buf));
  return Qnil;
}

//---------------------------------------
// interface reading methods
//---------------------------------------

#define is_bool_type(ctype) (((ctype) & 0x0F) == CTYPE_BOOLEAN_TRUE || ((ctype) & 0x0F) == CTYPE_BOOLEAN_FALSE)

VALUE rb_thrift_compact_proto_read_string(VALUE self);
VALUE rb_thrift_compact_proto_read_binary(VALUE self);
VALUE rb_thrift_compact_proto_read_byte(VALUE self);
VALUE rb_thrift_compact_proto_read_i32(VALUE self);
VALUE rb_thrift_compact_proto_read_i16(VALUE self);

static int8_t get_ttype(int8_t ctype) {
  if (ctype == TTYPE_STOP) {
    return TTYPE_STOP;
  } else if (ctype == CTYPE_BOOLEAN_TRUE || ctype == CTYPE_BOOLEAN_FALSE) {
    return TTYPE_BOOL;
  } else if (ctype == CTYPE_BYTE) {
    return TTYPE_BYTE;
  } else if (ctype == CTYPE_I16) {
    return TTYPE_I16;
  } else if (ctype == CTYPE_I32) {
    return TTYPE_I32;
  } else if (ctype == CTYPE_I64) {
    return TTYPE_I64;
  } else if (ctype == CTYPE_DOUBLE) {
    return TTYPE_DOUBLE;
  } else if (ctype == CTYPE_BINARY) {
    return TTYPE_STRING;
  } else if (ctype == CTYPE_LIST) {
    return TTYPE_LIST;
  } else if (ctype == CTYPE_SET) {
    return TTYPE_SET;
  } else if (ctype == CTYPE_MAP) {
    return TTYPE_MAP;
  } else if (ctype == CTYPE_STRUCT) {
    return TTYPE_STRUCT;
  } else {
    char str[50];
    sprintf(str, "don't know what type: %d", ctype);
    rb_raise(rb_eStandardError, "%s", str);
    return 0;
  }
}

static char read_byte_direct(VALUE self) {
  VALUE byte = rb_funcall(GET_TRANSPORT(self), read_byte_method_id, 0);
  return (char)(FIX2INT(byte));
}

static int64_t zig_zag_to_ll(int64_t n) {
  return (((uint64_t)n) >> 1) ^ -(n & 1);
}

static int32_t zig_zag_to_int(int32_t n) {
  return (((uint32_t)n) >> 1) ^ -(n & 1);
}

static int64_t read_varint64(VALUE self) {
  int shift = 0;
  int64_t result = 0;
  while (true) {
    int8_t b = read_byte_direct(self);
    result = result | ((uint64_t)(b & 0x7f) << shift);
    if ((b & 0x80) != 0x80) {
      break;
    }
    shift += 7;
  }
  return result;
}

static int16_t read_i16(VALUE self) {
  return zig_zag_to_int((int32_t)read_varint64(self));
}

static VALUE get_protocol_exception(VALUE code, VALUE message) {
  VALUE args[2];
  args[0] = code;
  args[1] = message;
  return rb_class_new_instance(2, (VALUE*)&args, protocol_exception_class);
}

VALUE rb_thrift_compact_proto_read_message_end(VALUE self) {
  return Qnil;
}

VALUE rb_thrift_compact_proto_read_struct_begin(VALUE self) {
  rb_ary_push(rb_ivar_get(self, last_field_id), INT2FIX(0));
  return Qnil;
}

VALUE rb_thrift_compact_proto_read_struct_end(VALUE self) {
  rb_ary_pop(rb_ivar_get(self, last_field_id));
  return Qnil;
}

VALUE rb_thrift_compact_proto_read_field_end(VALUE self) {
  return Qnil;
}

VALUE rb_thrift_compact_proto_read_map_end(VALUE self) {
  return Qnil;
}

VALUE rb_thrift_compact_proto_read_list_end(VALUE self) {
  return Qnil;
}

VALUE rb_thrift_compact_proto_read_set_end(VALUE self) {
  return Qnil;
}

VALUE rb_thrift_compact_proto_read_message_begin(VALUE self) {
  int8_t protocol_id = read_byte_direct(self);
  if (protocol_id != PROTOCOL_ID) {
    char buf[100];
    int len = sprintf(buf, "Expected protocol id %d but got %d", PROTOCOL_ID, protocol_id);
    buf[len] = 0;
    rb_exc_raise(get_protocol_exception(INT2FIX(-1), rb_str_new2(buf)));
  }
  
  int8_t version_and_type = read_byte_direct(self);
  int8_t version = version_and_type & VERSION_MASK;
  if (version != VERSION) {
    char buf[100];
    int len = sprintf(buf, "Expected version id %d but got %d", version, VERSION);
    buf[len] = 0;
    rb_exc_raise(get_protocol_exception(INT2FIX(-1), rb_str_new2(buf)));
  }
  
  int8_t type = (version_and_type >> TYPE_SHIFT_AMOUNT) & TYPE_BITS;
  int32_t seqid = read_varint64(self);
  VALUE messageName = rb_thrift_compact_proto_read_string(self);
  return rb_ary_new3(3, messageName, INT2FIX(type), INT2NUM(seqid));
}

VALUE rb_thrift_compact_proto_read_field_begin(VALUE self) {
  int8_t type = read_byte_direct(self);
  // if it's a stop, then we can return immediately, as the struct is over.
  if ((type & 0x0f) == TTYPE_STOP) {
    return rb_ary_new3(3, Qnil, INT2FIX(0), INT2FIX(0));
  } else {
    int field_id = 0;

    // mask off the 4 MSB of the type header. it could contain a field id delta.
    uint8_t modifier = ((type & 0xf0) >> 4);
    
    if (modifier == 0) {
      // not a delta. look ahead for the zigzag varint field id.
      (void) LAST_ID(self);
      field_id = read_i16(self);
    } else {
      // has a delta. add the delta to the last read field id.
      field_id = LAST_ID(self) + modifier;
    }

    // if this happens to be a boolean field, the value is encoded in the type
    if (is_bool_type(type)) {
      // save the boolean value in a special instance variable.
      rb_ivar_set(self, bool_value_id, (type & 0x0f) == CTYPE_BOOLEAN_TRUE ? Qtrue : Qfalse);
    }

    // push the new field onto the field stack so we can keep the deltas going.
    SET_LAST_ID(self, INT2FIX(field_id));
    return rb_ary_new3(3, Qnil, INT2FIX(get_ttype(type & 0x0f)), INT2FIX(field_id));
  }
}

VALUE rb_thrift_compact_proto_read_map_begin(VALUE self) {
  int32_t size = read_varint64(self);
  uint8_t key_and_value_type = size == 0 ? 0 : read_byte_direct(self);
  return rb_ary_new3(3, INT2FIX(get_ttype(key_and_value_type >> 4)), INT2FIX(get_ttype(key_and_value_type & 0xf)), INT2FIX(size));
}

VALUE rb_thrift_compact_proto_read_list_begin(VALUE self) {
  uint8_t size_and_type = read_byte_direct(self);
  int32_t size = (size_and_type >> 4) & 0x0f;
  if (size == 15) {
    size = read_varint64(self);
  }
  uint8_t type = get_ttype(size_and_type & 0x0f);
  return rb_ary_new3(2, INT2FIX(type), INT2FIX(size));
}

VALUE rb_thrift_compact_proto_read_set_begin(VALUE self) {
  return rb_thrift_compact_proto_read_list_begin(self);
}

VALUE rb_thrift_compact_proto_read_bool(VALUE self) {
  VALUE bool_value = rb_ivar_get(self, bool_value_id);
  if (NIL_P(bool_value)) {
    return read_byte_direct(self) == CTYPE_BOOLEAN_TRUE ? Qtrue : Qfalse;
  } else {
    rb_ivar_set(self, bool_value_id, Qnil);
    return bool_value;
  }
}

VALUE rb_thrift_compact_proto_read_byte(VALUE self) {
  return INT2FIX(read_byte_direct(self));
}

VALUE rb_thrift_compact_proto_read_i16(VALUE self) {
  return INT2FIX(read_i16(self));
}

VALUE rb_thrift_compact_proto_read_i32(VALUE self) {
  return INT2NUM(zig_zag_to_int(read_varint64(self)));
}

VALUE rb_thrift_compact_proto_read_i64(VALUE self) {
  return LL2NUM(zig_zag_to_ll(read_varint64(self)));
}

VALUE rb_thrift_compact_proto_read_double(VALUE self) {
  union {
    double f;
    int64_t l;
  } transfer;
  VALUE rbuf = rb_ivar_get(self, rbuf_ivar_id);
  rb_funcall(GET_TRANSPORT(self), read_into_buffer_method_id, 2, rbuf, INT2FIX(8));
  uint32_t lo = ((uint8_t)(RSTRING_PTR(rbuf)[0]))
    | (((uint8_t)(RSTRING_PTR(rbuf)[1])) << 8)
    | (((uint8_t)(RSTRING_PTR(rbuf)[2])) << 16)
    | (((uint8_t)(RSTRING_PTR(rbuf)[3])) << 24);
  uint64_t hi = (((uint8_t)(RSTRING_PTR(rbuf)[4])))
    | (((uint8_t)(RSTRING_PTR(rbuf)[5])) << 8)
    | (((uint8_t)(RSTRING_PTR(rbuf)[6])) << 16)
    | (((uint8_t)(RSTRING_PTR(rbuf)[7])) << 24);
  transfer.l = (hi << 32) | lo;

  return rb_float_new(transfer.f);
}

VALUE rb_thrift_compact_proto_read_string(VALUE self) {
  VALUE buffer = rb_thrift_compact_proto_read_binary(self);
  return convert_to_string(buffer);
}

VALUE rb_thrift_compact_proto_read_binary(VALUE self) {
  int64_t size = read_varint64(self);
  return READ(self, size);
}

static void Init_constants() {
  thrift_compact_protocol_class = rb_const_get(thrift_module, rb_intern("CompactProtocol"));

  VERSION = rb_num2ll(rb_const_get(thrift_compact_protocol_class, rb_intern("VERSION")));
  VERSION_MASK = rb_num2ll(rb_const_get(thrift_compact_protocol_class, rb_intern("VERSION_MASK")));
  TYPE_MASK = rb_num2ll(rb_const_get(thrift_compact_protocol_class, rb_intern("TYPE_MASK")));
  TYPE_BITS = rb_num2ll(rb_const_get(thrift_compact_protocol_class, rb_intern("TYPE_BITS")));
  TYPE_SHIFT_AMOUNT = FIX2INT(rb_const_get(thrift_compact_protocol_class, rb_intern("TYPE_SHIFT_AMOUNT")));
  PROTOCOL_ID = FIX2INT(rb_const_get(thrift_compact_protocol_class, rb_intern("PROTOCOL_ID")));

  last_field_id = rb_intern("@last_field");
  boolean_field_id = rb_intern("@boolean_field");
  bool_value_id = rb_intern("@bool_value");
  rbuf_ivar_id = rb_intern("@rbuf");
}

static void Init_rb_methods() {
  rb_define_method(thrift_compact_protocol_class, "native?", rb_thrift_compact_proto_native_qmark, 0);

  rb_define_method(thrift_compact_protocol_class, "write_message_begin", rb_thrift_compact_proto_write_message_begin, 3);
  rb_define_method(thrift_compact_protocol_class, "write_field_begin",   rb_thrift_compact_proto_write_field_begin, 3);
  rb_define_method(thrift_compact_protocol_class, "write_field_stop",    rb_thrift_compact_proto_write_field_stop, 0);
  rb_define_method(thrift_compact_protocol_class, "write_map_begin",     rb_thrift_compact_proto_write_map_begin, 3);
  rb_define_method(thrift_compact_protocol_class, "write_list_begin",    rb_thrift_compact_proto_write_list_begin, 2);
  rb_define_method(thrift_compact_protocol_class, "write_set_begin",     rb_thrift_compact_proto_write_set_begin, 2);
  rb_define_method(thrift_compact_protocol_class, "write_byte",          rb_thrift_compact_proto_write_byte, 1);
  rb_define_method(thrift_compact_protocol_class, "write_bool",          rb_thrift_compact_proto_write_bool, 1);
  rb_define_method(thrift_compact_protocol_class, "write_i16",           rb_thrift_compact_proto_write_i16, 1);
  rb_define_method(thrift_compact_protocol_class, "write_i32",           rb_thrift_compact_proto_write_i32, 1);
  rb_define_method(thrift_compact_protocol_class, "write_i64",           rb_thrift_compact_proto_write_i64, 1);
  rb_define_method(thrift_compact_protocol_class, "write_double",        rb_thrift_compact_proto_write_double, 1);
  rb_define_method(thrift_compact_protocol_class, "write_string",        rb_thrift_compact_proto_write_string, 1);
  rb_define_method(thrift_compact_protocol_class, "write_binary",        rb_thrift_compact_proto_write_binary, 1);

  rb_define_method(thrift_compact_protocol_class, "write_message_end", rb_thrift_compact_proto_write_message_end, 0);
  rb_define_method(thrift_compact_protocol_class, "write_struct_begin", rb_thrift_compact_proto_write_struct_begin, 1);
  rb_define_method(thrift_compact_protocol_class, "write_struct_end", rb_thrift_compact_proto_write_struct_end, 0);
  rb_define_method(thrift_compact_protocol_class, "write_field_end", rb_thrift_compact_proto_write_field_end, 0);
  rb_define_method(thrift_compact_protocol_class, "write_map_end", rb_thrift_compact_proto_write_map_end, 0);
  rb_define_method(thrift_compact_protocol_class, "write_list_end", rb_thrift_compact_proto_write_list_end, 0);
  rb_define_method(thrift_compact_protocol_class, "write_set_end", rb_thrift_compact_proto_write_set_end, 0);


  rb_define_method(thrift_compact_protocol_class, "read_message_begin",  rb_thrift_compact_proto_read_message_begin, 0);
  rb_define_method(thrift_compact_protocol_class, "read_field_begin",    rb_thrift_compact_proto_read_field_begin, 0);
  rb_define_method(thrift_compact_protocol_class, "read_map_begin",      rb_thrift_compact_proto_read_map_begin, 0);
  rb_define_method(thrift_compact_protocol_class, "read_list_begin",     rb_thrift_compact_proto_read_list_begin, 0);
  rb_define_method(thrift_compact_protocol_class, "read_set_begin",      rb_thrift_compact_proto_read_set_begin, 0);
  rb_define_method(thrift_compact_protocol_class, "read_byte",           rb_thrift_compact_proto_read_byte, 0);
  rb_define_method(thrift_compact_protocol_class, "read_bool",           rb_thrift_compact_proto_read_bool, 0);
  rb_define_method(thrift_compact_protocol_class, "read_i16",            rb_thrift_compact_proto_read_i16, 0);
  rb_define_method(thrift_compact_protocol_class, "read_i32",            rb_thrift_compact_proto_read_i32, 0);
  rb_define_method(thrift_compact_protocol_class, "read_i64",            rb_thrift_compact_proto_read_i64, 0);
  rb_define_method(thrift_compact_protocol_class, "read_double",         rb_thrift_compact_proto_read_double, 0);
  rb_define_method(thrift_compact_protocol_class, "read_string",         rb_thrift_compact_proto_read_string, 0);
  rb_define_method(thrift_compact_protocol_class, "read_binary",         rb_thrift_compact_proto_read_binary, 0);

  rb_define_method(thrift_compact_protocol_class, "read_message_end", rb_thrift_compact_proto_read_message_end, 0);
  rb_define_method(thrift_compact_protocol_class, "read_struct_begin",  rb_thrift_compact_proto_read_struct_begin, 0);
  rb_define_method(thrift_compact_protocol_class, "read_struct_end",    rb_thrift_compact_proto_read_struct_end, 0);
  rb_define_method(thrift_compact_protocol_class, "read_field_end",     rb_thrift_compact_proto_read_field_end, 0);
  rb_define_method(thrift_compact_protocol_class, "read_map_end",       rb_thrift_compact_proto_read_map_end, 0);
  rb_define_method(thrift_compact_protocol_class, "read_list_end",      rb_thrift_compact_proto_read_list_end, 0);
  rb_define_method(thrift_compact_protocol_class, "read_set_end",       rb_thrift_compact_proto_read_set_end, 0);
}

void Init_compact_protocol() {
  Init_constants();
  Init_rb_methods();
}
