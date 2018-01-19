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
unit Thrift.Transport;

{$I Thrift.Defines.inc}
{$SCOPEDENUMS ON}

interface

uses
  Classes,
  SysUtils,
  Math,
  Generics.Collections,
  {$IFDEF OLD_UNIT_NAMES}
    ActiveX, msxml, WinSock, Sockets,
  {$ELSE}
    Winapi.ActiveX, Winapi.msxml, Winapi.WinSock,
    {$IFDEF OLD_SOCKETS}
      Web.Win.Sockets,
    {$ELSE}
      Thrift.Socket,
    {$ENDIF}
  {$ENDIF}
  Thrift.Collections,
  Thrift.Utils,
  Thrift.Stream;

type
  ITransport = interface
    ['{A4A9FC37-D620-44DC-AD21-662D16364CE4}']
    function GetIsOpen: Boolean;
    property IsOpen: Boolean read GetIsOpen;
    function Peek: Boolean;
    procedure Open;
    procedure Close;
    function Read(var buf: TBytes; off: Integer; len: Integer): Integer;
    function ReadAll(var buf: TBytes; off: Integer; len: Integer): Integer;
    procedure Write( const buf: TBytes); overload;
    procedure Write( const buf: TBytes; off: Integer; len: Integer); overload;
    procedure Flush;
  end;

  TTransportImpl = class( TInterfacedObject, ITransport)
  protected
    function GetIsOpen: Boolean; virtual; abstract;
    property IsOpen: Boolean read GetIsOpen;
    function Peek: Boolean; virtual;
    procedure Open(); virtual; abstract;
    procedure Close(); virtual; abstract;
    function Read(var buf: TBytes; off: Integer; len: Integer): Integer; virtual; abstract;
    function ReadAll(var buf: TBytes; off: Integer; len: Integer): Integer; virtual;
    procedure Write( const buf: TBytes); overload; virtual;
    procedure Write( const buf: TBytes; off: Integer; len: Integer); overload; virtual; abstract;
    procedure Flush; virtual;
  end;

  TTransportException = class( Exception )
  public
    type
      TExceptionType = (
        Unknown,
        NotOpen,
        AlreadyOpen,
        TimedOut,
        EndOfFile,
        BadArgs,
        Interrupted
      );
  private
    function GetType: TExceptionType;
  protected
    constructor HiddenCreate(const Msg: string);
  public
    class function Create( AType: TExceptionType): TTransportException; overload; deprecated 'Use specialized TTransportException types (or regenerate from IDL)';
    class function Create( const msg: string): TTransportException; reintroduce; overload; deprecated 'Use specialized TTransportException types (or regenerate from IDL)';
    class function Create( AType: TExceptionType; const msg: string): TTransportException; overload; deprecated 'Use specialized TTransportException types (or regenerate from IDL)';
    property Type_: TExceptionType read GetType;
  end;

  // Needed to remove deprecation warning
  TTransportExceptionSpecialized = class abstract (TTransportException)
  public
    constructor Create(const Msg: string);
  end;

  TTransportExceptionUnknown = class (TTransportExceptionSpecialized);
  TTransportExceptionNotOpen = class (TTransportExceptionSpecialized);
  TTransportExceptionAlreadyOpen = class (TTransportExceptionSpecialized);
  TTransportExceptionTimedOut = class (TTransportExceptionSpecialized);
  TTransportExceptionEndOfFile = class (TTransportExceptionSpecialized);
  TTransportExceptionBadArgs = class (TTransportExceptionSpecialized);
  TTransportExceptionInterrupted = class (TTransportExceptionSpecialized);

  IHTTPClient = interface( ITransport )
    ['{0F5DB8AB-710D-4338-AAC9-46B5734C5057}']
    procedure SetConnectionTimeout(const Value: Integer);
    function GetConnectionTimeout: Integer;
    procedure SetReadTimeout(const Value: Integer);
    function GetReadTimeout: Integer;
    function GetCustomHeaders: IThriftDictionary<string,string>;
    procedure SendRequest;
    property ConnectionTimeout: Integer read GetConnectionTimeout write SetConnectionTimeout;
    property ReadTimeout: Integer read GetReadTimeout write SetReadTimeout;
    property CustomHeaders: IThriftDictionary<string,string> read GetCustomHeaders;
  end;

  THTTPClientImpl = class( TTransportImpl, IHTTPClient)
  private
    FUri : string;
    FInputStream : IThriftStream;
    FOutputStream : IThriftStream;
    FConnectionTimeout : Integer;
    FReadTimeout : Integer;
    FCustomHeaders : IThriftDictionary<string,string>;

    function CreateRequest: IXMLHTTPRequest;
  protected
    function GetIsOpen: Boolean; override;
    procedure Open(); override;
    procedure Close(); override;
    function Read( var buf: TBytes; off: Integer; len: Integer): Integer; override;
    procedure Write( const buf: TBytes; off: Integer; len: Integer); override;
    procedure Flush; override;

    procedure SetConnectionTimeout(const Value: Integer);
    function GetConnectionTimeout: Integer;
    procedure SetReadTimeout(const Value: Integer);
    function GetReadTimeout: Integer;
    function GetCustomHeaders: IThriftDictionary<string,string>;
    procedure SendRequest;
    property ConnectionTimeout: Integer read GetConnectionTimeout write SetConnectionTimeout;
    property ReadTimeout: Integer read GetReadTimeout write SetReadTimeout;
    property CustomHeaders: IThriftDictionary<string,string> read GetCustomHeaders;
  public
    constructor Create( const AUri: string);
    destructor Destroy; override;
  end;

  IServerTransport = interface
    ['{C43B87ED-69EA-47C4-B77C-15E288252900}']
    procedure Listen;
    procedure Close;
    function Accept( const fnAccepting: TProc): ITransport;
  end;

  TServerTransportImpl = class( TInterfacedObject, IServerTransport)
  protected
    procedure Listen; virtual; abstract;
    procedure Close; virtual; abstract;
    function Accept( const fnAccepting: TProc): ITransport;  virtual; abstract;
  end;

  ITransportFactory = interface
    ['{DD809446-000F-49E1-9BFF-E0D0DC76A9D7}']
    function GetTransport( const ATrans: ITransport): ITransport;
  end;

  TTransportFactoryImpl = class( TInterfacedObject, ITransportFactory)
    function GetTransport( const ATrans: ITransport): ITransport; virtual;
  end;

  TTcpSocketStreamImpl = class( TThriftStreamImpl )
{$IFDEF OLD_SOCKETS}
  private type
    TWaitForData = ( wfd_HaveData, wfd_Timeout, wfd_Error);
  private
    FTcpClient : TCustomIpClient;
    FTimeout : Integer;
    function Select( ReadReady, WriteReady, ExceptFlag: PBoolean;
                     TimeOut: Integer; var wsaError : Integer): Integer;
    function WaitForData( TimeOut : Integer; pBuf : Pointer; DesiredBytes: Integer;
                          var wsaError, bytesReady : Integer): TWaitForData;
{$ELSE}
    FTcpClient: TSocket;
  protected const
    SLEEP_TIME = 200;
{$ENDIF}
  protected
    procedure Write( const buffer: TBytes; offset: Integer; count: Integer); override;
    function Read( var buffer: TBytes; offset: Integer; count: Integer): Integer; override;
    procedure Open; override;
    procedure Close; override;
    procedure Flush; override;

    function IsOpen: Boolean; override;
    function ToArray: TBytes; override;
  public
{$IFDEF OLD_SOCKETS}
    constructor Create( const ATcpClient: TCustomIpClient; const aTimeout : Integer = 0);
{$ELSE}
    constructor Create( const ATcpClient: TSocket; const aTimeout : Longword = 0);
{$ENDIF}
  end;

  IStreamTransport = interface( ITransport )
    ['{A8479B47-2A3E-4421-A9A0-D5A9EDCC634A}']
    function GetInputStream: IThriftStream;
    function GetOutputStream: IThriftStream;
    property InputStream : IThriftStream read GetInputStream;
    property OutputStream : IThriftStream read GetOutputStream;
  end;

  TStreamTransportImpl = class( TTransportImpl, IStreamTransport)
  protected
    FInputStream : IThriftStream;
    FOutputStream : IThriftStream;
  protected
    function GetIsOpen: Boolean; override;

    function GetInputStream: IThriftStream;
    function GetOutputStream: IThriftStream;
  public
    property InputStream : IThriftStream read GetInputStream;
    property OutputStream : IThriftStream read GetOutputStream;

    procedure Open; override;
    procedure Close; override;
    procedure Flush; override;
    function Read(var buf: TBytes; off: Integer; len: Integer): Integer; override;
    procedure Write( const buf: TBytes; off: Integer; len: Integer); override;
    constructor Create( const AInputStream : IThriftStream; const AOutputStream : IThriftStream);
    destructor Destroy; override;
  end;

  TBufferedStreamImpl = class( TThriftStreamImpl)
  private
    FStream : IThriftStream;
    FBufSize : Integer;
    FReadBuffer : TMemoryStream;
    FWriteBuffer : TMemoryStream;
  protected
    procedure Write( const buffer: TBytes; offset: Integer; count: Integer); override;
    function Read( var buffer: TBytes; offset: Integer; count: Integer): Integer; override;
    procedure Open;  override;
    procedure Close; override;
    procedure Flush; override;
    function IsOpen: Boolean; override;
    function ToArray: TBytes; override;
  public
    constructor Create( const AStream: IThriftStream; ABufSize: Integer);
    destructor Destroy; override;
  end;

  TServerSocketImpl = class( TServerTransportImpl)
  private
{$IFDEF OLD_SOCKETS}
    FServer : TTcpServer;
    FPort : Integer;
    FClientTimeout : Integer;
{$ELSE}
    FServer: TServerSocket;
{$ENDIF}
    FUseBufferedSocket : Boolean;
    FOwnsServer : Boolean;
  protected
    function Accept( const fnAccepting: TProc) : ITransport; override;
  public
{$IFDEF OLD_SOCKETS}
    constructor Create( const AServer: TTcpServer; AClientTimeout: Integer = 0); overload;
    constructor Create( APort: Integer; AClientTimeout: Integer = 0; AUseBufferedSockets: Boolean = FALSE); overload;
{$ELSE}
    constructor Create( const AServer: TServerSocket; AClientTimeout: Longword = 0); overload;
    constructor Create( APort: Integer; AClientTimeout: Longword = 0; AUseBufferedSockets: Boolean = FALSE); overload;
{$ENDIF}
    destructor Destroy; override;
    procedure Listen; override;
    procedure Close; override;
  end;

  TBufferedTransportImpl = class( TTransportImpl )
  private
    FInputBuffer : IThriftStream;
    FOutputBuffer : IThriftStream;
    FTransport : IStreamTransport;
    FBufSize : Integer;

    procedure InitBuffers;
    function GetUnderlyingTransport: ITransport;
  protected
    function GetIsOpen: Boolean; override;
    procedure Flush; override;
  public
    procedure Open(); override;
    procedure Close(); override;
    function Read(var buf: TBytes; off: Integer; len: Integer): Integer; override;
    procedure Write( const buf: TBytes; off: Integer; len: Integer); override;
    constructor Create( const ATransport : IStreamTransport ); overload;
    constructor Create( const ATransport : IStreamTransport; ABufSize: Integer); overload;
    property UnderlyingTransport: ITransport read GetUnderlyingTransport;
    property IsOpen: Boolean read GetIsOpen;
  end;

  TSocketImpl = class(TStreamTransportImpl)
  private
{$IFDEF OLD_SOCKETS}
    FClient : TCustomIpClient;
{$ELSE}
    FClient: TSocket;
{$ENDIF}
    FOwnsClient : Boolean;
    FHost : string;
    FPort : Integer;
{$IFDEF OLD_SOCKETS}
    FTimeout : Integer;
{$ELSE}
    FTimeout : Longword;
{$ENDIF}

    procedure InitSocket;
  protected
    function GetIsOpen: Boolean; override;
  public
    procedure Open; override;
{$IFDEF OLD_SOCKETS}
    constructor Create( const AClient : TCustomIpClient; aOwnsClient : Boolean; ATimeout: Integer = 0); overload;
    constructor Create( const AHost: string; APort: Integer; ATimeout: Integer = 0); overload;
{$ELSE}
    constructor Create(const AClient: TSocket; aOwnsClient: Boolean); overload;
    constructor Create( const AHost: string; APort: Integer; ATimeout: Longword = 0); overload;
{$ENDIF}
    destructor Destroy; override;
    procedure Close; override;
{$IFDEF OLD_SOCKETS}
    property TcpClient: TCustomIpClient read FClient;
{$ELSE}
    property TcpClient: TSocket read FClient;
{$ENDIF}
    property Host : string read FHost;
    property Port: Integer read FPort;
  end;

  TFramedTransportImpl = class( TTransportImpl)
  private const
    FHeaderSize : Integer = 4;
  private class var
    FHeader_Dummy : array of Byte;
  protected
    FTransport : ITransport;
    FWriteBuffer : TMemoryStream;
    FReadBuffer : TMemoryStream;

    procedure InitWriteBuffer;
    procedure ReadFrame;
  public
    type
      TFactory = class( TTransportFactoryImpl )
      public
        function GetTransport( const ATrans: ITransport): ITransport; override;
      end;

    {$IFDEF HAVE_CLASS_CTOR}
    class constructor Create;
    {$ENDIF}

    constructor Create; overload;
    constructor Create( const ATrans: ITransport); overload;
    destructor Destroy; override;

    procedure Open(); override;
    function GetIsOpen: Boolean; override;

    procedure Close(); override;
    function Read(var buf: TBytes; off: Integer; len: Integer): Integer; override;
    procedure Write( const buf: TBytes; off: Integer; len: Integer); override;
    procedure Flush; override;
  end;

{$IFNDEF HAVE_CLASS_CTOR}
procedure TFramedTransportImpl_Initialize;
{$ENDIF}

const
  DEFAULT_THRIFT_TIMEOUT = 5 * 1000; // ms


implementation

{ TTransportImpl }

procedure TTransportImpl.Flush;
begin
  // nothing to do
end;

function TTransportImpl.Peek: Boolean;
begin
  Result := IsOpen;
end;

function TTransportImpl.ReadAll( var buf: TBytes; off, len: Integer): Integer;
var
  got : Integer;
  ret : Integer;
begin
  got := 0;
  while got < len do begin
    ret := Read( buf, off + got, len - got);
    if ret > 0 
    then Inc( got, ret)
    else raise TTransportExceptionNotOpen.Create( 'Cannot read, Remote side has closed' );
  end;
  Result := got;
end;

procedure TTransportImpl.Write( const buf: TBytes);
begin
  Self.Write( buf, 0, Length(buf) );
end;

{ THTTPClientImpl }

procedure THTTPClientImpl.Close;
begin
  FInputStream := nil;
  FOutputStream := nil;
end;

constructor THTTPClientImpl.Create(const AUri: string);
begin
  inherited Create;
  FUri := AUri;
  FCustomHeaders := TThriftDictionaryImpl<string,string>.Create;
  FOutputStream := TThriftStreamAdapterDelphi.Create( TMemoryStream.Create, True);
end;

function THTTPClientImpl.CreateRequest: IXMLHTTPRequest;
var
  pair : TPair<string,string>;
begin
  {$IF CompilerVersion >= 21.0}
  Result := CoXMLHTTP.Create;
  {$ELSE}
  Result := CoXMLHTTPRequest.Create;
  {$IFEND}

  Result.open('POST', FUri, False, '', '');
  Result.setRequestHeader( 'Content-Type', 'application/x-thrift');
  Result.setRequestHeader( 'Accept', 'application/x-thrift');
  Result.setRequestHeader( 'User-Agent', 'Delphi/IHTTPClient');

  for pair in FCustomHeaders do begin
    Result.setRequestHeader( pair.Key, pair.Value );
  end;
end;

destructor THTTPClientImpl.Destroy;
begin
  Close;
  inherited;
end;

procedure THTTPClientImpl.Flush;
begin
  try
    SendRequest;
  finally
    FOutputStream := nil;
    FOutputStream := TThriftStreamAdapterDelphi.Create( TMemoryStream.Create, True);
  end;
end;

function THTTPClientImpl.GetConnectionTimeout: Integer;
begin
  Result := FConnectionTimeout;
end;

function THTTPClientImpl.GetCustomHeaders: IThriftDictionary<string,string>;
begin
  Result := FCustomHeaders;
end;

function THTTPClientImpl.GetIsOpen: Boolean;
begin
  Result := True;
end;

function THTTPClientImpl.GetReadTimeout: Integer;
begin
  Result := FReadTimeout;
end;

procedure THTTPClientImpl.Open;
begin
  // nothing to do
end;

function THTTPClientImpl.Read( var buf: TBytes; off, len: Integer): Integer;
begin
  if FInputStream = nil then begin
    raise TTransportExceptionNotOpen.Create('No request has been sent');
  end;

  try
    Result := FInputStream.Read( buf, off, len )
  except
    on E: Exception
    do raise TTransportExceptionUnknown.Create(E.Message);
  end;
end;

procedure THTTPClientImpl.SendRequest;
var
  xmlhttp : IXMLHTTPRequest;
  ms : TMemoryStream;
  a : TBytes;
  len : Integer;
begin
  xmlhttp := CreateRequest;

  ms := TMemoryStream.Create;
  try
    a := FOutputStream.ToArray;
    len := Length(a);
    if len > 0 then begin
      ms.WriteBuffer( Pointer(@a[0])^, len);
    end;
    ms.Position := 0;
    xmlhttp.send( IUnknown( TStreamAdapter.Create( ms, soReference )));
    FInputStream := nil;
    FInputStream := TThriftStreamAdapterCOM.Create( IUnknown( xmlhttp.responseStream) as IStream);
  finally
    ms.Free;
  end;
end;

procedure THTTPClientImpl.SetConnectionTimeout(const Value: Integer);
begin
  FConnectionTimeout := Value;
end;

procedure THTTPClientImpl.SetReadTimeout(const Value: Integer);
begin
  FReadTimeout := Value
end;

procedure THTTPClientImpl.Write( const buf: TBytes; off, len: Integer);
begin
  FOutputStream.Write( buf, off, len);
end;

{ TTransportException }

function TTransportException.GetType: TExceptionType;
begin
  if Self is TTransportExceptionNotOpen then Result := TExceptionType.NotOpen
  else if Self is TTransportExceptionAlreadyOpen then Result := TExceptionType.AlreadyOpen
  else if Self is TTransportExceptionTimedOut then Result := TExceptionType.TimedOut
  else if Self is TTransportExceptionEndOfFile then Result := TExceptionType.EndOfFile
  else if Self is TTransportExceptionBadArgs then Result := TExceptionType.BadArgs
  else if Self is TTransportExceptionInterrupted then Result := TExceptionType.Interrupted
  else Result := TExceptionType.Unknown;
end;

constructor TTransportException.HiddenCreate(const Msg: string);
begin
  inherited Create(Msg);
end;

class function TTransportException.Create(AType: TExceptionType): TTransportException;
begin
  //no inherited;
{$WARN SYMBOL_DEPRECATED OFF}
  Result := Create(AType, '')
{$WARN SYMBOL_DEPRECATED DEFAULT}
end;

class function TTransportException.Create(AType: TExceptionType;
  const msg: string): TTransportException;
begin
  case AType of
    TExceptionType.NotOpen:     Result := TTransportExceptionNotOpen.Create(msg);
    TExceptionType.AlreadyOpen: Result := TTransportExceptionAlreadyOpen.Create(msg);
    TExceptionType.TimedOut:    Result := TTransportExceptionTimedOut.Create(msg);
    TExceptionType.EndOfFile:   Result := TTransportExceptionEndOfFile.Create(msg);
    TExceptionType.BadArgs:     Result := TTransportExceptionBadArgs.Create(msg);
    TExceptionType.Interrupted: Result := TTransportExceptionInterrupted.Create(msg);
  else
    Result := TTransportExceptionUnknown.Create(msg);
  end;
end;

class function TTransportException.Create(const msg: string): TTransportException;
begin
  Result := TTransportExceptionUnknown.Create(Msg);
end;

{ TTransportExceptionSpecialized }

constructor TTransportExceptionSpecialized.Create(const Msg: string);
begin
  inherited HiddenCreate(Msg);
end;

{ TTransportFactoryImpl }

function TTransportFactoryImpl.GetTransport( const ATrans: ITransport): ITransport;
begin
  Result := ATrans;
end;

{ TServerSocket }

{$IFDEF OLD_SOCKETS}
constructor TServerSocketImpl.Create( const AServer: TTcpServer; AClientTimeout: Integer);
begin
  inherited Create;
  FServer := AServer;
  FClientTimeout := AClientTimeout;
end;
{$ELSE}
constructor TServerSocketImpl.Create( const AServer: TServerSocket; AClientTimeout: Longword);
begin
  inherited Create;
  FServer := AServer;
  FServer.RecvTimeout := AClientTimeout;
  FServer.SendTimeout := AClientTimeout;
end;
{$ENDIF}

{$IFDEF OLD_SOCKETS}
constructor TServerSocketImpl.Create(APort, AClientTimeout: Integer; AUseBufferedSockets: Boolean);
{$ELSE}
constructor TServerSocketImpl.Create(APort: Integer; AClientTimeout: Longword; AUseBufferedSockets: Boolean);
{$ENDIF}
begin
  inherited Create;
{$IFDEF OLD_SOCKETS}
  FPort := APort;
  FClientTimeout := AClientTimeout;
  FServer := TTcpServer.Create( nil );
  FServer.BlockMode := bmBlocking;
  {$IF CompilerVersion >= 21.0}
  FServer.LocalPort := AnsiString( IntToStr( FPort));
  {$ELSE}
  FServer.LocalPort := IntToStr( FPort);
  {$IFEND}
{$ELSE}
  FServer := TServerSocket.Create(APort, AClientTimeout, AClientTimeout);
{$ENDIF}
  FUseBufferedSocket := AUseBufferedSockets;
  FOwnsServer := True;
end;

destructor TServerSocketImpl.Destroy;
begin
  if FOwnsServer then begin
    FServer.Free;
    FServer := nil;
  end;
  inherited;
end;

function TServerSocketImpl.Accept( const fnAccepting: TProc): ITransport;
var
{$IFDEF OLD_SOCKETS}
  client : TCustomIpClient;
{$ELSE}
  client: TSocket;
{$ENDIF}
  trans  : IStreamTransport;
begin
  if FServer = nil then begin
    raise TTransportExceptionNotOpen.Create('No underlying server socket.');
  end;

{$IFDEF OLD_SOCKETS}
  client := nil;
  try
    client := TCustomIpClient.Create(nil);

    if Assigned(fnAccepting)
    then fnAccepting();

    if not FServer.Accept( client) then begin
      client.Free;
      Result := nil;
      Exit;
    end;

    if client = nil then begin
      Result := nil;
      Exit;
    end;

    trans := TSocketImpl.Create( client, TRUE, FClientTimeout);
    client := nil;  // trans owns it now

    if FUseBufferedSocket
    then result := TBufferedTransportImpl.Create( trans)
    else result := trans;

  except
    on E: Exception do begin
      client.Free;
      raise TTransportExceptionUnknown.Create(E.ToString);
    end;
  end;
{$ELSE}
  if Assigned(fnAccepting) then
    fnAccepting();

  client := FServer.Accept;
  try
    trans := TSocketImpl.Create(client, True);
    client := nil;

    if FUseBufferedSocket then
      Result := TBufferedTransportImpl.Create(trans)
    else
      Result := trans;
  except
    client.Free;
    raise;
  end;
{$ENDIF}
end;

procedure TServerSocketImpl.Listen;
begin
  if FServer <> nil then
  begin
{$IFDEF OLD_SOCKETS}
    try
      FServer.Active := True;
    except
      on E: Exception
      do raise TTransportExceptionUnknown.Create('Could not accept on listening socket: ' + E.Message);
    end;
{$ELSE}
    FServer.Listen;
{$ENDIF}
  end;
end;

procedure TServerSocketImpl.Close;
begin
  if FServer <> nil then
{$IFDEF OLD_SOCKETS}
    try
      FServer.Active := False;
    except
      on E: Exception
      do raise TTransportExceptionUnknown.Create('Error on closing socket : ' + E.Message);
    end;
{$ELSE}
    FServer.Close;
{$ENDIF}
end;

{ TSocket }

{$IFDEF OLD_SOCKETS}
constructor TSocketImpl.Create( const AClient : TCustomIpClient; aOwnsClient : Boolean; ATimeout: Integer = 0);
var stream : IThriftStream;
begin
  FClient := AClient;
  FTimeout := ATimeout;
  FOwnsClient := aOwnsClient;
  stream := TTcpSocketStreamImpl.Create( FClient, FTimeout);
  inherited Create( stream, stream);
end;
{$ELSE}
constructor TSocketImpl.Create(const AClient: TSocket; aOwnsClient: Boolean);
var stream : IThriftStream;
begin
  FClient := AClient;
  FTimeout := AClient.RecvTimeout;
  FOwnsClient := aOwnsClient;
  stream := TTcpSocketStreamImpl.Create(FClient, FTimeout);
  inherited Create(stream, stream);
end;
{$ENDIF}

{$IFDEF OLD_SOCKETS}
constructor TSocketImpl.Create(const AHost: string; APort, ATimeout: Integer);
{$ELSE}
constructor TSocketImpl.Create(const AHost: string; APort: Integer; ATimeout: Longword);
{$ENDIF}
begin
  inherited Create(nil,nil);
  FHost := AHost;
  FPort := APort;
  FTimeout := ATimeout;
  InitSocket;
end;

destructor TSocketImpl.Destroy;
begin
  if FOwnsClient
  then FreeAndNil( FClient);
  inherited;
end;

procedure TSocketImpl.Close;
begin
  inherited Close;
  if FOwnsClient
  then FreeAndNil( FClient);
end;

function TSocketImpl.GetIsOpen: Boolean;
begin
{$IFDEF OLD_SOCKETS}
  Result := (FClient <> nil) and FClient.Connected;
{$ELSE}
  Result := (FClient <> nil) and FClient.IsOpen
{$ENDIF}
end;

procedure TSocketImpl.InitSocket;
var
  stream : IThriftStream;
begin
  if FOwnsClient
  then FreeAndNil( FClient)
  else FClient := nil;

{$IFDEF OLD_SOCKETS}
  FClient := TTcpClient.Create( nil);
{$ELSE}
  FClient := TSocket.Create(FHost, FPort);
{$ENDIF}
  FOwnsClient := True;

  stream := TTcpSocketStreamImpl.Create( FClient, FTimeout);
  FInputStream := stream;
  FOutputStream := stream;
end;

procedure TSocketImpl.Open;
begin
  if IsOpen then begin
    raise TTransportExceptionAlreadyOpen.Create('Socket already connected');
  end;

  if FHost = '' then begin
    raise TTransportExceptionNotOpen.Create('Cannot open null host');
  end;

  if Port <= 0 then begin
    raise TTransportExceptionNotOpen.Create('Cannot open without port');
  end;

  if FClient = nil
  then InitSocket;

{$IFDEF OLD_SOCKETS}
  FClient.RemoteHost := TSocketHost( Host);
  FClient.RemotePort := TSocketPort( IntToStr( Port));
  FClient.Connect;
{$ELSE}
  FClient.Open;
{$ENDIF}

  FInputStream := TTcpSocketStreamImpl.Create( FClient, FTimeout);
  FOutputStream := FInputStream;
end;

{ TBufferedStream }

procedure TBufferedStreamImpl.Close;
begin
  Flush;
  FStream := nil;

  FReadBuffer.Free;
  FReadBuffer := nil;

  FWriteBuffer.Free;
  FWriteBuffer := nil;
end;

constructor TBufferedStreamImpl.Create( const AStream: IThriftStream; ABufSize: Integer);
begin
  inherited Create;
  FStream := AStream;
  FBufSize := ABufSize;
  FReadBuffer := TMemoryStream.Create;
  FWriteBuffer := TMemoryStream.Create;
end;

destructor TBufferedStreamImpl.Destroy;
begin
  Close;
  inherited;
end;

procedure TBufferedStreamImpl.Flush;
var
  buf : TBytes;
  len : Integer;
begin
  if IsOpen then begin
    len := FWriteBuffer.Size;
    if len > 0 then begin
      SetLength( buf, len );
      FWriteBuffer.Position := 0;
      FWriteBuffer.Read( Pointer(@buf[0])^, len );
      FStream.Write( buf, 0, len );
    end;
    FWriteBuffer.Clear;
  end;
end;

function TBufferedStreamImpl.IsOpen: Boolean;
begin
  Result := (FWriteBuffer <> nil)
        and (FReadBuffer <> nil)
        and (FStream <> nil);
end;

procedure TBufferedStreamImpl.Open;
begin
  // nothing to do
end;

function TBufferedStreamImpl.Read( var buffer: TBytes; offset: Integer; count: Integer): Integer;
var
  nRead : Integer;
  tempbuf : TBytes;
begin
  inherited;
  Result := 0;
  
  if IsOpen then begin
    while count > 0 do begin

      if FReadBuffer.Position >= FReadBuffer.Size then begin
        FReadBuffer.Clear;
        SetLength( tempbuf, FBufSize);
        nRead := FStream.Read( tempbuf, 0, FBufSize );
        if nRead = 0 then Break; // avoid infinite loop

        FReadBuffer.WriteBuffer( Pointer(@tempbuf[0])^, nRead );
        FReadBuffer.Position := 0;
      end;

      if FReadBuffer.Position < FReadBuffer.Size then begin
        nRead  := Min( FReadBuffer.Size - FReadBuffer.Position, count);
        Inc( Result, FReadBuffer.Read( Pointer(@buffer[offset])^, nRead));
        Dec( count, nRead);
        Inc( offset, nRead);
      end;
    end;
  end;
end;

function TBufferedStreamImpl.ToArray: TBytes;
var len : Integer;
begin
  len := 0;

  if IsOpen then begin
    len := FReadBuffer.Size;
  end;

  SetLength( Result, len);

  if len > 0 then begin
    FReadBuffer.Position := 0;
    FReadBuffer.Read( Pointer(@Result[0])^, len );
  end;
end;

procedure TBufferedStreamImpl.Write( const buffer: TBytes; offset: Integer; count: Integer);
begin
  inherited;
  if count > 0 then begin
    if IsOpen then begin
      FWriteBuffer.Write( Pointer(@buffer[offset])^, count );
      if FWriteBuffer.Size > FBufSize then begin
        Flush;
      end;
    end;
  end;
end;

{ TStreamTransportImpl }

procedure TStreamTransportImpl.Close;
begin
  FInputStream := nil;
  FOutputStream := nil;
end;

constructor TStreamTransportImpl.Create( const AInputStream : IThriftStream; const AOutputStream : IThriftStream);
begin
  inherited Create;
  FInputStream := AInputStream;
  FOutputStream := AOutputStream;
end;

destructor TStreamTransportImpl.Destroy;
begin
  FInputStream := nil;
  FOutputStream := nil;
  inherited;
end;

procedure TStreamTransportImpl.Flush;
begin
  if FOutputStream = nil then begin
    raise TTransportExceptionNotOpen.Create('Cannot flush null outputstream' );
  end;

  FOutputStream.Flush;
end;

function TStreamTransportImpl.GetInputStream: IThriftStream;
begin
  Result := FInputStream;
end;

function TStreamTransportImpl.GetIsOpen: Boolean;
begin
  Result := True;
end;

function TStreamTransportImpl.GetOutputStream: IThriftStream;
begin
  Result := FInputStream;
end;

procedure TStreamTransportImpl.Open;
begin

end;

function TStreamTransportImpl.Read(var buf: TBytes; off, len: Integer): Integer;
begin
  if FInputStream = nil then begin
    raise TTransportExceptionNotOpen.Create('Cannot read from null inputstream' );
  end;

  Result := FInputStream.Read( buf, off, len );
end;

procedure TStreamTransportImpl.Write(const buf: TBytes; off, len: Integer);
begin
  if FOutputStream = nil then begin
    raise TTransportExceptionNotOpen.Create('Cannot write to null outputstream' );
  end;

  FOutputStream.Write( buf, off, len );
end;

{ TBufferedTransportImpl }

constructor TBufferedTransportImpl.Create( const ATransport: IStreamTransport);
begin
  //no inherited;
  Create( ATransport, 1024 );
end;

procedure TBufferedTransportImpl.Close;
begin
  FTransport.Close;
end;

constructor TBufferedTransportImpl.Create( const ATransport: IStreamTransport;  ABufSize: Integer);
begin
  inherited Create;
  FTransport := ATransport;
  FBufSize := ABufSize;
  InitBuffers;
end;

procedure TBufferedTransportImpl.Flush;
begin
  if FOutputBuffer <> nil then begin
    FOutputBuffer.Flush;
  end;
end;

function TBufferedTransportImpl.GetIsOpen: Boolean;
begin
  Result := FTransport.IsOpen;
end;

function TBufferedTransportImpl.GetUnderlyingTransport: ITransport;
begin
  Result := FTransport;
end;

procedure TBufferedTransportImpl.InitBuffers;
begin
  if FTransport.InputStream <> nil then begin
    FInputBuffer := TBufferedStreamImpl.Create( FTransport.InputStream, FBufSize );
  end;
  if FTransport.OutputStream <> nil then begin
    FOutputBuffer := TBufferedStreamImpl.Create( FTransport.OutputStream, FBufSize );
  end;
end;

procedure TBufferedTransportImpl.Open;
begin
  FTransport.Open
end;

function TBufferedTransportImpl.Read(var buf: TBytes; off, len: Integer): Integer;
begin
  Result := 0;
  if FInputBuffer <> nil then begin
    Result := FInputBuffer.Read( buf, off, len );
  end;
end;

procedure TBufferedTransportImpl.Write(const buf: TBytes; off, len: Integer);
begin
  if FOutputBuffer <> nil then begin
    FOutputBuffer.Write( buf, off, len );
  end;
end;

{ TFramedTransportImpl }

{$IFDEF HAVE_CLASS_CTOR}
class constructor TFramedTransportImpl.Create;
begin
  SetLength( FHeader_Dummy, FHeaderSize);
  FillChar( FHeader_Dummy[0], Length( FHeader_Dummy) * SizeOf( Byte ), 0);
end;
{$ELSE}
procedure TFramedTransportImpl_Initialize;
begin
  SetLength( TFramedTransportImpl.FHeader_Dummy, TFramedTransportImpl.FHeaderSize);
  FillChar( TFramedTransportImpl.FHeader_Dummy[0],
    Length( TFramedTransportImpl.FHeader_Dummy) * SizeOf( Byte ), 0);
end;
{$ENDIF}

constructor TFramedTransportImpl.Create;
begin
  inherited Create;
  InitWriteBuffer;
end;

procedure TFramedTransportImpl.Close;
begin
  FTransport.Close;
end;

constructor TFramedTransportImpl.Create( const ATrans: ITransport);
begin
  inherited Create;
  InitWriteBuffer;
  FTransport := ATrans;
end;

destructor TFramedTransportImpl.Destroy;
begin
  FWriteBuffer.Free;
  FReadBuffer.Free;
  inherited;
end;

procedure TFramedTransportImpl.Flush;
var
  buf : TBytes;
  len : Integer;
  data_len : Integer;

begin
  len := FWriteBuffer.Size;
  SetLength( buf, len);
  if len > 0 then begin
    System.Move( FWriteBuffer.Memory^, buf[0], len );
  end;

  data_len := len - FHeaderSize;
  if (data_len < 0) then begin
    raise TTransportExceptionUnknown.Create('TFramedTransport.Flush: data_len < 0' );
  end;

  InitWriteBuffer;

  buf[0] := Byte($FF and (data_len shr 24));
  buf[1] := Byte($FF and (data_len shr 16));
  buf[2] := Byte($FF and (data_len shr 8));
  buf[3] := Byte($FF and data_len);

  FTransport.Write( buf, 0, len );
  FTransport.Flush;
end;

function TFramedTransportImpl.GetIsOpen: Boolean;
begin
  Result := FTransport.IsOpen;
end;

type
  TAccessMemoryStream = class(TMemoryStream)
  end;

procedure TFramedTransportImpl.InitWriteBuffer;
begin
  FWriteBuffer.Free;
  FWriteBuffer := TMemoryStream.Create;
  TAccessMemoryStream(FWriteBuffer).Capacity := 1024;
  FWriteBuffer.Write( Pointer(@FHeader_Dummy[0])^, FHeaderSize);
end;

procedure TFramedTransportImpl.Open;
begin
  FTransport.Open;
end;

function TFramedTransportImpl.Read(var buf: TBytes; off, len: Integer): Integer;
var
  got : Integer;
begin
  if FReadBuffer <> nil then begin
    if len > 0
    then got := FReadBuffer.Read( Pointer(@buf[off])^, len )
    else got := 0;
	
    if got > 0 then begin
      Result := got;
      Exit;
    end;
  end;

  ReadFrame;
  if len > 0
  then Result := FReadBuffer.Read( Pointer(@buf[off])^, len)
  else Result := 0;
end;

procedure TFramedTransportImpl.ReadFrame;
var
  i32rd : TBytes;
  size : Integer;
  buff : TBytes;
begin
  SetLength( i32rd, FHeaderSize );
  FTransport.ReadAll( i32rd, 0, FHeaderSize);
  size :=
    ((i32rd[0] and $FF) shl 24) or
    ((i32rd[1] and $FF) shl 16) or
    ((i32rd[2] and $FF) shl 8) or
     (i32rd[3] and $FF);
  SetLength( buff, size );
  FTransport.ReadAll( buff, 0, size );
  FReadBuffer.Free;
  FReadBuffer := TMemoryStream.Create;
  FReadBuffer.Write( Pointer(@buff[0])^, size );
  FReadBuffer.Position := 0;
end;

procedure TFramedTransportImpl.Write(const buf: TBytes; off, len: Integer);
begin
  if len > 0
  then FWriteBuffer.Write( Pointer(@buf[off])^, len );
end;

{ TFramedTransport.TFactory }

function TFramedTransportImpl.TFactory.GetTransport( const ATrans: ITransport): ITransport;
begin
  Result := TFramedTransportImpl.Create( ATrans );
end;

{ TTcpSocketStreamImpl }

procedure TTcpSocketStreamImpl.Close;
begin
  FTcpClient.Close;
end;

{$IFDEF OLD_SOCKETS}
constructor TTcpSocketStreamImpl.Create( const ATcpClient: TCustomIpClient; const aTimeout : Integer);
begin
  inherited Create;
  FTcpClient := ATcpClient;
  FTimeout := aTimeout;
end;
{$ELSE}
constructor TTcpSocketStreamImpl.Create( const ATcpClient: TSocket; const aTimeout : Longword);
begin
  inherited Create;
  FTcpClient := ATcpClient;
  if aTimeout = 0 then
    FTcpClient.RecvTimeout := SLEEP_TIME
  else
    FTcpClient.RecvTimeout := aTimeout;
  FTcpClient.SendTimeout := aTimeout;
end;
{$ENDIF}

procedure TTcpSocketStreamImpl.Flush;
begin

end;

function TTcpSocketStreamImpl.IsOpen: Boolean;
begin
{$IFDEF OLD_SOCKETS}
  Result := FTcpClient.Active;
{$ELSE}
  Result := FTcpClient.IsOpen;
{$ENDIF}
end;

procedure TTcpSocketStreamImpl.Open;
begin
  FTcpClient.Open;
end;


{$IFDEF OLD_SOCKETS}
function TTcpSocketStreamImpl.Select( ReadReady, WriteReady, ExceptFlag: PBoolean;
                                      TimeOut: Integer; var wsaError : Integer): Integer;
var
  ReadFds: TFDset;
  ReadFdsptr: PFDset;
  WriteFds: TFDset;
  WriteFdsptr: PFDset;
  ExceptFds: TFDset;
  ExceptFdsptr: PFDset;
  tv: timeval;
  Timeptr: PTimeval;
  socket : TSocket;
begin
  if not FTcpClient.Active then begin
    wsaError := WSAEINVAL;
    Exit( SOCKET_ERROR);
  end;

  socket := FTcpClient.Handle;

  if Assigned(ReadReady) then begin
    ReadFdsptr := @ReadFds;
    FD_ZERO(ReadFds);
    FD_SET(socket, ReadFds);
  end
  else begin
    ReadFdsptr := nil;
  end;

  if Assigned(WriteReady) then begin
    WriteFdsptr := @WriteFds;
    FD_ZERO(WriteFds);
    FD_SET(socket, WriteFds);
  end
  else begin
    WriteFdsptr := nil;
  end;

  if Assigned(ExceptFlag) then begin
    ExceptFdsptr := @ExceptFds;
    FD_ZERO(ExceptFds);
    FD_SET(socket, ExceptFds);
  end
  else begin
    ExceptFdsptr := nil;
  end;

  if TimeOut >= 0 then begin
    tv.tv_sec := TimeOut div 1000;
    tv.tv_usec :=  1000 * (TimeOut mod 1000);
    Timeptr := @tv;
  end
  else begin
    Timeptr := nil;  // wait forever
  end;

  wsaError := 0;
  try
    {$IFDEF MSWINDOWS}
      {$IFDEF OLD_UNIT_NAMES}
      result := WinSock.select(        socket + 1, ReadFdsptr, WriteFdsptr, ExceptFdsptr, Timeptr);
      {$ELSE}
      result := Winapi.WinSock.select( socket + 1, ReadFdsptr, WriteFdsptr, ExceptFdsptr, Timeptr);
      {$ENDIF}
    {$ENDIF}
    {$IFDEF LINUX}
      result := Libc.select(           socket + 1, ReadFdsptr, WriteFdsptr, ExceptFdsptr, Timeptr);
    {$ENDIF}
	
    if result = SOCKET_ERROR
    then wsaError := WSAGetLastError;

  except
    result := SOCKET_ERROR;
  end;

  if Assigned(ReadReady) then
   ReadReady^ := FD_ISSET(socket, ReadFds);
   
  if Assigned(WriteReady) then
    WriteReady^ := FD_ISSET(socket, WriteFds);
  
  if Assigned(ExceptFlag) then
    ExceptFlag^ := FD_ISSET(socket, ExceptFds);
end;
{$ENDIF}

{$IFDEF OLD_SOCKETS}
function TTcpSocketStreamImpl.WaitForData( TimeOut : Integer; pBuf : Pointer;
                                           DesiredBytes : Integer;
                                           var wsaError, bytesReady : Integer): TWaitForData;
var bCanRead, bError : Boolean;
    retval : Integer;
const 
  MSG_PEEK = {$IFDEF OLD_UNIT_NAMES} WinSock.MSG_PEEK  {$ELSE} Winapi.WinSock.MSG_PEEK  {$ENDIF};
begin
  bytesReady := 0;

  // The select function returns the total number of socket handles that are ready
  // and contained in the fd_set structures, zero if the time limit expired,
  // or SOCKET_ERROR if an error occurred. If the return value is SOCKET_ERROR,
  // WSAGetLastError can be used to retrieve a specific error code.
  retval := Self.Select( @bCanRead, nil, @bError, TimeOut, wsaError);
  if retval = SOCKET_ERROR
  then Exit( TWaitForData.wfd_Error);
  if (retval = 0) or not bCanRead
  then Exit( TWaitForData.wfd_Timeout);

  // recv() returns the number of bytes received, or -1 if an error occurred.
  // The return value will be 0 when the peer has performed an orderly shutdown.
  
  retval := recv( FTcpClient.Handle, pBuf^, DesiredBytes, MSG_PEEK);
  if retval <= 0
  then Exit( TWaitForData.wfd_Error);

  // at least we have some data
  bytesReady := Min( retval, DesiredBytes);
  result := TWaitForData.wfd_HaveData;
end;
{$ENDIF}

{$IFDEF OLD_SOCKETS}
function TTcpSocketStreamImpl.Read(var buffer: TBytes; offset, count: Integer): Integer;
// old sockets version
var wfd : TWaitForData;
    wsaError,
    msecs : Integer;
    nBytes : Integer;
    pDest : PByte;
begin
  inherited;

  if FTimeout > 0
  then msecs := FTimeout
  else msecs := DEFAULT_THRIFT_TIMEOUT;

  result := 0;
  pDest := Pointer(@buffer[offset]);
  while count > 0 do begin

    while TRUE do begin
      wfd := WaitForData( msecs, pDest, count, wsaError, nBytes);
      case wfd of
        TWaitForData.wfd_Error    :  Exit;
        TWaitForData.wfd_HaveData :  Break;
        TWaitForData.wfd_Timeout  :  begin
          if (FTimeout = 0)
          then Exit
          else begin
            raise TTransportExceptionTimedOut.Create(SysErrorMessage(Cardinal(wsaError)));

          end;
        end;
      else
        ASSERT( FALSE);
      end;
    end;

    // reduce the timeout once we got data
    if FTimeout > 0
    then msecs := FTimeout div 10
    else msecs := DEFAULT_THRIFT_TIMEOUT div 10;
    msecs := Max( msecs, 200);

    ASSERT( nBytes <= count);
    nBytes := FTcpClient.ReceiveBuf( pDest^, nBytes);
    Inc( pDest, nBytes);
    Dec( count, nBytes);
    Inc( result, nBytes);
  end;
end;

function TTcpSocketStreamImpl.ToArray: TBytes;
// old sockets version
var len : Integer;
begin
  len := 0;
  if IsOpen then begin
    len := FTcpClient.BytesReceived;
  end;

  SetLength( Result, len );

  if len > 0 then begin
    FTcpClient.ReceiveBuf( Pointer(@Result[0])^, len);
  end;
end;

procedure TTcpSocketStreamImpl.Write(const buffer: TBytes; offset, count: Integer);
// old sockets version
var bCanWrite, bError : Boolean;
    retval, wsaError : Integer;
begin
  inherited;

  if not FTcpClient.Active
  then raise TTransportExceptionNotOpen.Create('not open');

  // The select function returns the total number of socket handles that are ready
  // and contained in the fd_set structures, zero if the time limit expired,
  // or SOCKET_ERROR if an error occurred. If the return value is SOCKET_ERROR,
  // WSAGetLastError can be used to retrieve a specific error code.
  retval := Self.Select( nil, @bCanWrite, @bError, FTimeOut, wsaError);
  if retval = SOCKET_ERROR
  then raise TTransportExceptionUnknown.Create(SysErrorMessage(Cardinal(wsaError)));

  if (retval = 0)
  then raise TTransportExceptionTimedOut.Create('timed out');

  if bError or not bCanWrite
  then raise TTransportExceptionUnknown.Create('unknown error');

  FTcpClient.SendBuf( Pointer(@buffer[offset])^, count);
end;

{$ELSE}

function TTcpSocketStreamImpl.Read(var buffer: TBytes; offset, count: Integer): Integer;
// new sockets version
var nBytes : Integer;
    pDest : PByte;
begin
  inherited;

  result := 0;
  pDest := Pointer(@buffer[offset]);
  while count > 0 do begin
    nBytes := FTcpClient.Read(pDest^, count);
    if nBytes = 0 then Exit;
    Inc( pDest, nBytes);
    Dec( count, nBytes);
    Inc( result, nBytes);
  end;
end;

function TTcpSocketStreamImpl.ToArray: TBytes;
// new sockets version
var len : Integer;
begin
  len := 0;
  try
    if FTcpClient.Peek then
      repeat
        SetLength(Result, Length(Result) + 1024);
        len := FTcpClient.Read(Result[Length(Result) - 1024], 1024);
      until len < 1024;
  except
    on TTransportException do begin { don't allow default exceptions } end;
    else raise;
  end;
  if len > 0 then
    SetLength(Result, Length(Result) - 1024 + len);
end;

procedure TTcpSocketStreamImpl.Write(const buffer: TBytes; offset, count: Integer);
// new sockets version
begin
  inherited;

  if not FTcpClient.IsOpen
  then raise TTransportExceptionNotOpen.Create('not open');

  FTcpClient.Write(buffer[offset], count);
end;

{$ENDIF}


{$IF CompilerVersion < 21.0}
initialization
begin
  TFramedTransportImpl_Initialize;
end;
{$IFEND}


end.
