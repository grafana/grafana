Haskell Thrift Bindings

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

Compile
=======

Use Cabal to compile and install; ./configure uses Cabal underneath, and that
path is not yet well tested. Thrift's library and generated code should compile
with pretty much any GHC extensions or warnings you enable (or disable).
Please report this not being the case as a bug on
https://issues.apache.org/jira/secure/CreateIssue!default.jspa

Chances you'll need to muck a bit with Cabal flags to install Thrift:

CABAL_CONFIGURE_FLAGS="--user" ./configure

Base Types
==========

The mapping from Thrift types to Haskell's is:

 * double -> Double
 * byte -> Data.Int.Int8
 * i16 -> Data.Int.Int16
 * i32 -> Data.Int.Int32
 * i64 -> Data.Int.Int64
 * string -> Text
 * binary -> Data.ByteString.Lazy
 * bool -> Boolean

Enums
=====

Become Haskell 'data' types. Use fromEnum to get out the int value.

Lists
=====

Become Data.Vector.Vector from the vector package.

Maps and Sets
=============

Become Data.HashMap.Strict.Map and Data.HashSet.Set from the
unordered-containers package.

Structs
=======

Become records. Field labels are ugly, of the form f_STRUCTNAME_FIELDNAME. All
fields are Maybe types.

Exceptions
==========

Identical to structs. Use them with throw and catch from Control.Exception.

Client
======

Just a bunch of functions. You may have to import a bunch of client files to
deal with inheritance.

Interface
=========

You should only have to import the last one in the chain of inheritors. To make
an interface, declare a label:

  data MyIface = MyIface

and then declare it an instance of each iface class, starting with the superest
class and proceeding down (all the while defining the methods).  Then pass your
label to process as the handler.

Processor
=========

Just a function that takes a handler label, protocols. It calls the
superclasses process if there is a superclass.
