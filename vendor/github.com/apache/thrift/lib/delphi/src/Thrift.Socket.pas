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

unit Thrift.Socket;

{$I Thrift.Defines.inc}
{$I-}  // prevent annoying errors with default log delegate and no console

interface
{$IFNDEF OLD_SOCKETS} // not for OLD_SOCKETS

uses
  Winapi.Windows, Winapi.Winsock2;

const
  AI_PASSIVE                = $00000001;  // Socket address will be used in bind() call
  AI_CANONNAME              = $00000002;  // Return canonical name in first ai_canonname
  AI_NUMERICHOST            = $00000004;  // Nodename must be a numeric address string
  AI_NUMERICSERV            = $00000008;  // Servicename must be a numeric port number

  AI_ALL                    = $00000100;  // Query both IP6 and IP4 with AI_V4MAPPED
  AI_ADDRCONFIG             = $00000400;  // Resolution only if global address configured
  AI_V4MAPPED               = $00000800;  // On v6 failure, query v4 and convert to V4MAPPED format

  AI_NON_AUTHORITATIVE      = $00004000;  // LUP_NON_AUTHORITATIVE
  AI_SECURE                 = $00008000;  // LUP_SECURE
  AI_RETURN_PREFERRED_NAMES = $00010000;  // LUP_RETURN_PREFERRED_NAMES

  AI_FQDN                   = $00020000;  // Return the FQDN in ai_canonname
  AI_FILESERVER             = $00040000;  // Resolving fileserver name resolution

type
  PAddrInfoA = ^TAddrInfoA;
  TAddrInfoA = record
    ai_flags: Integer;
    ai_family: Integer;
    ai_socktype: Integer;
    ai_protocol: Integer;
    ai_addrlen: NativeUInt;
    ai_canonname: PAnsiChar;
    ai_addr: PSockAddr;
    ai_next: PAddrInfoA;
  end;

  PAddrInfoW = ^TAddrInfoW;
  TAddrInfoW = record
    ai_flags: Integer;
    ai_family: Integer;
    ai_socktype: Integer;
    ai_protocol: Integer;
    ai_addrlen: NativeUInt;
    ai_canonname: PChar;
    ai_addr: PSockAddr;
    ai_next: PAddrInfoW;
  end;

  TAddressFamily = USHORT;

  TIn6Addr = record
  case Integer of
    0: (_Byte: array[0..15] of UCHAR);
    1: (_Word: array[0..7] of USHORT);
  end;

  TScopeId = record
  public
    Value: ULONG;
  private
    function GetBitField(Loc: Integer): Integer; inline;
    procedure SetBitField(Loc: Integer; const aValue: Integer); inline;
  public
    property Zone: Integer index $0028 read GetBitField write SetBitField;
    property Level: Integer index $2804 read GetBitField write SetBitField;
  end;

  TSockAddrIn6 = record
    sin6_family: TAddressFamily;
    sin6_port: USHORT;
    sin6_flowinfo: ULONG;
    sin6_addr: TIn6Addr;
  case Integer of
    0: (sin6_scope_id: ULONG);
    1: (sin6_scope_struct: TScopeId);
  end;
  PSockAddrIn6 = ^TSockAddrIn6;

const
  NI_NOFQDN      = $01;  // Only return nodename portion for local hosts
  NI_NUMERICHOST = $02;  // Return numeric form of the host's address
  NI_NAMEREQD    = $04;  // Error if the host's name not in DNS
  NI_NUMERICSERV = $08;  // Return numeric form of the service (port #)
  NI_DGRAM       = $10;  // Service is a datagram service

  NI_MAXHOST     = 1025;  // Max size of a fully-qualified domain name
  NI_MAXSERV     = 32;    // Max size of a service name

function getaddrinfo(pNodeName, pServiceName: PAnsiChar; const pHints: TAddrInfoA; var ppResult: PAddrInfoA): Integer; stdcall;
function GetAddrInfoW(pNodeName, pServiceName: PWideChar; const pHints: TAddrInfoW; var ppResult: PAddrInfoW): Integer; stdcall;
procedure freeaddrinfo(pAddrInfo: PAddrInfoA); stdcall;
procedure FreeAddrInfoW(pAddrInfo: PAddrInfoW); stdcall;
function getnameinfo(const pSockaddr: TSockAddr; SockaddrLength: Integer; pNodeBuffer: PAnsiChar; NodeBufferSize: DWORD; pServiceBuffer: PAnsiChar;
  ServiceBufferSize: DWORD; Flags: Integer): Integer; stdcall;
function GetNameInfoW(const pSockaddr: TSockAddr; SockaddrLength: Integer; pNodeBuffer: PWideChar; NodeBufferSize: DWORD; pServiceBuffer: PWideChar;
  ServiceBufferSize: DWORD; Flags: Integer): Integer; stdcall;

type
  TSmartPointerDestroyer<T> = reference to procedure(Value: T);

  ISmartPointer<T> = reference to function: T;

  TSmartPointer<T> = class(TInterfacedObject, ISmartPointer<T>)
  private
    FValue: T;
    FDestroyer: TSmartPointerDestroyer<T>;
  public
    constructor Create(AValue: T; ADestroyer: TSmartPointerDestroyer<T>);
    destructor Destroy; override;
    function Invoke: T;
  end;

  TBaseSocket = class abstract
  public type
    TLogDelegate = reference to procedure( const str: string);
  strict private
    FPort: Integer;
    FSocket: Winapi.Winsock2.TSocket;
    FSendTimeout,
    FRecvTimeout: Longword;
    FKeepAlive: Boolean;
    FLogDelegate: TLogDelegate;
    class constructor Create;
    class destructor Destroy;
    class procedure DefaultLogDelegate(const Str: string);
  protected type
    IGetAddrInfoWrapper = interface
      function Init: Integer;
      function GetRes: PAddrInfoW;
      property Res: PAddrInfoW read GetRes;
    end;
    TGetAddrInfoWrapper = class(TInterfacedObject, IGetAddrInfoWrapper)
    strict private
      FNode: string;
      FService: string;
      FHints,
      FRes: PAddrInfoW;
    public
      constructor Create(ANode, AService: string; AHints: PAddrInfoW);
      destructor Destroy; override;
      function Init: Integer;
      function GetRes: PAddrInfoW;
      property Res: PAddrInfoW read GetRes;
    end;
  strict protected
    procedure CommonInit; virtual;
    function CreateSocket(AAddress: string; APort: Integer): IGetAddrInfoWrapper;
    procedure SetRecvTimeout(ARecvTimeout: Longword); virtual;
    procedure SetSendTimeout(ASendTimeout: Longword); virtual;
    procedure SetKeepAlive(AKeepAlive: Boolean); virtual;
    procedure SetSocket(ASocket: Winapi.Winsock2.TSocket);
    property LogDelegate: TLogDelegate read FLogDelegate;
  public
    //
    // Constructs a new socket. Note that this does NOT actually connect the
    // socket.
    //
    constructor Create(ALogDelegate: TLogDelegate = nil); overload;
    constructor Create(APort: Integer; ALogDelegate: TLogDelegate = nil); overload;

    //
    // Destroys the socket object, closing it if necessary.
    //
    destructor Destroy; override;

    //
    // Shuts down communications on the socket
    //
    procedure Close; virtual;

    // The port that the socket is connected to
    property Port: Integer read FPort write FPort;

    // The receive timeout
    property RecvTimeout: Longword read FRecvTimeout write SetRecvTimeout;

    // The send timeout
    property SendTimeout: Longword read FSendTimeout write SetSendTimeout;

    // Set SO_KEEPALIVE
    property KeepAlive: Boolean read FKeepAlive write SetKeepAlive;

    // The underlying socket descriptor
    property Socket: Winapi.Winsock2.TSocket read FSocket write SetSocket;
  end;

  TSocket = class(TBaseSocket)
  strict private type
    TCachedPeerAddr = record
    case Integer of
      0: (ipv4: TSockAddrIn);
      1: (ipv6: TSockAddrIn6);
    end;
  strict private
    FHost: string;
    FPeerHost: string;
    FPeerAddress: string;
    FPeerPort: Integer;
    FInterruptListener: ISmartPointer<Winapi.Winsock2.TSocket>;
    FConnTimeout: Longword;
    FLingerOn: Boolean;
    FLingerVal: Integer;
    FNoDelay: Boolean;
    FMaxRecvRetries: Longword;
    FCachedPeerAddr: TCachedPeerAddr;
    procedure InitPeerInfo;
    procedure OpenConnection(Res: TBaseSocket.IGetAddrInfoWrapper);
    procedure LocalOpen;
    procedure SetGenericTimeout(S: Winapi.Winsock2.TSocket; Timeout: Longword; OptName: Integer);
    function GetIsOpen: Boolean;
    procedure SetNoDelay(ANoDelay: Boolean);
    function GetSocketInfo: string;
    function GetPeerHost: string;
    function GetPeerAddress: string;
    function GetPeerPort: Integer;
    function GetOrigin: string;
  strict protected
    procedure CommonInit; override;
    procedure SetRecvTimeout(ARecvTimeout: Longword); override;
    procedure SetSendTimeout(ASendTimeout: Longword); override;
    procedure SetKeepAlive(AKeepAlive: Boolean); override;
  public
    //
    // Constructs a new socket. Note that this does NOT actually connect the
    // socket.
    //
    constructor Create(ALogDelegate: TBaseSocket.TLogDelegate = nil); overload;

    //
    // Constructs a new socket. Note that this does NOT actually connect the
    // socket.
    //
    // @param host An IP address or hostname to connect to
    // @param port The port to connect on
    //
    constructor Create(AHost: string; APort: Integer; ALogDelegate: TBaseSocket.TLogDelegate = nil); overload;

    //
    // Constructor to create socket from socket descriptor.
    //
    constructor Create(ASocket: Winapi.Winsock2.TSocket; ALogDelegate: TBaseSocket.TLogDelegate = nil); overload;

    //
    // Constructor to create socket from socket descriptor that
    // can be interrupted safely.
    //
    constructor Create(ASocket: Winapi.Winsock2.TSocket; AInterruptListener: ISmartPointer<Winapi.Winsock2.TSocket>;
      ALogDelegate: TBaseSocket.TLogDelegate = nil); overload;

    //
    // Creates and opens the socket
    //
    // @throws ETransportationException If the socket could not connect
    //
    procedure Open;

    //
    // Shuts down communications on the socket
    //
    procedure Close; override;

    //
    // Reads from the underlying socket.
    // \returns the number of bytes read or 0 indicates EOF
    // \throws TTransportException of types:
    //          Interrupted means the socket was interrupted
    //                      out of a blocking call
    //          NotOpen means the socket has been closed
    //          TimedOut means the receive timeout expired
    //          Unknown means something unexpected happened
    //
    function Read(var Buf; Len: Integer): Integer;

    //
    // Writes to the underlying socket.  Loops until done or fail.
    //
    procedure Write(const Buf; Len: Integer);

    //
    // Writes to the underlying socket.  Does single send() and returns result.
    //
    function WritePartial(const Buf; Len: Integer): Integer;

    //
    // Returns a cached copy of the peer address.
    //
    function GetCachedAddress(out Len: Integer): PSockAddr;

    //
    // Set a cache of the peer address (used when trivially available: e.g.
    // accept() or connect()). Only caches IPV4 and IPV6; unset for others.
    //
    procedure SetCachedAddress(const Addr: TSockAddr; Len: Integer);

    //
    // Controls whether the linger option is set on the socket.
    //
    // @param on      Whether SO_LINGER is on
    // @param linger  If linger is active, the number of seconds to linger for
    //
    procedure SetLinger(LingerOn: Boolean; LingerVal: Integer);

    //
    // Calls select() on the socket to see if there is more data available.
    //
    function Peek: Boolean;

    // Whether the socket is alive
    property IsOpen: Boolean read GetIsOpen;

    // The host that the socket is connected to
    property Host: string read FHost write FHost;

    // Whether to enable or disable Nagle's algorithm
    property NoDelay: Boolean read FNoDelay write SetNoDelay;

    // Connect timeout
    property ConnTimeout: Longword read FConnTimeout write FConnTimeout;

    // The max number of recv retries in the case of a WSAEWOULDBLOCK
    property MaxRecvRetries: Longword read FMaxRecvRetries write FMaxRecvRetries;

    // Socket information formatted as a string <Host: x Port: x>
    property SocketInfo: string read GetSocketInfo;

    // The DNS name of the host to which the socket is connected
    property PeerHost: string read GetPeerHost;

    // The address of the host to which the socket is connected
    property PeerAddress: string read GetPeerAddress;

    // The port of the host to which the socket is connected
    property PeerPort: Integer read GetPeerPort;

    // The origin the socket is connected to
    property Origin: string read GetOrigin;
  end;

  TServerSocketFunc = reference to procedure(sock: Winapi.Winsock2.TSocket);

  TServerSocket = class(TBaseSocket)
  strict private
    FAddress: string;
    FAcceptBacklog,
    FRetryLimit,
    FRetryDelay,
    FTcpSendBuffer,
    FTcpRecvBuffer: Integer;
    FAcceptTimeout: Longword;
    FListening,
    FInterruptableChildren: Boolean;
    FInterruptSockWriter,                                               // is notified on Interrupt()
    FInterruptSockReader,                                               // is used in select with FSocket for interruptability
    FChildInterruptSockWriter: Winapi.Winsock2.TSocket;                 // is notified on InterruptChildren()
    FChildInterruptSockReader: ISmartPointer<Winapi.Winsock2.TSocket>;  // if FnterruptableChildren this is shared with child TSockets
    FListenCallback,
    FAcceptCallback: TServerSocketFunc;
    function CreateSocketObj(Client: Winapi.Winsock2.TSocket): TSocket;
    procedure Notify(NotifySocket: Winapi.Winsock2.TSocket);
    procedure SetInterruptableChildren(AValue: Boolean);
  strict protected
    procedure CommonInit; override;
  public const
    DEFAULT_BACKLOG = 1024;
  public
    //
    // Constructor.
    //
    // @param port    Port number to bind to
    //
    constructor Create(APort: Integer; ALogDelegate: TBaseSocket.TLogDelegate = nil); overload;

    //
    // Constructor.
    //
    // @param port        Port number to bind to
    // @param sendTimeout Socket send timeout
    // @param recvTimeout Socket receive timeout
    //
    constructor Create(APort: Integer; ASendTimeout, ARecvTimeout: Longword; ALogDelegate: TBaseSocket.TLogDelegate = nil); overload;

    //
    // Constructor.
    //
    // @param address Address to bind to
    // @param port    Port number to bind to
    //
    constructor Create(AAddress: string; APort: Integer; ALogDelegate: TBaseSocket.TLogDelegate = nil); overload;

    procedure Listen;
    function Accept: TSocket;
    procedure Interrupt;
    procedure InterruptChildren;
    procedure Close; override;

    property AcceptBacklog: Integer read FAcceptBacklog write FAcceptBacklog;
    property AcceptTimeout: Longword read FAcceptTimeout write FAcceptTimeout;
    property RetryLimit: Integer read FRetryLimit write FRetryLimit;
    property RetryDelay: Integer read FRetryDelay write FRetryDelay;
    property TcpSendBuffer: Integer read FTcpSendBuffer write FTcpSendBuffer;
    property TcpRecvBuffer: Integer read FTcpRecvBuffer write FTcpRecvBuffer;

    // When enabled (the default), new children TSockets will be constructed so
    // they can be interrupted by TServerTransport.InterruptChildren().
    // This is more expensive in terms of system calls (poll + recv) however
    // ensures a connected client cannot interfere with TServer.Stop().
    //
    // When disabled, TSocket children do not incur an additional poll() call.
    // Server-side reads are more efficient, however a client can interfere with
    // the server's ability to shutdown properly by staying connected.
    //
    // Must be called before listen(); mode cannot be switched after that.
    // \throws EPropertyError if listen() has been called
    property InterruptableChildren: Boolean read FInterruptableChildren write SetInterruptableChildren;

    // listenCallback gets called just before listen, and after all Thrift
    // setsockopt calls have been made.  If you have custom setsockopt
    // things that need to happen on the listening socket, this is the place to do it.
    property ListenCallback: TServerSocketFunc read FListenCallback write FListenCallback;

    // acceptCallback gets called after each accept call, on the newly created socket.
    // It is called after all Thrift setsockopt calls have been made.  If you have
    // custom setsockopt things that need to happen on the accepted
    // socket, this is the place to do it.
    property AcceptCallback: TServerSocketFunc read FAcceptCallback write FAcceptCallback;
  end;

{$ENDIF} // not for OLD_SOCKETS
implementation
{$IFNDEF OLD_SOCKETS} // not for OLD_SOCKETS

uses
  System.SysUtils, System.Math, System.DateUtils, Thrift.Transport;

constructor TBaseSocket.TGetAddrInfoWrapper.Create(ANode, AService: string; AHints: PAddrInfoW);
begin
  inherited Create;
  FNode := ANode;
  FService := AService;
  FHints := AHints;
  FRes := nil;
end;

destructor TBaseSocket.TGetAddrInfoWrapper.Destroy;
begin
  if Assigned(FRes) then
    FreeAddrInfoW(FRes);
  inherited Destroy;
end;

function TBaseSocket.TGetAddrInfoWrapper.Init: Integer;
begin
  if FRes = nil then
    Exit(GetAddrInfoW(@FNode[1], @FService[1], FHints^, FRes));
  Result := 0;
end;

function TBaseSocket.TGetAddrInfoWrapper.GetRes: PAddrInfoW;
begin
  Result := FRes;
end;

procedure DestroyerOfFineSockets(ssock: Winapi.Winsock2.TSocket);
begin
  closesocket(ssock);
end;

function TScopeId.GetBitField(Loc: Integer): Integer;
begin
  Result := (Value shr (Loc shr 8)) and ((1 shl (Loc and $FF)) - 1);
end;

procedure TScopeId.SetBitField(Loc: Integer; const aValue: Integer);
begin
  Value := (Value and ULONG((not ((1 shl (Loc and $FF)) - 1)))) or ULONG(aValue shl (Loc shr 8));
end;

function getaddrinfo; external 'ws2_32.dll' name 'getaddrinfo';
function GetAddrInfoW; external 'ws2_32.dll' name 'GetAddrInfoW';
procedure freeaddrinfo; external 'ws2_32.dll' name 'freeaddrinfo';
procedure FreeAddrInfoW; external 'ws2_32.dll' name 'FreeAddrInfoW';
function getnameinfo; external 'ws2_32.dll' name 'getnameinfo';
function GetNameInfoW; external 'ws2_32.dll' name 'GetNameInfoW';

constructor TSmartPointer<T>.Create(AValue: T; ADestroyer: TSmartPointerDestroyer<T>);
begin
  inherited Create;
  FValue := AValue;
  FDestroyer := ADestroyer;
end;

destructor TSmartPointer<T>.Destroy;
begin
  if Assigned(FDestroyer) then FDestroyer(FValue);
  inherited Destroy;
end;

function TSmartPointer<T>.Invoke: T;
begin
  Result := FValue;
end;

class constructor TBaseSocket.Create;
var
  Version: WORD;
  Data: WSAData;
  Error: Integer;
begin
  Version := $0202;
  FillChar(Data, SizeOf(Data), 0);
  Error := WSAStartup(Version, Data);
  if Error <> 0 then
    raise Exception.Create('Failed to initialize Winsock.');
end;

class destructor TBaseSocket.Destroy;
begin
  WSACleanup;
end;

class procedure TBaseSocket.DefaultLogDelegate(const Str: string);
var
  OutStr: string;
begin
  OutStr := Format('Thrift: %s %s', [DateTimeToStr(Now, TFormatSettings.Create), Str]);
  try
    Writeln(OutStr);
    if IoResult <> 0 then OutputDebugString(PChar(OutStr));
  except
    OutputDebugString(PChar(OutStr));
  end;
end;

procedure TBaseSocket.CommonInit;
begin
  FSocket := INVALID_SOCKET;
  FPort := 0;
  FSendTimeout := 0;
  FRecvTimeout := 0;
  FKeepAlive := False;
  FLogDelegate := DefaultLogDelegate;
end;

function TBaseSocket.CreateSocket(AAddress: string; APort: Integer): IGetAddrInfoWrapper;
var
  Hints: TAddrInfoW;
  Res: PAddrInfoW;
  ThePort: array[0..5] of Char;
  Error: Integer;
begin
  FillChar(Hints, SizeOf(Hints), 0);
  Hints.ai_family := PF_UNSPEC;
  Hints.ai_socktype := SOCK_STREAM;
  Hints.ai_flags := AI_PASSIVE or AI_ADDRCONFIG;
  StrFmt(ThePort, '%d', [FPort]);

  Result := TGetAddrInfoWrapper.Create(AAddress, ThePort, @Hints);
  Error := Result.Init;
  if Error <> 0 then begin
    LogDelegate(Format('GetAddrInfoW %d: %s', [Error, SysErrorMessage(Error)]));
    Close;
    raise TTransportExceptionNotOpen.Create('Could not resolve host for server socket.');
  end;

  // Pick the ipv6 address first since ipv4 addresses can be mapped
  // into ipv6 space.
  Res := Result.Res;
  while Assigned(Res) do begin
    if (Res^.ai_family = AF_INET6) or (not Assigned(Res^.ai_next)) then
      Break;
    Res := Res^.ai_next;
  end;

  FSocket := Winapi.Winsock2.socket(Res^.ai_family, Res^.ai_socktype, Res^.ai_protocol);
  if FSocket = INVALID_SOCKET then begin
    Error := WSAGetLastError;
    LogDelegate(Format('TBaseSocket.CreateSocket() socket() %s', [SysErrorMessage(Error)]));
    Close;
    raise TTransportExceptionNotOpen.Create(Format('socket(): %s', [SysErrorMessage(Error)]));
  end;
end;

procedure TBaseSocket.SetRecvTimeout(ARecvTimeout: Longword);
begin
  FRecvTimeout := ARecvTimeout;
end;

procedure TBaseSocket.SetSendTimeout(ASendTimeout: Longword);
begin
  FSendTimeout := ASendTimeout;
end;

procedure TBaseSocket.SetKeepAlive(AKeepAlive: Boolean);
begin
  FKeepAlive := AKeepAlive;
end;

procedure TBaseSocket.SetSocket(ASocket: Winapi.Winsock2.TSocket);
begin
  if FSocket <> INVALID_SOCKET then
    Close;
  FSocket := ASocket;
end;

constructor TBaseSocket.Create(ALogDelegate: TLogDelegate);
begin
  inherited Create;
  CommonInit;
  if Assigned(ALogDelegate) then FLogDelegate := ALogDelegate;
end;

constructor TBaseSocket.Create(APort: Integer; ALogDelegate: TLogDelegate);
begin
  inherited Create;
  CommonInit;
  FPort := APort;
  if Assigned(ALogDelegate) then FLogDelegate := ALogDelegate;
end;

destructor TBaseSocket.Destroy;
begin
  Close;
  inherited Destroy;
end;

procedure TBaseSocket.Close;
begin
  if FSocket <> INVALID_SOCKET then begin
    shutdown(FSocket, SD_BOTH);
    closesocket(FSocket);
  end;
  FSocket := INVALID_SOCKET;
end;

procedure TSocket.InitPeerInfo;
begin
  FCachedPeerAddr.ipv4.sin_family := AF_UNSPEC;
  FPeerHost := '';
  FPeerAddress := '';
  FPeerPort := 0;
end;

procedure TSocket.CommonInit;
begin
  inherited CommonInit;
  FHost := '';
  FInterruptListener := nil;
  FConnTimeout := 0;
  FLingerOn := True;
  FLingerVal := 0;
  FNoDelay := True;
  FMaxRecvRetries := 5;
  InitPeerInfo;
end;

procedure TSocket.OpenConnection(Res: TBaseSocket.IGetAddrInfoWrapper);
label
  Done;
var
  ErrnoCopy: Integer;
  Ret,
  Ret2: Integer;
  Fds: TFdSet;
  TVal: TTimeVal;
  PTVal: PTimeVal;
  Val,
  Lon: Integer;
  One,
  Zero: Cardinal;
begin
  if SendTimeout > 0 then SetSendTimeout(SendTimeout);
  if RecvTimeout > 0 then SetRecvTimeout(RecvTimeout);
  if KeepAlive then SetKeepAlive(KeepAlive);
  SetLinger(FLingerOn, FLingerVal);
  SetNoDelay(FNoDelay);

  // Set the socket to be non blocking for connect if a timeout exists
  Zero := 0;
  if FConnTimeout > 0 then begin
    One := 1;
    if ioctlsocket(Socket, Integer(FIONBIO), One) = SOCKET_ERROR then begin
      ErrnoCopy := WSAGetLastError;
      LogDelegate(Format('TSocket.OpenConnection() ioctlsocket() %s %s', [SocketInfo, SysErrorMessage(ErrnoCopy)]));
      raise TTransportExceptionNotOpen.Create(Format('ioctlsocket() failed: %s', [SysErrorMessage(ErrnoCopy)]));
    end;
  end
  else begin
    if ioctlsocket(Socket, Integer(FIONBIO), Zero) = SOCKET_ERROR then begin
      ErrnoCopy := WSAGetLastError;
      LogDelegate(Format('TSocket.OpenConnection() ioctlsocket() %s %s', [SocketInfo, SysErrorMessage(ErrnoCopy)]));
      raise TTransportExceptionNotOpen.Create(Format('ioctlsocket() failed: %s', [SysErrorMessage(ErrnoCopy)]));
    end;
  end;

  Ret := connect(Socket, Res.Res^.ai_addr^, Res.Res^.ai_addrlen);
  if Ret = 0 then goto Done;

  ErrnoCopy := WSAGetLastError;
  if (ErrnoCopy <> WSAEINPROGRESS) and (ErrnoCopy <> WSAEWOULDBLOCK) then begin
    LogDelegate(Format('TSocket.OpenConnection() connect() ', [SocketInfo, SysErrorMessage(ErrnoCopy)]));
    raise TTransportExceptionNotOpen.Create(Format('connect() failed: %s', [SysErrorMessage(ErrnoCopy)]));
  end;

  FD_ZERO(Fds);
  _FD_SET(Socket, Fds);
  if FConnTimeout > 0 then begin
    TVal.tv_sec := FConnTimeout div 1000;
    TVal.tv_usec := (FConnTimeout mod 1000) * 1000;
    PTVal := @TVal;
  end
  else
    PTVal := nil;
  Ret := select(1, nil, @Fds, nil, PTVal);

  if Ret > 0 then begin
    // Ensure the socket is connected and that there are no errors set
    Lon := SizeOf(Val);
    Ret2 := getsockopt(Socket, SOL_SOCKET, SO_ERROR, @Val, Lon);
    if Ret2 = SOCKET_ERROR then begin
      ErrnoCopy := WSAGetLastError;
      LogDelegate(Format('TSocket.OpenConnection() getsockopt() ', [SocketInfo, SysErrorMessage(ErrnoCopy)]));
      raise TTransportExceptionNotOpen.Create(Format('getsockopt(): %s', [SysErrorMessage(ErrnoCopy)]));
    end;
    // no errors on socket, go to town
    if Val = 0 then goto Done;
    LogDelegate(Format('TSocket.OpenConnection() error on socket (after select()) ', [SocketInfo, SysErrorMessage(ErrnoCopy)]));
    raise TTransportExceptionNotOpen.Create(Format('socket OpenConnection() error: %s', [SysErrorMessage(Val)]));
  end
  else if Ret = 0 then begin
    // socket timed out
    LogDelegate(Format('TSocket.OpenConnection() timed out ', [SocketInfo, SysErrorMessage(ErrnoCopy)]));
    raise TTransportExceptionNotOpen.Create('OpenConnection() timed out');
  end
  else begin
    // error on select()
    ErrnoCopy := WSAGetLastError;
    LogDelegate(Format('TSocket.OpenConnection() select() ', [SocketInfo, SysErrorMessage(ErrnoCopy)]));
    raise TTransportExceptionNotOpen.Create(Format('select() failed: %s', [SysErrorMessage(ErrnoCopy)]));
  end;

Done:
  // Set socket back to normal mode (blocking)
  ioctlsocket(Socket, Integer(FIONBIO), Zero);
  SetCachedAddress(Res.Res^.ai_addr^, Res.Res^.ai_addrlen);
end;

procedure TSocket.LocalOpen;
var
  Res: TBaseSocket.IGetAddrInfoWrapper;
begin
  if IsOpen then Exit;

  // Validate port number
  if (Port < 0) or (Port > $FFFF) then
    raise TTransportExceptionBadArgs.Create('Specified port is invalid');

  Res := CreateSocket(Host, Port);

  OpenConnection(Res);
end;

procedure TSocket.SetGenericTimeout(S: Winapi.Winsock2.TSocket; Timeout: Longword; OptName: Integer);
var
  Time: DWORD;
begin
  if S = INVALID_SOCKET then
    Exit;

  Time := Timeout;

  if setsockopt(S, SOL_SOCKET, OptName, @Time, SizeOf(Time)) = SOCKET_ERROR then
    LogDelegate(Format('SetGenericTimeout() setsockopt() %s', [SysErrorMessage(WSAGetLastError)]));
end;

function TSocket.GetIsOpen: Boolean;
begin
  Result := Socket <> INVALID_SOCKET;
end;

procedure TSocket.SetNoDelay(ANoDelay: Boolean);
var
  V: Integer;
begin
  FNoDelay := ANoDelay;
  if Socket = INVALID_SOCKET then
    Exit;

  V := IfThen(FNoDelay, 1, 0);
  if setsockopt(Socket, IPPROTO_TCP, TCP_NODELAY, @V, SizeOf(V)) = SOCKET_ERROR then
    LogDelegate(Format('TSocket.SetNoDelay() setsockopt() %s %s', [SocketInfo, SysErrorMessage(WSAGetLastError)]));
end;

function TSocket.GetSocketInfo: string;
begin
  if (FHost = '') or (Port = 0) then
    Result := '<Host: ' + GetPeerAddress + ' Port: ' + GetPeerPort.ToString + '>'
  else
    Result := '<Host: ' + FHost + ' Port: ' + Port.ToString + '>';
end;

function TSocket.GetPeerHost: string;
var
  Addr: TSockAddrStorage;
  AddrPtr: PSockAddr;
  AddrLen: Integer;
  ClientHost: array[0..NI_MAXHOST-1] of Char;
  ClientService: array[0..NI_MAXSERV-1] of Char;
begin
  if FPeerHost = '' then begin
    if Socket = INVALID_SOCKET then
      Exit(FPeerHost);

    AddrPtr := GetCachedAddress(AddrLen);
    if AddrPtr = nil then begin
      AddrLen := SizeOf(Addr);
      if getpeername(Socket, PSockAddr(@Addr)^, AddrLen) <> 0 then
        Exit(FPeerHost);
      AddrPtr := PSockAddr(@Addr);
      SetCachedAddress(AddrPtr^, AddrLen);
    end;

    GetNameInfoW(AddrPtr^, AddrLen, ClientHost, NI_MAXHOST, ClientService, NI_MAXSERV, 0);
    FPeerHost := ClientHost;
  end;
  Result := FPeerHost;
end;

function TSocket.GetPeerAddress: string;
var
  Addr: TSockAddrStorage;
  AddrPtr: PSockAddr;
  AddrLen: Integer;
  ClientHost: array[0..NI_MAXHOST-1] of Char;
  ClientService: array[0..NI_MAXSERV-1] of Char;
begin
  if FPeerAddress = '' then begin
    if Socket = INVALID_SOCKET then
      Exit(FPeerAddress);

    AddrPtr := GetCachedAddress(AddrLen);
    if AddrPtr = nil then begin
      AddrLen := SizeOf(Addr);
      if getpeername(Socket, PSockAddr(@Addr)^, AddrLen) <> 0 then
        Exit(FPeerHost);
      AddrPtr := PSockAddr(@Addr);
      SetCachedAddress(AddrPtr^, AddrLen);
    end;

    GetNameInfoW(AddrPtr^, AddrLen, ClientHost, NI_MAXHOST, ClientService, NI_MAXSERV, NI_NUMERICHOST or NI_NUMERICSERV);
    FPeerAddress := ClientHost;
    TryStrToInt(ClientService, FPeerPort);
  end;
  Result := FPeerAddress
end;

function TSocket.GetPeerPort: Integer;
begin
  GetPeerAddress;
  Result := FPeerPort;
end;

function TSocket.GetOrigin: string;
begin
  Result := GetPeerHost + ':' + GetPeerPort.ToString;
end;

procedure TSocket.SetRecvTimeout(ARecvTimeout: Longword);
begin
  inherited SetRecvTimeout(ARecvTimeout);
  SetGenericTimeout(Socket, ARecvTimeout, SO_RCVTIMEO);
end;

procedure TSocket.SetSendTimeout(ASendTimeout: Longword);
begin
  inherited SetSendTimeout(ASendTimeout);
  SetGenericTimeout(Socket, ASendTimeout, SO_SNDTIMEO);
end;

procedure TSocket.SetKeepAlive(AKeepAlive: Boolean);
var
  Value: Integer;
begin
  inherited SetKeepAlive(AKeepAlive);

  Value := IfThen(KeepAlive, 1, 0);
  if setsockopt(Socket, SOL_SOCKET, SO_KEEPALIVE, @Value, SizeOf(Value)) = SOCKET_ERROR then
    LogDelegate(Format('TSocket.SetKeepAlive() setsockopt() %s %s', [SocketInfo, SysErrorMessage(WSAGetLastError)]));
end;

constructor TSocket.Create(ALogDelegate: TBaseSocket.TLogDelegate = nil);
begin
  // Not needed, but just a placeholder
  inherited Create(ALogDelegate);
end;

constructor TSocket.Create(AHost: string; APort: Integer; ALogDelegate: TBaseSocket.TLogDelegate);
begin
  inherited Create(APort, ALogDelegate);
  FHost := AHost;
end;

constructor TSocket.Create(ASocket: Winapi.Winsock2.TSocket; ALogDelegate: TBaseSocket.TLogDelegate);
begin
  inherited Create(ALogDelegate);
  Socket := ASocket;
end;

constructor TSocket.Create(ASocket: Winapi.Winsock2.TSocket; AInterruptListener: ISmartPointer<Winapi.Winsock2.TSocket>;
  ALogDelegate: TBaseSocket.TLogDelegate);
begin
  inherited Create(ALogDelegate);
  Socket := ASocket;
  FInterruptListener := AInterruptListener;
end;

procedure TSocket.Open;
begin
  if IsOpen then Exit;
  LocalOpen;
end;

procedure TSocket.Close;
begin
  inherited Close;
  InitPeerInfo;
end;

function TSocket.Read(var Buf; Len: Integer): Integer;
label
  TryAgain;
var
  Retries: Longword;
  EAgainThreshold,
  ReadElapsed: UInt64;
  Start: TDateTime;
  Got: Integer;
  Fds: TFdSet;
  ErrnoCopy: Integer;
  TVal: TTimeVal;
  PTVal: PTimeVal;
  Ret: Integer;
begin
  if Socket = INVALID_SOCKET then
    raise TTransportExceptionNotOpen.Create('Called read on non-open socket');

  Retries := 0;

  // THRIFT_EAGAIN can be signalled both when a timeout has occurred and when
  // the system is out of resources (an awesome undocumented feature).
  // The following is an approximation of the time interval under which
  // THRIFT_EAGAIN is taken to indicate an out of resources error.
  EAgainThreshold := 0;
  if RecvTimeout <> 0 then
    // if a readTimeout is specified along with a max number of recv retries, then
    // the threshold will ensure that the read timeout is not exceeded even in the
    // case of resource errors
    EAgainThreshold := RecvTimeout div IfThen(FMaxRecvRetries > 0, FMaxRecvRetries, 2);

TryAgain:
  // Read from the socket
  if RecvTimeout > 0 then
    Start := Now
  else
    // if there is no read timeout we don't need the TOD to determine whether
    // an THRIFT_EAGAIN is due to a timeout or an out-of-resource condition.
    Start := 0;

  if Assigned(FInterruptListener) then begin
    FD_ZERO(Fds);
    _FD_SET(Socket, Fds);
    _FD_SET(FInterruptListener, Fds);
    if RecvTimeout > 0 then begin
      TVal.tv_sec := RecvTimeout div 1000;
      TVal.tv_usec := (RecvTimeout mod 1000) * 1000;
      PTVal := @TVal;
    end
    else
      PTVal := nil;

    Ret := select(2, @Fds, nil, nil, PTVal);
    ErrnoCopy := WSAGetLastError;
    if Ret < 0 then begin
      // error cases
      if (ErrnoCopy = WSAEINTR) and (Retries < FMaxRecvRetries) then begin
        Inc(Retries);
        goto TryAgain;
      end;
      LogDelegate(Format('TSocket.Read() select() %s', [SysErrorMessage(ErrnoCopy)]));
      raise TTransportExceptionUnknown.Create(Format('Unknown: %s', [SysErrorMessage(ErrnoCopy)]));
    end
    else if Ret > 0 then begin
      // Check the interruptListener
      if FD_ISSET(FInterruptListener, Fds) then
        raise TTransportExceptionInterrupted.Create('Interrupted');
    end
    else // Ret = 0
      raise TTransportExceptionTimedOut.Create('WSAEWOULDBLOCK (timed out)');

    // falling through means there is something to recv and it cannot block
  end;

  Got := recv(Socket, Buf, Len, 0);
  ErrnoCopy := WSAGetLastError;
  // Check for error on read
  if Got < 0 then begin
    if ErrnoCopy = WSAEWOULDBLOCK then begin
      // if no timeout we can assume that resource exhaustion has occurred.
      if RecvTimeout = 0 then
        raise TTransportExceptionTimedOut.Create('WSAEWOULDBLOCK (unavailable resources)');
      // check if this is the lack of resources or timeout case
      ReadElapsed := MilliSecondsBetween(Now, Start);
      if (EAgainThreshold = 0) or (ReadElapsed < EAgainThreshold) then begin
        if Retries < FMaxRecvRetries then begin
          Inc(Retries);
          Sleep(1);
          goto TryAgain;
        end
        else
          raise TTransportExceptionTimedOut.Create('WSAEWOULDBLOCK (unavailable resources)');
      end
      else
        // infer that timeout has been hit
        raise TTransportExceptionTimedOut.Create('WSAEWOULDBLOCK (timed out)');
    end;

    // If interrupted, try again
    if (ErrnoCopy = WSAEINTR) and (Retries < FMaxRecvRetries) then begin
      Inc(Retries);
      goto TryAgain;
    end;

    if ErrnoCopy = WSAECONNRESET then
      Exit(0);

    // This ish isn't open
    if ErrnoCopy = WSAENOTCONN then
      raise TTransportExceptionNotOpen.Create('WSAENOTCONN');

    // Timed out!
    if ErrnoCopy = WSAETIMEDOUT then
      raise TTransportExceptionNotOpen.Create('WSAETIMEDOUT');

    // Now it's not a try again case, but a real probblez
    LogDelegate(Format('TSocket.Read() recv() %s %s', [SocketInfo, SysErrorMessage(ErrnoCopy)]));

    // Some other error, whatevz
    raise TTransportExceptionUnknown.Create(Format('Unknown: %s', [SysErrorMessage(ErrnoCopy)]));
  end;

  Result := Got;
end;

procedure TSocket.Write(const Buf; Len: Integer);
var
  Sent, B: Integer;
begin
  Sent := 0;
  while Sent < Len do begin
    B := WritePartial((PByte(@Buf) + Sent)^, Len - Sent);
    if B = 0 then
      // This should only happen if the timeout set with SO_SNDTIMEO expired.
      // Raise an exception.
      raise TTransportExceptionTimedOut.Create('send timeout expired');
    Inc(Sent, B);
  end;
end;

function TSocket.WritePartial(const Buf; Len: Integer): Integer;
var
  B: Integer;
  ErrnoCopy: Integer;
begin
  if Socket = INVALID_SOCKET then
    raise TTransportExceptionNotOpen.Create('Called write on non-open socket');

  B := send(Socket, Buf, Len, 0);

  if B < 0 then begin
    // Fail on a send error
    ErrnoCopy := WSAGetLastError;
    if ErrnoCopy = WSAEWOULDBLOCK then
      Exit(0);

    LogDelegate(Format('TSocket.WritePartial() send() %s %s', [SocketInfo, SysErrorMessage(ErrnoCopy)]));

    if (ErrnoCopy = WSAECONNRESET) or (ErrnoCopy = WSAENOTCONN) then begin
      Close;
      raise TTransportExceptionNotOpen.Create(Format('write() send(): %s', [SysErrorMessage(ErrnoCopy)]));
    end;

    raise TTransportExceptionUnknown.Create(Format('write() send(): %s', [SysErrorMessage(ErrnoCopy)]));
  end;

  // Fail on blocked send
  if B = 0 then
    raise TTransportExceptionNotOpen.Create('Socket send returned 0.');

  Result := B;
end;

function TSocket.GetCachedAddress(out Len: Integer): PSockAddr;
begin
  case FCachedPeerAddr.ipv4.sin_family of
    AF_INET: begin
      Len := SizeOf(TSockAddrIn);
      Result := PSockAddr(@FCachedPeerAddr.ipv4);
    end;
    AF_INET6: begin
      Len := SizeOf(TSockAddrIn6);
      Result := PSockAddr(@FCachedPeerAddr.ipv6);
    end;
  else
    Len := 0;
    Result := nil;
  end;
end;

procedure TSocket.SetCachedAddress(const Addr: TSockAddr; Len: Integer);
begin
  case Addr.sa_family of
    AF_INET: if Len = SizeOf(TSockAddrIn) then FCachedPeerAddr.ipv4 := PSockAddrIn(@Addr)^;
    AF_INET6: if Len = SizeOf(TSockAddrIn6) then FCachedPeerAddr.ipv6 := PSockAddrIn6(@Addr)^;
  end;
  FPeerAddress := '';
  FPeerHost := '';
  FPeerPort := 0;
end;

procedure TSocket.SetLinger(LingerOn: Boolean; LingerVal: Integer);
var
  L: TLinger;
begin
  FLingerOn := LingerOn;
  FLingerVal := LingerVal;
  if Socket = INVALID_SOCKET then
    Exit;

  L.l_onoff := IfThen(FLingerOn, 1, 0);
  L.l_linger := LingerVal;

  if setsockopt(Socket, SOL_SOCKET, SO_LINGER, @L, SizeOf(L)) = SOCKET_ERROR then
    LogDelegate(Format('TSocket.SetLinger() setsockopt() %s %s', [SocketInfo, SysErrorMessage(WSAGetLastError)]));
end;

function TSocket.Peek: Boolean;
var
  Retries: Longword;
  Fds: TFdSet;
  TVal: TTimeVal;
  PTVal: PTimeVal;
  Ret: Integer;
  ErrnoCopy: Integer;
  Buf: Byte;
begin
  if not IsOpen then Exit(False);

  if Assigned(FInterruptListener) then begin
    Retries := 0;
    while true do begin
      FD_ZERO(Fds);
      _FD_SET(Socket, Fds);
      _FD_SET(FInterruptListener, Fds);
      if RecvTimeout > 0 then begin
        TVal.tv_sec := RecvTimeout div 1000;
        TVal.tv_usec := (RecvTimeout mod 1000) * 1000;
        PTVal := @TVal;
      end
      else
        PTVal := nil;

      Ret := select(2, @Fds, nil, nil, PTVal);
      ErrnoCopy := WSAGetLastError;
      if Ret < 0 then begin
        // error cases
        if (ErrnoCopy = WSAEINTR) and (Retries < FMaxRecvRetries) then begin
          Inc(Retries);
          Continue;
        end;
        LogDelegate(Format('TSocket.Peek() select() %s', [SysErrorMessage(ErrnoCopy)]));
        raise TTransportExceptionUnknown.Create(Format('Unknown: %s', [SysErrorMessage(ErrnoCopy)]));
      end
      else if Ret > 0 then begin
        // Check the interruptListener
        if FD_ISSET(FInterruptListener, Fds) then
          Exit(False);
        // There must be data or a disconnection, fall through to the PEEK
        Break;
      end
      else
        // timeout
        Exit(False);
    end;
  end;

  // Check to see if data is available or if the remote side closed
  Ret := recv(Socket, Buf, 1, MSG_PEEK);
  if Ret = SOCKET_ERROR then begin
    ErrnoCopy := WSAGetLastError;
    if ErrnoCopy = WSAECONNRESET then begin
      Close;
      Exit(False);
    end;
    LogDelegate(Format('TSocket.Peek() recv() %s %s', [SocketInfo, SysErrorMessage(ErrnoCopy)]));
    raise TTransportExceptionUnknown.Create(Format('recv(): %s', [SysErrorMessage(ErrnoCopy)]));
  end;
  Result := Ret > 0;
end;

function TServerSocket.CreateSocketObj(Client: Winapi.Winsock2.TSocket): TSocket;
begin
  if FInterruptableChildren then
    Result := TSocket.Create(Client, FChildInterruptSockReader)
  else
    Result := TSocket.Create(Client);
end;

procedure TServerSocket.Notify(NotifySocket: Winapi.Winsock2.TSocket);
var
  Byt: Byte;
begin
  if NotifySocket <> INVALID_SOCKET then begin
    Byt := 0;
    if send(NotifySocket, Byt, SizeOf(Byt), 0) = SOCKET_ERROR then
      LogDelegate(Format('TServerSocket.Notify() send() %s', [SysErrorMessage(WSAGetLastError)]));
  end;
end;

procedure TServerSocket.SetInterruptableChildren(AValue: Boolean);
begin
  if FListening then
    raise Exception.Create('InterruptableChildren cannot be set after listen()');
  FInterruptableChildren := AValue;
end;

procedure TServerSocket.CommonInit;
begin
  inherited CommonInit;
  FInterruptableChildren := True;
  FAcceptBacklog := DEFAULT_BACKLOG;
  FAcceptTimeout := 0;
  FRetryLimit := 0;
  FRetryDelay := 0;
  FTcpSendBuffer := 0;
  FTcpRecvBuffer := 0;
  FListening := False;
  FInterruptSockWriter := INVALID_SOCKET;
  FInterruptSockReader := INVALID_SOCKET;
  FChildInterruptSockWriter := INVALID_SOCKET;
end;

constructor TServerSocket.Create(APort: Integer; ALogDelegate: TBaseSocket.TLogDelegate = nil);
begin
  // Unnecessary, but here for documentation purposes
  inherited Create(APort, ALogDelegate);
end;

constructor TServerSocket.Create(APort: Integer; ASendTimeout, ARecvTimeout: Longword; ALogDelegate: TBaseSocket.TLogDelegate);
begin
  inherited Create(APort, ALogDelegate);
  SendTimeout := ASendTimeout;
  RecvTimeout := ARecvTimeout;
end;

constructor TServerSocket.Create(AAddress: string; APort: Integer; ALogDelegate: TBaseSocket.TLogDelegate);
begin
  inherited Create(APort, ALogDelegate);
  FAddress := AAddress;
end;

procedure TServerSocket.Listen;

  function CreateSocketPair(var Reader, Writer: Winapi.Winsock2.TSocket): Integer;
  label
    Error;
  type
    TSAUnion = record
    case Integer of
      0: (inaddr: TSockAddrIn);
      1: (addr: TSockAddr);
    end;
  var
    a: TSAUnion;
    listener: Winapi.Winsock2.TSocket;
    e: Integer;
    addrlen: Integer;
    flags: DWORD;
    reuse: Integer;
  begin
    addrlen := SizeOf(a.inaddr);
    flags := 0;
    reuse := 1;

    listener := Winapi.Winsock2.socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if listener = INVALID_SOCKET then
      Exit(SOCKET_ERROR);

    FillChar(a, SizeOf(a), 0);
    a.inaddr.sin_family := AF_INET;
    a.inaddr.sin_addr.s_addr := htonl(INADDR_LOOPBACK);
    a.inaddr.sin_port := 0;
    Reader := INVALID_SOCKET;
    Writer := INVALID_SOCKET;

    // ignore errors coming out of this setsockopt.  This is because
    // SO_EXCLUSIVEADDRUSE requires admin privileges on WinXP, but we don't
    // want to force socket pairs to be an admin.
    setsockopt(listener, SOL_SOCKET, Integer(SO_EXCLUSIVEADDRUSE), @reuse, SizeOf(reuse));
    if bind(listener, a.addr, SizeOf(a.inaddr)) = SOCKET_ERROR then
      goto Error;

    if getsockname(listener, a.addr, addrlen) = SOCKET_ERROR then
      goto Error;

    if Winapi.Winsock2.listen(listener, 1) = SOCKET_ERROR then
      goto Error;

    Reader := WSASocket(AF_INET, SOCK_STREAM, 0, nil, 0, flags);
    if Reader = INVALID_SOCKET then
      goto Error;

    if connect(Reader, a.addr, SizeOf(a.inaddr)) = SOCKET_ERROR then
      goto Error;

    Writer := Winapi.Winsock2.accept(listener, nil, nil);
    if Writer = INVALID_SOCKET then
      goto Error;

    closesocket(listener);
    Exit(0);

  Error:
    e := WSAGetLastError;
    closesocket(listener);
    closesocket(Reader);
    closesocket(Writer);
    WSASetLastError(e);
    Result := SOCKET_ERROR;
  end;

var
  TempIntReader,
  TempIntWriter: Winapi.Winsock2.TSocket;
  One: Cardinal;
  ErrnoCopy: Integer;
  Ling: TLinger;
  Retries: Integer;
  AddrInfo: IGetAddrInfoWrapper;
  SA: TSockAddrStorage;
  Len: Integer;
begin
  // Create the socket pair used to interrupt
  if CreateSocketPair(TempIntReader, TempIntWriter) = SOCKET_ERROR then begin
    LogDelegate(Format('TServerSocket.Listen() CreateSocketPair() Interrupt %s', [SysErrorMessage(WSAGetLastError)]));
    FInterruptSockReader := INVALID_SOCKET;
    FInterruptSockWriter := INVALID_SOCKET;
  end
  else begin
    FInterruptSockReader := TempIntReader;
    FInterruptSockWriter := TempIntWriter;
  end;

  // Create the socket pair used to interrupt all clients
  if CreateSocketPair(TempIntReader, TempIntWriter) = SOCKET_ERROR then begin
    LogDelegate(Format('TServerSocket.Listen() CreateSocketPair() ChildInterrupt %s', [SysErrorMessage(WSAGetLastError)]));
    FChildInterruptSockReader := TSmartPointer<Winapi.Winsock2.TSocket>.Create(INVALID_SOCKET, nil);
    FChildInterruptSockWriter := INVALID_SOCKET;
  end
  else begin
    FChildInterruptSockReader := TSmartPointer<Winapi.Winsock2.TSocket>.Create(TempIntReader, DestroyerOfFineSockets);
    FChildInterruptSockWriter := TempIntWriter;
  end;

  if (Port < 0) or (Port > $FFFF) then
    raise TTransportExceptionBadArgs.Create('Specified port is invalid');

  AddrInfo := CreateSocket(FAddress, Port);

  // Set SO_EXCLUSIVEADDRUSE to prevent 2MSL delay on accept
  One := 1;
  setsockopt(Socket, SOL_SOCKET, Integer(SO_EXCLUSIVEADDRUSE), @one, SizeOf(One));
  // ignore errors coming out of this setsockopt on Windows.  This is because
  // SO_EXCLUSIVEADDRUSE requires admin privileges on WinXP, but we don't
  // want to force servers to be an admin.

  // Set TCP buffer sizes
  if FTcpSendBuffer > 0 then begin
    if setsockopt(Socket, SOL_SOCKET, SO_SNDBUF, @FTcpSendBuffer, SizeOf(FTcpSendBuffer)) = SOCKET_ERROR then begin
      ErrnoCopy := WSAGetLastError;
      LogDelegate(Format('TServerSocket.Listen() setsockopt() SO_SNDBUF %s', [SysErrorMessage(ErrnoCopy)]));
      raise TTransportExceptionNotOpen.Create(Format('Could not set SO_SNDBUF: %s', [SysErrorMessage(ErrnoCopy)]));
    end;
  end;

  if FTcpRecvBuffer > 0 then begin
    if setsockopt(Socket, SOL_SOCKET, SO_RCVBUF, @FTcpRecvBuffer, SizeOf(FTcpRecvBuffer)) = SOCKET_ERROR then begin
      ErrnoCopy := WSAGetLastError;
      LogDelegate(Format('TServerSocket.Listen() setsockopt() SO_RCVBUF %s', [SysErrorMessage(ErrnoCopy)]));
      raise TTransportExceptionNotOpen.Create(Format('Could not set SO_RCVBUF: %s', [SysErrorMessage(ErrnoCopy)]));
    end;
  end;

  // Turn linger off, don't want to block on calls to close
  Ling.l_onoff := 0;
  Ling.l_linger := 0;
  if setsockopt(Socket, SOL_SOCKET, SO_LINGER, @Ling, SizeOf(Ling)) = SOCKET_ERROR then begin
    ErrnoCopy := WSAGetLastError;
    LogDelegate(Format('TServerSocket.Listen() setsockopt() SO_LINGER %s', [SysErrorMessage(ErrnoCopy)]));
    raise TTransportExceptionNotOpen.Create(Format('Could not set SO_LINGER: %s', [SysErrorMessage(ErrnoCopy)]));
  end;

  // TCP Nodelay, speed over bandwidth
  if setsockopt(Socket, IPPROTO_TCP, TCP_NODELAY, @One, SizeOf(One)) = SOCKET_ERROR then begin
    ErrnoCopy := WSAGetLastError;
    LogDelegate(Format('TServerSocket.Listen() setsockopt() TCP_NODELAY %s', [SysErrorMessage(ErrnoCopy)]));
    raise TTransportExceptionNotOpen.Create(Format('Could not set TCP_NODELAY: %s', [SysErrorMessage(ErrnoCopy)]));
  end;

  // Set NONBLOCK on the accept socket
  if ioctlsocket(Socket, Integer(FIONBIO), One) = SOCKET_ERROR then begin
    ErrnoCopy := WSAGetLastError;
    LogDelegate(Format('TServerSocket.Listen() ioctlsocket() FIONBIO %s', [SysErrorMessage(ErrnoCopy)]));
    raise TTransportExceptionNotOpen.Create(Format('ioctlsocket() FIONBIO: %s', [SysErrorMessage(ErrnoCopy)]));
  end;

  // prepare the port information
  // we may want to try to bind more than once, since THRIFT_NO_SOCKET_CACHING doesn't
  // always seem to work. The client can configure the retry variables.
  Retries := 0;
  while True do begin
    if bind(Socket, AddrInfo.Res^.ai_addr^, AddrInfo.Res^.ai_addrlen) = 0 then
      Break;
    Inc(Retries);
    if Retries > FRetryLimit then
      Break;
    Sleep(FRetryDelay * 1000);
  end;

  // retrieve bind info
  if (Port = 0) and (Retries < FRetryLimit) then begin
    Len := SizeOf(SA);
    FillChar(SA, Len, 0);
    if getsockname(Socket, PSockAddr(@SA)^, Len) = SOCKET_ERROR then
      LogDelegate(Format('TServerSocket.Listen() getsockname() %s', [SysErrorMessage(WSAGetLastError)]))
    else begin
      if SA.ss_family = AF_INET6 then
        Port := ntohs(PSockAddrIn6(@SA)^.sin6_port)
      else
        Port := ntohs(PSockAddrIn(@SA)^.sin_port);
    end;
  end;

  // throw an error if we failed to bind properly
  if (Retries > FRetryLimit) then begin
    LogDelegate(Format('TServerSocket.Listen() BIND %d', [Port]));
    Close;
    raise TTransportExceptionNotOpen.Create(Format('Could not bind: %s', [SysErrorMessage(WSAGetLastError)]));
  end;

  if Assigned(FListenCallback) then
    FListenCallback(Socket);

  // Call listen
  if Winapi.Winsock2.listen(Socket, FAcceptBacklog) = SOCKET_ERROR then begin
    ErrnoCopy := WSAGetLastError;
    LogDelegate(Format('TServerSocket.Listen() listen() %s', [SysErrorMessage(ErrnoCopy)]));
    raise TTransportExceptionNotOpen.Create(Format('Could not listen: %s', [SysErrorMessage(ErrnoCopy)]));
  end;

  // The socket is now listening!
end;

function TServerSocket.Accept: TSocket;
var
  Fds: TFdSet;
  MaxEInters,
  NumEInters: Integer;
  TVal: TTimeVal;
  PTVal: PTimeVal;
  ErrnoCopy: Integer;
  Buf: Byte;
  ClientAddress: TSockAddrStorage;
  Size: Integer;
  ClientSocket: Winapi.Winsock2.TSocket;
  Zero: Cardinal;
  Client: TSocket;
  Ret: Integer;
begin
  MaxEInters := 5;
  NumEInters := 0;

  while True do begin
    FD_ZERO(Fds);
    _FD_SET(Socket, Fds);
    _FD_SET(FInterruptSockReader, Fds);
    if FAcceptTimeout > 0 then begin
      TVal.tv_sec := FAcceptTimeout div 1000;
      TVal.tv_usec := (FAcceptTimeout mod 1000) * 1000;
      PTVal := @TVal;
    end
    else
      PTVal := nil;

    // TODO: if WSAEINTR is received, we'll restart the timeout.
    // To be accurate, we need to fix this in the future.
    Ret := select(2, @Fds, nil, nil, PTVal);

    if Ret < 0 then begin
      // error cases
      if (WSAGetLastError = WSAEINTR) and (NumEInters < MaxEInters) then begin
        // THRIFT_EINTR needs to be handled manually and we can tolerate
        // a certain number
        Inc(NumEInters);
        Continue;
      end;
      ErrnoCopy := WSAGetLastError;
      LogDelegate(Format('TServerSocket.Accept() select() %s', [SysErrorMessage(ErrnoCopy)]));
      raise TTransportExceptionUnknown.Create(Format('Unknown: %s', [SysErrorMessage(ErrnoCopy)]));
    end
    else if Ret > 0 then begin
      // Check for an interrupt signal
      if (FInterruptSockReader <> INVALID_SOCKET) and FD_ISSET(FInterruptSockReader, Fds) then begin
        if recv(FInterruptSockReader, Buf, SizeOf(Buf), 0) = SOCKET_ERROR then
          LogDelegate(Format('TServerSocket.Accept() recv() interrupt %s', [SysErrorMessage(WSAGetLastError)]));
        raise TTransportExceptionInterrupted.Create('interrupted');
      end;

      // Check for the actual server socket being ready
      if FD_ISSET(Socket, Fds) then
        Break;
    end
    else begin
      LogDelegate('TServerSocket.Accept() select() 0');
      raise TTransportExceptionUnknown.Create('unknown error');
    end;
  end;

  Size := SizeOf(ClientAddress);
  ClientSocket := Winapi.Winsock2.accept(Socket, @ClientAddress, @Size);
  if ClientSocket = INVALID_SOCKET then begin
    ErrnoCopy := WSAGetLastError;
    LogDelegate(Format('TServerSocket.Accept() accept() %s', [SysErrorMessage(ErrnoCopy)]));
    raise TTransportExceptionUnknown.Create(Format('accept(): %s', [SysErrorMessage(ErrnoCopy)]));
  end;

  // Make sure client socket is blocking
  Zero := 0;
  if ioctlsocket(ClientSocket, Integer(FIONBIO), Zero) = SOCKET_ERROR then begin
    ErrnoCopy := WSAGetLastError;
    closesocket(ClientSocket);
    LogDelegate(Format('TServerSocket.Accept() ioctlsocket() FIONBIO %s', [SysErrorMessage(ErrnoCopy)]));
    raise TTransportExceptionUnknown.Create(Format('ioctlsocket(): %s', [SysErrorMessage(ErrnoCopy)]));
  end;

  Client := CreateSocketObj(ClientSocket);
  if SendTimeout > 0 then
    Client.SendTimeout := SendTimeout;
  if RecvTimeout > 0 then
    Client.RecvTimeout := RecvTimeout;
  if KeepAlive then
    Client.KeepAlive := KeepAlive;
  Client.SetCachedAddress(PSockAddr(@ClientAddress)^, Size);

  if Assigned(FAcceptCallback) then
    FAcceptCallback(ClientSocket);

  Result := Client;
end;

procedure TServerSocket.Interrupt;
begin
  Notify(FInterruptSockWriter);
end;

procedure TServerSocket.InterruptChildren;
begin
  Notify(FChildInterruptSockWriter);
end;

procedure TServerSocket.Close;
begin
  inherited Close;
  if FInterruptSockWriter <> INVALID_SOCKET then
    closesocket(FInterruptSockWriter);
  if FInterruptSockReader <> INVALID_SOCKET then
    closesocket(FInterruptSockReader);
  if FChildInterruptSockWriter <> INVALID_SOCKET then
    closesocket(FChildInterruptSockWriter);
  FChildInterruptSockReader := TSmartPointer<Winapi.Winsock2.TSocket>.Create(INVALID_SOCKET, nil);
  FListening := False;
end;

{$ENDIF} // not for OLD_SOCKETS
end.
