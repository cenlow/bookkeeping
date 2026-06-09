const cloud = require('../autoSettleRooms/node_modules/wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { roomId, from,fromName, to, targetNickname,amount } = event
  const tx = await db.startTransaction()
  try {
    // 1️⃣ 读取房间
    const roomRes = await tx.collection('rooms').doc(roomId).get()
    if (!roomRes.data) {
      throw new Error('房间不存在')
    }

    const room = roomRes.data

    // 2️⃣ 查找成员
    const members = room.members.map(m => {
      if (m.openid === from) {
        return { ...m, score: m.score - amount }
      }
      if (m.openid === to) {
        return { ...m, score: m.score + amount }
      }
      return m
    })

    // 3️⃣ 构造转账记录
    const record = {
      _id: `${from}_${to}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'transfer',
      from,
      fromName,
      targetNickname,
      to,
      amount,
      time: new Date()
    }

    // 4️⃣ 原子更新
    await tx.collection('rooms').doc(roomId).update({
      data: {
        members,
        records: _.unshift(record),   // ✅ 原子追加
        toTransfer: record,
        lastActiveTime: new Date()
      }
    })

    await tx.commit()
    return { code: 0 }
  } catch (err) {
    await tx.rollback()
    return { code: -1, msg: err.message }
  }
}