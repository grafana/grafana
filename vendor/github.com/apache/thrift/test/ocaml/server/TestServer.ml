(*
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
*)

open Thrift
open ThriftTest_types

let p = Printf.printf;;
exception Die;;
let sod = function
    Some v -> v
  | None -> raise Die;;


class test_handler =
object (self)
  inherit ThriftTest.iface
  method testVoid = p "testVoid()\n"
  method testString x = p "testString(%s)\n" (sod x); (sod x)
  method testByte x = p "testByte(%d)\n" (sod x); (sod x)
  method testI32 x = p "testI32(%d)\n" (sod x); (sod x)
  method testI64 x = p "testI64(%s)\n" (Int64.to_string (sod x)); (sod x)
  method testDouble x = p "testDouble(%f)\n" (sod x); (sod x)
  method testBinary x = p "testBinary(%s)\n" (sod x); (sod x)
  method testStruct x = p "testStruct(---)\n"; (sod x)
  method testNest x = p "testNest(---)\n"; (sod x)
  method testMap x = p "testMap(---)\n"; (sod x)
  method testSet x = p "testSet(---)\n"; (sod x)
  method testList x = p "testList(---)\n"; (sod x)
  method testEnum x = p "testEnum(---)\n"; (sod x)
  method testTypedef x = p "testTypedef(---)\n"; (sod x)
  method testMapMap x = p "testMapMap(%d)\n" (sod x);
    let mm = Hashtbl.create 3 in
    let pos = Hashtbl.create 7 in
    let neg = Hashtbl.create 7 in
      for i=1 to 4 do
        Hashtbl.add pos i i;
        Hashtbl.add neg (-i) (-i);
      done;
      Hashtbl.add mm 4 pos;
      Hashtbl.add mm (-4) neg;
      mm
  method testInsanity x = p "testInsanity()\n";
    p "testinsanity()\n";
    let hello = new xtruct in
    let goodbye = new xtruct in
    let crazy = new insanity in
    let looney = new insanity in
    let cumap = Hashtbl.create 7 in
    let insane = Hashtbl.create 7 in
    let firstmap = Hashtbl.create 7 in
    let secondmap = Hashtbl.create 7 in
      hello#set_string_thing "Hello2";
      hello#set_byte_thing 2;
      hello#set_i32_thing 2;
      hello#set_i64_thing 2L;
      goodbye#set_string_thing "Goodbye4";
      goodbye#set_byte_thing 4;
      goodbye#set_i32_thing 4;
      goodbye#set_i64_thing 4L;
      Hashtbl.add cumap Numberz.EIGHT 8L;
      Hashtbl.add cumap Numberz.FIVE 5L;
      crazy#set_userMap cumap;
      crazy#set_xtructs [goodbye; hello];
      Hashtbl.add firstmap Numberz.TWO crazy;
      Hashtbl.add firstmap Numberz.THREE crazy;
      Hashtbl.add secondmap Numberz.SIX looney;
      Hashtbl.add insane 1L firstmap;
      Hashtbl.add insane 2L secondmap;
      insane
  method testMulti a0 a1 a2 a3 a4 a5 =
    p "testMulti()\n";
    let hello = new xtruct in
      hello#set_string_thing "Hello2";
      hello#set_byte_thing (sod a0);
      hello#set_i32_thing (sod a1);
      hello#set_i64_thing (sod a2);
      hello
  method testException s =
    p "testException(%S)\n" (sod s);
    if (sod s) = "Xception" then
      let x = new xception in
        x#set_errorCode 1001;
        x#set_message "This is an Xception";
        raise (Xception x)
    else ()
  method testMultiException a0 a1 =
    p "testMultiException(%S, %S)\n" (sod a0) (sod a1);
    if (sod a0) = "Xception" then
      let x = new xception in
        x#set_errorCode 1001;
        x#set_message "This is an Xception";
        raise (Xception x)
    else (if (sod a0) = "Xception2" then
              let x = new xception2 in
              let s = new xtruct in
                x#set_errorCode 2002;
                s#set_string_thing "This as an Xception2";
                x#set_struct_thing s;
                raise (Xception2 x)
          else ());
    let res = new xtruct in
      res#set_string_thing (sod a1);
      res
  method testOneway i =
    Unix.sleep (sod i)
end;;

let h = new test_handler in
let proc = new ThriftTest.processor h in
let port = 9090 in
let pf = new TBinaryProtocol.factory in
let server = new TThreadedServer.t
  proc
  (new TServerSocket.t port)
  (new Transport.factory)
  pf
  pf
in
  server#serve


