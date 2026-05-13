const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { maxMembers = 10, userInfo } = event

  // 1️⃣ 查找未结算房间
  const oldRooms = await db.collection('rooms')
    .where({
      creator: OPENID,
      status: 'playing'
    })
    .orderBy('createTime', 'desc')
    .limit(1)
    .get()

  // 2️⃣ 有 → 直接返回
  if (oldRooms.data.length > 0) {
    return {
      code: 0,
      roomId: oldRooms.data[0]._id,
      shortId: oldRooms.data[0].shortId,
      msg: '已进入未结算房间'
    }
  }

  // 3️⃣ 没有 → 新建（带 shortId 重试）
  let retry = 0
  const MAX_RETRY = 10

  while (retry < MAX_RETRY) {
    // ✅ 生成 4 位 shortId
    const shortId = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0')

    try {
      const result = await db.collection('rooms').add({
        data: {
          creator: OPENID,
          shortId, // ✅ 写入 shortId
          members: [
            {
              openid: OPENID,
              nickName: userInfo?.nickName || '房主',
              avatarUrl: userInfo?.avatarUrl || '',
              score: 0,
              joinTime: Date.now()
            }
          ],
          maxMembers,
          teaMoney: 0,
          records: [],
          status: 'playing',
          createTime: new Date()
        }
      })

      return {
        code: 0,
        roomId: result._id,
        shortId,
        msg: '创建成功'
      }
    } catch (err) {
      // ✅ 唯一索引冲突，重试
      if (err.code === 'DUPLICATE_KEY') {
        retry++
        continue
      }
      throw err
    }
  }

  return {
    code: -1,
    msg: '生成房间失败，请重试'
  }
}