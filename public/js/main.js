$(document).ready(function() {
    // Initialize variables
    var $window = $(window);
    var socket = io();
    socket.on('response', function (errorMsg) {
        console.log(errorMsg);
        swal({
          type: 'success',
          title: 'IOTA successfully sent!',
          text: errorMsg,
          html: 'Check your Wallet'
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
      text: address + ' this may take up to 10 minutes!',
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
    // Whenever the server emits 'balance', show the actual balance
      socket.on('balance', function (balance) {
        //   console.log(balance);
          // Update total balance
          $("#iota__balance").html(balance.toString());
      });

    //GetDataFromForm
    function getDataFromForm(){
        return $("#sendIotaInput").val();
    }
    });
