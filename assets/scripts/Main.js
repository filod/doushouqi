
const ResUtils = require("./gameFrame/ResUtils");
const GameConst = require("GameConst");

const mvs = require('./macthvs/Mvs')
const MvsConfig = require('./macthvs/MvsConfig')

cc.Class({
    extends: cc.Component,

    properties: {
        loading: cc.Node
    },

    onLoad: function () {
        mvs.response.initResponse = this.initResponse.bind(this);
        cc.log('开始初始化')
        try {
            var result = mvs.engine.init(mvs.response, MvsConfig.channel, MvsConfig.platform, MvsConfig.gameId)
            cc.log('开始初始化2')
            if (result !== 0)
                cc.log('初始化失败,错误码:' + result);
        } catch (e) {
            cc.log(e);
        }

    },

    start() {
        cc.global = {
            events: []
        };
    },


    onDanjiStart1(event){
        cc.global.isDanRenDanJi = true;
        this.startGame();
    },

    onDanjiStart2(event){
        cc.global.isShuangRenDanJi = true;
        this.startGame();
    },

    onStartGame(event) {
        cc.log('开始进入房间');
        cc.global.isLianwang = true;
        mvs.response.joinRoomResponse = this.joinRoomResponse.bind(this);
        var result = mvs.engine.joinRandomRoom(MvsConfig.MAX_PLAYER_COUNT, '')
        if (result !== 0)
            cc.log('进入房间失败,错误码:' + result)
    },

    startGame() {
        var loading = this.loading.getComponent('Loading');
        loading.loadScene("game");
        this.loading.active = true;
    },

    initResponse: function (status) {
        cc.log('初始化成功，开始注册用户');
        mvs.response.registerUserResponse = this.registerUserResponse.bind(this); // 用户注册之后的回调
        var result = mvs.engine.registerUser();
        if (result !== 0)
            cc.log('注册用户失败，错误码:' + result);
        else
            cc.log('注册用户成功');
    },

    registerUserResponse: function (userInfo) {
        var deviceId = 'abcdef';
        var gatewayId = 0;

        cc.global.userInfo = userInfo;

        cc.log('开始登录,用户Id:' + userInfo.id)

        mvs.response.loginResponse = this.loginResponse.bind(this); // 用户登录之后的回调
        var result = mvs.engine.login(userInfo.id, userInfo.token,
            MvsConfig.gameId, MvsConfig.gameVersion,
            MvsConfig.appKey, MvsConfig.secret,
            deviceId, gatewayId);

        if (result !== 0)
            cc.log('登录失败,错误码:' + status);
    },

    loginResponse: function (info) {
        if (info.status !== 200) {
            cc.log('登录失败,异步回调错误码:' + info.status)
            return;
        }
        cc.log('登录成功')
    },

    joinRoomResponse: function (status, userInfoList, roomInfo) {
        if (status !== 200) {
            cc.log('进入房间失败,异步回调错误码: ' + status);
            return;
        } else {
            cc.log('进入房间成功');
            cc.log('房间号: ' + roomInfo.roomId);
        }

        var userIds = [cc.global.userInfo.id]
        userInfoList.forEach(function (item) { 
            if (cc.global.userInfo.id !== item.userId)
                userIds.push(item.userId);
        });
        cc.log('房间用户: ' + userIds);

        mvs.response.sendEventNotify = this.sendEventNotify.bind(this); // 设置事件接收的回调
        if (userIds.length >= MvsConfig.MAX_PLAYER_COUNT) {
            mvs.response.joinOverResponse = this.joinOverResponse.bind(this); // 关闭房间之后的回调
            var result = mvs.engine.joinOver("");
            cc.log("发出关闭房间的通知");
            if (result !== 0) {
                cc.log("关闭房间失败，错误码：", result);
            }

            cc.global.playerUserIds = userIds;
        }
    },

    joinOverResponse: function (joinOverRsp) {
        if (joinOverRsp.status === 200) {
            cc.log("关闭房间成功");
            this.notifyGameStart();
        } else {
            cc.log("关闭房间失败，回调通知错误码：", joinOverRsp.status);
        }
    },

    notifyGameStart: function () {
        cc.global.isRoomOwner = true;

        var cardData = GameConst.getCardData();
        cardData.shuffle();
        var event = {
            action: MvsConfig.Event.GAME_START_EVENT,
            userInfoList: [
            {
                userId: cc.global.playerUserIds[0],
                name: '大王',
                head: Math.random2(1, 8),
                sex: Math.random2(1, 2),
                playerType: GameConst.PlayerType.Red
                
            }, 
            {
                userId: cc.global.playerUserIds[1],
                name: '小王',
                head: Math.random2(1, 8),
                sex: Math.random2(1, 2),
                playerType: GameConst.PlayerType.Blue
            }],
            firstPlayerType: Math.random2(1, 2),
            cardData: cardData
        };

        cc.global.playerUserList = event.userInfoList;
        cc.global.firstPlayerType = event.firstPlayerType;
        cc.global.cardData = event.cardData;

        mvs.response.sendEventResponse = this.sendEventResponse.bind(this); // 设置事件发射之后的回调
        var result = mvs.engine.sendEvent(JSON.stringify(event));
        if (result.result !== 0) {
            cc.log('发送游戏开始通知失败，错误码' + result.result)
            return;
        }

        // 发送的事件要缓存起来，收到异步回调时用于判断是哪个事件发送成功
        cc.global.events[result.sequence] = event;
        cc.log("发起游戏开始的通知，等待回复");
    },

    sendEventResponse: function (info) {
        if (!info
            || !info.status
            || info.status !== 200) {
            cc.log('事件发送失败')
            return;
        }

        var event = cc.global.events[info.sequence]

        if (event && event.action === MvsConfig.Event.GAME_START_EVENT) {
            delete cc.global.events[info.sequence]
            this.startGame();
        }
    },

    sendEventNotify: function (info) {
        if (info
            && info.cpProto
            && info.cpProto.indexOf(MvsConfig.Event.GAME_START_EVENT) >= 0) {

            var event = JSON.parse(info.cpProto);
            cc.global.playerUserList = event.userInfoList;
            cc.global.firstPlayerType = event.firstPlayerType;
            cc.global.cardData = event.cardData;
            
            this.startGame();
        }
    },

});
