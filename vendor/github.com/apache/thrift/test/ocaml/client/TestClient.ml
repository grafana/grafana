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

open Thrift;;
open ThriftTest_types;;

let s = new TSocket.t "127.0.0.1" 9090;;
let p = new TBinaryProtocol.t s;;
let c = new ThriftTest.client p p;;
let sod = function
    Some v -> v
  | None -> raise Thrift_error;;

s#opn;
print_string (c#testString "bya");
print_char '\n';
print_int (c#testByte 8);
print_char '\n';
print_int (c#testByte (-8));
print_char '\n';
print_int (c#testI32 32);
print_char '\n';
print_string (Int64.to_string (c#testI64 64L));
print_char '\n';
print_float (c#testDouble 3.14);
print_char '\n';

let l = [1;2;3;4] in
  if l = (c#testList l) then print_string "list ok\n" else print_string "list fail\n";;
let h = Hashtbl.create 5 in
let a = Hashtbl.add h in
  for i=1 to 10 do
    a i (10*i)
  done;
  let r = c#testMap h in
    for i=1 to 10 do
      try
        let g = Hashtbl.find r i in
          print_int i;
          print_char ' ';
          print_int g;
          print_char '\n'
      with Not_found -> print_string ("Can't find "^(string_of_int i)^"\n")
    done;;

let s = Hashtbl.create 5 in
let a = Hashtbl.add s in
  for i = 1 to 10 do
    a i true
  done;
  let r = c#testSet s in
    for i = 1 to 10 do
      try
        let g = Hashtbl.find r i in
          print_int i;
          print_char '\n'
      with Not_found -> print_string ("Can't find "^(string_of_int i)^"\n")
    done;;
try
  c#testException "Xception"
with Xception _ -> print_string "testException ok\n";;
try
  ignore(c#testMultiException "Xception" "bya")
with Xception e -> Printf.printf "%d %s\n" (sod e#get_errorCode) (sod e#get_message);;


