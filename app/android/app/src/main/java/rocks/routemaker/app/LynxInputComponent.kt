// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
package rocks.routemaker.app

import android.content.Context
import android.graphics.Color
import android.text.Editable
import android.text.InputType
import android.text.TextWatcher
import android.view.Gravity
import android.view.View
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import androidx.appcompat.widget.AppCompatEditText
import com.lynx.react.bridge.Callback
import com.lynx.react.bridge.ReadableMap
import com.lynx.tasm.behavior.LynxContext
import com.lynx.tasm.behavior.LynxProp
import com.lynx.tasm.behavior.LynxUIMethod
import com.lynx.tasm.behavior.LynxUIMethodConstants
import com.lynx.tasm.behavior.ui.LynxUI
import com.lynx.tasm.event.LynxCustomEvent


class LynxInputComponent(context: LynxContext?) : LynxUI<AppCompatEditText>(context) {

  override fun createView(context: Context): AppCompatEditText {
    return AppCompatEditText(context).apply {
      setLines(1)
      setSingleLine()
      gravity = Gravity.CENTER_VERTICAL
      background = null
      imeOptions = EditorInfo.IME_ACTION_NONE
      setHorizontallyScrolling(true)
      setPadding(0, 0, 0, 0)
      setOnEditorActionListener { _, actionId, event ->
        val submitted = actionId != EditorInfo.IME_ACTION_NONE ||
          (event?.keyCode == android.view.KeyEvent.KEYCODE_ENTER)
        if (submitted) emitEvent("confirm", null)
        submitted
      }
      addTextChangedListener(object : TextWatcher {
        override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
        override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
        override fun afterTextChanged(s: Editable?) {
          emitEvent("input", mapOf("value" to (s?.toString() ?: "")))
        }
      })
      onFocusChangeListener = View.OnFocusChangeListener { _, hasFocus ->
        if (!hasFocus) {
          emitEvent("blur", null)
        }
      }
    }
  }

  override fun onLayoutUpdated() {
    super.onLayoutUpdated()
    val paddingTop = mPaddingTop + mBorderTopWidth
    val paddingBottom = mPaddingBottom + mBorderBottomWidth
    val paddingLeft = mPaddingLeft + mBorderLeftWidth
    val paddingRight = mPaddingRight + mBorderRightWidth
    mView.setPadding(paddingLeft, paddingTop, paddingRight, paddingBottom)
  }

  @LynxProp(name = "value")
  fun setValue(value: String) {
    if (value != mView.text.toString()) {
      mView.setText(value)
    }
  }

  @LynxUIMethod
  @Suppress("UNUSED_PARAMETER")
  fun focus(_params: ReadableMap, callback: Callback) {
    if (mView.requestFocus()) {
      if (showSoftInput()) {
        callback.invoke(LynxUIMethodConstants.SUCCESS)
      } else {
        callback.invoke(LynxUIMethodConstants.UNKNOWN, "fail to show keyboard")
      }
    } else {
      callback.invoke(LynxUIMethodConstants.UNKNOWN, "fail to focus")
    }
  }

  private fun showSoftInput(): Boolean {
    val imm = lynxContext.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
    return imm.showSoftInput(mView, InputMethodManager.SHOW_IMPLICIT)
  }

  @LynxProp(name = "placeholder")
  fun setPlaceHolder(value: String) {
    mView.hint = value
  }

  @LynxProp(name = "confirm-type")
  fun setConfirmType(value: String) {
    mView.imeOptions = when (value) {
      "send" -> EditorInfo.IME_ACTION_SEND
      "search" -> EditorInfo.IME_ACTION_SEARCH
      "go" -> EditorInfo.IME_ACTION_GO
      "next" -> EditorInfo.IME_ACTION_NEXT
      "done" -> EditorInfo.IME_ACTION_DONE
      else -> EditorInfo.IME_ACTION_NONE
    }
  }

  @LynxProp(name = "type")
  fun setType(value: String) {
    mView.inputType =
      when (value) {
        "password" -> InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
        "email" -> InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
        "number", "digit" -> InputType.TYPE_CLASS_NUMBER
        "tel" -> InputType.TYPE_CLASS_PHONE
        else -> InputType.TYPE_CLASS_TEXT
      }
  }

  @LynxProp(name = "text-color")
  fun setTextColor(value: String) {
    var normalized = value
    if (normalized.startsWith("#")) {
      normalized = normalized.substring(1)
    }
    val textColor = "#" + normalized
    val hintColor = "#40" + normalized
    mView.setHintTextColor(Color.parseColor(hintColor))
    mView.setTextColor(Color.parseColor(textColor))
  }



  private fun emitEvent(name: String, value: Map<String, Any>?) {
    val detail = LynxCustomEvent(sign, name)
    value?.forEach { (key, v) -> detail.addDetail(key, v) }
    lynxContext.eventEmitter.sendCustomEvent(detail)
  }
}
