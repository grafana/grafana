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

#ifndef _THRIFT_TRANSPORT_H
#define _THRIFT_TRANSPORT_H

#include <glib-object.h>

G_BEGIN_DECLS

/*! \file thrift_transport.h
 *  \brief Abstract class for Thrift transports.
 *
 * An abstract class is used instead of an interface because:
 *  - interfaces can't seem to be used as properties.  ThriftProtocol has
 *    a ThriftTransport as an object property.
 *  - if a method needs to be added that all subclasses can use, a class
 *    is necessary.
 */

/* type macros */
#define THRIFT_TYPE_TRANSPORT (thrift_transport_get_type ())
#define THRIFT_TRANSPORT(obj) (G_TYPE_CHECK_INSTANCE_CAST ((obj), THRIFT_TYPE_TRANSPORT, ThriftTransport))
#define THRIFT_IS_TRANSPORT(obj) (G_TYPE_CHECK_INSTANCE_TYPE ((obj), THRIFT_TYPE_TRANSPORT))
#define THRIFT_TRANSPORT_CLASS(c) (G_TYPE_CHECK_CLASS_CAST ((c), THRIFT_TYPE_TRANSPORT, ThriftTransportClass))
#define THRIFT_IS_TRANSPORT_CLASS(c) (G_TYPE_CHECK_CLASS_TYPE ((c), THRIFT_TYPE_TRANSPORT))
#define THRIFT_TRANSPORT_GET_CLASS(obj) (G_TYPE_INSTANCE_GET_CLASS ((obj), THRIFT_TYPE_TRANSPORT, ThriftTransportClass))

typedef struct _ThriftTransport ThriftTransport;

/*!
 * Thrift Protocol object
 */
struct _ThriftTransport
{
  GObject parent;
};

typedef struct _ThriftTransportClass ThriftTransportClass;

/*!
 * Thrift Transport class
 */
struct _ThriftTransportClass
{
  GObjectClass parent;

  /* vtable */
  gboolean (*is_open) (ThriftTransport *transport);
  gboolean (*peek) (ThriftTransport *transport, GError **error);
  gboolean (*open) (ThriftTransport *transport, GError **error);
  gboolean (*close) (ThriftTransport *transport, GError **error);
  gint32 (*read) (ThriftTransport *transport, gpointer buf,
                  guint32 len, GError **error);
  gboolean (*read_end) (ThriftTransport *transport, GError **error);
  gboolean (*write) (ThriftTransport *transport, const gpointer buf,
                   const guint32 len, GError **error);
  gboolean (*write_end) (ThriftTransport *transport, GError **error);
  gboolean (*flush) (ThriftTransport *transport, GError **error);
  gint32 (*read_all) (ThriftTransport *transport, gpointer buf,
                      guint32 len, GError **error);
};

/* used by THRIFT_TYPE_TRANSPORT */
GType thrift_transport_get_type (void);

/* virtual public methods */

/*!
 * Checks if this transport is opened.
 * \public \memberof ThriftTransportInterface
 */
gboolean thrift_transport_is_open (ThriftTransport *transport);

/*!
 * Open the transport for reading and writing.
 * \public \memberof ThriftTransportInterface
 */
gboolean thrift_transport_open (ThriftTransport *transport, GError **error);

/*!
 * Tests whether there is more data to read or if the remote side is still
 * open. By default this is true whenever the transport is open, but
 * implementations should add logic to test for this condition where possible
 * (i.e. on a socket).
 *
 * This is used by a server to check if it should listen for another request.
 * \public \memberof ThriftTransportInterface
 */
gboolean thrift_transport_peek (ThriftTransport *transport, GError **error);

/*!
 * Close the transport.
 * \public \memberof ThriftTransportInterface
 */
gboolean thrift_transport_close (ThriftTransport *transport, GError **error);

/*!
 * Read some data into the buffer buf.
 * \public \memberof ThriftTransportInterface
 */
gint32 thrift_transport_read (ThriftTransport *transport, gpointer buf,
                              guint32 len, GError **error);

/*!
 * Called when read is completed.
 * \public \memberof ThriftTransportInterface
 */
gboolean thrift_transport_read_end (ThriftTransport *transport, GError **error);

/*!
 * Writes data from a buffer to the transport.
 * \public \memberof ThriftTransportInterface
 */
gboolean thrift_transport_write (ThriftTransport *transport, const gpointer buf,
                                 const guint32 len, GError **error);

/*!
 * Called when write is completed.
 * \public \memberof ThriftTransportInterface
 */
gboolean thrift_transport_write_end (ThriftTransport *transport,
                                     GError **error);

/*!
 * Flushes any pending data to be written.  Typically used with buffered
 * transport mechanisms.
 * \public \memberof ThriftTransportInterface
 */
gboolean thrift_transport_flush (ThriftTransport *transport, GError **error);

/*!
 * Read len bytes of data into the buffer buf.
 * \public \memberof ThriftTransportInterface
 */
gint32 thrift_transport_read_all (ThriftTransport *transport, gpointer buf,
                                  guint32 len, GError **error);

/* define error/exception types */
typedef enum
{
  THRIFT_TRANSPORT_ERROR_UNKNOWN,
  THRIFT_TRANSPORT_ERROR_HOST,
  THRIFT_TRANSPORT_ERROR_SOCKET,
  THRIFT_TRANSPORT_ERROR_CONNECT,
  THRIFT_TRANSPORT_ERROR_SEND,
  THRIFT_TRANSPORT_ERROR_RECEIVE,
  THRIFT_TRANSPORT_ERROR_CLOSE
} ThriftTransportError;

/* define an error domain for GError to use */
GQuark thrift_transport_error_quark (void);
#define THRIFT_TRANSPORT_ERROR (thrift_transport_error_quark ())

/* define macro for invalid socket */
#define THRIFT_INVALID_SOCKET (-1)

G_END_DECLS

#endif /* _THRIFT_TRANSPORT_H */
