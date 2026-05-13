const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { roomId, shortId, userInfo } = event

  if (!roomId && !shortId) {
    return { code: -1, msg: '缺少房间参数' }
  }
  console.log(userInfo);
  let room

  // 1️⃣ 通过 shortId 或 roomId 查房间
  if (shortId) {
    const res = await db.collection('rooms')
      .where({
        shortId,
        status: 'playing'
      })
      .limit(1)
      .get()

    if (res.data.length === 0) {
      return { code: -1, msg: '房间不存在或已结束' }
    }

    room = res.data[0]
  } else {
    const res = await db.collection('rooms').doc(roomId).get()
    if (!res.data) {
      return { code: -1, msg: '房间不存在' }
    }
    room = res.data
  }
 // 2️⃣ 校验房间状态
 if (room.status !== 'playing') {
  return { code: -1, msg: '房间已结束' }
}

if (room.members.length >= room.maxMembers) {
  return { code: -1, msg: '房间已满' }
}
  let currentOpenId=userInfo.openId;
  if(!currentOpenId){
    currentOpenId=OPENID;
  }
  const exists = room.members.find(m => m.openid === currentOpenId)
  if (exists) {
    return { code: -1, msg: '已在房间' }
  }

  await db.collection('rooms').doc(room._id).update({
    data: {
      members: db.command.push({
        openid: OPENID,
        nickName: userInfo?.nickName || '游客',
        avatarUrl: userInfo?.avatarUrl || '',
        score: 0
      }),
    }
  })

  return { code: 0, msg: '加入成功' }
}