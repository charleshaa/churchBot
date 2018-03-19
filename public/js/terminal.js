var ws;

const setupEvents = (events, ws) => {
    for (var key in events) {
        if (events.hasOwnProperty(key)) {
            ws[key] = events[key];
        }
    }
};

const displayOutput = msg => {
    var el = $('<p/>');
    el.html(msg);
    $('#stdout').append(el);
};
var cmdHistory;
$(document).ready(function() {
    var historyIndex = 0;
    // SOCKET
    cmdHistory = localStorage.getItem('history');

    if(cmdHistory){
        console.log(cmdHistory);
        cmdHistory = JSON.parse(cmdHistory);
    } else {
        cmdHistory = [];
    }
    console.log(location.protocol.replace(/^http/, 'ws') + '//' + location.hostname);
    var HOST = location.protocol.replace(/^http/, 'ws') + '//' + location.hostname + ':8080';
    ws = new WebSocket(HOST);

    var stdin = $('#cmd');
    var home = $('#home');

    const SOCK_EVENTS = {
        onopen: () => {
            // Web Socket is connected, send data using send()
            ws.send("Hey there !");
            console.log("Sent message");
        },
        onmessage: (e) => {
            var msg = e.data;
            console.log("Message received", msg);
            displayOutput(msg);
        },
        onclose: () => {
            // websocket is closed.

        }
    };

    setupEvents(SOCK_EVENTS, ws);

    window.onbeforeunload = function(event) {
        ws.close();
    };

    const processCmd = cmd => {
        stdin.val('');
        console.log('Sending command', cmd);
        ws.send(cmd);
        var rappel = $('<p class="rappel"></p>');
        rappel.text(">> Command: " + cmd);
        $('#stdout').append(rappel);
        cmdHistory.push(cmd);
        localStorage.setItem('history', JSON.stringify(cmdHistory));
    };


    stdin.focus();
    home.addClass('open');

    // Debug
    //console.log(sectionArray);

    // Command Input------------------------------

    stdin.keyup(function(e) {

        if (e.which == 13) { // ENTER key pressed

            var cmd = stdin.val();
            if(cmd === "history"){
                cmdHistory.forEach(function(val, index){
                    displayOutput(val);
                });
                return;
            }
            historyIndex = 0;
            processCmd(cmd);

        } // end if ENTER key pressed

        if (e.which == 38){ // up arrow
            if(historyIndex < cmdHistory.length){
                stdin.val(cmdHistory[cmdHistory.length - ++historyIndex]);
            }
        }
        if (e.which == 40){ // down arrow
            console.log("Down arrow on index ", historyIndex, cmdHistory);
            if(historyIndex > 0 && historyIndex <= cmdHistory.length){
                stdin.val(cmdHistory[cmdHistory.length - (--historyIndex)]);
            }
        }
    }); // end keyup function

    // End Command Input-----------------------------

});
