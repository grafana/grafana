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

#include <assert.h>
#include <glib.h>
#include <stdlib.h>
#include <unistd.h>
#include <sys/types.h>
#include <sys/wait.h>

#include <thrift/c_glib/thrift.h>
#include <thrift/c_glib/processor/thrift_processor.h>
#include <thrift/c_glib/transport/thrift_server_socket.h>

#define TEST_PORT 51199

#include <thrift/c_glib/server/thrift_simple_server.c>

/* create a rudimentary processor */
#define TEST_PROCESSOR_TYPE (test_processor_get_type ())

struct _TestProcessor
{
  ThriftProcessor parent;
};
typedef struct _TestProcessor TestProcessor;

struct _TestProcessorClass
{
  ThriftProcessorClass parent;
};
typedef struct _TestProcessorClass TestProcessorClass;

G_DEFINE_TYPE(TestProcessor, test_processor, THRIFT_TYPE_PROCESSOR)

gboolean
test_processor_process (ThriftProcessor *processor, ThriftProtocol *in,
                        ThriftProtocol *out, GError **error)
{
  THRIFT_UNUSED_VAR (processor);
  THRIFT_UNUSED_VAR (in);
  THRIFT_UNUSED_VAR (out);
  THRIFT_UNUSED_VAR (error);

  return FALSE;
}

static void
test_processor_init (TestProcessor *p)
{
  THRIFT_UNUSED_VAR (p);
}

static void
test_processor_class_init (TestProcessorClass *proc)
{
  (THRIFT_PROCESSOR_CLASS(proc))->process = test_processor_process;
}

static void
test_server (void)
{
  int status;
  pid_t pid;
  TestProcessor *p = NULL;
  ThriftServerSocket *tss = NULL;
  ThriftSimpleServer *ss = NULL;

  p = g_object_new (TEST_PROCESSOR_TYPE, NULL);
  tss = g_object_new (THRIFT_TYPE_SERVER_SOCKET, "port", TEST_PORT, NULL);
  ss = g_object_new (THRIFT_TYPE_SIMPLE_SERVER, "processor", p,
                     "server_transport", THRIFT_SERVER_TRANSPORT (tss), NULL);

  /* run the server in a child process */
  pid = fork ();
  assert (pid >= 0);

  if (pid == 0)
  {
    THRIFT_SERVER_GET_CLASS (THRIFT_SERVER (ss))->serve (THRIFT_SERVER (ss),
                                                         NULL);
    exit (0);
  } else {
    sleep (5);
    kill (pid, SIGINT);

    g_object_unref (ss);
    g_object_unref (tss);
    g_object_unref (p);
    assert (wait (&status) == pid);
    assert (status == SIGINT);
  }
}

int
main(int argc, char *argv[])
{
#if (!GLIB_CHECK_VERSION (2, 36, 0))
  g_type_init();
#endif

  g_test_init (&argc, &argv, NULL);

  g_test_add_func ("/testsimpleserver/SimpleServer", test_server);

  return g_test_run ();
}
