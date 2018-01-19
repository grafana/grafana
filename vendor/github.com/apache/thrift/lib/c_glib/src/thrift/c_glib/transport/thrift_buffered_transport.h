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

#ifndef _THRIFT_BUFFERED_TRANSPORT_H
#define _THRIFT_BUFFERED_TRANSPORT_H

#include <glib.h>
#include <glib-object.h>

#include <thrift/c_glib/transport/thrift_transport.h>

G_BEGIN_DECLS

/*! \file thrift_buffered_transport.h
 *  \brief Implementation of a Thrift buffered transport.  Subclasses
 *         the ThriftTransport class.
 */

/* type macros */
#define THRIFT_TYPE_BUFFERED_TRANSPORT (thrift_buffered_transport_get_type ())
#define THRIFT_BUFFERED_TRANSPORT(obj) (G_TYPE_CHECK_INSTANCE_CAST ((obj), THRIFT_TYPE_BUFFERED_TRANSPORT, ThriftBufferedTransport))
#define THRIFT_IS_BUFFERED_TRANSPORT(obj) (G_TYPE_CHECK_INSTANCE_TYPE ((obj), THRIFT_TYPE_BUFFERED_TRANSPORT))
#define THRIFT_BUFFERED_TRANSPORT_CLASS(c) (G_TYPE_CHECK_CLASS_CAST ((c), THRIFT_TYPE_BUFFERED_TRANSPORT, ThriftBufferedTransportClass))
#define THRIFT_IS_BUFFERED_TRANSPORT_CLASS(c) (G_TYPE_CHECK_CLASS_TYPE ((c), THRIFT_TYPE_BUFFERED_TRANSPORT)
#define THRIFT_BUFFERED_TRANSPORT_GET_CLASS(obj) (G_TYPE_INSTANCE_GET_CLASS ((obj), THRIFT_TYPE_BUFFERED_TRANSPORT, ThriftBufferedTransportClass))

typedef struct _ThriftBufferedTransport ThriftBufferedTransport;

/*!
 * ThriftBufferedTransport  instance.
 */
struct _ThriftBufferedTransport
{
  ThriftTransport parent;

  /* protected */
  ThriftTransport *transport;

  /* private */
  GByteArray *r_buf;
  GByteArray *w_buf;
  guint32 r_buf_size;
  guint32 w_buf_size;
};

typedef struct _ThriftBufferedTransportClass ThriftBufferedTransportClass;

/*!
 * ThriftBufferedTransport class.
 */
struct _ThriftBufferedTransportClass
{
  ThriftTransportClass parent;
};

/* used by THRIFT_TYPE_BUFFERED_TRANSPORT */
GType thrift_buffered_transport_get_type (void);

G_END_DECLS

#endif
