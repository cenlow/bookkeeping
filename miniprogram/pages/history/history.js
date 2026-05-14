Page({
  data: {
    list: []
  },

  onLoad() {
    this.getHistory()
  },

  getHistory() {
    wx.cloud.callFunction({
      name: 'getUserHistory',
      success: res => {
        if (res.result.code === 0) {
          this.setData({
            list: res.result.list.map(item => ({
              ...item,
              settleTime: this.formatTime(item.settleTime)
            }))
          })
        }
      }
    })
  },

  formatTime(time) {
    const d = new Date(time)
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${d.getMinutes()}`
  },

  goDetail(e) {
    wx.navigateTo({
      url: `/pages/settle/settle?roomId=${e.currentTarget.dataset.id}`
    })
  }
})