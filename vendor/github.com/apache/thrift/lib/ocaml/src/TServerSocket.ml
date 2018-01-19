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

class t port =
object
  inherit Transport.server_t
  val mutable sock = None
  method listen =
    let s = Unix.socket Unix.PF_INET Unix.SOCK_STREAM 0 in
      sock <- Some s;
      Unix.bind s (Unix.ADDR_INET (Unix.inet_addr_any, port));
      Unix.listen s 256
  method close =
    match sock with
        Some s -> Unix.shutdown s Unix.SHUTDOWN_ALL; Unix.close s;
          sock <- None
      | _ -> ()
  method acceptImpl =
    match sock with
        Some s -> let (fd,_) = Unix.accept s in
                    new TChannelTransport.t (Unix.in_channel_of_descr fd,Unix.out_channel_of_descr fd)
      | _ -> raise (Transport.E (Transport.NOT_OPEN,"TServerSocket: Not listening but tried to accept"))
end
