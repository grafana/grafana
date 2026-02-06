/*
Copyright 2019 The Vitess Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

// Package mysql is a library to support MySQL binary protocol,
// both client and server sides. It also supports binlog event parsing.
package mysql

/*

Implementation notes, collected during coding.
==============================================

The reference for the capabilities is at this location:
http://dev.mysql.com/doc/internals/en/capability-flags.html

--
CLIENT_FOUND_ROWS

The doc says:
Send found rows instead of affected rows in EOF_Packet.
Value
0x00000002

We just pass it through to the server.

--
CLIENT_CONNECT_WITH_DB:

It drives the ability to connect with a database name.
The server needs to send this flag if it supports it.
If the client supports it as well, and wants to connect with a database name,
then the client can set the flag in its response, and then put the database name
in the handshake response.

If the server doesn't support it (meaning it is not set in the server
capability flags), then the client may set the flag or not (as the
server should ignore it anyway), and then should send a COM_INIT_DB
message to set the database.

--
PLUGGABLE AUTHENTICATION:

See https://dev.mysql.com/doc/internals/en/authentication-method-mismatch.html
for more information on this.

Our server side always starts by using mysql_native_password, like a
real MySQL server.

Our client will expect the server to always use mysql_native_password
in its initial handshake. This is what a real server always does, even though
it's not technically mandatory.

The server's AuthServer plugin method AuthMethod() will then return
what auth method the server wants to use. If it is
mysql_native_password, and the client already returned the data, we
use it. Otherwise we switch the auth to what the server wants (by
sending an Authentication Method Switch Request packet) and
re-negotiate.

--
Maximum Packet Size:

Set to zero by client and ignored by the server. Not sure what to do
with this now.  It seems the mysql client is sending 16777216 to the
server, which is what we use anyway. Not sure any client will send any
lower value, and if they do, not sure what the first 3 bytes of a
packet should be (still 0xff 0xff 0xff or the max packet size).

--
CLIENT_CONNECT_ATTRS

The client can send up optional connection attributes with this flags.
I don't see a use for them yet.

--
Multi result sets:

Only used by stored procedures returning multiple result sets.
Unclear if it is also used when the CLIENT_MULTI_STATEMENTS flag is used.
See: http://dev.mysql.com/doc/internals/en/multi-resultset.html

The flags returned is then used to mark if there are more result sets
coming up.

We do not support any of this yet. It would be nice to plumb that for
ExecuteBatch later on though.

--
Character sets:

See: http://dev.mysql.com/doc/internals/en/character-set.html#packet-Protocol::CharacterSet

We maintain a map of character set names to integer value.

--
Server protection:

We should add the following protections for the server:
- Limit the number of concurrently opened client connections.
- Add an idle timeout and close connections after that timeout is reached.
  Should start during initial handshake, maybe have a shorter value during
  handshake.

--
NUM_FLAG flag:

It is added by the C client library if the field is numerical.

  if (IS_NUM(client_field->type))
    client_field->flags|= NUM_FLAG;

This is somewhat useless. Also, that flag overlaps with GROUP_FLAG
(which seems to be used by the server only for temporary tables in
some cases, so it's not a big deal).

But eventually, we probably want to remove it entirely, as it is not
transmitted over the wire. For now, we keep it for backward
compatibility with the C client.

--
Row-based replication:

The following types or constructs are not yet supported by our RBR:

- in MariaDB, the type TIMESTAMP(N) where N>0 is stored in the row the
  exact same way as TIMESTAMP(0). So there is no way to get N, except
  by knowing the table exact schema. This is such a corner case. MySQL
  5.6+ uses TIMESTAMP2, and uses metadata to know the precision, so it
  works there very nicely.

  From mariaDB source code comment:
  'So row-based replication between temporal data types of
  different precision is not possible in MariaDB.'

- JSON is stored as an optimized index data blob in the row. We don't
  parse it to re-print a text version for re-insertion. Instead, we
  just return NULL. So JSOn is not supported.

Replication Notes:
==================

This package also defines a few data structures used for replication.
It is meant to only depend on the proto definitions, and nothing else.
Replication support has two main aspects:

1. Replication event and positions.

A replication event is an individual event, and it has an ID, called GTID.

A replication position is defined slightly differently for MariaDB and MySQL 5.6+:

- MariaDB uses the latest position as an integer, that assumes every
  single event before that integer was applied. So a replication
  position is similar to a GTID.

- Mysql 5.6+ keeps track of all event ever applied, in a structure called GTIDSet.

To make these two compatible, a replication position is defined by
this library as a GTIDSet. For MariaDB, the Set is equal to a Position.


2. Binlog event management. They are defined in the MySQL spec at:
http://dev.mysql.com/doc/internals/en/replication-protocol.html

These are slightly different for MariaDB and MySQL 5.6+, as they
contain GTIDs. MariaDB also defines a GTID event that has an implicit
Begin, that can replace an usual Begin.

*/
