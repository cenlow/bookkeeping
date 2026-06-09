const app = getApp()
const db = wx.cloud.database()
import lottie from 'lottie-miniprogram'
import { Remark } from '../../utils/user'
import { INTERACTION_TYPES } from '../../utils/interactionConfig'
const ANI_MAP = {
  fuda: require('../../assets/lottie/fuda'),
  bmh: require('../../assets/lottie/bmh'),
  dog: require('../../assets/lottie/dog'),
  call: require('../../assets/lottie/call'),
  flash: require('../../assets/lottie/flash'),
}
Page({
  data: {
    roomId: '',        // 房间ID
    shortId: "",
    myOpenid: '',      // 自己的openid
    userList: [],      // 用户列表（含自己）
    recordList: [],    // 转账记录
    teaMoney: 0,       // 茶水间金额
    qrUrl:'',
    isOwner:false,
    effect: {
      show: false
    },
    currentRoom: {}    // 当前房间信息
  },

  onLoad(options) {
    // 1. 获取房间ID（从路由参数传入）
    let roomId = options.roomId;
    let shortId=options.shortId;
    if (options.scene) {
      const sceneStr = decodeURIComponent(options.scene)
      const params = this.parseQuery(sceneStr)
      const r = params.r
      shortId=r;
    }
    if (!roomId && !shortId) {
      wx.showToast({ title: '房间ID不能为空', icon: 'none' })
      return
    }
    if(!roomId){
      this.getRoomId(shortId);
    }else{
      this.setData({ roomId:roomId,shortId:shortId })
      this.initLogin()
    }
  },
  onShow(){
    // 进入房间页 → 保持屏幕常亮
    wx.setKeepScreenOn({
      keepScreenOn: true,
      fail() {
        wx.setKeepScreenOn({ keepScreenOn: true })
      }
    })
  },
  onHide() {
    wx.setKeepScreenOn({ keepScreenOn: false })
  },
  onUnload() {
    wx.setKeepScreenOn({ keepScreenOn: false })
  },
  parseQuery(str = '') {
    const obj = {}
    if (!str) return obj
  
    str.split('&').forEach(item => {
      const [key, value] = item.split('=')
      if (key) {
        obj[key] = value || ''
      }
    })
    return obj
  },
  async getRoomId(sId){
    let r="";
    const { data } = await db.collection('rooms')
      .where({ shortId: sId })
      .get();
      console.log(data);
    if(data.length>0){
      r=data[0]._id;
      this.setData({ roomId:r,shortId:sId })
      this.initLogin()
    }
  },
  // 初始化登录 & 获取用户信息
  initLogin() {
    const {roomId,shortId}=this.data;
    wx.cloud.callFunction({
      name: 'login',
      success: res => {
        // 保存用户信息
        const userInfo = {
          ...res.result.userInfo,
          openId:res.result.openid,
          uid: res.result.openid.substring(0, 8) + Math.floor(Math.random() * 10000).toString().padStart(4, '0')
        };
        wx.setStorageSync('userInfo', userInfo);
        wx.setStorageSync('isLogin', true);
        app.globalData.userInfo = userInfo;
        app.globalData.isLogin = true;
        app.globalData.openid = res.result.openid;
        
        this.setData({ myOpenid: res.result.openid });
        this.joinRoom({roomId: roomId,shortId: shortId});
        // 3. 进入房间（拉取房间信息、用户列表、记录）
        this.enterRoom()
      },
      fail: err => {
        var msg = "登录失败"+err;
        wx.showToast({ title: msg, icon: 'none' })
        console.error(err)
      }
    })
  },
  joinRoom(params) {
    wx.cloud.callFunction({
      name: 'joinRoom',
      data: {
        ...params,
        userInfo: app.globalData.userInfo
      },
      success: res => {
        if (res.result.code !== 0) {
          wx.showToast({
            title: res.result.msg,
            icon: 'none'
          })
        }
      },
    fail: err => {
        var msg = "登录失败"+err;
        wx.showToast({ title: msg, icon: 'none' })
        console.error(err)
      }
    })
  },
  // 进入房间：拉取房间信息、用户列表、记录
  enterRoom() {
    const { roomId } = this.data
    // 监听房间信息变化（实时）
    db.collection('rooms').doc(roomId).watch({
      onChange: snapshot => {
        const roomData = snapshot.docs[0];
        this.setData({
          currentRoom: roomData,
          isOwner: roomData.creator==this.data.myOpenid,
          teaMoney: roomData.teaMoney || 0 // 茶水间金额
        });
        this.reloadSettleResult(roomData.settleResult);
        this.sortRecordList(roomData.records);// 转账记录
        this.reloadUserList(roomData.members); // 用户列表
        // 自己排在第一个
        this.sortUserList();
        if(roomData.toTransfer){
          if(roomData.toTransfer.to === this.data.myOpenid){
            this.speckText("收到一笔记账，数额为"+roomData.toTransfer.amount);
          }
        }
        // ✅ 找出最新互动
        const last = roomData.interactions
        if (last && last.toOpenid ===this.data.myOpenid) {
          this.showInteraction(last)
          db.collection('rooms').doc(roomId).update({
            data: {
              interactions: db.command.set({})
            },
            success: () => {
            }
          });
        }
      },
      onError: err => {
        wx.showToast({ title: '监听房间失败', icon: 'none' })
        wx.navigateTo({
          url: `/pages/index/index`
        })
      }
    })
  },
  reloadSettleResult(setl){
    if(setl){
      const settleResult = setl.map(u => ({
        ...u,
        fromName: Remark.get(u.from) || u.fromName,
        toName: Remark.get(u.to) || u.toName,
      }))
      this.setData({
        settleResult
      })
    }
  },
  reloadUserList(user){
    if(user){
      const userList = user.map(u => ({
        ...u,
        remark: Remark.get(u.openid)
      }))
      this.setData({
        userList
      })
    }
  },
  speckText(msg){
    wx.cloud.callFunction({
      name: "ttsTextToVoice",
      data: {
        text: msg
      },
      success: (res) => {
        const base64Audio = res.result.Audio;
        console.log("paly audio");
        this.playAudio(res.result.Audio);
        
      },
      fail: console.error
    });
  },audioCtx: null,
  playAudio(base64Audio) {
    const fs = wx.getFileSystemManager();
    // 文件名
    const fileName = `tts_${Date.now()}.mp3`;
    const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;
    // Base64 → ArrayBuffer
    const buffer = wx.base64ToArrayBuffer(base64Audio);
    // 写入文件
    fs.writeFile({
      filePath,
      data: buffer,
      encoding: "binary",
      success() {
        if(this.audioCtx==null){
          this.audioCtx = wx.createInnerAudioContext();
        }
        this.audioCtx.src = filePath;
        this.audioCtx.autoplay = true;
        this.audioCtx.onPlay(() => {
          console.log("▶️ 开始播放");
        });
        this.audioCtx.onError((err) => {
          console.error("播放失败", err);
        });
        this.audioCtx.onEnded(() => {
          console.log('✅ 播放结束')
          audioCtx.destroy();
        });
      },
      fail: console.error,
    });
  },
  sortRecordList(recordList){
    if(recordList){
      const r = recordList
        .map(r => ({
          ...r,
          fromName: Remark.get(r.from) || r.fromName,
          targetNickname: Remark.get(r.to) || r.targetNickname,
          isSelf: r.from === this.data.myOpenid,
          isReceptSelf: r.to === this.data.myOpenid
        }))
        this.setData({ recordList:r })
    }
  },
  // 排序：自己在前，其他人按加入顺序
  sortUserList() {
    const { userList, myOpenid } = this.data
    if(userList){
      userList.sort((a, b) => {
        if (a.openid === myOpenid) return -1
        if (b.openid === myOpenid) return 1
        return a.joinTime - b.joinTime // 按加入时间升序
      })
      this.setData({ userList })
    }
  },

  // 点击用户头像：转账（或给自己记账）
  onUserTap(e) {
    const { openid } = e.currentTarget.dataset
    if (openid === this.data.myOpenid) {
      // 点击自己：修改名称
      this.editNickname()
    } else {
      // 点击他人：发起转账
      this.showTransferModal(openid)
    }
  },

  // 长按用户头像：备注
  onUserLongPress(e) {
    const { openid,nickname } = e.currentTarget.dataset
    wx.showActionSheet({
      itemList: ['修改备注', '发送互动'],
      success: res => {
        if (res.tapIndex === 0) {
          wx.showModal({
          title: '修改备注',
          content: '',
          editable: true,
          success: res => {
            if (res.confirm && res.content.trim()) {
              this.updateRemark(openid, res.content.trim())
            }
          }
        })
        }
        if (res.tapIndex === 1) {
          this.showInteractionMenu(openid, nickname)
        }
      }
    })
  },

  // 修改自己的名称
  editNickname() {
    wx.showModal({
      title: '修改自己的昵称',
      content: '',
      editable: true,
      success: res => {
        if (res.confirm && res.content.trim()) {
          this.updateMyNickname(res.content.trim())
        }
      }
    })
  },

  // 更新自己的昵称（更新 rooms 中的 members）
  updateMyNickname(newNickname) {
    const { roomId, myOpenid, userList } = this.data
    const newMembers = userList.map(user => {
      if (user.openid === myOpenid) {
        return { ...user, nickName: newNickname }
      }
      return user
    })

    db.collection('rooms').doc(roomId).update({
      data: { members: newMembers },
      success: () => {
        wx.showToast({ title: '昵称修改成功', icon: 'success' })
        this.setData({ userList: newMembers })
      },
      fail: err => {
        wx.showToast({ title: '昵称修改失败', icon: 'none' })
        console.error(err)
      }
    })
    wx.cloud.callFunction({
      name: 'updateNickName',
      data: {
        nickName: newNickname
      },
      success: res => {
        wx.hideLoading()
        app.globalData.userInfo.nickName = newNickname;
        this.setData({
          userInfo: app.globalData.userInfo
        });
      },
      fail: err => {
        wx.hideLoading()
        console.error(err)
        wx.showToast({ title: '修改名称失败', icon: 'none' })
      }
    })

  },

  // 更新用户备注（仅自己可见，存到本地或云端）
  updateRemark(openid, remark) {
    const {  userList,recordList } = this.data
    // wx.setStorageSync(`remark_${roomId}_${openid}`, remark)
    Remark.set(openid, remark)
    wx.showToast({ title: '备注成功', icon: 'success' })
    this.reloadUserList(userList);
    this.sortRecordList(recordList);
  },

  // 显示转账弹窗
  showTransferModal(targetOpenid) {
    this.setData({showAmountDialog:true,transOpenid:targetOpenid,setTea:false});
    // wx.showModal({
    //   title: '请输入转账金额',
    //   content: '',
    //   editable: true,
    //   success: res => {
    //     if (res.confirm) {
    //       const amount = parseFloat(res.content)
    //       if (isNaN(amount) || amount <= 0) {
    //         wx.showToast({ title: '请输入有效金额', icon: 'none' })
    //         return
    //       }
    //       this.doTransfer(targetOpenid, amount)
    //     }
    //   }
    // })
  },
  onAmountConfirm(res){
    const{transOpenid,setTea} = this.data
    if(setTea){
      this.updateTeaMoney(res.detail.amount)
    }else{
      this.doTransfer(transOpenid, res.detail.amount);
    }
  },
  // 执行转账（更新双方分数、添加记录）
  doTransfer(targetOpenid, amount) {
    const { roomId, myOpenid, userList } = this.data
    const targetUser = userList.find(u => u.openid === targetOpenid)
    const myUser = userList.find(u => u.openid === myOpenid)

    wx.showLoading({ title: '转账中...' })

    wx.cloud.callFunction({
      name: 'doTransfer',
      data: {
        roomId,
        from: myOpenid,
        fromName: myUser.nickName,
        to: targetOpenid,
        targetNickname: targetUser.nickName,
        amount
      },
      success: res => {
        wx.hideLoading()
        if (res.result.code === 0) {
          wx.showToast({ title: '转账成功', icon: 'success' })
        } else {
          wx.showToast({ title: res.result.msg || '转账失败', icon: 'none' })
        }
      },
      fail: () => {
        wx.hideLoading()
        wx.showToast({ title: '网络错误', icon: 'none' })
      }
    })

    // // 计算新的分数
    // const newMyScore = myUser.score - amount
    // const newTargetScore = targetUser.score + amount

    // // 更新成员分数
    // const newMembers = userList.map(user => {
    //   if (user.openid === myOpenid) {
    //     return { ...user, score: newMyScore }
    //   }
    //   if (user.openid === targetOpenid) {
    //     return { ...user, score: newTargetScore }
    //   }
    //   return user
    // })

    // // 添加转账记录
    // const newRecord = {
    //   _id: Date.now().toString(),
    //   type: 'transfer',
    //   from: myOpenid,
    //   to: targetOpenid,
    //   fromName: myUser.nickName,
    //   amount: amount, // 自己支出（负），对方收入（正）
    //   targetNickname: targetUser.nickName,
    //   avatarUrl: myUser.avatarUrl,
    //   time: this.formatTime(new Date())
    // }

    // // 更新房间数据
    // db.collection('rooms').doc(roomId).update({
    //   data: {
    //     members: newMembers,
    //     records: [newRecord,...this.data.recordList],
    //     toTransfer: newRecord
    //   },
    //   success: () => {
    //     wx.showToast({ title: '转账成功', icon: 'success' })
    //     this.setData({
    //       userList: newMembers,
    //     });
    //     const recordList = this.data.recordList.map(r => ({
    //       ...r,
    //       isSelf: r.from === myOpenid
    //     }));
    //     this.setData({ recordList })
    //   },
    //   fail: err => {
    //     wx.showToast({ title: '转账失败', icon: 'none' })
    //     console.error(err)
    //   }
    // })
  },

  // 邀请用户
  inviteUser() {
    wx.showLoading({ title: '生成中...' })
  
    wx.cloud.callFunction({
      name: 'getRoomQRCode',
      data: { shortId: this.data.shortId },
      success: res => {
        wx.hideLoading()
        const qrUrl = res.result.qrBase64
        // ✅ 直接显示
        this.setData({ qrUrl })
      },
      fail: err => {
        wx.hideLoading()
        console.error(err)
        wx.showToast({ title: '生成失败', icon: 'none' })
      }
    })
  },

  // 打开茶水间
  openTeaRoom() {
    this.setData({showAmountDialog:true,setTea:true});
    // wx.showModal({
    //   title: '茶水间',
    //   content: `当前茶水间金额：¥${this.data.teaMoney}`,
    //   success: res => {
    //     if (res.confirm) {
    //       // 这里可以扩展：喝茶扣费逻辑
    //       wx.showToast({ title: '喝水扣费1元（示例）', icon: 'none' })
    //       this.updateTeaMoney(-1)
    //     }
    //   }
    // })
  },

  // 更新茶水间金额
  updateTeaMoney(change) {
    const { roomId, teaMoney ,myOpenid, userList} = this.data
    const newTeaMoney = teaMoney + change

    const myUser = userList.find(u => u.openid === myOpenid)

    // 计算新的分数
    const newMyScore = myUser.score - change

    // 更新成员分数
    const newMembers = userList.map(user => {
      if (user.openid === myOpenid) {
        return { ...user, score: newMyScore }
      }
      return user
    })

    db.collection('rooms').doc(roomId).update({
      data: { teaMoney: newTeaMoney,
        members: newMembers
       },
      success: () => {
        this.setData({ teaMoney: newTeaMoney })
      },
      fail: err => {
        wx.showToast({ title: '更新茶水间失败', icon: 'none' })
        console.error(err)
      }
    })
  },
  // 格式化时间
  formatTime(date) {
    const d = new Date(date)
    const pad = n => n.toString().padStart(2, '0')

    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  },

  // 返回上一页
  goBack() {
    wx.navigateBack()
  },

  // 打开设置
  openSetting() {
    wx.showModal({
      title: '房间设置',
      content: '房间设置功能开发中',
      showCancel: false
    })
  },

  // 更多操作
  openMore() {
    wx.showActionSheet({
      itemList: ['退出房间', '清空记录', '分享房间'],
      success: res => {
        if (res.tapIndex === 0) {
          this.exitRoom()
        } else if (res.tapIndex === 1) {
          this.clearRecords()
        } else if (res.tapIndex === 2) {
          this.shareRoom()
        }
      }
    })
  },

  // 打开二维码
  openQR() {
    wx.showToast({
      title: '二维码功能开发中',
      icon: 'none'
    })
  },

  // 退出房间
  exitRoom() {
    wx.showModal({
      title: '退出房间',
      content: '确定要退出当前房间吗？',
      success: res => {
        if (res.confirm) {
          const { roomId, myOpenid } = this.data

          db.collection('rooms').doc(roomId).update({
            data: {
              members: db.command.pull({ openid: myOpenid })
            },
            success: () => {
              wx.showToast({ title: '已退出房间', icon: 'success' })
              setTimeout(() => wx.navigateBack(), 1500)
            },
            fail: err => {
              console.error(err)
              wx.showToast({ title: '退出失败', icon: 'none' })
            }
          })
        }
      }
    })
  },

  // 清空记录
  clearRecords() {
    wx.showModal({
      title: '清空记录',
      content: '确定清空所有转账记录？',
      success: res => {
        if (res.confirm) {
          db.collection('rooms').doc(this.data.roomId).update({
            data: {
              records: []
            },
            success: () => {
              this.setData({ recordList: [] })
              wx.showToast({ title: '已清空', icon: 'success' })
            }
          })
        }
      }
    })
  },

  // 分享房间
  shareRoom() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    })
  },

  // 分享给好友
  onShareAppMessage() {
    return {
      title: '一起来打牌记账',
      path: `/pages/room/room?roomId=${this.data.roomId}`,
      imageUrl: '/images/share.png'
    }
  },
  closeQR() {
    this.setData({ qrUrl: '' })
  },
  onBackTap(){
    wx.navigateTo({
      url: `/pages/index/index`
    })
  },
  onSettleTap() {
    wx.showModal({
      title: '确认结算',
      content: '结算后将生成转账明细，房间将关闭，是否继续？',
      confirmText: '确认结算',
      cancelText: '再想想',
      success: (res) => {
        if (res.confirm) {
          this.goSettle()
        }
      }
    })
  },  
  goSettle() {
    const { roomId } = this.data
    wx.cloud.callFunction({
      name: 'settleRoom',
      data: {
        roomId: roomId
      },
      success: res => {
        console.log(res);
      }
    })
  },
  // 页面卸载，关闭监听
  onUnload() {
    if (this.watch) {
      this.watch.close()
    }
    if (this.audioCtx) {
      this.audioCtx.stop()
      this.audioCtx.destroy()
      this.audioCtx = null
    }
  },
  sendInteraction(toOpenid, toName, type) {
    const { roomId, myOpenid } = this.data
    const myName = app.globalData.userInfo.nickName;
    const interaction = {
      _id: Date.now().toString(),
      type,
      fromOpenid: myOpenid,
      fromName: myName,
      toOpenid,
      toName,
      time: new Date()
    }
    db.collection('rooms').doc(roomId).update({
      data: {
        interactions: interaction
      }
    })
  },
  showInteractionMenu(openid, nickname) {
    const list = Object.values(INTERACTION_TYPES).map(i => i.showLabel)
    wx.showActionSheet({
      itemList: list,
      success: res => {
        const type = Object.keys(INTERACTION_TYPES)[res.tapIndex]
        this.sendInteraction(openid, nickname, type)
      }
    })
  },
  showInteraction(interaction) {
    const cfg = INTERACTION_TYPES[interaction.type]
    wx.showToast({
      title: `${interaction.fromName} ${cfg.label}`,
      icon: 'none',
      duration: 2000
    })
    this.startFrameAnimation(cfg,interaction);
  },
  startFrameAnimation(cfg,source) {
    this.setData({ effect: { show: true } })
  wx.createSelectorQuery()
    .select('#effectCanvas')
    .node(res => {
      const canvas = res.node
      const ctx = canvas.getContext('2d')
      lottie.setup(canvas)

      this.ani = lottie.loadAnimation({
        loop: false,
        autoplay: true,
        animationData: ANI_MAP[cfg.type], // 关键：用 animationData
        rendererSettings: { context: ctx }
      });
      this.speckText(source.fromName+cfg.label);
      this.ani.addEventListener('complete', () => {
        this.setData({ effect: { show: false } })
        this.ani.destroy()
      })
    })
    .exec();
  }
})