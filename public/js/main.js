$(document).ready(function() {
    // Initialize variables
    var $window = $(window);
    var socket = io();

    var iota = new IOTA({'host': 'http://165.227.128.198', 'port': 14265});
    //set the initial Balance from Cache, update every 10 seconds from file
    updateSupply()
    setInterval(function(){updateSupply()}, 10000);
    //console.log("Document Ready");
    //Attach Eventlistener
    $( "#sendIotaBtn" ).click(function() {
        //alert(getDataFromForm());
        //TODO Clean Input Data of unwanted Stuff?
        var address = getDataFromForm()
        if (address === "") {
            //empty Address
            return
        }
        //Add Response for Iota is Sending
    swal({
      type: 'question',
      title: 'Please confirm your address!',
      text: address + '  | this may take up to 10 minutes, please wait!',
      confirmButtonText: 'Confirm Address',
      showLoaderOnConfirm: true,
      preConfirm: function () {
           return new Promise(function (resolve, reject) {
          // Send event
          socket.emit('sendTransfer', getDataFromForm(), function (trytes) {
              console.log("Client POW Start");
              if (trytes === "Address ERROR!") {
                   reject("Address ERROR!")
              }
              //  console.log(trytes);
                  iota.api.sendTrytes(trytes, 4, 15, function(error){
                      if (error) {
                          console.log(error)
                          reject(error)
                      } else {
                          console.log("IOTA POW Done");
                          resolve()
                      }
             });
          });
         })
      },
      allowOutsideClick: false
  }).then(function () {
      swal({
        type: 'success',
        title: 'Transfer Successful!',
        text: "Check your Wallet!"
      })
    });
});
    //GetDataFromForm
    function getDataFromForm(){
        return $("#sendIotaInput").val();
    }
    //updateSupply
    function updateSupply(){
        $.getJSON( "./balancecache.json", function( data ) {
            var balance = data.balance;
            $("#iota__balance").html(balance.toString());
        });
    }

});
