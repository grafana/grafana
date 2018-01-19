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

#ifndef _THRIFT_BINARY_PROTOCOL_H
#define _THRIFT_BINARY_PROTOCOL_H

#include <glib-object.h>

#include <thrift/c_glib/protocol/thrift_protocol.h>
#include <thrift/c_glib/transport/thrift_transport.h>

G_BEGIN_DECLS

/*! \file thrift_binary_protocol.h
 *  \brief Binary protocol implementation of a Thrift protocol.  Implements the
 *         ThriftProtocol interface.
 */

/* type macros */
#define THRIFT_TYPE_BINARY_PROTOCOL (thrift_binary_protocol_get_type ())
#define THRIFT_BINARY_PROTOCOL(obj) (G_TYPE_CHECK_INSTANCE_CAST ((obj), THRIFT_TYPE_BINARY_PROTOCOL, ThriftBinaryProtocol))
#define THRIFT_IS_BINARY_PROTOCOL(obj) (G_TYPE_CHECK_INSTANCE_TYPE ((obj), THRIFT_TYPE_BINARY_PROTOCOL))
#define THRIFT_BINARY_PROTOCOL_CLASS(c) (G_TYPE_CHECK_CLASS_CAST ((c), THRIFT_TYPE_BINARY_PROTOCOL, ThriftBinaryProtocolClass))
#define THRIFT_IS_BINARY_PROTOCOL_CLASS(c) (G_TYPE_CHECK_CLASS_TYPE ((c), THRIFT_TYPE_BINARY_PROTOCOL))
#define THRIFT_BINARY_PROTOCOL_GET_CLASS(obj) (G_TYPE_INSTANCE_GET_CLASS ((obj), THRIFT_TYPE_BINARY_PROTOCOL, ThriftBinaryProtocolClass))

/* version numbers */
#define THRIFT_BINARY_PROTOCOL_VERSION_1 0x80010000
#define THRIFT_BINARY_PROTOCOL_VERSION_MASK 0xffff0000

typedef struct _ThriftBinaryProtocol ThriftBinaryProtocol;

/*!
 * Thrift Binary Protocol instance.
 */
struct _ThriftBinaryProtocol
{
  ThriftProtocol parent;
};

typedef struct _ThriftBinaryProtocolClass ThriftBinaryProtocolClass;

/*!
 * Thrift Binary Protocol class.
 */
struct _ThriftBinaryProtocolClass
{
  ThriftProtocolClass parent;
};

/* used by THRIFT_TYPE_BINARY_PROTOCOL */
GType thrift_binary_protocol_get_type (void);

G_END_DECLS

#endif /* _THRIFT_BINARY_PROTOCOL_H */
