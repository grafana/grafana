//
// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements. See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership. The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License. You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.
//

#include <lua.h>
#include <lauxlib.h>
#include <string.h>
#include <inttypes.h>
#include <netinet/in.h>

extern int64_t lualongnumber_checklong(lua_State *L, int index);
extern int64_t lualongnumber_pushlong(lua_State *L, int64_t *val);

// host order to network order (64-bit)
static int64_t T_htonll(uint64_t data) {
  uint32_t d1 = htonl((uint32_t)data);
  uint32_t d2 = htonl((uint32_t)(data >> 32));
  return ((uint64_t)d1 << 32) + (uint64_t)d2;
}

// network order to host order (64-bit)
static int64_t T_ntohll(uint64_t data) {
  uint32_t d1 = ntohl((uint32_t)data);
  uint32_t d2 = ntohl((uint32_t)(data >> 32));
  return ((uint64_t)d1 << 32) + (uint64_t)d2;
}

/**
 * bpack(type, data)
 *  c - Signed Byte
 *  s - Signed Short
 *  i - Signed Int
 *  l - Signed Long
 *  d - Double
 */
static int l_bpack(lua_State *L) {
  const char *code = luaL_checkstring(L, 1);
  luaL_argcheck(L, code[1] == '\0', 0, "Format code must be one character.");
  luaL_Buffer buf;
  luaL_buffinit(L, &buf);

  switch (code[0]) {
    case 'c': {
      int8_t data = luaL_checknumber(L, 2);
      luaL_addlstring(&buf, (void*)&data, sizeof(data));
      break;
    }
    case 's': {
      int16_t data = luaL_checknumber(L, 2);
      data = (int16_t)htons(data);
      luaL_addlstring(&buf, (void*)&data, sizeof(data));
      break;
    }
    case 'i': {
      int32_t data = luaL_checkinteger(L, 2);
      data = (int32_t)htonl(data);
      luaL_addlstring(&buf, (void*)&data, sizeof(data));
      break;
    }
    case 'l': {
      int64_t data = lualongnumber_checklong(L, 2);
      data = (int64_t)T_htonll(data);
      luaL_addlstring(&buf, (void*)&data, sizeof(data));
      break;
    }
    case 'd': {
      double data = luaL_checknumber(L, 2);
      luaL_addlstring(&buf, (void*)&data, sizeof(data));
      break;
    }
    default:
      luaL_argcheck(L, 0, 0, "Invalid format code.");
  }

  luaL_pushresult(&buf);
  return 1;
}

/**
 * bunpack(type, data)
 *  c - Signed Byte
 *  C - Unsigned Byte
 *  s - Signed Short
 *  i - Signed Int
 *  l - Signed Long
 *  d - Double
 */
static int l_bunpack(lua_State *L) {
  const char *code = luaL_checkstring(L, 1);
  luaL_argcheck(L, code[1] == '\0', 0, "Format code must be one character.");
  const char *data = luaL_checkstring(L, 2);
#ifdef _LUA51_
  size_t len = lua_objlen(L, 2);
#else
  size_t len = lua_rawlen(L, 2);
#endif

  switch (code[0]) {
    case 'c': {
      int8_t val;
      luaL_argcheck(L, len == sizeof(val), 1, "Invalid input string size.");
      memcpy(&val, data, sizeof(val));
      lua_pushnumber(L, val);
      break;
    }
    /**
     * unpack unsigned Byte.
     */
    case 'C': {
      uint8_t val;
      luaL_argcheck(L, len == sizeof(val), 1, "Invalid input string size.");
      memcpy(&val, data, sizeof(val));
      lua_pushnumber(L, val);
      break;
    }
    case 's': {
      int16_t val;
      luaL_argcheck(L, len == sizeof(val), 1, "Invalid input string size.");
      memcpy(&val, data, sizeof(val));
      val = (int16_t)ntohs(val);
      lua_pushnumber(L, val);
      break;
    }
    case 'i': {
      int32_t val;
      luaL_argcheck(L, len == sizeof(val), 1, "Invalid input string size.");
      memcpy(&val, data, sizeof(val));
      val = (int32_t)ntohl(val);
      lua_pushnumber(L, val);
      break;
    }
    case 'l': {
      int64_t val;
      luaL_argcheck(L, len == sizeof(val), 1, "Invalid input string size.");
      memcpy(&val, data, sizeof(val));
      val = (int64_t)T_ntohll(val);
      lualongnumber_pushlong(L, &val);
      break;
    }
    case 'd': {
      double val;
      luaL_argcheck(L, len == sizeof(val), 1, "Invalid input string size.");
      memcpy(&val, data, sizeof(val));
      lua_pushnumber(L, val);
      break;
    }
    default:
      luaL_argcheck(L, 0, 0, "Invalid format code.");
  }
  return 1;
}

/**
 * Convert l into a zigzag long. This allows negative numbers to be
 * represented compactly as a varint.
 */
static int l_i64ToZigzag(lua_State *L) {
  int64_t n = lualongnumber_checklong(L, 1);
  int64_t result = (n << 1) ^ (n >> 63);
  lualongnumber_pushlong(L, &result);
  return 1;
}
/**
 * Convert n into a zigzag int. This allows negative numbers to be
 * represented compactly as a varint.
 */
static int l_i32ToZigzag(lua_State *L) {
  int32_t n = luaL_checkinteger(L, 1);
  uint32_t result = (uint32_t)(n << 1) ^ (n >> 31);
  lua_pushnumber(L, result);
  return 1;
}

/**
 * Convert from zigzag int to int.
 */
static int l_zigzagToI32(lua_State *L) {
  uint32_t n = luaL_checkinteger(L, 1);
  int32_t result = (int32_t)(n >> 1) ^ (uint32_t)(-(int32_t)(n & 1));
  lua_pushnumber(L, result);
  return 1;
}

/**
 * Convert from zigzag long to long.
 */
static int l_zigzagToI64(lua_State *L) {
  int64_t n = lualongnumber_checklong(L, 1);
  int64_t result = (int64_t)(n >> 1) ^ (uint64_t)(-(int64_t)(n & 1));
  lualongnumber_pushlong(L, &result);
  return 1;
}

/**
 * Convert an i32 to a varint. Results in 1-5 bytes on the buffer.
 */
static int l_toVarint32(lua_State *L) {
  uint8_t buf[5];
  uint32_t n = luaL_checkinteger(L, 1);
  uint32_t wsize = 0;

  while (1) {
    if ((n & ~0x7F) == 0) {
      buf[wsize++] = (int8_t)n;
      break;
    } else {
      buf[wsize++] = (int8_t)((n & 0x7F) | 0x80);
      n >>= 7;
    }
  }
  lua_pushlstring(L, buf, wsize);
  return 1;
}

/**
 * Convert an i64 to a varint. Results in 1-10 bytes on the buffer.
 */
static int l_toVarint64(lua_State *L) {
  uint8_t data[10];
  uint64_t n = lualongnumber_checklong(L, 1);
  uint32_t wsize = 0;
  luaL_Buffer buf;
  luaL_buffinit(L, &buf);

  while (1) {
    if ((n & ~0x7FL) == 0) {
      data[wsize++] = (int8_t)n;
      break;
    } else {
      data[wsize++] = (int8_t)((n & 0x7F) | 0x80);
      n >>= 7;
    }
  }

  luaL_addlstring(&buf, (void*)&data, wsize);
  luaL_pushresult(&buf);
  return 1;
}

/**
 * Convert a varint to i64.
 */
static int l_fromVarint64(lua_State *L) {
  int64_t result;
  uint8_t byte = luaL_checknumber(L, 1);
  int32_t shift = luaL_checknumber(L, 2);
  uint64_t n = (uint64_t)lualongnumber_checklong(L, 3);
  n |= (uint64_t)(byte & 0x7f) << shift;

  if (!(byte & 0x80)) {
    result = (int64_t)(n >> 1) ^ (uint64_t)(-(int64_t)(n & 1));
    lua_pushnumber(L, 0);
  } else {
    result = n;
    lua_pushnumber(L, 1);
  }
  lualongnumber_pushlong(L, &result);
  return 2;
}

/**
 * To pack message type of compact protocol.
 */
static int l_packMesgType(lua_State *L) {
  int32_t version_n = luaL_checkinteger(L, 1);
  int32_t version_mask = luaL_checkinteger(L, 2);
  int32_t messagetype = luaL_checkinteger(L, 3);
  int32_t type_shift_amount = luaL_checkinteger(L, 4);
  int32_t type_mask = luaL_checkinteger(L, 5);
  int32_t to_mesg_type = (version_n & version_mask) |
    (((int32_t)messagetype << type_shift_amount) & type_mask);
  lua_pushnumber(L, to_mesg_type);
  return 1;
}

static const struct luaL_Reg lua_bpack[] = {
  {"bpack", l_bpack},
  {"bunpack", l_bunpack},
  {"i32ToZigzag", l_i32ToZigzag},
  {"i64ToZigzag", l_i64ToZigzag},
  {"zigzagToI32", l_zigzagToI32},
  {"zigzagToI64", l_zigzagToI64},
  {"toVarint32", l_toVarint32},
  {"toVarint64", l_toVarint64},
  {"fromVarint64", l_fromVarint64},
  {"packMesgType", l_packMesgType},
  {NULL, NULL}
};

int luaopen_libluabpack(lua_State *L) {
  luaL_register(L, "libluabpack", lua_bpack);
  return 1;
}
