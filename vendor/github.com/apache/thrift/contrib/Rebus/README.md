Sample code for the combination of Thrift with Rebus.

Rebus is a .NET service bus, similar to NServiceBus, but more lightweight. 
It ihas been mainly written by Mogens Heller Grabe and is currently hosted 
on GitHub (https://github.com/rebus-org/Rebus)

As with all ServiceBus or MQ scenarios, due to the highly asynchronous 
operations it is recommended to do all calls as "oneway void" calls.

The configuration can be done via App.Config, via code or even mixed from 
both locations. Refer to the Rebus documentation for further details. For 
this example, since we are effectively implementing two queue listeners in 
only one single process, we do configuration of incoming and error queues 
in the code.

If you want to communicate with non-NET languages, you may need a customized 
serializer as well, in order to override Rebus' default wire format. Please 
refer to the Rebus docs on how to do that (it's not that hard, really).

Additional requirements:
- RabbitMQ .NET client (see nuget)
