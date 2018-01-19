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

static int l_not(lua_State *L) {
  int a = luaL_checkinteger(L, 1);
  a = ~a;
  lua_pushnumber(L, a);
  return 1;
}

static int l_xor(lua_State *L) {
  int a = luaL_checkinteger(L, 1);
  int b = luaL_checkinteger(L, 2);
  a ^= b;
  lua_pushnumber(L, a);
  return 1;
}

static int l_and(lua_State *L) {
  int a = luaL_checkinteger(L, 1);
  int b = luaL_checkinteger(L, 2);
  a &= b;
  lua_pushnumber(L, a);
  return 1;
}

static int l_or(lua_State *L) {
  int a = luaL_checkinteger(L, 1);
  int b = luaL_checkinteger(L, 2);
  a |= b;
  lua_pushnumber(L, a);
  return 1;
}

static int l_shiftr(lua_State *L) {
  int a = luaL_checkinteger(L, 1);
  int b = luaL_checkinteger(L, 2);
  a = a >> b;
  lua_pushnumber(L, a);
  return 1;
}

static int l_shiftl(lua_State *L) {
  int a = luaL_checkinteger(L, 1);
  int b = luaL_checkinteger(L, 2);
  a = a << b;
  lua_pushnumber(L, a);
  return 1;
}

static const struct luaL_Reg funcs[] = {
  {"band", l_and},
  {"bor", l_or},
  {"bxor", l_xor},
  {"bnot", l_not},
  {"shiftl", l_shiftl},
  {"shiftr", l_shiftr},
  {NULL, NULL}
};

int luaopen_libluabitwise(lua_State *L) {
  luaL_register(L, "libluabitwise", funcs);
  return 1;
}
