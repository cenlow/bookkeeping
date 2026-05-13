const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 默认头像
const avatars = Array.from({ length: 10 }, (_, i) =>
  `/images/avatar_${String(i + 1).padStart(2, '0')}.png`
)

// 随机昵称池
const adjectives = [
  '快乐的', '聪明的', '爱笑的', '温柔的',
  '酷酷的', '阳光的', '机智的', '可爱的'
]

const nouns = [
  '小猫', '小狗', '老虎', '熊猫',
  '月亮', '星星', '石头', '风儿',
  '小鱼', '小鸟'
]

function generateNickname() {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  return adj + noun
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  // 1️⃣ 查询是否已存在用户
  const userRes = await db.collection('users')
    .where({ openid: OPENID })
    .get()

  if (userRes.data.length > 0) {
    return {
      openid: OPENID,
      userInfo: {
        nickName: userRes.data[0].nickName,
        avatarUrl: userRes.data[0].avatarUrl
      }
    }
  }

  // 2️⃣ 新用户 → 随机昵称 + 随机头像
  const nickname = generateNickname()
  const avatarUrl =
    avatars[Math.floor(Math.random() * avatars.length)]

  const newUser = {
    openid: OPENID,
    nickName: nickname,
    avatarUrl,
    createTime: new Date()
  }

  await db.collection('users').add({
    data: newUser
  })

  return {
    openid: OPENID,
    userInfo: {
      nickName: nickname,
      avatarUrl
    }
  }
}