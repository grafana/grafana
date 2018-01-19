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

class calc_handler =
object (self)
  inherit Calculator.iface
  val log = Hashtbl.create 23
  method ping  = Printf.printf "ping()\n" ; flush stdout
  method add a b =
    Printf.printf"add(%ld,%ld)\n" (sod a) (sod b); flush stdout ;
    Int32.add (sod a) (sod b)
  method calculate logid w =
    let w = sod w in
      Printf.printf "calculate(%ld,{%ld,%ld,%ld})\n" (sod logid) (Operation.to_i w#grab_op) w#grab_num1 w#grab_num2; flush stdout ;
    let rv =
      match w#grab_op with
	  Operation.ADD ->
	    Int32.add w#grab_num1 w#grab_num2
	| Operation.SUBTRACT ->
	    Int32.sub w#grab_num1 w#grab_num2
	| Operation.MULTIPLY ->
	    Int32.mul w#grab_num1 w#grab_num2
	| Operation.DIVIDE ->
	    if w#grab_num2 = Int32.zero then
	      let io = new invalidOperation in
		io#set_whatOp (Operation.to_i w#grab_op) ;
		io#set_why "Cannot divide by 0" ;
		raise (InvalidOperation io)
	    else
	      Int32.div w#grab_num1 w#grab_num2 in

    let ss = new sharedStruct in
      ss#set_key (sod logid) ;
    let buffer = Int32.to_string rv in
      ss#set_value buffer ;
      Hashtbl.add log (sod logid) ss ;
      rv

  method zip =
    Printf.printf "zip()\n"; flush stdout

  method getStruct logid =
    Printf.printf "getStruct(%ld)\n" (sod logid) ; flush stdout ;
    Hashtbl.find log (sod logid)

end

let doserver () =
  let h = new calc_handler in
  let proc = new Calculator.processor h in
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
;;

doserver();;
