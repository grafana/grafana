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

#include <errno.h>
#include <netdb.h>
#include <string.h>
#include <stdlib.h>
#include <unistd.h>
#include <sys/socket.h>
#include <netinet/in.h>

#include <thrift/c_glib/thrift.h>
#include <thrift/c_glib/transport/thrift_socket.h>
#include <thrift/c_glib/transport/thrift_transport.h>
#include <thrift/c_glib/transport/thrift_server_transport.h>
#include <thrift/c_glib/transport/thrift_server_socket.h>

/* object properties */
enum _ThriftServerSocketProperties
{
  PROP_0,
  PROP_THRIFT_SERVER_SOCKET_PORT,
  PROP_THRIFT_SERVER_SOCKET_BACKLOG
};

/* define the GError domain string */
#define THRIFT_SERVER_SOCKET_ERROR_DOMAIN "thrift-server-socket-error-quark"

G_DEFINE_TYPE(ThriftServerSocket, thrift_server_socket, THRIFT_TYPE_SERVER_TRANSPORT)

gboolean
thrift_server_socket_listen (ThriftServerTransport *transport, GError **error)
{
  int enabled = 1; /* for setsockopt() */
  struct sockaddr_in pin;
  ThriftServerSocket *tsocket = THRIFT_SERVER_SOCKET (transport);

  /* create a address structure */
  memset (&pin, 0, sizeof(pin));
  pin.sin_family = AF_INET;
  pin.sin_addr.s_addr = INADDR_ANY;
  pin.sin_port = htons(tsocket->port);

  /* create a socket */
  if ((tsocket->sd = socket (AF_INET, SOCK_STREAM, 0)) == -1)
  {
    g_set_error (error, THRIFT_SERVER_SOCKET_ERROR,
                 THRIFT_SERVER_SOCKET_ERROR_SOCKET,
                 "failed to create socket - %s", strerror (errno));
    return FALSE;
  }

  if (setsockopt(tsocket->sd, SOL_SOCKET, SO_REUSEADDR, &enabled,
                 sizeof(enabled)) == -1)
  {
    g_set_error (error, THRIFT_SERVER_SOCKET_ERROR,
                 THRIFT_SERVER_SOCKET_ERROR_SETSOCKOPT,
                 "unable to set SO_REUSEADDR - %s", strerror(errno));
    return FALSE;
  }

  /* bind to the socket */
  if (bind(tsocket->sd, (struct sockaddr *) &pin, sizeof(pin)) == -1)
  {
    g_set_error (error, THRIFT_SERVER_SOCKET_ERROR,
                 THRIFT_SERVER_SOCKET_ERROR_BIND,
                 "failed to bind to port %d - %s",
                 tsocket->port, strerror(errno));
    return FALSE;
  }

  if (listen(tsocket->sd, tsocket->backlog) == -1)
  {
    g_set_error (error, THRIFT_SERVER_SOCKET_ERROR,
                 THRIFT_SERVER_SOCKET_ERROR_LISTEN,
                 "failed to listen to port %d - %s",
                 tsocket->port, strerror(errno));
    return FALSE;
  }

  return TRUE;
}

ThriftTransport *
thrift_server_socket_accept (ThriftServerTransport *transport, GError **error)
{
  int sd = THRIFT_INVALID_SOCKET;
  guint addrlen = 0;
  struct sockaddr_in address;
  ThriftSocket *socket = NULL;

  ThriftServerSocket *tsocket = THRIFT_SERVER_SOCKET (transport);

  if ((sd = accept(tsocket->sd, (struct sockaddr *) &address, &addrlen)) == -1)
  {
    g_set_error (error, THRIFT_SERVER_SOCKET_ERROR,
                 THRIFT_SERVER_SOCKET_ERROR_ACCEPT,
                 "failed to accept connection - %s",
                 strerror(errno));
    return FALSE;
  }

  socket = g_object_new (THRIFT_TYPE_SOCKET, NULL);
  socket->sd = sd;

  return THRIFT_TRANSPORT(socket);
}

gboolean
thrift_server_socket_close (ThriftServerTransport *transport, GError **error)
{
  ThriftServerSocket *tsocket = THRIFT_SERVER_SOCKET (transport);

  if (close (tsocket->sd) == -1)
  {
    g_set_error (error, THRIFT_SERVER_SOCKET_ERROR,
                 THRIFT_SERVER_SOCKET_ERROR_CLOSE,
                 "unable to close socket - %s", strerror(errno));
    return FALSE;
  }
  tsocket->sd = THRIFT_INVALID_SOCKET;

  return TRUE;
}

/* define the GError domain for this implementation */
GQuark
thrift_server_socket_error_quark (void)
{
  return g_quark_from_static_string(THRIFT_SERVER_SOCKET_ERROR_DOMAIN);
}

/* initializes the instance */
static void
thrift_server_socket_init (ThriftServerSocket *socket)
{
  socket->sd = THRIFT_INVALID_SOCKET;
}

/* destructor */
static void
thrift_server_socket_finalize (GObject *object)
{
  ThriftServerSocket *socket = THRIFT_SERVER_SOCKET (object);

  if (socket->sd != THRIFT_INVALID_SOCKET)
  {
    close (socket->sd);
  }
  socket->sd = THRIFT_INVALID_SOCKET;
}

/* property accessor */
void
thrift_server_socket_get_property (GObject *object, guint property_id,
                                   GValue *value, GParamSpec *pspec)
{
  ThriftServerSocket *socket = THRIFT_SERVER_SOCKET (object);

  switch (property_id)
  {
    case PROP_THRIFT_SERVER_SOCKET_PORT:
      g_value_set_uint (value, socket->port);
      break;
    case PROP_THRIFT_SERVER_SOCKET_BACKLOG:
      g_value_set_uint (value, socket->backlog);
      break;
    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, property_id, pspec);
      break;
  }
}

/* property mutator */
void
thrift_server_socket_set_property (GObject *object, guint property_id,
                                   const GValue *value, GParamSpec *pspec)
{
  ThriftServerSocket *socket = THRIFT_SERVER_SOCKET (object);

  switch (property_id)
  {
    case PROP_THRIFT_SERVER_SOCKET_PORT:
      socket->port = g_value_get_uint (value);
      break;
    case PROP_THRIFT_SERVER_SOCKET_BACKLOG:
      socket->backlog = g_value_get_uint (value);
      break;
    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, property_id, pspec);
      break;
  }
}

/* initializes the class */
static void
thrift_server_socket_class_init (ThriftServerSocketClass *cls)
{
  ThriftServerTransportClass *tstc = THRIFT_SERVER_TRANSPORT_CLASS (cls);
  GObjectClass *gobject_class = G_OBJECT_CLASS (cls);
  GParamSpec *param_spec = NULL;

  /* setup accessors and mutators */
  gobject_class->get_property = thrift_server_socket_get_property;
  gobject_class->set_property = thrift_server_socket_set_property;

  param_spec = g_param_spec_uint ("port",
                                  "port (construct)",
                                  "Set the port to listen to",
                                  0, /* min */
                                  65534, /* max */
                                  9090, /* default by convention */
                                  G_PARAM_CONSTRUCT_ONLY |
                                  G_PARAM_READWRITE);
  g_object_class_install_property (gobject_class,
                                   PROP_THRIFT_SERVER_SOCKET_PORT, 
                                   param_spec);

  param_spec = g_param_spec_uint ("backlog",
                                  "backlog (construct)",
                                  "Set the accept backlog",
                                  0, /* max */
                                  65534, /* max */
                                  1024, /* default */
                                  G_PARAM_CONSTRUCT_ONLY |
                                  G_PARAM_READWRITE);
  g_object_class_install_property (gobject_class,
                                   PROP_THRIFT_SERVER_SOCKET_BACKLOG,
                                   param_spec);

  gobject_class->finalize = thrift_server_socket_finalize;

  tstc->listen = thrift_server_socket_listen;
  tstc->accept = thrift_server_socket_accept;
  tstc->close = thrift_server_socket_close;
}

