Sample code for STOMP-based Thrift clients and/or servers.

Although the sample Thrift STOMP Transport is written in 
Delphi/Pascal, it can easily serve as a starting point for 
similar implementations in other languages.

STOMP is a protocol widely supported by many messaging systems,
such as Apache ActiveMQ, RabbitMQ and many others. In particular,
it can be used to communicate with Service-Bus products like Rebus
or NServiceBus, when running against a STOMP-capable MQ system.

A prerequisite for this sample is the Delphi STOMP Adapter written
by Daniele Teti (http://www.danieleteti.it/stomp-client), currently
hosted at Google Code (http://code.google.com/p/delphistompclient).

At the time of writing, the STOMP adapter does not fully support 
binary data. Please check whether this has been fixed, otherwise 
you have to use the JSON protocol (or to fix it on your own).
