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
#include <thrift/c_glib/transport/thrift_framed_transport.h>
#include <thrift/c_glib/transport/thrift_framed_transport_factory.h>

G_DEFINE_TYPE (ThriftFramedTransportFactory,
               thrift_framed_transport_factory,
               THRIFT_TYPE_TRANSPORT_FACTORY)

/* Wraps a transport with a ThriftFramedTransport. */
ThriftTransport *
thrift_framed_transport_factory_get_transport (ThriftTransportFactory *factory,
                                               ThriftTransport *transport)
{
  THRIFT_UNUSED_VAR (factory);

  return THRIFT_TRANSPORT (g_object_new (THRIFT_TYPE_FRAMED_TRANSPORT,
                                         "transport", transport,
                                         NULL));
}

static void
thrift_framed_transport_factory_init (ThriftFramedTransportFactory *self)
{
  THRIFT_UNUSED_VAR (self);
}

static void
thrift_framed_transport_factory_class_init (ThriftFramedTransportFactoryClass *klass)
{
  ThriftTransportFactoryClass *base_class =
    THRIFT_TRANSPORT_FACTORY_CLASS (klass);

  base_class->get_transport =
    klass->get_transport =
    thrift_framed_transport_factory_get_transport;
}
