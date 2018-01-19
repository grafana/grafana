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
#include <thrift/c_glib/transport/thrift_transport_factory.h>

G_DEFINE_TYPE(ThriftTransportFactory, thrift_transport_factory, G_TYPE_OBJECT)

/* builds a transport from the base transport. */
ThriftTransport *
thrift_transport_factory_get_transport (ThriftTransportFactory *factory,
                                        ThriftTransport *transport)
{
  THRIFT_UNUSED_VAR (factory);
  return transport;
}

static void
thrift_transport_factory_class_init (ThriftTransportFactoryClass *cls)
{
  cls->get_transport = thrift_transport_factory_get_transport;
}

static void
thrift_transport_factory_init (ThriftTransportFactory *factory)
{
  THRIFT_UNUSED_VAR (factory);
}
