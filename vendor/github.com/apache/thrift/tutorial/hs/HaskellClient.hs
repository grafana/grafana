--
-- Licensed to the Apache Software Foundation (ASF) under one
-- or more contributor license agreements. See the NOTICE file
-- distributed with this work for additional information
-- regarding copyright ownership. The ASF licenses this file
-- to you under the Apache License, Version 2.0 (the
-- "License"); you may not use this file except in compliance
-- with the License. You may obtain a copy of the License at
--
--   http://www.apache.org/licenses/LICENSE-2.0
--
-- Unless required by applicable law or agreed to in writing,
-- software distributed under the License is distributed on an
-- "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
-- KIND, either express or implied. See the License for the
-- specific language governing permissions and limitations
-- under the License.
--

import qualified Calculator
import qualified Calculator_Client as Client
import qualified SharedService_Client as SClient
import Tutorial_Types
import SharedService_Iface
import Shared_Types

import Thrift
import Thrift.Protocol.Binary
import Thrift.Transport
import Thrift.Transport.Handle
import Thrift.Server

import Control.Exception
import Data.Maybe
import Data.Text.Lazy
import Text.Printf
import Network

main = do
  transport  <- hOpen ("localhost", PortNumber 9090)
  let binProto = BinaryProtocol transport
  let client = (binProto, binProto)

  Client.ping client
  print "ping()"

  sum <- Client.add client 1 1
  printf "1+1=%d\n" sum


  let work = Work { work_op = DIVIDE,
                    work_num1 = 1,
                    work_num2 = 0,
                    work_comment = Nothing
                  }

  Control.Exception.catch (printf "1/0=%d\n" =<< Client.calculate client 1 work)
        (\e -> printf "InvalidOperation %s\n" (show (e :: InvalidOperation)))


  let work = Work { work_op = SUBTRACT,
                    work_num1 = 15,
                    work_num2 = 10,
                    work_comment = Nothing
                  }

  diff <- Client.calculate client 1 work
  printf "15-10=%d\n" diff

  log <- SClient.getStruct client 1
  printf "Check log: %s\n" $ unpack $ sharedStruct_value log

  -- Close!
  tClose transport


