const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { pageSize = 10, pageNum = 1 } = event

  const skip = (pageNum - 1) * pageSize

  const res = await db.collection('rooms')
    .where({
      status: 'settled',
      'members.openid': OPENID // ✅ 当前用户参与的房间
    })
    .orderBy('settleTime', 'desc')
    .skip(skip)
    .limit(pageSize)
    .get()

  return {
    code: 0,
    list: res.data
  }
}