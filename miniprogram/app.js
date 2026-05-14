App({
  onLaunch(options) {
    // ✅ 1. 初始化云开发（只做一次）
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上基础库')
      return
    }

    wx.cloud.init({
      env: 'cloud1-d9gcontpa96247cc2',
      traceUser: true
    })

    // ✅ 2. 保存邀请 roomId
    if (options && options.query && options.query.roomId) {
      this.globalData.inviteRoomId = options.query.roomId
    }
    if(options && options.scene){
      this.globalData.r=options.scene;
    }

    // ✅ 3. 检查登录状态
    this.checkLogin()
  },

  globalData: {
    userInfo: null,
    isLogin: false,
    openid: null,
    inviteRoomId: null
  },

  checkLogin() {
    const userInfo = wx.getStorageSync('userInfo')
    const isLogin = wx.getStorageSync('isLogin')
    const openid=wx.getStorageSync('openid');
    console.log("check login")
    if (userInfo && isLogin) {
      this.globalData.userInfo = userInfo
      this.globalData.isLogin = true
      this.globalData.openid=openid;
    }
  }
})