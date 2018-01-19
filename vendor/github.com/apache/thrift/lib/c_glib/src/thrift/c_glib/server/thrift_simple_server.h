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

#ifndef _THRIFT_SIMPLE_SERVER_H
#define _THRIFT_SIMPLE_SERVER_H

#include <glib-object.h>

#include <thrift/c_glib/server/thrift_server.h>

G_BEGIN_DECLS

/*! \file thrift_simple_server.h
 *  \brief A simple Thrift server, single-threaded.
 */

/* type macros */
#define THRIFT_TYPE_SIMPLE_SERVER (thrift_simple_server_get_type ())
#define THRIFT_SIMPLE_SERVER(obj) (G_TYPE_CHECK_INSTANCE_CAST ((obj), THRIFT_TYPE_SIMPLE_SERVER, ThriftSimpleServer))
#define THRIFT_IS_SIMPLE_SERVER(obj) (G_TYPE_CHECK_INSTANCE_TYPE ((obj), THRIFT_TYPE_SIMPLE_SERVER))
#define THRIFT_SIMPLE_SERVER_CLASS(c) (G_TYPE_CHECK_CLASS_CAST ((c) THRIFT_TYPE_SIMPLE_SERVER, ThriftSimpleServerClass))
#define THRIFT_IS_SIMPLE_SERVER_CLASS(c) (G_TYPE_CHECK_CLASS_TYPE ((c), THRIFT_TYPE_SIMPLE_SERVER))
#define THRIFT_SIMPLE_SERVER_GET_CLASS(obj) (G_TYPE_INSTANCE_GET_CLASS ((obj), THRIFT_TYPE_SIMPLE_SERVER, ThriftSimpleServerClass))

typedef struct _ThriftSimpleServer ThriftSimpleServer;

/**
 * Thrift Simple Server instance.
 */
struct _ThriftSimpleServer
{
  ThriftServer parent;

  /* private */
  volatile gboolean running;
};

typedef struct _ThriftSimpleServerClass ThriftSimpleServerClass;

/**
 * Thrift Simple Server class.
 */
struct _ThriftSimpleServerClass
{
  ThriftServerClass parent;
};

/* used by THRIFT_TYPE_SIMPLE_SERVER */
GType thrift_simple_server_get_type (void);

G_END_DECLS

#endif /* _THRIFT_SIMPLE_SERVER_H */

