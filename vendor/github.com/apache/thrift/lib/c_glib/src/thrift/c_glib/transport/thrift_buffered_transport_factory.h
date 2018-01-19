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

#ifndef _THRIFT_BUFFERED_TRANSPORT_FACTORY_H
#define _THRIFT_BUFFERED_TRANSPORT_FACTORY_H

#include <glib-object.h>

#include <thrift/c_glib/transport/thrift_transport.h>
#include <thrift/c_glib/transport/thrift_transport_factory.h>

G_BEGIN_DECLS

/*! \file thrift_buffered_transport_factory.h
 *  \brief Wraps a transport with a ThriftBufferedTransport.
 */

/* type macros */
#define THRIFT_TYPE_BUFFERED_TRANSPORT_FACTORY          \
  (thrift_buffered_transport_factory_get_type ())
#define THRIFT_BUFFERED_TRANSPORT_FACTORY(obj)                          \
  (G_TYPE_CHECK_INSTANCE_CAST ((obj),                                   \
                               THRIFT_TYPE_BUFFERED_TRANSPORT_FACTORY,  \
                               ThriftBufferedTransportFactory))
#define THRIFT_IS_BUFFERED_TRANSPORT_FACTORY(obj)                       \
  (G_TYPE_CHECK_INSTANCE_TYPE ((obj),                                   \
                               THRIFT_TYPE_BUFFERED_TRANSPORT_FACTORY))
#define THRIFT_BUFFERED_TRANSPORT_FACTORY_CLASS(c)                      \
  (G_TYPE_CHECK_CLASS_CAST ((c),                                        \
                            THRIFT_TYPE_BUFFERED_TRANSPORT_FACTORY,     \
                            ThriftBufferedTransportFactoryClass))
#define THRIFT_IS_BUFFERED_TRANSPORT_FACTORY_CLASS(c)                   \
  (G_TYPE_CHECK_CLASS_TYPE ((c),                                        \
                            THRIFT_TYPE_BUFFERED_TRANSPORT_FACTORY))
#define THRIFT_BUFFERED_TRANSPORT_FACTORY_GET_CLASS(obj)                \
  (G_TYPE_INSTANCE_GET_CLASS ((obj),                                    \
                              THRIFT_TYPE_BUFFERED_TRANSPORT_FACTORY,   \
                              ThriftBufferedTransportFactoryClass))

typedef struct _ThriftBufferedTransportFactory ThriftBufferedTransportFactory;

/* Thrift Buffered-Transport Factory instance */
struct _ThriftBufferedTransportFactory
{
  ThriftTransportFactory parent;
};

typedef struct _ThriftBufferedTransportFactoryClass ThriftBufferedTransportFactoryClass;

/* Thrift Buffered-Transport Factory class */
struct _ThriftBufferedTransportFactoryClass
{
  ThriftTransportFactoryClass parent;

  /* vtable */
  ThriftTransport *(*get_transport) (ThriftTransportFactory *factory,
                                     ThriftTransport *transport);
};

/* used by THRIFT_TYPE_BUFFERED_TRANSPORT_FACTORY */
GType thrift_buffered_transport_factory_get_type (void);

/* virtual public methods */
ThriftTransport *
thrift_buffered_transport_factory_get_transport (ThriftTransportFactory *factory,
                                                 ThriftTransport *transport);

G_END_DECLS

#endif /* _THRIFT_BUFFERED_TRANSPORT_FACTORY_H */
