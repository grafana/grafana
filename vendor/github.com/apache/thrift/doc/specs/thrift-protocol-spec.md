Thrift Protocol Structure
====================================================================

Last Modified: 2007-Jun-29

<!--
--------------------------------------------------------------------

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

--------------------------------------------------------------------
-->

This document describes the structure of the Thrift protocol
without specifying the encoding. Thus, the order of elements
could in some cases be rearranged depending upon the TProtocol
implementation, but this document specifies the minimum required
structure. There are some "dumb" terminals like STRING and INT
that take the place of an actual encoding specification.

They key point to notice is that ALL messages are just one wrapped
`<struct>`. Depending upon the message type, the `<struct>` can be
interpreted as the argument list to a function, the return value
of a function, or an exception.

--------------------------------------------------------------------

```
       <message> ::= <message-begin> <struct> <message-end>

 <message-begin> ::= <method-name> <message-type> <message-seqid>

   <method-name> ::= STRING

  <message-type> ::= T_CALL | T_REPLY | T_EXCEPTION | T_ONEWAY

 <message-seqid> ::= I32

        <struct> ::= <struct-begin> <field>* <field-stop> <struct-end>

  <struct-begin> ::= <struct-name>

   <struct-name> ::= STRING

    <field-stop> ::= T_STOP

         <field> ::= <field-begin> <field-data> <field-end>

   <field-begin> ::= <field-name> <field-type> <field-id>

    <field-name> ::= STRING

    <field-type> ::= T_BOOL | T_BYTE | T_I8 | T_I16 | T_I32 | T_I64 | T_DOUBLE
                     | T_STRING | T_BINARY | T_STRUCT | T_MAP | T_SET | T_LIST

      <field-id> ::= I16

    <field-data> ::= I8 | I16 | I32 | I64 | DOUBLE | STRING | BINARY
                     <struct> | <map> | <list> | <set>

           <map> ::= <map-begin> <field-datum>* <map-end>

     <map-begin> ::= <map-key-type> <map-value-type> <map-size>

  <map-key-type> ::= <field-type>

<map-value-type> ::= <field-type>

      <map-size> ::= I32

          <list> ::= <list-begin> <field-data>* <list-end>

    <list-begin> ::= <list-elem-type> <list-size>

<list-elem-type> ::= <field-type>

     <list-size> ::= I32

           <set> ::= <set-begin> <field-data>* <set-end>

     <set-begin> ::= <set-elem-type> <set-size>

 <set-elem-type> ::= <field-type>

      <set-size> ::= I32
```
