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

module ThriftTestUtils (ClientFunc, ServerFunc, clientLog, serverLog, testLog, runTest) where


import qualified Control.Concurrent
import qualified Network
import qualified System.IO


serverPort :: Network.PortNumber
serverPort = 9090

serverAddress :: (String, Network.PortID)
serverAddress = ("localhost", Network.PortNumber serverPort)


testLog :: String -> IO ()
testLog str = do
    System.IO.hPutStr System.IO.stdout $ str ++ "\n"
    System.IO.hFlush System.IO.stdout


clientLog :: String -> IO ()
clientLog str = testLog $ "CLIENT: " ++ str

serverLog :: String -> IO ()
serverLog str = testLog $ "SERVER: " ++ str


type ServerFunc = Network.PortNumber -> IO ()
type ClientFunc = (String, Network.PortID) -> IO ()

runTest :: ServerFunc -> ClientFunc -> IO ()
runTest server client = do
    _ <- Control.Concurrent.forkIO (server serverPort)

    -- Fairly horrible; this does not 100% guarantees that the other thread
    -- has actually opened the socket we need... but not much else we can do
    -- without this, the client races the server to the socket, and wins every
    -- time
    Control.Concurrent.yield
    Control.Concurrent.threadDelay $ 500 * 1000 -- unit is in _micro_seconds
    Control.Concurrent.yield

    client serverAddress

    testLog "SUCCESS"
