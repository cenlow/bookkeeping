const cloud = require('../getRoomQRCode/node_modules/wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { roomId, changes, note = '' } = event

  /*
    changes 示例：
    [
      { openid: 'a', delta: +10 },
      { openid: 'b', delta: -10 }
    ]
  */

  if (!roomId || !Array.isArray(changes)) {
    return { code: -1, msg: '参数错误' }
  }

  const room = await db.collection('rooms').doc(roomId).get()
  if (!room.data) {
    return { code: -1, msg: '房间不存在' }
  }

  const updateData = {}
  const records = []

  changes.forEach(c => {
    updateData[`scores.${c.openid}`] = db.command.inc(c.delta)
    records.push({
      type: 'score',
      from: OPENID,
      target: c.openid,
      delta: c.delta,
      note,
      time: new Date()
    })
  })

  await db.collection('rooms').doc(roomId).update({
    data: {
      ...updateData,
      records: db.command.push(records)
    }
  })

  return { code: 0, msg: '记账成功' }
}