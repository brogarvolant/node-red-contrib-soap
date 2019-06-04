module.exports = function (RED) {
    function SoapCall(n) {
        var soap = require('soap');
        RED.nodes.createNode(this, n);
        this.topic = n.topic;
        this.name = n.name;
        this.wsdl = n.wsdl;
        this.server = RED.nodes.getNode(this.wsdl);
        this.method = n.method;
        this.payload = n.payload;
        var node = this;
        this.status({});

        try {
            node.on('input', function (msg) {
                var server = (msg.server)?{wsdl:msg.server, auth:0}:node.server;
                var lastFiveChar = server.wsdl.substr(server.wsdl.length-5);
                if(server.wsdl.indexOf("://")>0 && lastFiveChar !== '?wsdl'){
                    server.wsdl += '?wsdl';
                }
                soap.createClient(server.wsdl, msg.options||{}, function (err, client) {
                    if (err) {
                        node.status({fill: "red", shape: "dot", text: "WSDL Config Error: " + err});
                        node.error("WSDL Config Error: " + err);
                        return;
                    }
                    switch (node.server.auth) {
                        case '1':
                            client.setSecurity(new soap.BasicAuthSecurity(server.user, server.pass));
                            break;
                        case '2':
                            client.setSecurity(new soap.ClientSSLSecurity(server.key, server.cert, {}));
                            break;
                        case '3':
                            client.setSecurity(new soap.WSSecurity(server.user, server.pass));
                            break;
                        case '4':
                            client.setSecurity(new soap.BearerSecurity(server.token));
                            break;
                    }
                    node.status({fill: "yellow", shape: "dot", text: "SOAP Request..."});
                    if(msg.headers){
                        client.addSoapHeader(msg.headers);
                    }

                    if(client.hasOwnProperty(node.method)){
                        client[node.method](msg.payload, function (err, response, result) {
                            if (err) {
								if (response.statusCode === 200) {
									node.status({fill:"green", shape:"dot", text:"SOAP message delivered"});
									msg.payload = result;
									msg.payload.fault = "none";
									msg.statusCode = response.statusCode;
									node.send(msg);
									return;										
								} else {					
									node.status({fill: "red", shape: "ring", text: "Service Call Error: " + err});
									node.error("Service Call Error: " + err);
									msg.payload = null;
									msg.statusCode = response.statusCode;
									msg.errMsg = "Soap Service Call Error: " + err;
									node.send(msg);
									return;
								}
                            } else {
								node.status({fill:"green", shape:"dot", text:"SOAP result received"});
								msg.payload = result;
								msg.statusCode = response.statusCode;
								node.send(msg);
							}
                        });
                    } else {
                        node.status({fill:"red", shape:"dot", text:"Method does not exist"});
                        node.error("Method does not exist!");
						msg.payload = null;
						msg.statusCode = response.statusCode;
						msg.errMsg = "Soap method "+node.method+" does not exist!";
						node.send(msg);
                    }
                });
            });
        } catch (err) {
            node.status({fill: "red", shape: "dot", text: err.message});
            node.error(err.message);
        }
    }
    RED.nodes.registerType("soap request", SoapCall);
};
