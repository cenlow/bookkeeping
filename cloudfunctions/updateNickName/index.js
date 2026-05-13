// cloudfunctions/updateNickName/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { nickName } = event

  // 1. 校验参数
  if (!nickName || nickName.trim() === '') {
    return {
      success: false,
      msg: '昵称不能为空'
    }
  }

  try {
    // 2. 查询 user 表是否存在该用户
    const userRes = await db.collection('users')
      .where({
        openid: OPENID
      })
      .get()

    if (userRes.data.length === 0) {
      // 如果没有记录，则创建一条（首次修改昵称）
      await db.collection('users').add({
        data: {
          openid: OPENID,
          nickName: nickName,
          avatarUrl: '', // 默认头像为空，后续可扩展
          updateTime: new Date()
        }
      })
    } else {
      // 如果有记录，则更新昵称
      await db.collection('users')
        .where({
          openid: OPENID
        })
        .update({
          data: {
            nickName: nickName,
            updateTime: new Date()
          }
        })
    }

    return {
      success: true,
      msg: '修改成功'
    }

  } catch (err) {
    console.error(err)
    return {
      success: false,
      msg: '服务器错误'
    }
  }
}