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

/* define the GError domain string */
#define THRIFT_TRANSPORT_ERROR_DOMAIN "thrift-transport-error-quark"

G_DEFINE_ABSTRACT_TYPE(ThriftTransport, thrift_transport, G_TYPE_OBJECT)

gboolean 
thrift_transport_is_open (ThriftTransport *transport)
{
  return THRIFT_TRANSPORT_GET_CLASS (transport)->is_open (transport);
}

gboolean
thrift_transport_peek (ThriftTransport *transport, GError **error)
{
  return THRIFT_TRANSPORT_GET_CLASS (transport)->peek (transport, error);
}

gboolean
thrift_transport_open (ThriftTransport *transport, GError **error)
{
  return THRIFT_TRANSPORT_GET_CLASS (transport)->open (transport, error);
}

gboolean
thrift_transport_close (ThriftTransport *transport, GError **error)
{
  return THRIFT_TRANSPORT_GET_CLASS (transport)->close (transport, error);
}

gint32
thrift_transport_read (ThriftTransport *transport, gpointer buf,
                       guint32 len, GError **error)
{
  return THRIFT_TRANSPORT_GET_CLASS (transport)->read (transport, buf,
                                                       len, error);
}

gboolean
thrift_transport_read_end (ThriftTransport *transport, GError **error)
{
  return THRIFT_TRANSPORT_GET_CLASS (transport)->read_end (transport,
                                                           error);
}

gboolean
thrift_transport_write (ThriftTransport *transport, const gpointer buf,
                        const guint32 len, GError **error)
{
  return THRIFT_TRANSPORT_GET_CLASS (transport)->write (transport, buf,
                                                        len, error);
}

gboolean
thrift_transport_write_end (ThriftTransport *transport, GError **error)
{
  return THRIFT_TRANSPORT_GET_CLASS (transport)->write_end (transport,
                                                            error);
}

gboolean
thrift_transport_flush (ThriftTransport *transport, GError **error)
{
  return THRIFT_TRANSPORT_GET_CLASS (transport)->flush (transport, error);
}

gint32
thrift_transport_read_all (ThriftTransport *transport, gpointer buf,
                           guint32 len, GError **error)
{
  return THRIFT_TRANSPORT_GET_CLASS (transport)->read_all (transport, buf,
                                                           len, error);
}

/* by default, peek returns true if and only if the transport is open */
static gboolean
thrift_transport_real_peek (ThriftTransport *transport, GError **error)
{
  THRIFT_UNUSED_VAR (error);

  return THRIFT_TRANSPORT_GET_CLASS (transport)->is_open (transport);
}

static gint32
thrift_transport_real_read_all (ThriftTransport *transport, gpointer buf,
                                guint32 len, GError **error)
{
  ThriftTransportClass *ttc;
  guint32 have;
  gint32 ret;
  gint8 *bytes;

  THRIFT_UNUSED_VAR (error);

  ttc = THRIFT_TRANSPORT_GET_CLASS (transport);
  have = 0;
  ret = 0;
  bytes = (gint8*) buf;

  while (have < len) {
    if ((ret = ttc->read (transport, (gpointer) (bytes + have), len - have,
                          error)) < 0) {
      return ret;
    }
    have += ret;
  }

  return have;
}

/* define the GError domain for Thrift transports */
GQuark
thrift_transport_error_quark (void)
{
  return g_quark_from_static_string (THRIFT_TRANSPORT_ERROR_DOMAIN);
}

/* class initializer for ThriftTransport */
static void
thrift_transport_class_init (ThriftTransportClass *cls)
{
  /* set these as virtual methods to be implemented by a subclass */
  cls->is_open = thrift_transport_is_open;
  cls->open = thrift_transport_open;
  cls->close = thrift_transport_close;
  cls->read = thrift_transport_read;
  cls->read_end = thrift_transport_read_end;
  cls->write = thrift_transport_write;
  cls->write_end = thrift_transport_write_end;
  cls->flush = thrift_transport_flush;

  /* provide a default implementation for the peek and read_all methods */
  cls->peek = thrift_transport_real_peek;
  cls->read_all = thrift_transport_real_read_all;
}

static void
thrift_transport_init (ThriftTransport *transport)
{
  THRIFT_UNUSED_VAR (transport);
}
