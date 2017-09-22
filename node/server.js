var path = process.cwd();
var fs = require('fs');
var moment = require('moment');
var Datastore = require('nedb');
var express = require('express');
var app = require('express')();
app.use(express.static('public'));
var server = require('http').createServer(app);
server.listen(80, '::');
console.log("server at http://localhost:80");


const addressSecurityLevel = 2
const debugLevel = 3 // Values 0 to 9 0=silent 9=super verbose

// We fetch the latest transactions every 1 minute
setInterval(function() {
    getAccountInfo()
}, 10000);

var IOTA = require("iota.lib.js");
var db = new Datastore({ filename: path + '\\node\\datastore.json', autoload: true });

//  Instantiate IOTA!
var iota = new IOTA({'host': 'http://165.227.128.198', 'port': 14265});

var seedJson = require('./seed.json');
var seed = seedJson.seed;
var balanceJson = require('../public/balancecache.json');
var balance = balanceJson.balance;
 // global

// Gets the addresses and transactions of an account
// Get the current Account balance
async function getAccountInfo() {

    console.log("Get the Balance: " + moment().format());
    //console.log(path);
    //console.log(iota.api);
    // Command to be sent to the IOTA API
    // update_address_database(db_handle,iota,seed,start_adr_index,max_adr_index, update_all)
    // TODO get the last new adress then start search for the next 20 / update changes
    await update_address_database(db, iota, seed, 0, 20, 1);
    // Gets the latest transfers for the specified seed
    iota.api.getAccountData(seed, function(e, accountData) {
        if (e) {
            console.log(e)
        } else {
            balance = accountData.balance
            if (balance == 0) {
                //do nothing
                console.log("SUPPLY IS EMPTY / BUGGY SERVER?");
            } else {
                console.log("Write Account Balance to file: ", accountData.balance);
                var balanceObj = {
                    balance: accountData.balance
                };
                var jsonbalance = JSON.stringify(balanceObj);
                fs.writeFile(path + '\\public\\balancecache.json', jsonbalance, 'utf8', (err) => {
                    if (err)
                        throw err;
                    }
                )

            }
        }
    })
}

var io = require('socket.io')(server);
io.on('connection', function(client) {
    console.log("Client connected...");
    //set the client connection to client var
    // when the client emits 'sendTransfer', this listens and executes
    // TODO get next free adress from db
    client.on('sendTransfer', function(address, callbackFn) {
        var errorMsg = ""
        // Check if Address is ok
        if (iota.valid.isAddress(address)) {
            //  Makes a new transfer for the specified seed
            //  Includes message and value
            var transfer = [
                {
                    'address': address,
                    'value': parseInt(9),
                    'message': "9IOTAFORFREE999FEEDMYFRIENDSEU999DONATEIFYOULIKEIT",
                    'tag': "9IOTAFORFREE"
                }
            ]
            console.log("Sending 9 Iota to", address);
            //console.log(iota);
            // We send the transfer from this seed, with depth 4 and minWeightMagnitude 15
            // iota.api.sendTransfer(seed, 4, 15, transfer, function(e) {
            //     if (e) {
            //         console.log(e)
            //         errorMsg = e
            //         client.broadcast.emit('response', errorMsg);
            //     } else {
            //         console.log("Successfully sent 1 IOTA to " + address)
            //         errorMsg = "Successfully sent 1 IOTA " + address
            //         client.broadcast.emit('response', errorMsg);
            //     }
            // })

            iota.api.prepareTransfers(seed, transfer, function(error, trytes) {
                // console.log("prepareTransfers");
                if (error) {
                    console.log("ERROR");
                    console.log(error);
                } else {
                    // console.log(trytes);
                    return callbackFn(trytes)
                }
                //get the trytes to client and do the sendTrytes / POW at client YES
            })

        } else {
            console.log("Address ERROR: " + address);
            return callbackFn("Address ERROR!")
        }
    });
});



//  (c) by Michael Schwab <michael.schwab@mikeshouse.de>
async function update_address_database(db_handle,iota,seed,start_adr_index,max_adr_index, update_all)
{
        var adr_index = start_adr_index;
        var new_address_count = 0;
        do
        {
            debug_output(adr_index+"---------------------------------------------------------------------------",9)
            var address;
            var inclusion ;
            var status;
            var balance_in_db;
            var query = { index: adr_index };
            var rows = await dbFind(db_handle,query);

            if ( rows.length == 0 )
            {
                address = await addNewAddress(db_handle,iota,seed,adr_index);
                status = "new";
                balance_in_db = 0;
            }
            else
            {
                debug_output("ROW: "+JSON.stringify(rows),9);
                debug_output("ADR: "+rows[0].address,9)
                address = rows[0].address;
                status = rows[0].status;
                balance_in_db = rows[0].balance;
            }

            if ( (status != "exhausted" && status != "overused") || update_all == 1  || balance_in_db > 0)
            {
                // Update address balance
                var balance = await getBalance(iota, [address]);
                debug_output("B: "+JSON.stringify(balance),9);
                var update_result = await dbUpdate(db_handle,query,{ $set: {balance: balance.balances[0] }});
                debug_output("DB Update completed",9);

                var transactions = await findTransactions(iota, { addresses: [address] });
                debug_output("TRANSACTIONS: "+JSON.stringify(transactions),9);
                var outgoing_transactions_count = 0;
                var zero_value_transactions_count = 0;
                var incoming_transactions_count = 0;
                for (j=0; j < transactions.length; j++)
                {
                        var inclusionstates = await getLatestInclusion(iota, [transactions[j].hash] );
                        inclusion = inclusionstates[0];
                        debug_output("Transaction: "+j+" Hash: "+transactions[j].hash+" value: "+transactions[j].value+" Inclusion: "+inclusion,4);
                    if (inclusion == true )
                    {
                        if (transactions[j].value < 0)
                        { outgoing_transactions_count++;}

                        if (transactions[j].value == 0)
                        { zero_value_transactions_count++;}

                        if ( transactions[j].value > 0)
                        { incoming_transactions_count++ }
                    }

                }
                // Address status
                // 1. new = unused not attached to tangle
                // 2. attached = has one or more transactions with value 0
                // 3. used = has transactions but no confirmed outgoing transactions and balance > 0
                // 4. exhausted = has one confirmed outgoing transaction, no more transactions should issued with this address
                // 5. overused = has more than one outgoing transaction, this should not happen but can be forced by the user
                if (outgoing_transactions_count == 1)
                { status = "exhausted" }
                else if (outgoing_transactions_count > 1)
                { status = "overused"}
                else if (outgoing_transactions_count == 0 && incoming_transactions_count > 0)
                { status = "used" }
                else if (outgoing_transactions_count == 0 && incoming_transactions_count == 0 && zero_value_transactions_count > 0)
                { status = "attached" }
                else if (outgoing_transactions_count == 0 && incoming_transactions_count == 0 && zero_value_transactions_count == 0 && (status == "" || status == undefined))
                { status = "new";}

                // count new addresses to always have some new addresses in your db
                if ( status == "new" ) {new_address_count++;}

                var update_result = await dbUpdate(db_handle,query,{ $set: {status: status }});

                debug_output("INDEX: "+adr_index+" ADR: "+address.substr(0,20)+".... Balance: "+balance.balances[0]+" Status: "+status,1);
            }

            adr_index++;

        } while ( (adr_index < max_adr_index && max_adr_index > 0) || (max_adr_index == 0 && inclusion == true) || (max_adr_index == -1 && new_address_count < 10) )
}

async function addNewAddress(db_handle,iota,seed,adr_index)
{
    var address = "";
    if (adr_index == undefined)
    {
        var rows = await dbFind(db_handle,{},{index: -1});
        if ( rows.length > 0)
        {
            adr_index = rows[0].index + 1;
        }
        else
        {
            adr_index = 0;
        }
        debug_output("NEXT INDEX:"+adr_index,4);
    }

    address = await getNewAddress(iota,seed,adr_index);
    address = address[0];

    debug_output("Adding address to db: "+address,4);

    var data = { index: adr_index, address: address, balance: 0, status: "new", securityLevel: addressSecurityLevel };
    await dbInsert(db_handle,data);
    debug_output('successfully added',4);
    return address;
}

async function get_new_address(db_handle,iota,seed,status)
{
    var address = "";
    var query = { status: "new" };
    var rows = await dbFind(db_handle,query,{index: 1});
    if ( rows.length == 0)
    {
        // Create new addresses
        await addNewAddress(db_handle,iota,seed);
        rows = await dbFind(db_handle,query,{index: 1});
        if (rows.length == 0)
        {
            error_output("Could not get a new address something seems to be wrong with the database, possibly delete it and do a SyncAll to rebuild it");
            // ERROR there should be one address!!
        }
    }
    else
    {
        debug_output(rows[0].address+" INDEX: "+rows[0].index);
    }

    if (status == undefined)
    { status = "published"; }

    query = { index: rows[0].index };
    var update_result = await dbUpdate(db_handle,query,{ $set: {status: status }});

    return {address: rows[0].address , index: rows[0].index};
}



function getLatestInclusion (iotaHandle, transaction_hashes)
{
    return new Promise(
        function(resolve, reject)
        {
            iotaHandle.api.getLatestInclusion(transaction_hashes,
                    function(error, success)
                    {
                        if (error) { reject(error); } else { resolve(success); }
                    }
            );
        }
    );
}

async function getBundleConfirmationState(iota, bundle_hash)
{
    var transactions_in_bundle = await findTransactions(iota, { bundles: [bundle_hash] });
    var transaction = [];
    var true_count = 0
    var false_count = 0
    var status = "";
    var result;
    var value = 0;

    debug_output("T:"+JSON.stringify(transactions_in_bundle),9);

    for (var j = 0; j < transactions_in_bundle.length; j++)
    {
        transaction.push(transactions_in_bundle[j].hash);
        if (transactions_in_bundle[j].value > 0)
        { value += parseInt(transactions_in_bundle[j].value); }
    }

    var inclusionstates = await getLatestInclusion(iota, transaction );

    for (var j = 0; j < inclusionstates.length; j++)
    {
        if (inclusionstates[j] == true)
        { true_count++; }
        else if (inclusionstates[j] == false)
        { false_count++; }
    }

    if ( (true_count > 0 && value == 0) || (true_count > 2 && value > 0))
    { status = "confirmed"; } else { status = "unconfirmed"; }

    result = { confirmedTransactionsCount: true_count, unconfirmedTransactionsCount: false_count, status: status};
    return result;
}

function findTransactions(iotaHandle,searchValues)
{
    return new Promise(
        function(resolve, reject)
        {
            iotaHandle.api.findTransactionObjects(searchValues,
                    function(error, success)
                    {
                        if (error) { reject(error); } else { resolve(success); }
                    }
            );
        }
    );
}


function getNewAddress(iotaHandle,seed,index)
{
    return new Promise(
        function(resolve, reject)
        {
            iotaHandle.api.getNewAddress(seed , {"index": index, "checksum": true, "total": 1, "security": addressSecurityLevel, "returnAll": false},
                function(error, success) {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(success);
                    }
                }
            );
        }
    );
}

function getBalance(iotaHandle, adr_array)
{
    return new Promise( function(resolve, reject)
    {
        iotaHandle.api.getBalances(adr_array, 100,
            function(error, balances_obj)
            {
                if (error) {  reject(error);  } else { resolve(balances_obj); }
            }
        );
    });
}

function dbInsert(dbHandle,data)
{
    return new Promise (
        function(resolve, reject)
        {
            dbHandle.insert(data,
                function (err, newDoc)
                {
                    if (err)
                    { reject(err); } else { resolve('Document inserted'); }
                }
            );
        }
    );
}

function dbUpdate(dbHandle,query,update)
{
    return new Promise (
        function(resolve, reject)
        {
            dbHandle.update(query, update, { multi: true},
                function (err, numReplaced)
                {
                    if (err)
                    { reject(err); } else { resolve(numReplaced); }
                }
            );
        }
    );
}

function dbFind(dbHandle,query,sort)
{
    if (sort == undefined)
    {
        return new Promise (
            function(resolve, reject)
            {
                dbHandle.find(query,
                    function (err, docs)
                    {
                        if (err) { reject(err); } else { resolve(docs); }
                    }
                );
            }
        );
    }
    else
    {
        return new Promise (
            function(resolve, reject)
            {
                dbHandle.find(query).sort(sort).exec(
                    function (err, docs)
                    {
                        if (err) { reject(err); } else { resolve(docs); }
                    }
                );
            }
        );
    }
}

function dbDelete(dbHandle,query)
{
    return new Promise (
        function(resolve, reject)
        {
            dbHandle.remove(query, { multi: true },
                function (err, numRemoved)
                {
                    if (err)
                    { reject(err); } else { resolve(numRemoved); }
                }
            );
        }
    );
}

function replayBundle(iotaHandle, tail, depth, minWeightMagnitude)
{
    return new Promise(
        function(resolve, reject)
        {
            iotaHandle.api.replayBundle(tail, depth, minWeightMagnitude,
                function(error, success) {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(success);
                    }
                }
            );
        }
    );
}


function debug_output(message,loglevel)
{
    if (loglevel <= debugLevel)
    {
        console.log(message);
    }
}

function error_output(message,loglevel)
{
    debug_output("ERROR: "+message,2);
    console.log("{ status: \"error\", message: \""+message+"\"}");
}

function json_output(json_data)
{
    if ( json_data.status == undefined )
    {
        json_data.status = "ok";
    }
    console.log(JSON.stringify(json_data));
}

async function getAddressFromIndex(db_handle, index)
{
        index = parseInt(index);

        var query = { index: index };
        var rows = await dbFind(db_handle,query,{index: 1});
        if ( rows.length == 1)
        {
            var address = rows[0].address;
            return address;
        }
        else
        {
            return "";
        }
}

async function getBundles(db, iota, address)
{
    var transactions = await findTransactions(iota, { addresses: [address] });

    var bundles = {};

    for (var i = 0; i < transactions.length; i++)
    {
        if ( bundles[transactions[i].bundle] == undefined)
        {
            //var confirmation_state = getBundleConfirmationState(iota, transactions[i].bundle)
            bundles[transactions[i].bundle] = { };
            bundles[transactions[i].bundle].replays = 0;
            bundles[transactions[i].bundle].hash = transactions[i].bundle;
        }
        else
        {
            bundles[transactions[i].bundle].replays++;
        }
        debug_output("-------------------- TRANSACTION:"+i,4);
        debug_output("HASH:     "+transactions[i].hash,4);
        debug_output("BUNDLE    "+transactions[i].bundle,4);
        debug_output("VALUE     "+transactions[i].value,4);
        debug_output("INDEX     "+transactions[i].currentIndex,4);
    }

    var return_value = [];
    for (var key in  bundles)
    {
        return_value.push({"bundle":key , "replays":bundles[key].replays});
    }
    return return_value;
}

async function updateBalances(db_handle, iota)
{
        var query = {};
        var rows = await dbFind(db_handle,query,{index: 1});
        var i;
        var address_array = [];
        var balances;
        var total_balance = 0;
        if (rows.length == 0)
        {
            error_output("No addresses in database");
            return;
        }
        for(i=0; i < rows.length; i++)
        {
            address_array.push(rows[i].address);
            if (i % 20 == 0 || i == rows.length-1 )
            {
                balances = await getBalance(iota, address_array);
                for(var j=0; j < address_array.length; j++)
                {
                    var query = { address: address_array[j] };
                    var balance = parseInt(balances.balances[j]);
                    total_balance += balance;
                    var update_result = await dbUpdate(db_handle,query,{ $set: {balance: balance }});

                    // Update Address status
                    var adr_rows = await dbFind(db_handle,query);
                    if ( adr_rows.length == 1)
                    {
                        if ( adr_rows[0].status == "published" && adr_rows[0].balance > 0 )
                        {
                            var adr_update_result = await dbUpdate(db_handle,query,{ $set: {status: "used" }});
                        }
                    }

                    //console.log("Update result:"+JSON.stringify(update_result));
                }
                address_array = [];
                debug_output("Balances:"+JSON.stringify(balances),4);
            }
        }
        return result = {addressCount: rows.length, totalBalance: total_balance};
}
/*
 * Sleep for a number of seconds
 *
 */
async function sleep(x)
{
    return new Promise(
        function (resolve, reject)
        {
            setTimeout(function() {resolve();},x*1000);
        }
    );
}



async function execute_transfer(db_handle, iota, seed, dst_address, value, message, tag)
{
    if (message == undefined) {message = "";}
    if (tag == undefined) {tag = "";}
    var options = {};

    if (value > 0)
    {
        // find the funding addresses search the whole db for addresses with balance > 0 and sum them
        // up till there is enough balance for the transfer.
        var funding_array = [];
//        var query = { balance: { $gt: 0 } };
        var query = {};
        var rows = await dbFind(db_handle,query,{index: 1});

        debug_output("Searching for funding, found "+rows.length+" records in Database",9);

        if (rows.length == 0)
        {
            error_output("Your balance is zero!");
            return;
        }
        else
        {
            var total = 0;
            var i = 0;
            while (total < value && i < rows.length)
            {
                // sometimes the database contains invalid values needs to be fixed
                if (rows[i].address != undefined && iota.valid.isAddress(rows[i].address) && rows[i].balance > 0)
                {
                    var input = {};
                    debug_output("FUNDING ADR: "+rows[i].address+" BALANCE: "+rows[i].balance,4);
                    input.address = iota.utils.noChecksum(rows[i].address);

                    if (rows[i].securityLevel == undefined)
                    { input.security = config[cmd_filename].addressSecurityLevel; }
                    else
                    { input.security = rows[i].securityLevel; }

                    input.security = config[cmd_filename].addressSecurityLevel;
                    input.keyIndex = parseInt(rows[i].index);
                    funding_array.push(input);
                    total += parseInt(rows[i].balance);
                }
                i++;
            }
            if (total < value)
            {
                error_output("Your balance is insufficient! Found a total of "+total+" IOTA");
                return;
            }
        }
        if (total == value)
        {
            // We add a remainder address to the transfer, but this is not going to be used
            // since amount and balance matches, so this address should be kept in status new
            var remainder_adr = await get_new_address(db_handle,iota,seed,'new');
        }
        else
        {
            var remainder_adr = await get_new_address(db_handle,iota,seed);
        }

        remainder_adr = iota.utils.noChecksum(remainder_adr.address);
        options = { address: remainder_adr, inputs: funding_array };
        debug_output("OPTIONS: "+JSON.stringify(options),9);
    }
    value = parseInt(value);
    var transfers = [{ "address": dst_address, "value": value , message: message, tag: tag}];
    debug_output("TRANSFER OBJ: "+JSON.stringify(transfers),9);

    var result =  await doTransfer(iota, seed, transfers, options);
    return result;
}

function doTransfer(iota, from_seed,transfers,options)
{
    return new Promise( function(resolve, reject)
                        {
                            var depth = 5; // Depth for tip selection algo

                            // Some help needed here if i set minWeightMagnitude to 18 the PoW takes very long
                            // so i set it to 15 which sometimes triggers a Invalid transaction hash error
                            // question why is there an error ans what does minWeightMagnitude mean precisely
                            // the lower it is set the more errors occur ... strange

                            // OK got some help on this, 15 is OK for mainnet now. PoW is done
                            // changing the nonce till the transaction hash has 15 Trits = 5 Trytes at its
                            // end which are Zero displayed by the digit 9.
                            // Conclusion: 15 shoud work here.
                            var minWeightMagnitude = 15;
                            iota.api.sendTransfer(from_seed, depth, minWeightMagnitude, transfers ,options,
                            function(error, success)
                            {
                                if (error) {  reject(error);  } else {  resolve(success);  }
                            } );
                        });
}
