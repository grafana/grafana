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

#ifndef _THRIFT_SERVER_TRANSPORT_H
#define _THRIFT_SERVER_TRANSPORT_H

#include <glib-object.h>

#include "thrift_transport.h"

G_BEGIN_DECLS

/*! \file thrift_server_transport.h
 *  \brief Abstract class for Thrift server transports.
 */

/* type macros */
#define THRIFT_TYPE_SERVER_TRANSPORT (thrift_server_transport_get_type ())
#define THRIFT_SERVER_TRANSPORT(obj) (G_TYPE_CHECK_INSTANCE_CAST ((obj), THRIFT_TYPE_SERVER_TRANSPORT, ThriftServerTransport))
#define THRIFT_IS_SERVER_TRANSPORT(obj) (G_TYPE_CHECK_INSTANCE_TYPE ((obj), THRIFT_TYPE_SERVER_TRANSPORT))
#define THRIFT_SERVER_TRANSPORT_CLASS(c) (G_TYPE_CHECK_CLASS_CAST ((c), THRIFT_TYPE_SERVER_TRANSPORT, ThriftServerTransportClass))
#define THRIFT_IS_SERVER_TRANSPORT_CLASS(c) (G_TYPE_CHECK_CLASS_TYPE ((c), THRIFT_TYPE_SERVER_TRANSPORT))
#define THRIFT_SERVER_TRANSPORT_GET_CLASS(obj) (G_TYPE_INSTANCE_GET_CLASS ((obj), THRIFT_TYPE_SERVER_TRANSPORT, ThriftServerTransportClass))

typedef struct _ThriftServerTransport ThriftServerTransport;

struct _ThriftServerTransport
{
  GObject parent;
};

typedef struct _ThriftServerTransportClass ThriftServerTransportClass;

/*!
 * Thrift Transport class
 */
struct _ThriftServerTransportClass
{
  GObjectClass parent;

  /* vtable */
  gboolean (*listen) (ThriftServerTransport *transport, GError **error);
  ThriftTransport *(*accept) (ThriftServerTransport *transport, GError **error);
  gboolean (*close) (ThriftServerTransport *transport, GError **error);
};

/* used by THRIFT_TYPE_SERVER_TRANSPORT */
GType thrift_server_transport_get_type (void);

/*!
 * Listen for new connections.
 * \public \memberof ThriftServerTransportClass
 */
gboolean thrift_server_transport_listen (ThriftServerTransport *transport,
                                         GError **error);

/*!
 * Accept a connection.
 * \public \memberof ThriftServerTransportClass
 */
ThriftTransport *thrift_server_transport_accept
    (ThriftServerTransport *transport, GError **error);

/*!
 * Close the transport.
 * \public \memberof ThriftServerTransportClass
 */
gboolean thrift_server_transport_close (ThriftServerTransport *transport,
                                        GError **error);

G_END_DECLS

#endif /* _THRIFT_SERVER_TRANSPORT_H */
