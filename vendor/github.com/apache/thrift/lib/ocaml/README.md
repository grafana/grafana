Thrift OCaml Software Library

License
=======

Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements. See the NOTICE file
distributed with this work for additional information
regarding copyright ownership. The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License. You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied. See the License for the
specific language governing permissions and limitations
under the License.


Library
=======

The library abstract classes, exceptions, and general use functions
are mostly jammed in Thrift.ml (an exception being
TServer).

Generally, classes are used, however they are often put in their own
module along with other relevant types and functions. The classes
often called t, exceptions are called E.

Implementations live in their own files. There is TBinaryProtocol,
TSocket, TThreadedServer, TSimpleServer, and TServerSocket.

A note on making the library: Running make should create native, debug
code libraries, and a toplevel.


Struct format
-------------
Structs are turned into classes. The fields are all option types and
are initially None. Write is a method, but reading is done by a
separate function (since there is no such thing as a static
class). The class type is t and is in a module with the name of the
struct.


enum format
-----------
Enums are put in their own module along with
functions to_i and of_i which convert the ocaml types into ints. For
example:

enum Numberz
{
  ONE = 1,
  TWO,
  THREE,
  FIVE = 5,
  SIX,
  EIGHT = 8
}

==>

module Numberz =
struct
type t =
| ONE
| TWO
| THREE
| FIVE
| SIX
| EIGHT

let of_i = ...
let to_i = ...
end

typedef format
--------------
Typedef turns into the type declaration:
typedef i64 UserId

==>

type userid Int64.t

exception format
----------------
The same as structs except that the module also has an exception type
E of t that is raised/caught.

For example, with an exception Xception,
raise (Xception.E (new Xception.t))
and
try
  ...
with Xception.E e -> ...

list format
-----------
Lists are turned into OCaml native lists.

Map/Set formats
---------------
These are both turned into Hashtbl.t's. Set values are bool.

Services
--------
The client is a class "client" parametrized on input and output
protocols. The processor is a class parametrized on a handler. A
handler is a class inheriting the iface abstract class. Unlike other
implementations, client does not implement iface since iface functions
must take option arguments so as to deal with the case where a client
does not send all the arguments.
