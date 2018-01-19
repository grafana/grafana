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

#ifndef _THRIFT_COMPACT_PROTOCOL_H
#define _THRIFT_COMPACT_PROTOCOL_H

#include <glib.h>
#include <glib-object.h>

#include <thrift/c_glib/protocol/thrift_protocol.h>
#include <thrift/c_glib/transport/thrift_transport.h>

G_BEGIN_DECLS

/*! \file thrift_compact_protocol.h
 *  \brief Compact protocol implementation of a Thrift protocol.  Implements the
 *         ThriftProtocol interface.
 */

/* type macros */
#define THRIFT_TYPE_COMPACT_PROTOCOL (thrift_compact_protocol_get_type ())
#define THRIFT_COMPACT_PROTOCOL(obj) \
  (G_TYPE_CHECK_INSTANCE_CAST ((obj), THRIFT_TYPE_COMPACT_PROTOCOL, \
   ThriftCompactProtocol))
#define THRIFT_IS_COMPACT_PROTOCOL(obj) \
  (G_TYPE_CHECK_INSTANCE_TYPE ((obj), THRIFT_TYPE_COMPACT_PROTOCOL))
#define THRIFT_COMPACT_PROTOCOL_CLASS(c) \
  (G_TYPE_CHECK_CLASS_CAST ((c), THRIFT_TYPE_COMPACT_PROTOCOL, \
   ThriftCompactProtocolClass))
#define THRIFT_IS_COMPACT_PROTOCOL_CLASS(c) \
  (G_TYPE_CHECK_CLASS_TYPE ((c), THRIFT_TYPE_COMPACT_PROTOCOL))
#define THRIFT_COMPACT_PROTOCOL_GET_CLASS(obj) \
  (G_TYPE_INSTANCE_GET_CLASS ((obj), THRIFT_TYPE_COMPACT_PROTOCOL, \
   ThriftCompactProtocolClass))


typedef struct _ThriftCompactProtocol ThriftCompactProtocol;

/*!
 * Thrift Compact Protocol instance.
 */
struct _ThriftCompactProtocol
{
  ThriftProtocol parent;

  /* protected */
  gint32 string_limit;
  gint32 container_limit;

  /* private */

  /**
   * (Writing) If we encounter a boolean field begin, save the TField here
   * so it can have the value incorporated.
   */
  const gchar* _bool_field_name;
  ThriftType _bool_field_type;
  gint16 _bool_field_id;

  /**
   * (Reading) If we read a field header, and it's a boolean field, save
   * the boolean value here so that read_bool can use it.
   */
  gboolean _has_bool_value;
  gboolean _bool_value;

  /**
   * Used to keep track of the last field for the current and previous structs,
   * so we can do the delta stuff.
   */

  GQueue _last_field;
  gint16 _last_field_id;
};

typedef struct _ThriftCompactProtocolClass ThriftCompactProtocolClass;

/*!
 * Thrift Compact Protocol class.
 */
struct _ThriftCompactProtocolClass
{
  ThriftProtocolClass parent;
};

/* used by THRIFT_TYPE_COMPACT_PROTOCOL */
GType thrift_compact_protocol_get_type (void);

G_END_DECLS

#endif /* _THRIFT_COMPACT_PROTOCOL_H */
