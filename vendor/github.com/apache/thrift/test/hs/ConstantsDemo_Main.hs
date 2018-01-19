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

module Main where


import qualified Control.Exception
import qualified Network

import Thrift.Protocol.Binary
import Thrift.Server
import Thrift.Transport.Handle

import qualified ThriftTestUtils

import qualified Yowza
import qualified Yowza_Client as Client
import qualified Yowza_Iface as Iface


data YowzaHandler = YowzaHandler
instance Iface.Yowza_Iface YowzaHandler where
    blingity _ = do
        ThriftTestUtils.serverLog "SERVER: Got blingity"
        return ()

    blangity _ = do
        ThriftTestUtils.serverLog "SERVER: Got blangity"
        return $ 31


client :: (String, Network.PortID) -> IO ()
client addr = do
    to <- hOpen addr
    let ps = (BinaryProtocol to, BinaryProtocol to)

    Client.blingity ps

    rv <- Client.blangity ps
    ThriftTestUtils.clientLog $ show rv

    tClose to

server :: Network.PortNumber -> IO ()
server port = do 
    ThriftTestUtils.serverLog "Ready..."
    (runBasicServer YowzaHandler Yowza.process port)
    `Control.Exception.catch`
    (\(TransportExn s _) -> error $ "FAILURE: " ++ show s)

main :: IO ()
main = ThriftTestUtils.runTest server client
