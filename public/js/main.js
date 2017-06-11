$(document).ready(function() {
    // Initialize variables
    var $window = $(window);
    var address = getDataFromForm()
    var socket = io();
    //console.log("Document Ready");
    //Attach Eventlistener
    $( "#sendIotaBtn" ).click(function() {
        alert(getDataFromForm());
        console.log(getDataFromForm());
        //TODO Clean Input Data of unwanted Stuff?
        // Socket events
        socket.emit('send', getDataFromForm());
        //Add Response for Iota is Sending


    });
    // Whenever the server emits 'balance', show the actual balance
      socket.on('balance', function (balance) {
          console.log(balance);
          // Update total balance
          $("#iota__balance").html(balance);
      });
      socket.on('response', function (errorMsg) {
          console.log(errorMsg);
      });
    //GetDataFromForm
    function getDataFromForm(){
        return $("#sendIotaInput").val();
    }
    });
