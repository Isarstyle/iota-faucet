$(document).ready(function() {
    // Initialize variables
    var $window = $(window);
    var socket = io();

    //set the initial Balance from Cache, update every 10 seconds from file
    updateSupply()
    setInterval(function(){updateSupply()}, 10000);
    
    socket.on('response', function (errorMsg) {
        console.log(errorMsg);
        swal({
          type: 'success',
          title: 'Transfermessage!',
          text: errorMsg
        })

    })
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
      text: address + '  | this may take up to 10 minutes until you can see it in your wallet!',
      confirmButtonText: 'Confirm Address',
      showLoaderOnConfirm: true,
      preConfirm: function () {
          // Send event
          socket.emit('send', getDataFromForm());
          //just wait a minute
          return new Promise(function (resolve) {
              setTimeout(function() {
                  resolve()
              }, 60000)
          })
      },
      allowOutsideClick: false
    })
    });
    // Whenever the server emits 'balance', update the balance
      socket.on('balance', function (balance) {
        //   console.log(balance);
          // Update total balance
          $("#iota__balance").html(balance.toString());
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
