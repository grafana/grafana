var thrift = require('thrift');                 	
var helloSvc = require('./gen-nodejs/HelloSvc');

//ServiceHandler: Implement the hello service 
var helloHandler = {
  hello_func: function (result) {
    console.log("Received Hello call");
    result(null, "Hello from Node.js");
  }
};

//ServiceOptions: The I/O stack for the service
var helloSvcOpt = {                       		
    handler: helloHandler,                      	
    processor: helloSvc,                         	
    protocol: thrift.TJSONProtocol,                 
    transport: thrift.TBufferedTransport 		
};                                  

//ServerOptions: Define server features
var serverOpt = {                          	
   services: {                         
      "/hello": helloSvcOpt                 
   }                               
}                                   

//Create and start the web server 
var port = 9090;                            		
thrift.createWebServer(serverOpt).listen(port);                        		
console.log("Http/Thrift Server running on port: " + port);

