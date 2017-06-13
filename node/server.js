var fs = require('fs');
var moment = require('moment');
var express = require('express');
var app = require('express')();
app.use(express.static('public'));
var server = require('http').createServer(app);
server.listen(80, '::');
console.log("server at http://localhost:80");

// We fetch the latest transactions every 1 minute
    setInterval(function(){getAccountInfo()}, 60000);

var IOTA = require("iota.lib.js");
//  Instantiate IOTA
var iota = new IOTA({
    'host': 'http://165.227.128.198',
    'port': 14265
});
var json = require('./seed.json');
var seed = json.seed;
var client; // global
var balance; // global

// Gets the addresses and transactions of an account
// Get the current Account balance
function getAccountInfo() {
    var path = process.cwd();
    console.log("Get the Balance: " + moment().format());
    // console.log(path);
    // Command to be sent to the IOTA API
    // Gets the latest transfers for the specified seed
    iota.api.getAccountData(seed, function(e, accountData) {
        if (e){
          console.log(e)
        } else {
            console.log("Write Account Balance to file: ", accountData.balance);
            balance = accountData.balance
            var balanceObj = {balance: accountData.balance};
            var jsonbalance = JSON.stringify(balanceObj);
            fs.writeFile(path+'\\public\\balancecache.json', jsonbalance, 'utf8');
        }
    })
}

var io = require('socket.io')(server);
io.on('connection',function(clientSocket){
        console.log("Client connected...");
        //set the client connection to client var
        client = clientSocket
    // when the client emits 'sendTransfer', this listens and executes
      client.on('send', function (address) {
          var errorMsg = ""
          // Check if Address is ok
        if (iota.valid.isAddress(address)) {
              //  Makes a new transfer for the specified seed
              //  Includes message and value
                  var transfer = [{
                      'address': address,
                      'value': parseInt(1),
                      'message': "ONEIOTAFORFREE",
                      'tag': "ONEIOTAFORFREE"
                  }]
                  console.log("Sending 1 Iota to", address);
                  //console.log(iota);
                  // We send the transfer from this seed, with depth 4 and minWeightMagnitude 15
                  iota.api.sendTransfer(seed, 4, 15, transfer, function(e) {
                      if (e){
                        console.log(e)
                        errorMsg = e
                        client.broadcast.emit('response', errorMsg);
                      } else {
                        console.log("Successfully sent 1 IOTA to " + address)
                        errorMsg = "Successfully sent 1 IOTA " + address
                        client.broadcast.emit('response', errorMsg);
                      }
                  })
        } else {
            console.log("Address ERROR! No valid Address.");
            errorMsg = "Address ERROR! No valid Address."
            client.broadcast.emit('response', errorMsg);
        }
    });
});
