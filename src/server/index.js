/**
 * Created by Moyu on 16/8/19.
 */

var app = require('http').createServer(handler)
var io = require('socket.io')(app);
var fs = require('fs');
var URL = require('url');
var p = require('path');
var dateFormat = require('dateformat');
const EventEmitter = require('events');
class MyEmitter extends EventEmitter {}
const myEmitter = new MyEmitter();

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

app.listen(9888, () => {
    console.log(`http://localhost:${app.address().port}`)
});

function handler (req, res) {
    let url = req.url
    let q = URL.parse(req.url, true).query
    if(url.startsWith(SUFFIX)) {
        if(q.id!=0)
            gs.getMvUrl(q.id)
                .then(json => {
                    if(json.hurl || json.murl) {
                        res.writeHead(200, {'Content-Type': u.suffix2Type('mp4')});
                        var s = gs.getStream(json.hurl || json.murl)
                        s.on('error', (err) => {
                            s.close && s.close()
                            console.error(err)
                            res.end()
                        })
                        s.pipe(res)
                    } else {
                        res.writeHead(500);
                        res.end('Error '+JSON.stringify(json))
                    }
                })
        else {
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
    }

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
    console.log(url, filename, ext)
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
                .emit('play', Object.assign({fixTime: true}, songs.getFirst()) )
            socket.name = ( (name!=null&&name!='') ? name : makeName() )

            socket.on('bullet', (data) => {
                if(socket.lastSend && (Date.now()-socket.lastSend)<5000) {

                    socket.emit('bullet', Object.assign(data, {isSelf: true, forbid: true}))

                } else {
                    socket.lastSend = Date.now()

                    socket.emit('bullet', Object.assign(data, {isSelf: true}))
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
                socket.emit('play', songs.getFirst())
            }).on('deleteSong', function (id) {
                let success = songs.deleteSelfSong(socket._id, id)
                if(success) {
                    broadcast('deleteSong', { isSelf: success, id: id })
                    // socket.emit('play', songs.getFirst())
                }else {
                    socket.emit('deleteSong', { isSelf: success, id: id })
                }
            }).on('reqsong', function (song) {
                const v = '点歌 ' + song.name+' - '+song.author
                socket.emit('bullet', {isSelf: true, val: v})
                socket.broadcast.emit('bullet', {val: v})
                requestSongWorker(song, socket)
            })
        }).on('disconnect', ()=> {
            // songs.removeUserSongs(socket._id)
        }).on('play', () => {
            if(Object.keys(socket.server.sockets.sockets).length>1) {
                socket.playTimer = setTimeout(function () {
                    socket.emit('play', songs.getFirst())
                }, 5000)
                socket.broadcast.emit('currentTime', socket.id)
            }
            else
                socket.emit('play', songs.getFirst())
        }).on('currentTime', (json) => {
            let findId = Object.keys(socket.server.sockets.sockets).find((x) => {
                return x == json.id
            })
            delete json.id
            if(findId) {
                clearTimeout(socket.server.sockets.sockets[findId].playTimer)
                socket.server.sockets.sockets[findId].emit('play', Object.assign(json, songs.getFirst()))
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



const makeName = (() => {
    let id = 0
    return () => {
        return `游客${id++}号`
    }
})()

const requestSongWorker = (song, socket) => {
    let id = song.id
    if(songs.exists(id)) {
        socket.emit('putSong', {code: 500, message: song.name + '已经在点歌列表中'})
    } else {
        Log(`${dateFormat(Date.now(), 'yyyy-mm-dd HH:MM:ss')},${socket.name},${socket._id},${song.name}`)
        Object.assign(song, {username: socket.name, userid: socket._id})
        if(song.mv!=null) {
            songs.add(Object.assign({}, song, {
                url: SUFFIX + '?id=' + song.mv,
                mv: song.mv
            }))
            socket.broadcast.emit('putSong', {code: 200, song: song})
            song.isSelf = true
            socket.emit('putSong', {code: 200, song: song})
            if(songs.size() == 1) {
                broadcast('play', songs.getFirst())
            }
        } else {
            gs.getSongUrl(id).then((x) => {
                if(x.code!=200) {
                    socket.emit('putSong', {code: 500, message: x.msg})
                } else {
                    songs.add(Object.assign({}, song, x.data))
                    socket.broadcast.emit('putSong', {code: 200, song: song})
                    song.isSelf = true
                    socket.emit('putSong', {code: 200, song: song})
                    if(songs.size() == 1) {
                        broadcast('play', songs.getFirst())
                    }
                }
            })
        }
    }
}

