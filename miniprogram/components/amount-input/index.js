Component({
  properties: {
    visible: Boolean,
    title: {
      type: String,
      value: '请输入转账金额'
    }
  },

  data: {
    value: '',
    quickAmounts: [1, 3,5,8, 10]
  },

  methods: {
    onInput(e) {
      let val = e.detail.value

      // ✅ 只允许数字 + 一个小数点
      val = val.replace(/[^0-9.]/g, '')
      if ((val.match(/\./g) || []).length > 1) {
        val = val.substring(0, val.lastIndexOf('.'))
      }

      this.setData({ value: val })
    },

    onQuick(e) {
      this.setData({
        value: String(e.currentTarget.dataset.amount)
      })
    },

    confirm() {
      const amount = parseFloat(this.data.value)

      if (!amount || amount <= 0) {
        wx.showToast({ title: '请输入有效金额', icon: 'none' })
        return
      }

      this.triggerEvent('confirm', { amount })
      this.close()
    },

    cancel() {
      this.triggerEvent('cancel')
      this.close()
    },

    close() {
      this.setData({ visible: false, value: '' })
    }
  }
})