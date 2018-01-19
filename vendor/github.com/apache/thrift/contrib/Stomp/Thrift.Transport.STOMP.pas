(*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *)

unit Thrift.Transport.STOMP;

interface

uses
  Classes,Windows, SysUtils,
  Thrift,
  Thrift.Transport,
  Thrift.Protocol,
  Thrift.Stream,
  StompClient,
  StompTypes;

type
  TStompTransportImpl = class( TStreamTransportImpl)
  strict private
    FData     : TStringStream;
    FServer   : string;
    FOutQueue : string;
    FStompCli : IStompClient;
  protected
    function GetIsOpen: Boolean; override;
    function Peek: Boolean; override;
  public
    constructor Create( const aServerAndPort, aOutQueue : string);
    destructor Destroy;  override;

    procedure Open();  override;
    procedure Close();  override;
    procedure Flush;  override;
  end;


  TStompServerTransportImpl = class( TServerTransportImpl)
  strict private
    FServer  : string;
    FInQueue : string;
    FClient  : IStompClient;
  protected
    procedure Listen; override;
    procedure Close; override;
    function Accept( const fnAccepting: TProc): ITransport; override;
  public
    constructor Create( const aServerAndPort, aInQueue : string);
    destructor Destroy;  override;
  end;


const
  QUEUE_PREFIX    = '/queue/';
  TOPIC_PREFIX    = '/topic/';
  EXCHANGE_PREFIX = '/exchange/';


implementation



constructor TStompTransportImpl.Create( const aServerAndPort, aOutQueue : string);
var adapter : IThriftStream;
begin
  FData     := TStringStream.Create;
  FServer   := aServerAndPort;
  FOutQueue := aOutQueue;

  adapter := TThriftStreamAdapterDelphi.Create( FData, FALSE);
  inherited Create( nil, adapter);  // output only
end;


destructor TStompTransportImpl.Destroy;
begin
  inherited Destroy;
  FreeAndNil( FData);
  FStompCli := nil;
end;


function TStompTransportImpl.GetIsOpen: Boolean;
begin
  result := (FStompCli <> nil);
end;


function TStompTransportImpl.Peek: Boolean;
begin
  result := FALSE;  // output only
end;


procedure TStompTransportImpl.Open;
begin
  if FStompCli <> nil
  then raise TTransportException.Create( TTransportException.TExceptionType.AlreadyOpen, 'already open')
  else FStompCli := StompUtils.NewStomp( FServer);
end;


procedure TStompTransportImpl.Close;
begin
  FStompCli := nil;
  FData.Clear;
end;


procedure TStompTransportImpl.Flush;
begin
  if FStompCli = nil
  then raise TTransportException.Create( TTransportException.TExceptionType.NotOpen, 'not open');

  FStompCli.Send( FOutQueue, FData.DataString);
  FData.Clear;
end;


//--- TStompServerTransportImpl --------------------------------------------


constructor TStompServerTransportImpl.Create( const aServerAndPort, aInQueue : string);
begin
  inherited Create;
  FServer  := aServerAndPort;
  FInQueue := aInQueue;
end;


destructor TStompServerTransportImpl.Destroy;
begin
  try
    Close;
  finally
    inherited Destroy;
  end;
end;


procedure TStompServerTransportImpl.Listen;
begin
  FClient := StompUtils.NewStomp(FServer);
  FClient.Subscribe( FInQueue);
end;


procedure TStompServerTransportImpl.Close;
begin
  if FClient <> nil then begin
    FClient.Unsubscribe( FInQueue);
    FClient := nil;
  end;
end;


function TStompServerTransportImpl.Accept( const fnAccepting: TProc): ITransport;
var frame   : IStompFrame;
    adapter : IThriftStream;
    stream  : TStringStream;
begin
  if FClient = nil
  then raise TTransportException.Create( TTransportException.TExceptionType.NotOpen,
                                         'Not connected.');

  if Assigned(fnAccepting)
  then fnAccepting();

  try
    frame := FClient.Receive(MAXINT);
    if frame = nil then Exit(nil);

    stream  := TStringStream.Create( frame.GetBody);
    adapter := TThriftStreamAdapterDelphi.Create( stream, TRUE);
    result  := TStreamTransportImpl.Create( adapter, nil);

  except
    on E: Exception
    do raise TTransportException.Create( E.ToString );
  end;
end;


end.

