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

{-# LANGUAGE OverloadedStrings,RecordWildCards #-}
module Main where

import Control.Exception
import Control.Monad
import Data.Functor
import Data.HashMap.Strict (HashMap)
import Data.List
import Data.List.Split
import Data.String
import Network
import System.Environment
import System.Exit
import System.IO
import Control.Concurrent (threadDelay)
import qualified System.IO as IO
import qualified Data.HashMap.Strict as Map
import qualified Data.HashSet as Set
import qualified Data.Text.Lazy as Text
import qualified Data.Vector as Vector

import ThriftTest
import ThriftTest_Iface
import ThriftTest_Types

import Thrift
import Thrift.Server
import Thrift.Transport.Framed
import Thrift.Transport.Handle
import Thrift.Protocol.Binary
import Thrift.Protocol.Compact
import Thrift.Protocol.JSON

data Options = Options
  { port         :: Int
  , domainSocket :: String
  , serverType   :: ServerType
  , transport    :: String
  , protocol     :: ProtocolType
  , ssl          :: Bool
  , workers      :: Int
  }

data ServerType = Simple
                | ThreadPool
                | Threaded
                | NonBlocking
                deriving (Show, Eq)

instance IsString ServerType where
  fromString "simple"      = Simple
  fromString "thread-pool" = ThreadPool
  fromString "threaded"    = Threaded
  fromString "nonblocking" = NonBlocking
  fromString _ = error "not a valid server type"

data TransportType = Buffered (Socket -> (IO IO.Handle))
                   | Framed (Socket -> (IO (FramedTransport IO.Handle)))
                   | NoTransport String

getTransport :: String -> TransportType
getTransport "buffered" = Buffered $ \s -> do
  (h, _, _) <- (accept s)
  IO.hSetBuffering h $ IO.BlockBuffering Nothing
  return h
getTransport "framed" = Framed $ \s -> do
  (h, _, _) <- (accept s)
  openFramedTransport h
getTransport t = NoTransport $ "Unsupported transport: " ++ t

data ProtocolType = Binary
                  | Compact
                  | JSON

getProtocol :: String -> ProtocolType
getProtocol "binary"  = Binary
getProtocol "compact" = Compact
getProtocol "json"    = JSON
getProtocol p = error $"Unsupported Protocol: " ++ p

defaultOptions :: Options
defaultOptions = Options
  { port         = 9090
  , domainSocket = ""
  , serverType   = Threaded
  , transport    = "buffered"
  , protocol     = Binary
  -- TODO: Haskell lib does not have SSL support
  , ssl          = False
  , workers      = 4
  }

stringifyMap :: (Show a, Show b) => Map.HashMap a b -> String
stringifyMap = Data.List.intercalate ", " . Data.List.map joinKV . Map.toList
  where joinKV (k, v) = show k ++ " => " ++ show v

stringifySet :: Show a => Set.HashSet a -> String
stringifySet = Data.List.intercalate ", " . Data.List.map show . Set.toList

stringifyList :: Show a => Vector.Vector a -> String
stringifyList = Data.List.intercalate ", " . Data.List.map show . Vector.toList

data TestHandler = TestHandler
instance ThriftTest_Iface TestHandler where
  testVoid _ = System.IO.putStrLn "testVoid()"

  testString _ s = do
    System.IO.putStrLn $ "testString(" ++ show s ++ ")"
    return s

  testBool _ x = do
    System.IO.putStrLn $ "testBool(" ++ show x ++ ")"
    return x

  testByte _ x = do
    System.IO.putStrLn $ "testByte(" ++ show x ++ ")"
    return x

  testI32 _ x = do
    System.IO.putStrLn $ "testI32(" ++ show x ++ ")"
    return x

  testI64 _ x = do
    System.IO.putStrLn $ "testI64(" ++ show x ++ ")"
    return x

  testDouble _ x = do
    System.IO.putStrLn $ "testDouble(" ++ show x ++ ")"
    return x

  testBinary _ x = do
    System.IO.putStrLn $ "testBinary(" ++ show x ++ ")"
    return x

  testStruct _ struct@Xtruct{..} = do
    System.IO.putStrLn $ "testStruct({" ++ show xtruct_string_thing
                      ++ ", " ++ show xtruct_byte_thing
                      ++ ", " ++ show xtruct_i32_thing
                      ++ ", " ++ show xtruct_i64_thing
                      ++ "})"
    return struct

  testNest _ nest@Xtruct2{..} = do
    let Xtruct{..} = xtruct2_struct_thing
    System.IO.putStrLn $ "testNest({" ++ show xtruct2_byte_thing
                   ++ "{, " ++ show xtruct_string_thing
                   ++  ", " ++ show xtruct_byte_thing
                   ++  ", " ++ show xtruct_i32_thing
                   ++  ", " ++ show xtruct_i64_thing
                   ++ "}, " ++ show xtruct2_i32_thing
    return nest

  testMap _ m = do
    System.IO.putStrLn $ "testMap({" ++ stringifyMap m ++ "})"
    return m

  testStringMap _ m = do
    System.IO.putStrLn $ "testStringMap(" ++ stringifyMap m ++ "})"
    return m

  testSet _ x = do
    System.IO.putStrLn $ "testSet({" ++ stringifySet x ++ "})"
    return x

  testList _ x = do
    System.IO.putStrLn $ "testList(" ++ stringifyList x ++ "})"
    return x

  testEnum _ x = do
    System.IO.putStrLn $ "testEnum(" ++ show x ++ ")"
    return x

  testTypedef _ x = do
    System.IO.putStrLn $ "testTypedef(" ++ show x ++ ")"
    return x

  testMapMap _ x = do
    System.IO.putStrLn $ "testMapMap(" ++ show x ++ ")"
    return $ Map.fromList [ (-4, Map.fromList [ (-4, -4)
                                              , (-3, -3)
                                              , (-2, -2)
                                              , (-1, -1)
                                              ])
                          , (4,  Map.fromList [ (1, 1)
                                              , (2, 2)
                                              , (3, 3)
                                              , (4, 4)
                                              ])
                          ]

  testInsanity _ x = do
    System.IO.putStrLn "testInsanity()"
    return $ Map.fromList [ (1, Map.fromList [ (TWO  , x)
                                             , (THREE, x)
                                             ])
                          , (2, Map.fromList [ (SIX, default_Insanity)
                                             ])
                          ]

  testMulti _ byte i32 i64 _ _ _ = do
    System.IO.putStrLn "testMulti()"
    return Xtruct{ xtruct_string_thing = Text.pack "Hello2"
                 , xtruct_byte_thing   = byte
                 , xtruct_i32_thing    = i32
                 , xtruct_i64_thing    = i64
                 }

  testException _ s = do
    System.IO.putStrLn $ "testException(" ++ show s ++ ")"
    case s of
      "Xception"   -> throw $ Xception 1001 s
      "TException" -> throw ThriftException
      _ -> return ()

  testMultiException _ s1 s2 = do
    System.IO.putStrLn $ "testMultiException(" ++ show s1 ++ ", " ++ show s2 ++  ")"
    case s1 of
      "Xception"   -> throw $ Xception 1001 "This is an Xception"
      "Xception2"  -> throw $ Xception2 2002 $ Xtruct "This is an Xception2" 0 0 0
      "TException" -> throw ThriftException
      _ -> return default_Xtruct{ xtruct_string_thing = s2 }

  testOneway _ i = do
    System.IO.putStrLn $ "testOneway(" ++ show i ++ "): Sleeping..."
    threadDelay $ (fromIntegral i) * 1000000
    System.IO.putStrLn $ "testOneway(" ++ show i ++ "): done sleeping!"

main :: IO ()
main = do
  options <- flip parseFlags defaultOptions <$> getArgs
  case options of
    Nothing -> showHelp
    Just Options{..} -> do
      case Main.getTransport transport of
        Buffered f -> runServer protocol f port
        Framed   f -> runServer protocol f port
        NoTransport err -> putStrLn err
      System.IO.putStrLn $ "Starting \"" ++ show serverType ++ "\" server (" ++
        show transport ++ ") listen on: " ++ domainSocket ++ show port
      where
        acceptor p f socket = do
          t <- f socket
          return (p t, p t)

        doRunServer p f = do
          runThreadedServer (acceptor p f) TestHandler ThriftTest.process . PortNumber . fromIntegral

        runServer p f port = case p of
          Binary  -> do doRunServer BinaryProtocol f port
          Compact -> do doRunServer CompactProtocol f port
          JSON    -> do doRunServer JSONProtocol f port

parseFlags :: [String] -> Options -> Maybe Options
parseFlags (flag : flags) opts = do
  let pieces = splitOn "=" flag
  case pieces of
    "--port" : arg : _ -> parseFlags flags opts{ port = read arg }
    "--domain-socket" : arg : _ -> parseFlags flags opts{ domainSocket = read arg }
    "--server-type" : arg : _ -> parseFlags flags opts{ serverType = fromString arg }
    "--transport" : arg : _ -> parseFlags flags opts{ transport = arg }
    "--protocol" : arg : _ -> parseFlags flags opts{ protocol = getProtocol arg }
    "--workers" : arg : _ -> parseFlags flags opts{ workers = read arg }
    "-n" : arg : _ -> parseFlags flags opts{ workers = read arg }
    "--h" : _ -> Nothing
    "--help" : _ -> Nothing
    "--ssl" : _ -> parseFlags flags opts{ ssl = True }
    "--processor-events" : _ -> parseFlags flags opts
    _ -> Nothing
parseFlags [] opts = Just opts

showHelp :: IO ()
showHelp = System.IO.putStrLn
  "Allowed options:\n\
  \  -h [ --help ]               produce help message\n\
  \  --port arg (=9090)          Port number to listen\n\
  \  --domain-socket arg         Unix Domain Socket (e.g. /tmp/ThriftTest.thrift)\n\
  \  --server-type arg (=simple) type of server, \"simple\", \"thread-pool\",\n\
  \                              \"threaded\", or \"nonblocking\"\n\
  \  --transport arg (=buffered) transport: buffered, framed\n\
  \  --protocol arg (=binary)    protocol: binary, compact, json\n\
  \  --ssl                       Encrypted Transport using SSL\n\
  \  --processor-events          processor-events\n\
  \  -n [ --workers ] arg (=4)   Number of thread pools workers. Only valid for\n\
  \                              thread-pool server type"
