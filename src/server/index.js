#!/usr/bin/env node
/**
 * Created by Moyu on 16/8/19.
 */

var http = require('http')
var app = http.createServer(handler)
var io = require('socket.io')(app);
var fs = require('fs');
var URL = require('url');
var p = require('path');
var dateFormat = require('dateformat');
var argv = require('minimist')(process.argv.slice(2))

var gs = require('../getsong')
var u = require('../utils')
const SUFFIX = '/api/mv'
const SUG_SUFFIX = '/api/sug'
const songs = u.songs

const log = fs.createWriteStream(p.resolve(__dirname, '../log.log'), {flags: 'a'})
function Log(text) {
    console.log(text)
    log.write(text + '\r\n')
}

app.listen(argv.p || 9888, () => {
    console.log(`http://localhost:${app.address().port}`)
});

function handler (req, res) {
    if (p.normalize(decodeURI(req.url)) !== decode.decodeURI(req.url)) {
        res.statusCode = 403;
        res.end();
        return;
    }
    let url = req.url
    console.log(url)
    let q = URL.parse(req.url, true).query

    if(url.startsWith(SUFFIX)) {

        if(q.id!=0) {
            gs.getMvUrl(q.id)
            .then(json => {
                if(json.hurl || json.murl ) {

                    gs.forwardRequest(req, res, json.hurl || json.murl);

                } else {
                    res.writeHead(500);
                    res.end('Error '+JSON.stringify(json))
                }
            })
        } else {
            res.writeHead(500);
            res.end('Error')
        }

        return

    } else if(url.startsWith(SUG_SUFFIX)) {
        gs.getSongs(q.s)
        .then(json=>{
            res.end(JSON.stringify(json))
        })
        return
    } else if(url.startsWith('/api/song')) {
        if(q.id!= null && q.id>0) {
            gs.getSongUrl(q.id)
                .then(x=>{
                    if(x.code!=200){
                        res.end('Error: '+x.msg)
                        return
                    }
                    return gs.getStream(x.data.url)
                        .then(s => {
                            s.on('error', (err) => {
                                s.close && s.close()
                                console.error(err)
                                res.end()
                            })
                            res.writeHead(200, {'Content-Type': 'audio/mpeg'})
                            s.pipe(res)
                        })
                })
        } else {
            res.writeHead(500);
            res.end('Error')
        }
        return
    }
    // if(url=="/stream") {
    //     res.writeHead(200, {
    //         'Content-Type': 'text/event-stream',
    //         'Cache-Control': 'no-cache'
    //     })
    //     setInterval(function () {
    //         res.write("data: " + Date.now()+"\n\n")
    //     }, 1000)
    //     return;
    // }
    let queryIndex = url.lastIndexOf('?')
    if(queryIndex >= 0) {
        url = url.slice(queryIndex)
    }
    let filename = url=='/'?'index.html':url.substring(1)
    let dotIndex = filename.lastIndexOf('.')
    let ext
    if(dotIndex >= 0) {
        ext = filename.substring(dotIndex+1)
    }
    fs.readFile(p.resolve(__dirname, 'static', filename),
        function (err, data) {
            if (err) {
                res.writeHead(500, {'Content-Type': u.suffix2Type(ext)});
                return res.end(`Error loading ${filename}.`);
            }
            res.writeHead(200, {'Content-Type': u.suffix2Type(ext)});
            res.end(data);
        });
}

io.on('connection', function (socket) {
    socket.emit('login')
    socket._id = socket.id.substring(2)
    socket
        .on('login', (name) => {
            socket.emit('initSongs', songs.toJSON().map(x=>{
                return Object.assign(x, {
                    isSelf: x.userid==socket._id
                })
            }))
            fixTime(socket)
            socket.name = ( (name!=null&&name!='') ? name : makeName() )
            broadcast('message', {welcome: true, text: socket.name})
            socket.on('bullet', (data) => {
                if(socket.lastSend && (Date.now()-socket.lastSend)<5000) {

                    socket.emit('bullet', Object.assign(data, {isSelf: true, forbid: true}))

                } else {
                    socket.lastSend = Date.now()

                    socket.emit('bullet', Object.assign({}, data, {isSelf: true}))
                    socket.broadcast.emit('bullet', data)

                    broadcast('message', {name: socket.name, text: data.val})

                    let flag = matchSong(data.val)
                    if(flag) {
                        getFirstSong(flag).then((json) => {
                            if(json.code==200) {
                                requestSongWorker(json.song, socket)
                            } else {
                                socket.emit('putSong', json)
                            }
                        })
                    }
                }
            }).on('playEnd', function (id) {
                songs.remove(id)
                playSon(socket)
            }).on('deleteSong', function (id) {
                let success = songs.deleteSelfSong(socket._id, id)
                if(success) {
                    broadcast('deleteSong', { isSelf: success, id: id })
                    // socket.emit('play', songs.getFirst())
                }else {
                    socket.emit('deleteSong', { isSelf: success, id: id })
                }
            }).on('reqsong', function (song) {
                const v = '点歌 ' + song.name+' - '+song.author;
                socket.emit('bullet', {isSelf: true, val: v});
                socket.broadcast.emit('bullet', {val: v});
                requestSongWorker(song, socket);
            })
        }).on('disconnect', ()=> {
            broadcast('message', {bye: true, text: socket.name})
            // songs.removeUserSongs(socket._id)
        }).on('play', () => {
            if(Object.keys(socket.server.sockets.sockets).length>1) {
                socket.playTimer = setTimeout(function () {
                    playSon(socket)
                }, 5000)
                socket.broadcast.emit('currentTime', socket.id)
            }
            else {
                playSon(socket)
            }
        }).on('currentTime', (json) => {
            let findId = Object.keys(socket.server.sockets.sockets).find((x) => {
                return x == json.id
            })
            delete json.id
            if(findId) {
                clearTimeout(socket.server.sockets.sockets[findId].playTimer)
                playSon(socket.server.sockets.sockets[findId], json)
            }

        })
});


function broadcast() {
    io.emit.apply(io, arguments)
}

function matchSong(text) {
    if(/^点歌 (.+)$/.test(text)) {
        return RegExp.$1.trim()
    }
}

function getFirstSong(title) {
    return gs.getSongs(title).then(json => {
        if(json.code==200) {
            json.song = json.result[0]
            delete json.result
            return json
        }
        return json
    })
}

function fixTime(socket) {
    let song = songs.getFirst()
    if(Object.keys(socket.server.sockets.sockets).length>1 && !!song) {
        socket.playTimer = setTimeout(function () {
            playSon(socket)
        }, 5000)
        socket.broadcast.emit('currentTime', {
            socketID: socket.id,
            songID: song.id
        })
    }
    else
        playSon(socket)
}

const makeName = (() => {
    let id = 0
    return () => {
        return `游客${id++}号`
    }
})()

const requestSongWorker = (song, socket, callback) => {
    let id = song.id
    if(songs.exists(id)) {
        socket.emit('putSong', {code: 500, message: song.name + '已经在点歌列表中'})
    } else {
        Log(`${dateFormat(Date.now(), 'yyyy-mm-dd HH:MM:ss')},${socket.name},${socket._id},${song.name}`)
        Object.assign(song, {username: socket.name, userid: socket._id})
        if(song.mv!=null) {
            songs.add(Object.assign({}, song, {
                mvurl: SUFFIX + '?id=' + song.mv,
                mv: song.mv
            }))
            socket.broadcast.emit('putSong', {code: 200, song: song})
            song.isSelf = true
            socket.emit('putSong', {code: 200, song: song})
            if(songs.size() == 1) {
                broadCastPlaySon()
            }
        } else {
            gs.getSongUrl(id).then((x) => {
                if(x.code!=200) {
                    socket.emit('putSong', {code: 500, message: x.msg})
                } else if(x.data.url == null) {
                    socket.emit('putSong', {code: 500, message: '该歌曲无数据'});
                } else {
                    songs.add(Object.assign({}, song, x.data))
                    socket.broadcast.emit('putSong', {code: 200, song: song})
                    song.isSelf = true
                    socket.emit('putSong', {code: 200, song: song})
                    if(songs.size() == 1) {
                        broadCastPlaySon()
                    }
                }
            })
        }
    }
}


function broadCastPlaySon(opt = {}) {
    _playSon(null, opt)
}
function _playSon(socket, opt) {
    let fn = socket ? socket.emit.bind(socket) : broadcast
    let first = songs.getFirst()
    if(first) {
        if(first.mv>0) {
            fn('play', Object.assign(opt, first))
        } else {
            gs.getSongUrl(first.id)
                .then(x=>{
                    gs.getLyric(first.id)
                        .then(y => {
                            fn('play', Object.assign(opt, first, x.data, {lyric: y}));
                        })
                })
        }
    }
    else
        fn('play')
}
function playSon(socket, opt = {}) {
    _playSon(socket, opt)
}
