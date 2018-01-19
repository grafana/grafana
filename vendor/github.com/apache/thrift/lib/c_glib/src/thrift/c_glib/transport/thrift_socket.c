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

#include <errno.h>
#include <netdb.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/socket.h>
#include <netinet/in.h>

#include <thrift/c_glib/thrift.h>
#include <thrift/c_glib/transport/thrift_transport.h>
#include <thrift/c_glib/transport/thrift_socket.h>

/* object properties */
enum _ThriftSocketProperties
{
  PROP_0,
  PROP_THRIFT_SOCKET_HOSTNAME,
  PROP_THRIFT_SOCKET_PORT
};

G_DEFINE_TYPE(ThriftSocket, thrift_socket, THRIFT_TYPE_TRANSPORT)

/* implements thrift_transport_is_open */
gboolean
thrift_socket_is_open (ThriftTransport *transport)
{
  ThriftSocket *socket = THRIFT_SOCKET (transport);
  return socket->sd != THRIFT_INVALID_SOCKET;
}

/* overrides thrift_transport_peek */
gboolean
thrift_socket_peek (ThriftTransport *transport, GError **error)
{
  gboolean result = FALSE;
  guint8 buf;
  int r;
  int errno_copy;

  ThriftSocket *socket = THRIFT_SOCKET (transport);

  if (thrift_socket_is_open (transport))
  {
    r = recv (socket->sd, &buf, 1, MSG_PEEK);
    if (r == -1)
    {
      errno_copy = errno;

      #if defined __FreeBSD__ || defined __MACH__
      /* FreeBSD returns -1 and ECONNRESET if the socket was closed by the other
         side */
      if (errno_copy == ECONNRESET)
      {
        thrift_socket_close (transport, error);
      }
      else
      {
      #endif

      g_set_error (error,
                   THRIFT_TRANSPORT_ERROR,
                   THRIFT_TRANSPORT_ERROR_SOCKET,
                   "failed to peek at socket - %s",
                   strerror (errno_copy));

      #if defined __FreeBSD__ || defined __MACH__
      }
      #endif
    }
    else if (r > 0)
    {
      result = TRUE;
    }
  }

  return result;
}

/* implements thrift_transport_open */
gboolean
thrift_socket_open (ThriftTransport *transport, GError **error)
{
  struct hostent *hp = NULL;
  struct sockaddr_in pin;
  int err;
#if defined(HAVE_GETHOSTBYNAME_R)
  struct hostent he;
  char buf[1024];
#endif

  ThriftSocket *tsocket = THRIFT_SOCKET (transport);
  g_return_val_if_fail (tsocket->sd == THRIFT_INVALID_SOCKET, FALSE);

  /* lookup the destination host */
#if defined(HAVE_GETHOSTBYNAME_R)
  if (gethostbyname_r (tsocket->hostname, &he, buf, 1024, &hp, &err) != 0 || hp == NULL)
#else
  if ((hp = gethostbyname (tsocket->hostname)) == NULL && (err = h_errno))
#endif
  {
    /* host lookup failed, bail out with an error */
    g_set_error (error, THRIFT_TRANSPORT_ERROR, THRIFT_TRANSPORT_ERROR_HOST,
                 "host lookup failed for %s:%d - %s",
                 tsocket->hostname, tsocket->port,
                 hstrerror (err));
    return FALSE;
  }

  /* create a socket structure */
  memset (&pin, 0, sizeof(pin));
  pin.sin_family = AF_INET;
  pin.sin_addr.s_addr = ((struct in_addr *) (hp->h_addr))->s_addr;
  pin.sin_port = htons (tsocket->port); 

  /* create the socket */
  if ((tsocket->sd = socket (AF_INET, SOCK_STREAM, 0)) == -1)
  {
    g_set_error (error, THRIFT_TRANSPORT_ERROR, THRIFT_TRANSPORT_ERROR_SOCKET,
                 "failed to create socket for host %s:%d - %s",
                 tsocket->hostname, tsocket->port,
                 strerror(errno));
    return FALSE;
  }

  /* open a connection */
  if (connect (tsocket->sd, (struct sockaddr *) &pin, sizeof(pin)) == -1)
  {
    g_set_error (error, THRIFT_TRANSPORT_ERROR, THRIFT_TRANSPORT_ERROR_CONNECT,
                 "failed to connect to host %s:%d - %s",
                 tsocket->hostname, tsocket->port, strerror(errno));
    return FALSE;
  }

  return TRUE;
}

/* implements thrift_transport_close */
gboolean
thrift_socket_close (ThriftTransport *transport, GError **error)
{
  ThriftSocket *socket = THRIFT_SOCKET (transport);

  if (close (socket->sd) == -1)
  {
    g_set_error (error, THRIFT_TRANSPORT_ERROR, THRIFT_TRANSPORT_ERROR_CLOSE,
                 "unable to close socket - %s",
                 strerror(errno));
    return FALSE;
  }

  socket->sd = THRIFT_INVALID_SOCKET;
  return TRUE;
}

/* implements thrift_transport_read */
gint32
thrift_socket_read (ThriftTransport *transport, gpointer buf,
                    guint32 len, GError **error)
{
  gint ret = 0;
  guint got = 0;

  ThriftSocket *socket = THRIFT_SOCKET (transport);

  while (got < len)
  {
    ret = recv (socket->sd, (guint8 *)buf + got, len-got, 0);
    if (ret <= 0)
    {
      g_set_error (error, THRIFT_TRANSPORT_ERROR,
                   THRIFT_TRANSPORT_ERROR_RECEIVE,
                   "failed to read %d bytes - %s", len, strerror(errno));
      return -1;
    }
    got += ret;
  }

  return got;
}

/* implements thrift_transport_read_end
 * called when write is complete.  nothing to do on our end. */
gboolean
thrift_socket_read_end (ThriftTransport *transport, GError **error)
{
  /* satisfy -Wall */
  THRIFT_UNUSED_VAR (transport);
  THRIFT_UNUSED_VAR (error);
  return TRUE;
}

/* implements thrift_transport_write */
gboolean
thrift_socket_write (ThriftTransport *transport, const gpointer buf,     
                     const guint32 len, GError **error)
{
  gint ret = 0;
  guint sent = 0;

  ThriftSocket *socket = THRIFT_SOCKET (transport);
  g_return_val_if_fail (socket->sd != THRIFT_INVALID_SOCKET, FALSE);

  while (sent < len)
  {
    ret = send (socket->sd, (guint8 *)buf + sent, len - sent, 0);
    if (ret < 0)
    {
      g_set_error (error, THRIFT_TRANSPORT_ERROR,
                   THRIFT_TRANSPORT_ERROR_SEND,
                   "failed to send %d bytes - %s", len, strerror(errno));
      return FALSE;
    }
    sent += ret;
  }

  return TRUE;
}

/* implements thrift_transport_write_end
 * called when write is complete.  nothing to do on our end. */
gboolean
thrift_socket_write_end (ThriftTransport *transport, GError **error)
{
  /* satisfy -Wall */
  THRIFT_UNUSED_VAR (transport);
  THRIFT_UNUSED_VAR (error);
  return TRUE;
}

/* implements thrift_transport_flush
 * flush pending data.  since we are not buffered, this is a no-op */
gboolean
thrift_socket_flush (ThriftTransport *transport, GError **error)
{
  /* satisfy -Wall */
  THRIFT_UNUSED_VAR (transport);
  THRIFT_UNUSED_VAR (error);
  return TRUE;
}

/* initializes the instance */
static void
thrift_socket_init (ThriftSocket *socket)
{
  socket->sd = THRIFT_INVALID_SOCKET;
}

/* destructor */
static void
thrift_socket_finalize (GObject *object)
{
  ThriftSocket *socket = THRIFT_SOCKET (object);

  if (socket->hostname != NULL)
  {
    g_free (socket->hostname);
  }
  socket->hostname = NULL;

  if (socket->sd != THRIFT_INVALID_SOCKET)
  {
    close (socket->sd);
  }
  socket->sd = THRIFT_INVALID_SOCKET;
}

/* property accessor */
void
thrift_socket_get_property (GObject *object, guint property_id,
                            GValue *value, GParamSpec *pspec)
{
  ThriftSocket *socket = THRIFT_SOCKET (object);

  THRIFT_UNUSED_VAR (pspec);

  switch (property_id)
  {
    case PROP_THRIFT_SOCKET_HOSTNAME:
      g_value_set_string (value, socket->hostname);
      break;
    case PROP_THRIFT_SOCKET_PORT:
      g_value_set_uint (value, socket->port);
      break;
  }
}

/* property mutator */
void
thrift_socket_set_property (GObject *object, guint property_id,
                            const GValue *value, GParamSpec *pspec)
{
  ThriftSocket *socket = THRIFT_SOCKET (object);

  THRIFT_UNUSED_VAR (pspec);

  switch (property_id)
  {
    case PROP_THRIFT_SOCKET_HOSTNAME:
      socket->hostname = g_strdup (g_value_get_string (value));
      break;
    case PROP_THRIFT_SOCKET_PORT:
      socket->port = g_value_get_uint (value);
      break;
  }
}

/* initializes the class */
static void
thrift_socket_class_init (ThriftSocketClass *cls)
{
  ThriftTransportClass *ttc = THRIFT_TRANSPORT_CLASS (cls);
  GObjectClass *gobject_class = G_OBJECT_CLASS (cls);
  GParamSpec *param_spec = NULL;

  /* setup accessors and mutators */
  gobject_class->get_property = thrift_socket_get_property;
  gobject_class->set_property = thrift_socket_set_property;

  param_spec = g_param_spec_string ("hostname",
                                    "hostname (construct)",
                                    "Set the hostname of the remote host",
                                    "localhost", /* default value */
                                    G_PARAM_CONSTRUCT_ONLY |
                                    G_PARAM_READWRITE);
  g_object_class_install_property (gobject_class, PROP_THRIFT_SOCKET_HOSTNAME,
                                   param_spec);

  param_spec = g_param_spec_uint ("port",
                                  "port (construct)",
                                  "Set the port of the remote host",
                                  0, /* min */
                                  65534, /* max */
                                  9090, /* default by convention */
                                  G_PARAM_CONSTRUCT_ONLY |
                                  G_PARAM_READWRITE);
  g_object_class_install_property (gobject_class, PROP_THRIFT_SOCKET_PORT,
                                   param_spec);

  gobject_class->finalize = thrift_socket_finalize;
  ttc->is_open = thrift_socket_is_open;
  ttc->peek = thrift_socket_peek;
  ttc->open = thrift_socket_open;
  ttc->close = thrift_socket_close;
  ttc->read = thrift_socket_read;
  ttc->read_end = thrift_socket_read_end;
  ttc->write = thrift_socket_write;
  ttc->write_end = thrift_socket_write_end;
  ttc->flush = thrift_socket_flush;
}
