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

module T = Transport

class t host port=
object (self)
  inherit T.t
  val mutable chans = None
  method isOpen = chans != None
  method opn =
    try
      let addr = (let {Unix.h_addr_list=x} = Unix.gethostbyname host in x.(0)) in
        chans <- Some(Unix.open_connection (Unix.ADDR_INET (addr,port)))
    with
        Unix.Unix_error (e,fn,_) -> raise (T.E (T.NOT_OPEN, ("TSocket: Could not connect to "^host^":"^(string_of_int port)^" because: "^fn^":"^(Unix.error_message e))))
      | _ -> raise (T.E (T.NOT_OPEN, ("TSocket: Could not connect to "^host^":"^(string_of_int port))))

  method close =
    match chans with
        None -> ()
      | Some(inc,out) -> (Unix.shutdown_connection inc;
                          close_in inc;
                          chans <- None)
  method read buf off len = match chans with
      None -> raise (T.E (T.NOT_OPEN, "TSocket: Socket not open"))
    | Some(i,o) ->
        try
          really_input i buf off len; len
        with
            Unix.Unix_error (e,fn,_) -> raise (T.E (T.UNKNOWN, ("TSocket: Could not read "^(string_of_int len)^" from "^host^":"^(string_of_int port)^" because: "^fn^":"^(Unix.error_message e))))
          | _ -> raise (T.E (T.UNKNOWN, ("TSocket: Could not read "^(string_of_int len)^" from "^host^":"^(string_of_int port))))
  method write buf off len = match chans with
      None -> raise (T.E (T.NOT_OPEN, "TSocket: Socket not open"))
    | Some(i,o) -> output o buf off len
  method flush = match chans with
      None -> raise (T.E (T.NOT_OPEN, "TSocket: Socket not open"))
    | Some(i,o) -> flush o
end


