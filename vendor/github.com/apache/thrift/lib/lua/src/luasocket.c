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

#include <unistd.h>
#include "string.h"
#include "socket.h"

////////////////////////////////////////////////////////////////////////////////

static const char *SOCKET_ANY     = "__thrift_socket_any";
static const char *SOCKET_CONN    = "__thrift_socket_connected";

static const char *SOCKET_GENERIC = "__thrift_socket_generic";
static const char *SOCKET_CLIENT  = "__thrift_socket_client";
static const char *SOCKET_SERVER  = "__thrift_socket_server";

static const char *DEFAULT_HOST   = "localhost";

typedef struct __t_tcp {
  t_socket sock;
  int timeout; // Milliseconds
} t_tcp;
typedef t_tcp *p_tcp;

////////////////////////////////////////////////////////////////////////////////
// Util

static void throw_argerror(lua_State *L, int index, const char *expected) {
  char msg[256];
  sprintf(msg, "%s expected, got %s", expected, luaL_typename(L, index));
  luaL_argerror(L, index, msg);
}

static void *checkgroup(lua_State *L, int index, const char *groupname) {
  if (!lua_getmetatable(L, index)) {
    throw_argerror(L, index, groupname);
  }

  lua_pushstring(L, groupname);
  lua_rawget(L, -2);
  if (lua_isnil(L, -1)) {
    lua_pop(L, 2);
    throw_argerror(L, index, groupname);
  } else {
    lua_pop(L, 2);
    return lua_touserdata(L, index);
  }
  return NULL; // Not reachable
}

static void *checktype(lua_State *L, int index, const char *typename) {
  if (strcmp(typename, SOCKET_ANY) == 0 ||
      strcmp(typename, SOCKET_CONN) == 0) {
    return checkgroup(L, index, typename);
  } else {
    return luaL_checkudata(L, index, typename);
  }
}

static void settype(lua_State *L, int index, const char *typename) {
  luaL_getmetatable(L, typename);
  lua_setmetatable(L, index);
}

#define LUA_SUCCESS_RETURN(L) \
  lua_pushnumber(L, 1); \
  return 1

#define LUA_CHECK_RETURN(L, err) \
  if (err) { \
    lua_pushnil(L); \
    lua_pushstring(L, err); \
    return 2; \
  } \
  LUA_SUCCESS_RETURN(L)

////////////////////////////////////////////////////////////////////////////////

static int l_socket_create(lua_State *L);
static int l_socket_destroy(lua_State *L);
static int l_socket_settimeout(lua_State *L);
static int l_socket_getsockinfo(lua_State *L);

static int l_socket_accept(lua_State *L);
static int l_socket_listen(lua_State *L);

static int l_socket_create_and_connect(lua_State *L);
static int l_socket_connect(lua_State *L);
static int l_socket_send(lua_State *L);
static int l_socket_receive(lua_State *L);

////////////////////////////////////////////////////////////////////////////////

static const struct luaL_Reg methods_generic[] = {
  {"destroy",     l_socket_destroy},
  {"settimeout",  l_socket_settimeout},
  {"getsockinfo", l_socket_getsockinfo},
  {"listen",      l_socket_listen},
  {"connect",     l_socket_connect},
  {NULL, NULL}
};

static const struct luaL_Reg methods_server[] = {
  {"destroy",     l_socket_destroy},
  {"getsockinfo", l_socket_getsockinfo},
  {"accept",      l_socket_accept},
  {"send",        l_socket_send},
  {"receive",     l_socket_receive},
  {NULL, NULL}
};

static const struct luaL_Reg methods_client[] = {
  {"destroy",     l_socket_destroy},
  {"settimeout",  l_socket_settimeout},
  {"getsockinfo", l_socket_getsockinfo},
  {"send",        l_socket_send},
  {"receive",     l_socket_receive},
  {NULL, NULL}
};

static const struct luaL_Reg funcs_luasocket[] = {
  {"create",             l_socket_create},
  {"create_and_connect", l_socket_create_and_connect},
  {NULL, NULL}
};

////////////////////////////////////////////////////////////////////////////////

// Check/enforce inheritance
static void add_to_group(lua_State *L,
                  const char *metatablename,
                  const char *groupname) {
  luaL_getmetatable(L, metatablename); // mt
  lua_pushstring(L, groupname);        // mt, "name"
  lua_pushboolean(L, 1);               // mt, "name", true
  lua_rawset(L, -3);                   // mt
  lua_pop(L, 1);
}

static void set_methods(lua_State *L,
  const char *metatablename,
  const struct luaL_Reg *methods) {
  luaL_getmetatable(L, metatablename);   // mt
  // Create the __index table
  lua_pushstring(L, "__index");          // mt, "__index"
  lua_newtable(L);                       // mt, "__index", t
  for (; methods->name; methods++) {
    lua_pushstring(L, methods->name);    // mt, "__index", t, "name"
    lua_pushcfunction(L, methods->func); // mt, "__index", t, "name", func
    lua_rawset(L, -3);                   // mt, "__index", t
  }
  lua_rawset(L, -3);                     // mt
  lua_pop(L, 1);
}

int luaopen_libluasocket(lua_State *L) {
  luaL_newmetatable(L, SOCKET_GENERIC);
  luaL_newmetatable(L, SOCKET_CLIENT);
  luaL_newmetatable(L, SOCKET_SERVER);
  lua_pop(L, 3);
  add_to_group(L, SOCKET_GENERIC, SOCKET_ANY);
  add_to_group(L, SOCKET_CLIENT, SOCKET_ANY);
  add_to_group(L, SOCKET_SERVER, SOCKET_ANY);
  add_to_group(L, SOCKET_CLIENT, SOCKET_CONN);
  add_to_group(L, SOCKET_SERVER, SOCKET_CONN);
  set_methods(L, SOCKET_GENERIC, methods_generic);
  set_methods(L, SOCKET_CLIENT, methods_client);
  set_methods(L, SOCKET_SERVER, methods_server);

  luaL_register(L, "luasocket", funcs_luasocket);
  return 1;
}

////////////////////////////////////////////////////////////////////////////////
// General

// sock,err create(bind_host, bind_port)
// sock,err create(bind_host) -> any port
// sock,err create() -> any port on localhost
static int l_socket_create(lua_State *L) {
  const char *err;
  t_socket sock;
  const char *addr = lua_tostring(L, 1);
  if (!addr) {
    addr = DEFAULT_HOST;
  }
  unsigned short port = lua_tonumber(L, 2);
  err = tcp_create(&sock);
  if (!err) {
    err = tcp_bind(&sock, addr, port); // bind on create
    if (err) {
      tcp_destroy(&sock);
    } else {
      p_tcp tcp = (p_tcp) lua_newuserdata(L, sizeof(t_tcp));
      settype(L, -2, SOCKET_GENERIC);
      socket_setnonblocking(&sock);
      tcp->sock = sock;
      tcp->timeout = 0;
      return 1; // Return userdata
    }
  }
  LUA_CHECK_RETURN(L, err);
}

// destroy()
static int l_socket_destroy(lua_State *L) {
  p_tcp tcp = (p_tcp) checktype(L, 1, SOCKET_ANY);
  const char *err = tcp_destroy(&tcp->sock);
  LUA_CHECK_RETURN(L, err);
}

// send(socket, data)
static int l_socket_send(lua_State *L) {
  p_tcp self = (p_tcp) checktype(L, 1, SOCKET_CONN);
  p_tcp tcp = (p_tcp) checktype(L, 2, SOCKET_CONN);
  size_t len;
  const char *data = luaL_checklstring(L, 3, &len);
  const char *err =
    tcp_send(&tcp->sock, data, len, tcp->timeout);
  LUA_CHECK_RETURN(L, err);
}

#define LUA_READ_STEP 8192
static int l_socket_receive(lua_State *L) {
  p_tcp self = (p_tcp) checktype(L, 1, SOCKET_CONN);
  p_tcp handle = (p_tcp) checktype(L, 2, SOCKET_CONN);
  size_t len = luaL_checknumber(L, 3);
  char buf[LUA_READ_STEP];
  const char *err = NULL;
  int received;
  size_t got = 0, step = 0;
  luaL_Buffer b;

  luaL_buffinit(L, &b);
  do {
    step = (LUA_READ_STEP < len - got ? LUA_READ_STEP : len - got);
    err = tcp_raw_receive(&handle->sock, buf, step, self->timeout, &received);
    if (err == NULL) {
      luaL_addlstring(&b, buf, received);
      got += received;
    }
  } while (err == NULL && got < len);

  if (err) {
    lua_pushnil(L);
    lua_pushstring(L, err);
    return 2;
  }
  luaL_pushresult(&b);
  return 1;
}

// settimeout(timeout)
static int l_socket_settimeout(lua_State *L) {
  p_tcp self = (p_tcp) checktype(L, 1, SOCKET_ANY);
  int timeout = luaL_checknumber(L, 2);
  self->timeout = timeout;
  LUA_SUCCESS_RETURN(L);
}

// table getsockinfo()
static int l_socket_getsockinfo(lua_State *L) {
  char buf[256];
  short port = 0;
  p_tcp tcp = (p_tcp) checktype(L, 1, SOCKET_ANY);
  if (socket_get_info(&tcp->sock, &port, buf, 256) == SUCCESS) {
    lua_newtable(L);                    // t
    lua_pushstring(L, "host");          // t, "host"
    lua_pushstring(L, buf);             // t, "host", buf
    lua_rawset(L, -3);                  // t
    lua_pushstring(L, "port");          // t, "port"
    lua_pushnumber(L, port);            // t, "port", port
    lua_rawset(L, -3);                  // t
    return 1;
  }
  return 0;
}

////////////////////////////////////////////////////////////////////////////////
// Server

// accept()
static int l_socket_accept(lua_State *L) {
  const char *err;
  p_tcp self = (p_tcp) checktype(L, 1, SOCKET_SERVER);
  t_socket sock;
  err = tcp_accept(&self->sock, &sock, self->timeout);
  if (!err) { // Success
    // Create a reference to the client
    p_tcp client = (p_tcp) lua_newuserdata(L, sizeof(t_tcp));
    settype(L, 2, SOCKET_CLIENT);
    socket_setnonblocking(&sock);
    client->sock = sock;
    client->timeout = self->timeout;
    return 1;
  }
  LUA_CHECK_RETURN(L, err);
}

static int l_socket_listen(lua_State *L) {
  const char* err;
  p_tcp tcp = (p_tcp) checktype(L, 1, SOCKET_GENERIC);
  int backlog = 10;
  err = tcp_listen(&tcp->sock, backlog);
  if (!err) {
    // Set the current as a server
    settype(L, 1, SOCKET_SERVER); // Now a server
  }
  LUA_CHECK_RETURN(L, err);
}

////////////////////////////////////////////////////////////////////////////////
// Client

// create_and_connect(host, port, timeout)
extern double __gettime();
static int l_socket_create_and_connect(lua_State *L) {
  const char* err = NULL;
  double end;
  t_socket sock;
  const char *host = luaL_checkstring(L, 1);
  unsigned short port = luaL_checknumber(L, 2);
  int timeout = luaL_checknumber(L, 3);

  // Create and connect loop for timeout milliseconds
  end = __gettime() + timeout/1000;
  do {
    // Create the socket
    err = tcp_create(&sock);
    if (!err) {
        // Connect
        err = tcp_connect(&sock, host, port, timeout);
        if (err) {
          tcp_destroy(&sock);
          usleep(100000); // sleep for 100ms
        } else {
          p_tcp tcp = (p_tcp) lua_newuserdata(L, sizeof(t_tcp));
          settype(L, -2, SOCKET_CLIENT);
          socket_setnonblocking(&sock);
          tcp->sock = sock;
          tcp->timeout = timeout;
          return 1; // Return userdata
        }
    }
  } while (err && __gettime() < end);

  LUA_CHECK_RETURN(L, err);
}

// connect(host, port)
static int l_socket_connect(lua_State *L) {
  const char *err;
  p_tcp tcp = (p_tcp) checktype(L, 1, SOCKET_GENERIC);
  const char *host = luaL_checkstring(L, 2);
  unsigned short port = luaL_checknumber(L, 3);
  err = tcp_connect(&tcp->sock, host, port, tcp->timeout);
  if (!err) {
    settype(L, 1, SOCKET_CLIENT); // Now a client
  }
  LUA_CHECK_RETURN(L, err);
}
