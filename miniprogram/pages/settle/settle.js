Page({
  data: {
    transfers: []
  },

  onLoad(options) {
    const { roomId } = options
    this.setData({ roomId })
    this.doSettle()
  },
  // ✅ 返回首页
  goHome() {
    wx.navigateTo({
      url: `/pages/index/index`
    })
  },
  doSettle() {
    
  }
})