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

#ifndef _THRIFT_TRANSPORT_FACTORY_H
#define _THRIFT_TRANSPORT_FACTORY_H

#include <glib-object.h>

#include "thrift_transport.h"

G_BEGIN_DECLS

/*! \file thrift_transport_factory.h
 *  \brief Base class for Thrift Transport Factories.  Used by Thrift Servers
 *         to obtain a client transport from an existing transport.  The default
 *         implementation simply clones the provided transport.
 */

/* type macros */
#define THRIFT_TYPE_TRANSPORT_FACTORY (thrift_transport_factory_get_type ())
#define THRIFT_TRANSPORT_FACTORY(obj) (G_TYPE_CHECK_INSTANCE_CAST ((obj), THRIFT_TYPE_TRANSPORT_FACTORY, ThriftTransportFactory))
#define THRIFT_IS_TRANSPORT_FACTORY(obj) (G_TYPE_CHECK_INSTANCE_TYPE ((obj), THRIFT_TYPE_TRANSPORT_FACTORY))
#define THRIFT_TRANSPORT_FACTORY_CLASS(c) (G_TYPE_CHECK_CLASS_CAST ((c), THRIFT_TYPE_TRANSPORT_FACTORY, ThriftTransportFactoryClass))
#define THRIFT_IS_TRANSPORT_FACTORY_CLASS(c) (G_TYPE_CHECK_CLASS_TYPE ((c), THRIFT_TYPE_TRANSPORT_FACTORY))
#define THRIFT_TRANSPORT_FACTORY_GET_CLASS(obj) (G_TYPE_INSTANCE_GET_CLASS ((obj), THRIFT_TYPE_TRANSPORT_FACTORY, ThriftTransportFactoryClass))

typedef struct _ThriftTransportFactory ThriftTransportFactory;

/* Thrift Transport Factory instance */
struct _ThriftTransportFactory
{
  GObject parent;
};

typedef struct _ThriftTransportFactoryClass ThriftTransportFactoryClass;

/* Thrift Transport Factory class */
struct _ThriftTransportFactoryClass
{
  GObjectClass parent;

  /* vtable */
  ThriftTransport *(*get_transport) (ThriftTransportFactory *factory,
                                     ThriftTransport *transport);
};

/* used by THRIFT_TYPE_TRANSPORT_FACTORY */
GType thrift_transport_factory_get_type (void);

/* virtual public methods */
ThriftTransport *thrift_transport_factory_get_transport (ThriftTransportFactory *factory, ThriftTransport *transport);

G_END_DECLS

#endif /* _THRIFT_TRANSPORT_FACTORY_H */
