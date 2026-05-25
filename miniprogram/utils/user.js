const REMARK_KEY = 'REMARK_MAP'

export const Remark = {
  // 获取全部备注
  getAll() {
    return wx.getStorageSync(REMARK_KEY) || {}
  },

  // 获取单个备注
  get(openid) {
    return this.getAll()[openid] || ''
  },

  // 设置备注
  set(openid, name) {
    const map = this.getAll()
    if (!name) {
      delete map[openid]
    } else {
      map[openid] = name
    }
    wx.setStorageSync(REMARK_KEY, map)
  },

  // 显示名称（优先备注）
  display(user) {
    const remark = this.get(user.openid)
    return remark || user.nickName
  }
}