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

#include <thrift/c_glib/thrift.h>
#include <thrift/c_glib/transport/thrift_transport.h>
#include <thrift/c_glib/transport/thrift_server_transport.h>

G_DEFINE_ABSTRACT_TYPE(ThriftServerTransport, thrift_server_transport, G_TYPE_OBJECT)

/* base initializer for the server transport interface */
static void
thrift_server_transport_class_init (ThriftServerTransportClass *c)
{
  c->listen = thrift_server_transport_listen;
  c->accept = thrift_server_transport_accept;
  c->close = thrift_server_transport_close;
}

static void
thrift_server_transport_init (ThriftServerTransport *transport)
{
  THRIFT_UNUSED_VAR (transport);
}

gboolean
thrift_server_transport_listen (ThriftServerTransport *transport,
                                GError **error)
{
  return THRIFT_SERVER_TRANSPORT_GET_CLASS (transport)->listen (transport,
                                                                error);
}

ThriftTransport *
thrift_server_transport_accept (ThriftServerTransport *transport,
                                GError **error)
{
  return THRIFT_SERVER_TRANSPORT_GET_CLASS (transport)->accept (transport,
                                                                error);
}

gboolean
thrift_server_transport_close (ThriftServerTransport *transport, GError **error)
{
  return THRIFT_SERVER_TRANSPORT_GET_CLASS (transport)->close (transport,
                                                               error);
}
