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

class t (i,o) =
object (self)
  val mutable opened = true
  inherit Transport.t
  method isOpen = opened
  method opn = ()
  method close = close_in i; opened <- false
  method read buf off len =
    if opened then
      try
        really_input i buf off len; len
      with _ -> raise (T.E (T.UNKNOWN, ("TChannelTransport: Could not read "^(string_of_int len))))
    else
      raise (T.E (T.NOT_OPEN, "TChannelTransport: Channel was closed"))
  method write buf off len = output o buf off len
  method flush = flush o
end
