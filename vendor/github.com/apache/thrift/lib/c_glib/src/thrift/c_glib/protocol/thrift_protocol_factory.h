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

#ifndef _THRIFT_PROTOCOL_FACTORY_H
#define _THRIFT_PROTOCOL_FACTORY_H

#include <glib-object.h>

#include <thrift/c_glib/transport/thrift_transport.h>
#include <thrift/c_glib/protocol/thrift_protocol.h>

G_BEGIN_DECLS

/*! \file thrift_protocol_factory.h
 *  \brief Abstract class for Thrift protocol factory implementations.
 */

/* type macros */
#define THRIFT_TYPE_PROTOCOL_FACTORY (thrift_protocol_factory_get_type ())
#define THRIFT_PROTOCOL_FACTORY(obj) (G_TYPE_CHECK_INSTANCE_CAST ((obj), THRIFT_TYPE_PROTOCOL_FACTORY, ThriftProtocolFactory))
#define THRIFT_IS_PROTOCOL_FACTORY(obj) (G_TYPE_CHECK_INSTANCE_TYPE ((obj), THRIFT_TYPE_PROTOCOL_FACTORY))
#define THRIFT_PROTOCOL_FACTORY_CLASS(c) (G_TYPE_CHECK_CLASS_CAST ((c), THRIFT_TYPE_PROTOCOL_FACTORY, ThriftProtocolFactoryClass))
#define THRIFT_IS_PROTOCOL_FACTORY_CLASS(c) (G_TYPE_CHECK_CLASS_TYPE ((c), THRIFT_TYPE_PROTOCOL_FACTORY))
#define THRIFT_PROTOCOL_FACTORY_GET_CLASS(obj) (G_TYPE_INSTANCE_GET_CLASS ((obj), THRIFT_TYPE_PROTOCOL_FACTORY, ThriftProtocolFactoryClass))

typedef struct _ThriftProtocolFactory ThriftProtocolFactory;

/*!
 * Thrift Protocol Factory object
 */
struct _ThriftProtocolFactory
{
  GObject parent;
};

typedef struct _ThriftProtocolFactoryClass ThriftProtocolFactoryClass;

/*!
 * Thrift Protocol Factory class
 */
struct _ThriftProtocolFactoryClass
{
  GObjectClass parent;

  ThriftProtocol *(*get_protocol) (ThriftProtocolFactory *factory,
                                   ThriftTransport *transport);
};

/* used by THRIFT_TYPE_PROTOCOL_FACTORY */
GType thrift_protocol_factory_get_type (void);

/* virtual public methods */
ThriftProtocol *thrift_protocol_factory_get_protocol(ThriftProtocolFactory *factory, ThriftTransport *transport);

G_END_DECLS

#endif /* _THRIFT_PROTOCOL_FACTORY_H */
