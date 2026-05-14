const app = getApp();
const db = wx.cloud.database();
Page({
  data: {
    userInfo: {},
    isLogin: false,
    totalGames: 0,
    winGames: 0,
    winRate: '0%'
  },
  
  onLoad: function() {
    // 检查登录状态
    this.setData({
      userInfo: app.globalData.userInfo || {},
      isLogin: app.globalData.isLogin || false
    });
    
    // 加载用户统计数据
    if (this.data.isLogin) {
      this.loadUserStats();
    }
  },
  
  onShow: function() {
    // 页面显示时刷新数据
    this.setData({
      userInfo: app.globalData.userInfo || {},
      isLogin: app.globalData.isLogin || false
    });
    if (this.data.isLogin) {
      console.log("on show")
      this.loadUserStats();
      this.getCurrentRoom();
    }
  
    if (app.globalData.inviteRoomId) {
      wx.navigateTo({
        url: `/pages/room/room?roomId=${app.globalData.inviteRoomId}`
      })
      app.globalData.inviteRoomId = null
    }
  },
  async getCurrentRoom(){
    console.log('openid:'+app.globalData.openid)
    if(!app.globalData.openid){
      return;
    }
    const _ = db.command;
    const { data } = await db.collection('rooms')
    .where(
      _.and([
        { status: "playing" },
        _.or([
          { creator: app.globalData.openid },
          { "members.openid": _.in([app.globalData.openid]) }
        ])
      ])
    )
    .get();
    console.log(data);
    if(data.length>0){
      wx.navigateTo({
        url: `/pages/room/room?roomId=${data[0]._id}&shortId=${data[0].shortId}`
      })
    }
  },
  // 处理登录/编辑信息按钮点击
  handleLogin: function() {
    if (this.data.isLogin) {
      // 编辑信息
      this.editUserInfo();
    } else {
      // 登录
      this.login();
    }
  },
  
  // 登录方法
  login: function() {
    wx.showLoading({
      title: '登录中...',
    });
    
    // 调用云函数登录
    wx.cloud.callFunction({
      name: 'login',
      success: res => {
        console.log('登录成功', res);
        
        // 保存用户信息
        const userInfo = {
          ...res.result.userInfo,
          openId:res.result.openid,
          uid: res.result.openid.substring(0, 8) + Math.floor(Math.random() * 10000).toString().padStart(4, '0')
        };
        
        wx.setStorageSync('userInfo', userInfo);
        wx.setStorageSync('isLogin', true);
        wx.setStorageSync("openid",res.result.openid);
        
        app.globalData.userInfo = userInfo;
        app.globalData.isLogin = true;
        app.globalData.openid = res.result.openid;
        
        this.setData({
          userInfo: userInfo,
          isLogin: true
        });
        
        // 加载用户统计数据
        this.loadUserStats();
        
        wx.hideLoading();
      },
      fail: err => {
        console.error('登录失败', err);
        wx.hideLoading();
        wx.showToast({
          title: '登录失败',
          icon: 'none'
        });
      }
    });
  },
  
  // 编辑信息
  editUserInfo: function() {
    wx.showModal({
      title: '修改自己的昵称',
      content: '',
      editable: true,
      success: res => {
        if (res.confirm && res.content.trim()) {
          this.updateMyNickname(res.content.trim())
        }
      }
    })
  },
  updateMyNickname(name){
    wx.cloud.callFunction({
      name: 'updateNickName',
      data: {
        nickName: name
      },
      success: res => {
        wx.hideLoading()
        app.globalData.userInfo.nickName = name;
        this.setData({
          userInfo: app.globalData.userInfo
        });
      },
      fail: err => {
        wx.hideLoading()
        console.error(err)
        wx.showToast({ title: '修改名称失败', icon: 'none' })
      }
    })
  },
  // 加载用户统计数据
  loadUserStats: function() {
    // 从云数据库获取用户统计数据
    const db = wx.cloud.database();
    db.collection('userStats').where({
      _openid: app.globalData.openid
    }).get({
      success: res => {
        console.log(res.data);
        if (res.data.length > 0) {
          const stats = res.data[0];
          this.setData({
            totalGames: stats.totalGames || 0,
            winGames: stats.winGames || 0,
            winRate: this.calculateWinRate(stats.totalGames, stats.winGames)
          });
        }
      },
      fail: err => {
        console.error('获取统计数据失败', err);
      }
    });
  },
  
  // 计算胜率
  calculateWinRate: function(total, win) {
    if (total === 0) return '0%';
    const rate = (win / total * 100).toFixed(2);
    return rate + '%';
  },
  // 创建房间
createRoom() {
  if (!this.data.isLogin) {
    wx.showToast({ title: '请先登录', icon: 'none' })
    return
  }

  wx.showLoading({ title: '加载中...' })

  wx.cloud.callFunction({
    name: 'createRoom',
    data: {
      maxMembers: 10,
      userInfo: this.data.userInfo
    },
    success: res => {
      wx.hideLoading()
      if (res.result.code === 0) {
        // ✅ 关键：拿到 roomId 再跳转
        wx.navigateTo({
          url: `/pages/room/room?roomId=${res.result.roomId}&shortId=${res.result.shortId}`
        })
      } else {
        wx.showToast({ title: res.result.msg, icon: 'none' })
      }
    },
    fail: err => {
      wx.hideLoading()
      console.error(err)
      wx.showToast({ title: '创建房间失败', icon: 'none' })
    }
  })
},
parseScene(scene) {
  const obj = {}
  scene.split('&').forEach(item => {
    const [key, value] = item.split('=')
    if (key) obj[key] = value
  })
  return obj
},
  // 扫码加入
  joinRoom: function() {
    if (!this.data.isLogin) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }
    
    wx.scanCode({
      success: (res) => {
        console.log(res);
        // path 示例: pages/room/room?scene=r%3D5542
        const qs = res.path.split('?')[1] || ''
        console.log(qs);
        // 先拿到 scene 字段
        let sceneStr = ''
        qs.split('&').forEach(pair => {
          const [k, v] = pair.split('=')
          if (k === 'scene') sceneStr = decodeURIComponent(v || '')
        })
        // sceneStr 应为: r=5542
        let shortId = ''
        sceneStr.split('&').forEach(pair => {
          const [k, v] = pair.split('=')
          if (k === 'r') shortId = v
        })
        if (!shortId) {
          wx.showToken({ title: '房间码参数异常', icon: 'none' })
          return
        }
        wx.navigateTo({
          url: `/pages/room/room?action=join&shortId=${shortId}`
        });
      },
      fail: (err) => {
        console.error('扫码失败', err);
        wx.showToast({
          title: '扫码失败',
          icon: 'none'
        });
      }
    });
  },
  
  // 联系客服
  contactService: function() {
    wx.showModal({
      title: '客服反馈',
      content: '2327593417@qq.com',
      showCancel: false
    });
  },
  
  // 查看历史记录
  viewHistory: function() {
    wx.navigateTo({
      url: `/pages/history/history`
    })
  },
  
  // 显示帮助
  showHelp: function() {
    wx.showModal({
      title: '如何使用',
      content: '1. 点击登录按钮授权登录\n2. 点击创建房间创建新房间\n3. 点击扫码加入加入已有房间\n4. 在房间内可以记账、查看统计',
      showCancel: false
    });
  },
  onShareAppMessage() {
    return {
      title: '一起来打牌记账',
      path: `/pages/index/index`,
      imageUrl: '/images/share.png'
    }
  }
});