/**
 * Created by Moyu on 16/8/19.
 */

// let ;
/*
 {
 id: '',
 pic: {},
 name: '',
 username: '',
 userid: ''
 }
 */
let songs = []
// const gs = require('../getsong')
let songsMap = {}

module.exports = {
    getFirst: () => {
        return songsMap[songs[0]]
    },
    deleteSelfSong:function (userid, id) {
        if(songsMap[id] && songsMap[id].userid==userid) {
            this.remove(id)
            return true
        }
        return false
    }
    ,
    exists: (id) => {
        return songsMap[id]!=null
    },
    add: (song) => {
        songs.push(song.id)
        songsMap[song.id] = song
    },
    remove: (id) => {
        if(songsMap[id]!=null) {
            delete songsMap[id]
            let i = songs.findIndex(x=>{
                return x == id
            })
            i>=0 && songs.splice(i, 1)
        }
    },
    
    toJSON: () => {
        return songs.map(id=>{
            let x = songsMap[id]
            return {
                id: x.id,
                name: x.name,
                username: x.username,
                userid: x.userid,
                author: x.author,
            }
        })
    },
    size: () => {
        return songs.length
    }
}

