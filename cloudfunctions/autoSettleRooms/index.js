const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async () => {
  const now = new Date()
  const expireTime = new Date(now.getTime() - 4 * 60 * 60 * 1000)

  const res = await db.collection('rooms')
    .where({
      status: 'playing',
      lastActiveTime: db.command.lt(expireTime)
    })
    .get()

  for (const room of res.data) {
    try {
      await cloud.callFunction({
        name: 'settleRoom',
        data: { roomId: room._id }
      })
      
      console.log(`✅ 自动结算房间：${room._id}`)
    } catch (e) {
      console.error(`❌ 自动结算失败：${room._id}`, e)
    }
  }

  return { count: res.data.length }
}