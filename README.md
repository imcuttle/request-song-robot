# 点歌机器人 (来自网易云音乐) 

偶然的机会，发现了B站的点歌机器人，觉得挺好玩的就自己做了一个简易版点歌机器人，预览如下：

![](/upload/gif1.gif)

## 功能

1. 使用websocket，支持多人同时点歌，发送弹幕聊天
2. 具有搜索suggestion，用户体验更佳
3. 点击mv视频右上角可以缩小放大，不影响用户其他操作
4. 具有mv的资源，优先播放mv
5. 对于未播放的已点歌曲，可以进行取消
6. ...

## 其他说明

由于是实时多人点歌，所以不能够跳过当前播放歌曲，也不能跳跃播放，Mv只能够重头开始播放，mp3能够根据线上其他用户的播放进度进行同步

**音乐资源均来自网易云音乐，该程序仅用于个人学习，不得用于任何商业用途**

关于网易云音乐的接口规则，我就不多说了，因为关于商业机密，可能吃官司的,有兴趣的可以私下找我

## 技术沉淀

![ClipboardImage](/upload/1471696540554.png)
如上图，网易云音乐的请求参数是做了加密处理的。  
关于网易云音乐请求参数的加密方法，简单提下
```js

aesRsaEncrypt: function (text) {
    var secKey = createSecretKey(16);
    return {
        params: aesEncrypt(aesEncrypt(text, nonce), secKey),
        encSecKey: rsaEncrypt(secKey, pubKey, modulus)
    }
}
```

![ClipboardImage](/upload/1471697286239.png)

`secKey`为本地随机生成的密文，通过rsa非对称加密算法加密，然后网易服务器通过约定好的与`pubKey`对应的另一个因数进行解密，得到`secKey`, 然后通过两次aes逆运算就能得到`text`，也就是真实的参数了。  

这样做的好处不言而喻，不法分子很难破解抓取到的请求数据  
但服务器负担加重了，每次提供服务前，还得先去破解一番

另外！网易还做了一点安全措施，调用接口得到音乐url是有时间限制的!!!

![ClipboardImage](/upload/1471697765689.png)

所以，不能够在点歌的时候就把音乐url抓取下来保存，必须得有用户需要播放的时候再抓取url  
而且云音乐的mvurl不支持跨域访问，所以我只好做个代理，转发视频数据流了，但这样做的不好就是mv播放不能跳跃播放（如最上方动图所示），不知有没有大牛知道如何解决这个问题

```javascript

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
                    //传递MV视频数据流
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
}
```

## 最后在上个预览

![](/upload/gif3.gif)

## 源码与使用

```

```

## 参考资料

referer
https://zh.wikipedia.org/zh/HTTP%E5%8F%83%E7%85%A7%E4%BD%8D%E5%9D%80

网易云api破解
http://qianzewei.com/2015/12/10/%E7%BD%91%E6%98%93%E4%BA%91%E9%9F%B3%E4%B9%90api%E6%95%B4%E7%90%86/#

node crypto  
https://nodejs.org/api/crypto.html

输入框光标变色  
http://jsfiddle.net/8k1k0awb/

