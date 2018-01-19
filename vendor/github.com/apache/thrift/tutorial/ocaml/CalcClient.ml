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

open Arg
open Thrift
open Tutorial_types
open Shared_types

exception Die;;
let sod = function
    Some v -> v
  | None -> raise Die;;

type connection = {
  trans : Transport.t ;
  proto : Thrift.Protocol.t;
  calc : Calculator.client ;
}

let connect ~host port =
  let tx = new TSocket.t host port in
  let proto = new TBinaryProtocol.t tx in
  let calc = new Calculator.client proto proto in
    tx#opn;
    { trans = tx ; proto = proto; calc = calc }
;;

let doclient () =
  let cli = connect ~host:"127.0.0.1" 9090 in
  try
    cli.calc#ping ;
    Printf.printf "ping()\n" ; flush stdout ;
    (let sum = cli.calc#add (Int32.of_int 1) (Int32.of_int 1) in
       Printf.printf "1+1=%ld\n" sum ;
       flush stdout) ;
    (let w = new work in
       w#set_op Operation.DIVIDE ;
       w#set_num1 (Int32.of_int 1) ;
       w#set_num2 (Int32.of_int 0) ;
       try
	 let quotient = cli.calc#calculate (Int32.of_int 1) w in
	   Printf.printf "Whoa? We can divide by zero!\n" ; flush stdout
       with InvalidOperation io ->
	 Printf.printf "InvalidOperation: %s\n" io#grab_why ; flush stdout) ;
    (let w = new work in
       w#set_op Operation.SUBTRACT ;
       w#set_num1 (Int32.of_int 15) ;
       w#set_num2 (Int32.of_int 10) ;
       let diff = cli.calc#calculate (Int32.of_int 1) w in
	 Printf.printf "15-10=%ld\n" diff ; flush stdout) ;
    (let ss = cli.calc#getStruct (Int32.of_int 1) in
       Printf.printf "Check log: %s\n" ss#grab_value ; flush stdout) ;
    cli.trans#close
  with Transport.E (_,what) ->
    Printf.printf "ERROR: %s\n" what ; flush stdout
;;

doclient();;
