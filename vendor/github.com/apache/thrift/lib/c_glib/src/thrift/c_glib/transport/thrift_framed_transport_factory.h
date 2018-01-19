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

#ifndef _THRIFT_FRAMED_TRANSPORT_FACTORY_H
#define _THRIFT_FRAMED_TRANSPORT_FACTORY_H

#include <glib-object.h>

#include <thrift/c_glib/transport/thrift_transport.h>
#include <thrift/c_glib/transport/thrift_transport_factory.h>

G_BEGIN_DECLS

/*! \file thrift_framed_transport_factory.h
 *  \brief Wraps a transport with a ThriftFramedTransport.
 */

/* type macros */
#define THRIFT_TYPE_FRAMED_TRANSPORT_FACTORY    \
  (thrift_framed_transport_factory_get_type ())
#define THRIFT_FRAMED_TRANSPORT_FACTORY(obj)                            \
  (G_TYPE_CHECK_INSTANCE_CAST ((obj),                                   \
                               THRIFT_TYPE_FRAMED_TRANSPORT_FACTORY,    \
                               ThriftFramedTransportFactory))
#define THRIFT_IS_FRAMED_TRANSPORT_FACTORY(obj)                         \
  (G_TYPE_CHECK_INSTANCE_TYPE ((obj),                                   \
                               THRIFT_TYPE_FRAMED_TRANSPORT_FACTORY))
#define THRIFT_FRAMED_TRANSPORT_FACTORY_CLASS(c)                        \
  (G_TYPE_CHECK_CLASS_CAST ((c),                                        \
                            THRIFT_TYPE_FRAMED_TRANSPORT_FACTORY,       \
                            ThriftFramedTransportFactoryClass))
#define THRIFT_IS_FRAMED_TRANSPORT_FACTORY_CLASS(c)                     \
  (G_TYPE_CHECK_CLASS_TYPE ((c),                                        \
                            THRIFT_TYPE_FRAMED_TRANSPORT_FACTORY))
#define THRIFT_FRAMED_TRANSPORT_FACTORY_GET_CLASS(obj)                  \
  (G_TYPE_INSTANCE_GET_CLASS ((obj),                                    \
                              THRIFT_TYPE_FRAMED_TRANSPORT_FACTORY,     \
                              ThriftFramedTransportFactoryClass))

typedef struct _ThriftFramedTransportFactory ThriftFramedTransportFactory;

/* Thrift Framed-Transport Factory instance */
struct _ThriftFramedTransportFactory
{
  ThriftTransportFactory parent;
};

typedef struct _ThriftFramedTransportFactoryClass ThriftFramedTransportFactoryClass;

/* Thrift Framed-Transport Factory class */
struct _ThriftFramedTransportFactoryClass
{
  ThriftTransportFactoryClass parent;

  /* vtable */
  ThriftTransport *(*get_transport) (ThriftTransportFactory *factory,
                                     ThriftTransport *transport);
};

/* used by THRIFT_TYPE_FRAMED_TRANSPORT_FACTORY */
GType thrift_framed_transport_factory_get_type (void);

/* virtual public methods */
ThriftTransport *
thrift_framed_transport_factory_get_transport (ThriftTransportFactory *factory,
                                               ThriftTransport *transport);

G_END_DECLS

#endif /* _THRIFT_FRAMED_TRANSPORT_FACTORY_H */
