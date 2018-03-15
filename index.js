
const express = require('express');
const app = express();
const path = require('path');
const os = require('os');
const fs = require('fs');
const bodyParser = require('body-parser');
const WebSocket = require('ws');
const env = require('dotenv').config({path: path.join(__dirname, '.env')});

const Database = require('./db');
const db = new Database('testBot');
db.init();

const IG_USERNAME = (process.env.IG_USERNAME || 'plop');
const IG_PASSWORD = (process.env.IG_PASSWORD || 'plavip');
const SOCK_PORT = 8080;
const LIKES_PER_DAY = 1000;
const LIKES_PER_TAG = 10;

var Client = require('instagram-private-api').V1;
var device = new Client.Device('charleshaa');
var storage = new Client.CookieFileStorage(__dirname + '/cookies/charleshaa.json');

var s;
var user;


app.set('port', (process.env.PORT || 3001));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded());
app.use(bodyParser.json());
app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname + '/terminal.html'));
});
app.listen(app.get('port'), function() {
    console.log('Example app listening on port ' + app.get('port'))
});

const wss = new WebSocket.Server({port: SOCK_PORT});
var client;
var likeInterval;
var running = false;
var tagCursor = 0;
var currentSet = [];
var currentSetIndex = 0;
var currentTag;
var hashtags;
var tagLikeCount = 0;
var totalLikeCount = 0;


const output = (msg, type = 'info') => {
    if (console[type]) console[type](msg)
        else console.log(msg);
    if (client) {
        if (typeof msg === "string") {
            return client.send(msg);
        } else if (typeof msg === "object") {
            return client.send(JSON.stringify(msg));
        } else {
            console.error("Error processing message", msg);
            return client.send("" + msg + "");
        }
    } else {
        console.log("Client registered: ", client);
        console.error("No client detected. Was sending msg:", msg);
    }
};

const initInstagram = () => {
    if (s)
        return true;
    Client.Session.create(device, storage, IG_USERNAME, IG_PASSWORD).then(function(session) {
        s = session;
        session.getAccount().then(function(account) {
            output(`Successfully acting as @${account.params.username}.`);
            user = account;
        });

        return session;
    });
};

const resetBot = () => {

    clearInterval(likeInterval);
    currentSet = [];
    running = false;
    output('McBot Face has been halted and reset.', 'warning');

};

const switchTag = (dir = 'next') => {

    currentSetIndex = 0;
    tagCursor = dir === 'next' ? tagCursor + 1 : tagCursor - 1;
    if ( (tagCursor === 0 || tagCursor === -1)  && dir === 'prev') tagCursor = hashtags.length - 1;
    currentTag = hashtags[tagCursor];
    if(!currentTag){
        tagCursor = 0;
        currentTag = hashtags[tagCursor];
        initTagRoutine(currentTag);
    } else {
        initTagRoutine(currentTag);
    }
    output(`Switching to Hashtag #${currentTag}...`, 'info');
};

const routine = () => {
    if(!running){
        return false;
    }
    if(currentSetIndex >= currentSet.length - 1 || currentSetIndex >= LIKES_PER_TAG){
        output('Should wether switch or fail.');
        if(currentSet.length > 1){
            return switchTag();
        } else {
            return false;
        }
    }
    IGM.like(currentSet[currentSetIndex].id);
};

const initTagRoutine = tag => {
    if(likeInterval) clearInterval(likeInterval);
    output(`Starting with Hashtag #${tag}...`, 'info');
    // 24h * 60 minutes * 60 seconds * 1000 miliseconds / LPD
    var delay = (24 * 3600 * 1000) / LIKES_PER_DAY;
    // Start on first item of search results
    currentSetIndex = 0;
    currentTag = tag;
    IGM.search(tag, true);
    likeInterval = setInterval(routine, delay);
};

const IGM = {
    search: (term, start = false) => {
        currentSet = [];
        if(!s) return false;
        var list = new Client.Feed.TagMedia(s, term);
        list.get().then(function(res) {
            var log = `Found ${res.length} items for Hashtag #${term}.`;
            console.log(log);
            output(log);
            res.forEach(function (item, index) {
                    currentSet.push(item.params);
            });
            if(start) routine();
        });
    },
    like: (id, success, error) => {
        if(!id || id === "") return false;
        if(!success){
            success = function(data) {
                var like = new Client.Like(s, {});
                currentSetIndex++;
                output(`Successfully liked media ID ${id}.`, 'success');
                return like;
            };
        }
        if(!error){
            error = function (err) {
                output(err.message, 'error');
                output('ERROR: Here is the response:', 'error');
                output(err, 'error');
            };
        }
        return new Client.Request(s)
                    .setMethod('POST')
                    .setResource('like', {id: id})
                    .generateUUID()
                    .setData({media_id: id, src: "profile"})
                    .signPayload()
                    .send()
                    .then(success).catch(error);

    }
};

const CMD_LIST = {
    connect: initInstagram,
    start: keywords => {
        if(!s) return output('No instagram session active.', 'error');
        if(running){
            output('McBot Face is already at work. Use the "stop" command before starting a new run.', 'warning');
            return false;
        }
        running = true;
        hashtags = keywords.split(',');

        initTagRoutine(hashtags[tagCursor]);


    },
    stop: () => resetBot(),
    next: () => switchTag(),
    prev: () => switchTag('prev'),
    search: tag => {
        console.log("Should perform a search for hashtag: " + tag);
        var list = new Client.Feed.TagMedia(s, tag);
        list.get().then(function(res) {
            output(res[0]);
            output("Got a set of results:");
            output(`<a target="_blank" href="${res[0].params.webLink}">${res[0].params.id}</a>`);
        });
    },
    like: id => {
        if(!id || id === "") return output("ERROR: No ID specified");
        output("Will like media ID: " + id);
        var like = new Client.Request(s)
                    .setMethod('POST')
                    .setResource('like', {id: id})
                    .generateUUID()
                    .setData({media_id: id, src: "profile"})
                    .signPayload()
                    .send()
                    .then(function(data) {
                        output(`Successfully liked media ID ${id}`);
                        return new Client.Like(s, {});
                    }).catch(function (err) {
                        output(err.message);
                        output('ERROR: Here is the response:', 'error');
                        output(err);
                    });

    },
    log: exp => {
        output(eval(`${exp}`), 'info');
    }
};

const SOCK_EVENTS = {
    message: msg => {
        console.log('received command: %s', msg);
        var params = msg.split(' ');
        if (CMD_LIST.hasOwnProperty(params[0])) {
            CMD_LIST[params[0]](params[1]);
        } else {
            output("ERROR: Command not found: " + params[0]);
        }
    }
};

const SERVER_EVENTS = {
    listening: () => {
        console.log('Socket listening on ' + SOCK_PORT);
    },
    connection: ws => {
        setupSocketEvents(ws);
        client = ws;
        if (!s) {
            output(`Ready to start working for @${IG_USERNAME}.`);
        } else {
            output("Botty McBot Face is already connected...");
            output(`He is currently showing some love for @${user.params.username}.`);
        }
    },
    error: err => {
        console.log(err)
    }
};

const setupSocketEvents = (ws) => {
    for (var key in SOCK_EVENTS) {
        if (SOCK_EVENTS.hasOwnProperty(key)) {
            ws.on(key, SOCK_EVENTS[key]);
        }
    }
};

const setupServerEvents = (wss) => {
    for (var key in SERVER_EVENTS) {
        if (SERVER_EVENTS.hasOwnProperty(key)) {
            wss.on(key, SERVER_EVENTS[key]);
        }
    }

};



setupServerEvents(wss);

// Instagram
