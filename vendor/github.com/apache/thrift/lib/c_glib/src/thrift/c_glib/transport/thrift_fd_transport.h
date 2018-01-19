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

#ifndef _THRIFT_FD_TRANSPORT_H
#define _THRIFT_FD_TRANSPORT_H

#include <glib-object.h>

#include "thrift_transport.h"

G_BEGIN_DECLS

/*! \file thrift_fd_transport.h
 *  \brief Class for Thrift file descriptor transports.
 */

/* type macros */
#define THRIFT_TYPE_FD_TRANSPORT (thrift_fd_transport_get_type ())
#define THRIFT_FD_TRANSPORT(obj) \
  (G_TYPE_CHECK_INSTANCE_CAST ((obj), THRIFT_TYPE_FD_TRANSPORT, \
                               ThriftFDTransport))
#define THRIFT_IS_FD_TRANSPORT(obj) \
  (G_TYPE_CHECK_INSTANCE_TYPE ((obj), THRIFT_TYPE_FD_TRANSPORT))
#define THRIFT_FD_TRANSPORT_CLASS(c) \
  (G_TYPE_CHECK_CLASS_CAST ((c), THRIFT_TYPE_FD_TRANSPORT, \
                            ThriftFDTransportClass))
#define THRIFT_IS_FD_TRANSPORT_CLASS(c) \
  (G_TYPE_CHECK_CLASS_TYPE ((c), THRIFT_TYPE_FD_TRANSPORT))
#define THRIFT_FD_TRANSPORT_GET_CLASS(obj) \
  (G_TYPE_INSTANCE_GET_CLASS ((obj), THRIFT_TYPE_FD_TRANSPORT, \
                              ThriftFDTransportClass))

typedef struct _ThriftFDTransport ThriftFDTransport;

struct _ThriftFDTransport
{
  ThriftTransport parent;

  /* protected */
  gint fd;
};

typedef struct _ThriftFDTransportClass ThriftFDTransportClass;

/*!
 * Thrift Transport class
 */
struct _ThriftFDTransportClass
{
  ThriftTransportClass parent;
};

/* used by THRIFT_TYPE_FD_TRANSPORT */
GType thrift_fd_transport_get_type (void);

G_END_DECLS

#endif /* _THRIFT_FD_TRANSPORT_H */
