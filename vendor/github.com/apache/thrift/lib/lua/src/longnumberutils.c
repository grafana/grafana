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
#include <stdlib.h>
#include <inttypes.h>

const char * LONG_NUM_TYPE = "__thrift_longnumber";
int64_t lualongnumber_checklong(lua_State *L, int index) {
  switch (lua_type(L, index)) {
    case LUA_TNUMBER:
      return (int64_t)lua_tonumber(L, index);
    case LUA_TSTRING:
      return atoll(lua_tostring(L, index));
    default:
      return *((int64_t *)luaL_checkudata(L, index, LONG_NUM_TYPE));
  }
}

// Creates a new longnumber and pushes it onto the statck
int64_t * lualongnumber_pushlong(lua_State *L, int64_t *val) {
  int64_t *data = (int64_t *)lua_newuserdata(L, sizeof(int64_t)); // longnum
  luaL_getmetatable(L, LONG_NUM_TYPE);                            // longnum, mt
  lua_setmetatable(L, -2);                                        // longnum
  if (val) {
    *data = *val;
  }
  return data;
}

