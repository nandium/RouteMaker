// Copyright 2025 The Sparkling Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

#import "LynxInput.h"
#import <Lynx/LynxComponentRegistry.h>
#import <Lynx/LynxPropsProcessor.h>
#import <Lynx/LynxUIOwner.h>
#import "UIHelper.h"

@implementation LynxTextField

- (void)setPadding:(UIEdgeInsets)padding {
  _padding = padding;
  [self setNeedsLayout];
}

- (CGRect)textRectForBounds:(CGRect)bounds {
  CGFloat x = self.padding.left;
  CGFloat y = self.padding.top;
  CGFloat width = bounds.size.width - self.padding.left - self.padding.right;
  CGFloat height = bounds.size.height - self.padding.top - self.padding.bottom;

  return CGRectMake(x, y, width, height);
}

- (CGRect)editingRectForBounds:(CGRect)bounds {
  return [self textRectForBounds:bounds];
}
@end

@implementation LynxInput

- (UITextField *)createView {
  UITextField *textField = [[LynxTextField alloc] init];
  textField.autoresizesSubviews = NO;
  textField.clipsToBounds = YES;
  textField.delegate = self;
  textField.secureTextEntry = NO;
  textField.font = [UIFont systemFontOfSize:14];
  [[NSNotificationCenter defaultCenter] addObserver:self
                                           selector:@selector(textFieldDidChange:)
                                               name:UITextFieldTextDidChangeNotification
                                             object:textField];

  return textField;
}

- (void)layoutDidFinished {
  self.view.padding = self.padding;
}

LYNX_PROP_SETTER("value", setValue, NSString *) {
  NSString *nextValue = value ?: @"";
  if (![self.view.text isEqualToString:nextValue]) {
    self.view.text = nextValue;
  }
}

LYNX_PROP_SETTER("placeholder", setPlaceholder, NSString *) { self.view.placeholder = value; }

LYNX_PROP_SETTER("type", setType, NSString *) {
  self.view.secureTextEntry = [value isEqualToString:@"password"];
  if ([value isEqualToString:@"email"]) {
    self.view.keyboardType = UIKeyboardTypeEmailAddress;
  } else if ([value isEqualToString:@"number"] || [value isEqualToString:@"digit"]) {
    self.view.keyboardType = UIKeyboardTypeNumberPad;
  } else if ([value isEqualToString:@"tel"]) {
    self.view.keyboardType = UIKeyboardTypePhonePad;
  } else {
    self.view.keyboardType = UIKeyboardTypeDefault;
  }
}

LYNX_PROP_SETTER("confirm-type", setConfirmType, NSString *) {
  if ([value isEqualToString:@"send"]) {
    self.view.returnKeyType = UIReturnKeySend;
  } else if ([value isEqualToString:@"search"]) {
    self.view.returnKeyType = UIReturnKeySearch;
  } else if ([value isEqualToString:@"go"]) {
    self.view.returnKeyType = UIReturnKeyGo;
  } else if ([value isEqualToString:@"next"]) {
    self.view.returnKeyType = UIReturnKeyNext;
  } else {
    self.view.returnKeyType = UIReturnKeyDone;
  }
}

LYNX_PROP_SETTER("text-color", setTextColor, NSString *) {
  UIColor *textColor = [UIHelper colorWithHexString:value];
  self.view.textColor = textColor;

  UIColor *placeholderColor = [textColor colorWithAlphaComponent:0.25];
  if (@available(iOS 13.0, *)) {
    NSAttributedString *attributedPlaceholder = [[NSAttributedString alloc]
        initWithString:self.view.placeholder ?: @""
            attributes:@{NSForegroundColorAttributeName : placeholderColor}];
    self.view.attributedPlaceholder = attributedPlaceholder;
  } else {
    [self.view setValue:placeholderColor forKeyPath:@"_placeholderLabel.textColor"];
  }
}

- (void)textFieldDidChange:(NSNotification *)notification {
  [self emitEvent:@"input"
           detail:@{
             @"value" : [self.view text] ?: @"",
           }];
}

LYNX_UI_METHOD(focus) {
  if ([self.view becomeFirstResponder]) {
    callback(kUIMethodSuccess, nil);
  } else {
    callback(kUIMethodUnknown, @"fail to focus");
  }
}

- (void)textFieldDidEndEditing:(UITextField *)textField {
  [self emitEvent:@"blur" detail:@{@"value" : [self.view text] ?: @""}];
}

- (BOOL)textFieldShouldReturn:(UITextField *)textField {
  [self emitEvent:@"confirm" detail:@{@"value" : [self.view text] ?: @""}];
  return YES;
}

- (void)emitEvent:(NSString *)name detail:(NSDictionary *)detail {
  LynxCustomEvent *eventInfo = [[LynxDetailEvent alloc] initWithName:name
                                                          targetSign:[self sign]
                                                              detail:detail];
  [self.context.eventEmitter dispatchCustomEvent:eventInfo];
}

@end
