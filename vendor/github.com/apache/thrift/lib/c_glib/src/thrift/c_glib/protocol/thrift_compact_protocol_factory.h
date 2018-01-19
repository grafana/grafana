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

#ifndef _THRIFT_COMPACT_PROTOCOL_FACTORY_H
#define _THRIFT_COMPACT_PROTOCOL_FACTORY_H

#include <glib-object.h>

#include <thrift/c_glib/protocol/thrift_protocol_factory.h>

G_BEGIN_DECLS

/* type macros */
#define THRIFT_TYPE_COMPACT_PROTOCOL_FACTORY \
  (thrift_compact_protocol_factory_get_type ())
#define THRIFT_COMPACT_PROTOCOL_FACTORY(obj) \
  (G_TYPE_CHECK_INSTANCE_CAST ((obj), THRIFT_TYPE_COMPACT_PROTOCOL_FACTORY, \
   ThriftCompactProtocolFactory))
#define THRIFT_IS_COMPACT_PROTOCOL_FACTORY(obj) \
  (G_TYPE_CHECK_INSTANCE_TYPE ((obj), THRIFT_TYPE_COMPACT_PROTOCOL_FACTORY))
#define THRIFT_COMPACT_PROTOCOL_FACTORY_CLASS(c) \
  (G_TYPE_CHECK_CLASS_CAST ((c), THRIFT_TYPE_COMPACT_PROTOCOL_FACTORY, \
   ThriftCompactProtocolFactoryClass))
#define THRIFT_IS_COMPACT_PROTOCOL_FACTORY_CLASS(c) \
  (G_TYPE_CHECK_CLASS_TYPE ((c), THRIFT_TYPE_COMPACT_PROTOCOL_FACTORY))
#define THRIFT_COMPACT_PROTOCOL_FACTORY_GET_CLASS(obj) \
  (G_TYPE_INSTANCE_GET_CLASS ((obj), THRIFT_TYPE_COMPACT_PROTOCOL_FACTORY, \
   ThriftCompactProtocolFactoryClass))

typedef struct _ThriftCompactProtocolFactory ThriftCompactProtocolFactory;

struct _ThriftCompactProtocolFactory
{
  ThriftProtocolFactory parent;

  /* protected */
  gint32 string_limit;
  gint32 container_limit;
};

typedef struct _ThriftCompactProtocolFactoryClass
  ThriftCompactProtocolFactoryClass;

struct _ThriftCompactProtocolFactoryClass
{
  ThriftProtocolFactoryClass parent;
};

/* used by THRIFT_TYPE_COMPACT_PROTOCOL_FACTORY */
GType thrift_compact_protocol_factory_get_type (void);

G_END_DECLS

#endif /* _THRIFT_COMPACT_PROTOCOL_FACTORY_H */
