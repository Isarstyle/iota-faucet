var express = require('express');
var app = require('express')();
app.use(express.static('public'));
var server = require('http').createServer(app);

var IOTA = require("iota.lib.js");
//  Instantiate IOTA
var iota = new IOTA({
    'host': 'http://165.227.128.198',
    'port': 14265
});
// var iota = new IOTA({
//   'host'  : 'http://165.227.128.198',
//   'sandbox'   :  true,
//   'token'     : 'EXAMPLE-TOKEN-HERE'
// });
//for Server
// var iota = new IOTA({
//        'host': 'http://localhost',
//        'port': 14265
//    });
// we have a bank - so seed is static and secret!
//TODO Insert Seed to go live
var seed = "";
var balance = 0;




var io = require('socket.io')(server);
io.on('connection',function(client){
        console.log("Client connected...");

        // when the client emits 'new message', this listens and executes
      client.on('send', function (data) {
          //TODO Check if Adress is ok
        if (iota.valid.isAddress(data)) {
            // Call The sendTransfer(address, value, messageTrytes)
              sendTransfer(data, 1 , 1);
              // We fetch the latest transactions every 90 seconds
              getAccountInfo();
              setInterval(getAccountInfo, 90000);
        } else {
            console.log("Address ERROR! No valid Address.");
        }
        // we tell the client to execute 'new message'
        client.broadcast.emit('working', {message: data});
  });
});
// Gets the addresses and transactions of an account
// As well as the current balance
//  Automatically updates the HTML on the site
//
function getAccountInfo() {
    // Command to be sent to the IOTA API
    // Gets the latest transfers for the specified seed
    iota.api.getAccountData(seed, function(e, accountData) {

        console.log("Account data", accountData);
        balance = accountData.balance;

        // Update total balance
        $("#iota__balance").html(balance);
    })
}

//
//  Makes a new transfer for the specified seed
//  Includes message and value
//
function sendTransfer(address, value, messageTrytes) {
    var transfer = [{
        'address': address,
        'value': parseInt(value),
        'message': "ONEIOTAFORFREE",
        'tag': "ONEIOTAFORFREE"
    }]

    console.log("Sending Transfer", transfer);
    //console.log(iota);
    // We send the transfer from this seed, with depth 4 and minWeightMagnitude 18
    iota.api.sendTransfer(seed, 4, 18, transfer, function(e) {

        if (e){
          console.log(e)
        } else {
            console.log("Successfully sent 1 IOTA to " + address)
            balance = balance - value;
            $("#iota__balance").html(balance);
        }
    })
}

server.listen(80, '::');
console.log("server at http://localhost:80");
