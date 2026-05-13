const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = async (event, context) => {
  const { shortId } = event

  if (!shortId) {
    return { code: -1, msg: '缺少 shortId' }
  }
  const scene = "r="+shortId;
  console.log(scene);
  const result = await cloud.openapi.wxacode.getUnlimited({
    scene,
    page: 'pages/room/room',
    width: 430
  })

  return {
    qrBase64: `data:image/png;base64,${result.buffer.toString('base64')}`
  }
}