const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
exports.main = async (event) => {
  try {
    const { roomId } = event
    if (!roomId) return { code: -1, msg: '缺少 roomId' }

    const room = (await db.collection('rooms').doc(roomId).get()).data
    if (!room || room.status === 'settled') {
      return { code: -2, msg: '房间已结算或不存在' }
    }

    const members = room.members || []
    if (!Array.isArray(members)) {
      return { code: -3, msg: 'members 数据异常' }
    }
    // ===== 结算算法 =====
    const winners = members
      .filter(m => m.score > 0)
      .map(m => ({ ...m, remain: m.score }))

    const losers = members
      .filter(m => m.score < 0)
      .map(m => ({ ...m, remain: -m.score }))

    const transfers = []

    const teaMoney=room.teaMoney;
    if(teaMoney>0){
      let teaPayer = null
      let maxLoss = 0
      for (const m of members) {
        if (m.score < 0 && Math.abs(m.score) > maxLoss) {
          maxLoss = Math.abs(m.score)
          teaPayer = m
        }
      }
      transfers.push({
        from: teaPayer.openid,
        fromName: teaPayer.nickName,
        to: 'system',          // 或公共池
        toName: '茶水钱',
        amount: teaMoney,
        type: 'tea'
      })
    }
    let i = 0, j = 0
    while (i < losers.length && j < winners.length) {
      const pay = Math.min(losers[i].remain, winners[j].remain)
      transfers.push({
        from: losers[i].openid,
        fromName: losers[i].nickName,
        to: winners[j].openid,
        toName: winners[j].nickName,
        amount: pay
      })
      losers[i].remain -= pay
      winners[j].remain -= pay
      if (losers[i].remain === 0) i++
      if (winners[j].remain === 0) j++
    }

    // ===== 更新房间 =====
    await db.collection('rooms').doc(roomId).update({
      data: {
        status: 'settled',
        settleResult: transfers,
        settleTime: new Date()
      }
    })

    // ===== ✅ 更新用户统计 =====
    const _ = db.command
    for (const member of members) {
      const q = db.collection('userStats').where({
        _openid: member.openid   // 确保字段名是 _openid
      })
    
      const exist = await q.get()
    
      if (exist.data.length > 0) {
        const old = exist.data[0]
        const newTotal = old.totalGames + 1
        const newWin = old.winGames + (member.score > 0 ? 1 : 0)
        await q.update({
          data: {
            totalGames: newTotal,
            winGames: newWin,
            updateTime: new Date()
          }
        })
      } else {
        await db.collection('userStats').add({
          data: {
            _openid: member.openid,   // 必须带 _openid
            totalGames: 1,
            winGames: member.score > 0 ? 1 : 0,
            updateTime: new Date()
          }
        })
      }
    }
    console.log("统计完成")
    return { code: 0, transfers }
  } catch (err) {
    console.error('settleRoom error:', err)
    return { code: -99, msg: '服务器错误', error: err.message }
  }
}