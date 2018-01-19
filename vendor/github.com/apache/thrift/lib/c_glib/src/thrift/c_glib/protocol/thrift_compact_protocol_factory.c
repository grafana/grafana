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
#include <thrift/c_glib/protocol/thrift_compact_protocol.h>
#include <thrift/c_glib/protocol/thrift_compact_protocol_factory.h>

/* object properties */
enum _ThriftCompactProtocolFactoryProperties
{
    PROP_0,
    PROP_THRIFT_COMPACT_PROTOCOL_FACTORY_STRING_LIMIT,
    PROP_THRIFT_COMPACT_PROTOCOL_FACTORY_CONTAINER_LIMIT
};

G_DEFINE_TYPE (ThriftCompactProtocolFactory, thrift_compact_protocol_factory,
               THRIFT_TYPE_PROTOCOL_FACTORY)

ThriftProtocol *
thrift_compact_protocol_factory_get_protocol (ThriftProtocolFactory *factory,
                                              ThriftTransport *transport)
{
  ThriftCompactProtocolFactory *tcf;
  ThriftCompactProtocol *tc;

  tcf = THRIFT_COMPACT_PROTOCOL_FACTORY (factory);

  tc = g_object_new (THRIFT_TYPE_COMPACT_PROTOCOL,
                     "transport", transport,
                     "string_limit", tcf->string_limit,
                     "container_limit", tcf->container_limit,
                     NULL);

  return THRIFT_PROTOCOL (tc);
}

/* property accessor */
void
thrift_compact_protocol_factory_get_property (GObject *object, guint property_id,
                                              GValue *value, GParamSpec *pspec)
{
  ThriftCompactProtocolFactory *tcf;

  THRIFT_UNUSED_VAR (pspec);

  tcf = THRIFT_COMPACT_PROTOCOL_FACTORY (object);

  switch (property_id) {
    case PROP_THRIFT_COMPACT_PROTOCOL_FACTORY_STRING_LIMIT:
      g_value_set_int (value, tcf->string_limit);
      break;
    case PROP_THRIFT_COMPACT_PROTOCOL_FACTORY_CONTAINER_LIMIT:
      g_value_set_int (value, tcf->container_limit);
      break;
  }
}

/* property mutator */
void
thrift_compact_protocol_factory_set_property (GObject *object, guint property_id,
                                              const GValue *value, GParamSpec
                                                *pspec)
{
  ThriftCompactProtocolFactory *tcf;

  THRIFT_UNUSED_VAR (pspec);

  tcf = THRIFT_COMPACT_PROTOCOL_FACTORY (object);

  switch (property_id) {
    case PROP_THRIFT_COMPACT_PROTOCOL_FACTORY_STRING_LIMIT:
      tcf->string_limit = g_value_get_int (value);
      break;
    case PROP_THRIFT_COMPACT_PROTOCOL_FACTORY_CONTAINER_LIMIT:
      tcf->container_limit = g_value_get_int (value);
      break;
  }
}

static void
thrift_compact_protocol_factory_class_init (ThriftCompactProtocolFactoryClass
                                              *klass)
{
  ThriftProtocolFactoryClass *cls;
  GObjectClass *gobject_class;
  GParamSpec *param_spec;

  cls = THRIFT_PROTOCOL_FACTORY_CLASS (klass);
  gobject_class = G_OBJECT_CLASS (klass);
  param_spec = NULL;

  /* setup accessors and mutators */
  gobject_class->get_property = thrift_compact_protocol_factory_get_property;
  gobject_class->set_property = thrift_compact_protocol_factory_set_property;

  param_spec = g_param_spec_int ("string_limit",
                                 "Max allowed string size",
                                 "Set the max string limit",
                                 0, /* min */
                                 G_MAXINT32, /* max */
                                 0, /* default value */
                                 G_PARAM_CONSTRUCT_ONLY | G_PARAM_READWRITE);
  g_object_class_install_property (gobject_class,
                                   PROP_THRIFT_COMPACT_PROTOCOL_FACTORY_STRING_LIMIT,
                                   param_spec);

  param_spec = g_param_spec_int ("container_limit",
                                 "Max allowed container size",
                                 "Set the max container limit",
                                 0, /* min */
                                 G_MAXINT32, /* max */
                                 0, /* default value */
                                 G_PARAM_CONSTRUCT_ONLY | G_PARAM_READWRITE);
  g_object_class_install_property (gobject_class,
    PROP_THRIFT_COMPACT_PROTOCOL_FACTORY_CONTAINER_LIMIT, param_spec);

  cls->get_protocol = thrift_compact_protocol_factory_get_protocol;
}

static void
thrift_compact_protocol_factory_init (ThriftCompactProtocolFactory *factory)
{
  THRIFT_UNUSED_VAR (factory);
}
