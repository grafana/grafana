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

class t
  (pf : Processor.t)
  (st : Transport.server_t)
  (tf : Transport.factory)
  (ipf : Protocol.factory)
  (opf : Protocol.factory)=
object
  inherit TServer.t pf st tf ipf opf
  method serve =
    st#listen;
    while true do
      let tr = tf#getTransport (st#accept) in
        ignore (Thread.create
          (fun _ ->
             let ip = ipf#getProtocol tr in
             let op = opf#getProtocol tr in
               try
                 while pf#process ip op do
                   ()
                 done
               with _ -> ()) ())
    done
end

