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

#ifndef _THRIFT_SOCKET_H
#define _THRIFT_SOCKET_H

#include <glib-object.h>

#include <thrift/c_glib/transport/thrift_transport.h>

G_BEGIN_DECLS

/*! \file thrift_socket.h
 *  \brief Socket implementation of a Thrift transport.  Subclasses the
 *         ThriftTransport class.
 */

/* type macros */
#define THRIFT_TYPE_SOCKET (thrift_socket_get_type ())
#define THRIFT_SOCKET(obj) (G_TYPE_CHECK_INSTANCE_CAST ((obj), THRIFT_TYPE_SOCKET, ThriftSocket))
#define THRIFT_IS_SOCKET(obj) (G_TYPE_CHECK_INSTANCE_TYPE ((obj), THRIFT_TYPE_SOCKET))
#define THRIFT_SOCKET_CLASS(c) (G_TYPE_CHECK_CLASS_CAST ((c), THRIFT_TYPE_SOCKET, ThriftSocketClass))
#define THRIFT_IS_SOCKET_CLASS(c) (G_TYPE_CHECK_CLASS_TYPE ((c), THRIFT_TYPE_SOCKET))
#define THRIFT_SOCKET_GET_CLASS(obj) (G_TYPE_INSTANCE_GET_CLASS ((obj), THRIFT_TYPE_SOCKET, ThriftSocketClass))

typedef struct _ThriftSocket ThriftSocket;

/*!
 * Thrift Socket instance.
 */
struct _ThriftSocket
{
  ThriftTransport parent;

  /* private */
  gchar *hostname;
  gshort port;
  int sd;
  guint8 *buf;
  guint32 buf_size;
  guint32 buf_len;
};

typedef struct _ThriftSocketClass ThriftSocketClass;

/*!
 * Thrift Socket class.
 */
struct _ThriftSocketClass
{
  ThriftTransportClass parent;
};

/* used by THRIFT_TYPE_SOCKET */
GType thrift_socket_get_type (void);

G_END_DECLS

#endif
